import Papa from "papaparse";
import { HttpError } from "../../core/http.js";
import { Lead } from "../leads/lead.model.js";
import { Event } from "../events/event.model.js";
import { classifyWebsite, scoreLead, normalisePhone, waNumber } from "../leads/lead.rules.js";
import { detectColumns, isClosed } from "./csv.columns.js";

export interface ImportResult {
  fileName: string;
  rowsRead: number;
  inserted: number;
  updated: number;
  dropped: {
    hasWebsite: number;
    noPhone: number;
    closed: number;
    duplicate: number;
    unusable: number;
  };
  detectedColumns: Record<string, string>;
}

type Row = Record<string, string>;

export async function importCsv(buffer: Buffer, fileName: string): Promise<ImportResult> {
  const text = buffer.toString("utf8").replace(/^﻿/, "");
  const parsed = Papa.parse<Row>(text, { header: true, skipEmptyLines: true });

  const rows = parsed.data;
  const headers = parsed.meta.fields ?? [];
  if (!rows.length || !headers.length) {
    throw new HttpError(400, "That CSV has no readable rows.");
  }

  const cols = detectColumns(headers);
  if (!cols.name) {
    throw new HttpError(400, `No business-name column found. Columns seen: ${headers.join(", ")}`);
  }
  if (!cols.phone) {
    throw new HttpError(400, `No phone column found. Columns seen: ${headers.join(", ")}`);
  }

  const result: ImportResult = {
    fileName,
    rowsRead: rows.length,
    inserted: 0,
    updated: 0,
    dropped: { hasWebsite: 0, noPhone: 0, closed: 0, duplicate: 0, unusable: 0 },
    detectedColumns: cols,
  };

  const seenInFile = new Set<string>();
  const ops: Parameters<typeof Lead.bulkWrite>[0] = [];

  for (const row of rows) {
    const get = (field: string) => {
      const col = cols[field];
      return col ? String(row[col] ?? "").trim() : "";
    };

    const name = get("name");
    if (!name) {
      result.dropped.unusable++;
      continue;
    }
    if (cols.closed && isClosed(row[cols.closed])) {
      result.dropped.closed++;
      continue;
    }

    const phone = get("phone");
    const phoneKey = normalisePhone(phone);
    if (!phoneKey || phoneKey.length < 10) {
      result.dropped.noPhone++;
      continue;
    }
    if (seenInFile.has(phoneKey)) {
      result.dropped.duplicate++;
      continue;
    }
    seenInFile.add(phoneKey);

    const websiteUrl = get("website");
    const leadType = classifyWebsite(websiteUrl);
    if (leadType === "HAS_WEBSITE") {
      result.dropped.hasWebsite++;
      continue;
    }

    const rating = Number.parseFloat(get("rating")) || 0;
    const reviews = Number.parseInt(get("reviews"), 10) || 0;

    ops.push({
      updateOne: {
        filter: { phoneKey },
        update: {
          // Re-importing refreshes the listing data but must never reset your
          // outreach progress, so status/touches/notes are insert-only.
          $set: {
            name,
            phone,
            waNumber: waNumber(phone),
            leadType,
            score: scoreLead({ phone, reviews, rating }, leadType),
            rating,
            reviews,
            area: get("area"),
            category: get("category"),
            address: get("address"),
            websiteUrl: leadType === "SOCIAL_ONLY" ? websiteUrl : "",
            mapsUrl: get("mapsUrl"),
            keyword: get("keyword"),
            source: fileName,
          },
          $setOnInsert: { phoneKey, status: "NEW", touches: 0, notes: "" },
        },
        upsert: true,
      },
    });
  }

  if (ops.length) {
    const write = await Lead.bulkWrite(ops, { ordered: false });
    result.inserted = write.upsertedCount;
    result.updated = write.modifiedCount;

    const upsertedIds = Object.values(write.upsertedIds ?? {});
    if (upsertedIds.length) {
      await Event.insertMany(
        upsertedIds.map((id) => ({ leadId: id, type: "IMPORTED" as const, note: fileName })),
        { ordered: false },
      );
    }
  }

  return result;
}
