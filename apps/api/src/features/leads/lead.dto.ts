import { z } from "zod";
import { Types } from "mongoose";
import { STATUSES, LEAD_TYPES, DEAD_REASONS, type LeadType, type Status, type DeadReason } from "./lead.rules.js";
import type { LeadDoc } from "./lead.model.js";
import { buildMessage, waLink, type Touch } from "../messaging/message.template.js";
import { env } from "../../core/env.js";

/** Shape returned to the client. Dates become ISO strings, _id becomes a string. */
export interface LeadDTO {
  _id: string;
  name: string;
  phone: string;
  waNumber: string | null;
  leadType: LeadType;
  score: number;
  status: Status;
  rating: number;
  reviews: number;
  area: string;
  category: string;
  address: string;
  websiteUrl: string;
  mapsUrl: string;
  source: string;
  keyword: string;
  notes: string;
  deadReason: DeadReason | null;
  touches: number;
  sentAt: string | null;
  repliedAt: string | null;
  nextFollowUpAt: string | null;
  createdAt: string;
  updatedAt: string;

  /**
   * The next message, precomputed. Carried on every lead so the list can offer
   * a one-tap WhatsApp button without a round-trip per card — a link's href
   * has to exist at click time, so it cannot be fetched on tap.
   */
  nextTouch: Touch;
  nextMessage: string;
  waUrl: string | null;
}

type LeanLead = LeadDoc & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };

export function toLeadDTO(doc: LeanLead): LeadDTO {
  const nextTouch = Math.min(3, (doc.touches ?? 0) + 1) as Touch;
  const nextMessage = buildMessage(
    {
      name: doc.name,
      area: doc.area ?? "",
      rating: doc.rating ?? 0,
      reviews: doc.reviews ?? 0,
      leadType: doc.leadType as LeadType,
    },
    env.SENDER_SIGNATURE,
    nextTouch,
  );

  return {
    nextTouch,
    nextMessage,
    waUrl: doc.waNumber ? waLink(doc.waNumber, nextMessage) : null,
    _id: doc._id.toString(),
    name: doc.name,
    phone: doc.phone,
    waNumber: doc.waNumber ?? null,
    leadType: doc.leadType as LeadType,
    score: doc.score,
    status: doc.status as Status,
    rating: doc.rating ?? 0,
    reviews: doc.reviews ?? 0,
    area: doc.area ?? "",
    category: doc.category ?? "",
    address: doc.address ?? "",
    websiteUrl: doc.websiteUrl ?? "",
    mapsUrl: doc.mapsUrl ?? "",
    source: doc.source ?? "",
    keyword: doc.keyword ?? "",
    notes: doc.notes ?? "",
    deadReason: (doc.deadReason ?? null) as DeadReason | null,
    touches: doc.touches ?? 0,
    sentAt: doc.sentAt?.toISOString() ?? null,
    repliedAt: doc.repliedAt?.toISOString() ?? null,
    nextFollowUpAt: doc.nextFollowUpAt?.toISOString() ?? null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export const listQuerySchema = z.object({
  status: z.enum([...STATUSES, "ALL"]).default("ALL"),
  leadType: z.enum([...LEAD_TYPES, "ALL"]).default("ALL"),
  area: z.string().trim().optional(),
  minScore: z.coerce.number().min(0).max(100).optional(),
  search: z.string().trim().max(120).optional(),
  dueOnly: z
    .union([z.boolean(), z.string()])
    .transform((v) => v === true || v === "true")
    .default(false),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  sort: z.enum(["score", "reviews", "recent"]).default("score"),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export const updateLeadSchema = z.object({
  status: z.enum(STATUSES).optional(),
  notes: z.string().max(4000).optional(),
  deadReason: z.enum(DEAD_REASONS).nullable().optional(),
  nextFollowUpAt: z.coerce.date().nullable().optional(),
});

export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

export interface LeadListResult {
  leads: LeadDTO[];
  total: number;
  page: number;
  pages: number;
}
