import { Types, type QueryFilter } from "mongoose";
import { env } from "../../core/env.js";
import { HttpError } from "../../core/http.js";
import { Lead, type LeadDoc } from "./lead.model.js";
import { Event } from "../events/event.model.js";
import {
  toLeadDTO,
  type LeadDTO,
  type LeadListResult,
  type ListQuery,
  type UpdateLeadInput,
} from "./lead.dto.js";

type LeanLead = LeadDoc & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };

const SORTS = {
  score: { score: -1, reviews: -1 },
  reviews: { reviews: -1, score: -1 },
  recent: { updatedAt: -1 },
} as const;

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function buildFilter(q: ListQuery): QueryFilter<LeadDoc> {
  const filter: QueryFilter<LeadDoc> = {};

  if (q.status !== "ALL") filter.status = q.status;
  if (q.leadType !== "ALL") filter.leadType = q.leadType;
  if (q.area) filter.area = q.area;
  if (q.minScore !== undefined) filter.score = { $gte: q.minScore };
  if (q.search) filter.name = { $regex: escapeRegex(q.search), $options: "i" };

  // The follow-up queue overrides any status filter: it is defined as
  // "already contacted, not yet closed, and due".
  if (q.dueOnly) {
    filter.nextFollowUpAt = { $lte: new Date() };
    filter.status = { $in: ["SENT", "REPLIED", "INTERESTED"] };
  }
  return filter;
}

export async function listLeads(q: ListQuery): Promise<LeadListResult> {
  const filter = buildFilter(q);

  const [docs, total] = await Promise.all([
    Lead.find(filter)
      .sort(SORTS[q.sort])
      .skip((q.page - 1) * q.limit)
      .limit(q.limit)
      .lean<LeanLead[]>(),
    Lead.countDocuments(filter),
  ]);

  return {
    leads: docs.map(toLeadDTO),
    total,
    page: q.page,
    pages: Math.max(1, Math.ceil(total / q.limit)),
  };
}

export async function listAreas(): Promise<string[]> {
  const areas = await Lead.distinct("area", { area: { $nin: ["", null] } });
  return (areas as string[]).sort();
}

async function findOrThrow(id: string | undefined) {
  if (!id || !Types.ObjectId.isValid(id)) throw new HttpError(400, "Invalid lead id");
  const doc = await Lead.findById(id);
  if (!doc) throw new HttpError(404, "Lead not found");
  return doc;
}

export async function getLead(id: string | undefined) {
  const doc = await findOrThrow(id);
  const events = await Event.find({ leadId: doc._id }).sort({ at: -1 }).limit(50).lean();
  return { lead: toLeadDTO(doc.toObject() as LeanLead), events };
}

/**
 * The message to send next. Every lead already carries this (see toLeadDTO);
 * this endpoint stays for callers that hold only an id.
 */
export async function getNextMessage(id: string | undefined) {
  const doc = await findOrThrow(id);
  const dto = toLeadDTO(doc.toObject() as LeanLead);

  return { message: dto.nextMessage, touch: dto.nextTouch, waUrl: dto.waUrl };
}

export async function updateLead(id: string | undefined, input: UpdateLeadInput): Promise<LeadDTO> {
  const doc = await findOrThrow(id);
  const previousStatus = doc.status;

  if (input.status !== undefined) doc.status = input.status;
  if (input.notes !== undefined) doc.notes = input.notes;
  if (input.deadReason !== undefined) doc.deadReason = input.deadReason;
  if (input.nextFollowUpAt !== undefined) doc.nextFollowUpAt = input.nextFollowUpAt;

  // Stamp the timestamp the insights feature depends on.
  if (input.status === "REPLIED" && !doc.repliedAt) doc.repliedAt = new Date();
  // A closed lead should stop appearing in the follow-up queue.
  if (input.status === "WON" || input.status === "DEAD") doc.nextFollowUpAt = null;

  await doc.save();

  if (input.status && input.status !== previousStatus) {
    await Event.create({
      leadId: doc._id,
      type: "STATUS_CHANGED",
      from: previousStatus,
      to: input.status,
      note: input.deadReason ?? "",
    });
  } else if (input.notes !== undefined) {
    await Event.create({ leadId: doc._id, type: "NOTE_ADDED", note: input.notes.slice(0, 200) });
  }

  return toLeadDTO(doc.toObject() as LeanLead);
}

/**
 * Records that a message actually went out. This is the only moment we know a
 * touch happened -- the send itself occurs inside WhatsApp, where we cannot see it.
 */
export async function markSent(id: string | undefined): Promise<LeadDTO> {
  const doc = await findOrThrow(id);
  const touch = (doc.touches ?? 0) + 1;

  doc.touches = touch;
  doc.sentAt = new Date();
  if (doc.status === "NEW") doc.status = "SENT";
  // Stop chasing after the third touch -- past that it reads as harassment.
  doc.nextFollowUpAt =
    touch >= 3 ? null : new Date(Date.now() + env.FOLLOW_UP_DAYS * 86_400_000);

  await doc.save();
  await Event.create({ leadId: doc._id, type: "MESSAGE_SENT", touch });

  return toLeadDTO(doc.toObject() as LeanLead);
}

/** How many messages went out today, so the UI can enforce the daily cap. */
export async function getTodayUsage() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const sentToday = await Event.countDocuments({ type: "MESSAGE_SENT", at: { $gte: start } });
  return { sentToday, cap: env.DAILY_SEND_CAP };
}
