#!/usr/bin/env node
/**
 * Turn ANY business-listing CSV into a scored lead list.
 *
 * Built for Apify's Google Maps Scraper export, but the column detection is
 * loose on purpose so RERA downloads, JustDial exports and hand-made sheets
 * work too.
 *
 * Keeps only businesses with NO real website and a working phone number,
 * then ranks them by how much they look like a paying customer.
 *
 *   node score-leads.mjs apify-export.csv
 *   node score-leads.mjs apify-export.csv --out my-leads.csv
 *   node score-leads.mjs a.csv b.csv c.csv        # merge + dedupe several files
 *   node score-leads.mjs export.csv --keep-all    # don't drop firms with sites
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import path from "node:path";
import {
  classifyWebsite, scoreLead, normalisePhone, toCsv, parseCsv,
} from "./lead-rules.mjs";

/**
 * Candidate column names, best match first. Apify uses `title`/`website`/
 * `phone`; RERA and others use plainer names. Matching is case-insensitive
 * and ignores spaces/underscores.
 */
const COLUMNS = {
  name:     ["title", "name", "businessname", "companyname", "promotername", "displayname"],
  website:  ["website", "websiteuri", "url", "webaddress", "site"],
  phone:    ["phone", "phoneunformatted", "phonenumber", "mobile", "contact",
             "contactnumber", "nationalphonenumber", "telephone"],
  rating:   ["totalscore", "rating", "stars", "averagerating"],
  reviews:  ["reviewscount", "reviews", "usratingcount", "userratingcount",
             "numberofreviews", "reviewcount"],
  address:  ["address", "fulladdress", "street", "location", "registeredaddress"],
  area:     ["city", "neighborhood", "area", "locality", "district", "town"],
  category: ["categoryname", "category", "type", "primarytype",
             "primarytypedisplayname", "categories/0"],
  maps_url: ["url", "mapsurl", "googlemapsuri", "link", "placeurl"],
  closed:   ["permanentlyclosed", "temporarilyclosed", "businessstatus"],
};

const norm = (s) => String(s).toLowerCase().replace(/[\s_-]/g, "");

/** Map our field names -> the actual header present in this CSV. */
function detectColumns(headers) {
  const lookup = new Map(headers.map((h) => [norm(h), h]));
  const found = {};
  for (const [field, candidates] of Object.entries(COLUMNS)) {
    for (const c of candidates) {
      if (lookup.has(c)) { found[field] = lookup.get(c); break; }
    }
  }
  // `url` is Apify's Maps link, but a plainer sheet may mean the website.
  if (found.website === found.maps_url && found.website) {
    if (norm(found.website) === "url") delete found.website;
    else delete found.maps_url;
  }
  return found;
}

function isClosed(value) {
  const v = norm(value ?? "");
  return v === "true" || v === "yes" || v.includes("closed");
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: "string", default: "leads-scored.csv" },
      "keep-all": { type: "boolean", default: false },
      "allow-no-phone": { type: "boolean", default: false },
    },
  });

  if (!positionals.length) {
    console.error("Usage: node score-leads.mjs <export.csv> [more.csv ...] [--out leads.csv]");
    process.exit(1);
  }

  const leads = new Map();
  let totalRows = 0, dropped = { site: 0, phone: 0, closed: 0, dupe: 0 };

  for (const file of positionals) {
    if (!existsSync(file)) {
      console.error(`! not found: ${file}`);
      continue;
    }
    const rows = parseCsv(await readFile(file, "utf8"));
    if (!rows.length) {
      console.log(`${path.basename(file)}: empty`);
      continue;
    }

    const cols = detectColumns(Object.keys(rows[0]));
    if (!cols.name) {
      console.error(`! ${path.basename(file)}: no business-name column found.`);
      console.error(`  Headers were: ${Object.keys(rows[0]).join(", ")}`);
      continue;
    }
    console.log(`${path.basename(file)}: ${rows.length} rows, using ` +
      Object.entries(cols).map(([k, v]) => `${k}="${v}"`).join(", "));

    for (const r of rows) {
      totalRows++;
      const get = (f) => (cols[f] ? String(r[cols[f]] ?? "").trim() : "");

      const name = get("name");
      if (!name) continue;

      if (cols.closed && isClosed(r[cols.closed])) { dropped.closed++; continue; }

      const phone = get("phone");
      if (!phone && !values["allow-no-phone"]) { dropped.phone++; continue; }

      const website = get("website");
      const leadType = classifyWebsite(website);
      if (leadType === "HAS_WEBSITE" && !values["keep-all"]) { dropped.site++; continue; }

      const rating = parseFloat(get("rating")) || 0;
      const reviews = parseInt(get("reviews"), 10) || 0;

      const key = normalisePhone(phone) || norm(name);
      if (leads.has(key)) { dropped.dupe++; continue; }

      leads.set(key, {
        score: scoreLead({ phone, reviews, rating }, leadType),
        lead_type: leadType,
        name,
        phone,
        category: get("category"),
        area: get("area"),
        rating: rating || "",
        reviews,
        address: get("address"),
        social_or_listing_url: leadType === "SOCIAL_ONLY" ? website : "",
        maps_url: get("maps_url"),
        source: path.basename(file),
        status: "NEW",
        contacted_on: "",
        notes: "",
      });
    }
  }

  const rows = [...leads.values()].sort((a, b) => b.score - a.score || b.reviews - a.reviews);
  if (!rows.length) {
    console.log("\nNo leads survived filtering. Try --keep-all to see what was dropped.");
    return;
  }

  await writeFile(values.out, toCsv(rows), "utf8");

  const noSite = rows.filter((r) => r.lead_type === "NO_WEBSITE").length;
  const social = rows.filter((r) => r.lead_type === "SOCIAL_ONLY").length;
  const hot = rows.filter((r) => r.score >= 75).length;

  console.log(`\nRead ${totalRows} rows -> ${rows.length} leads -> ${values.out}`);
  console.log(`  ${noSite} no website at all, ${social} Facebook/JustDial only`);
  console.log(`  ${hot} scored 75+ (call these first)`);
  console.log(`  dropped: ${dropped.site} had real sites, ${dropped.phone} no phone, ` +
              `${dropped.closed} closed, ${dropped.dupe} duplicates`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
