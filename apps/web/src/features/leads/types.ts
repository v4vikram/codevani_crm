/**
 * Mirrors the API's lead contract. Deliberately duplicated rather than shared
 * so the two apps can be deployed and versioned independently.
 */

export const LEAD_TYPES = ["NO_WEBSITE", "SOCIAL_ONLY", "HAS_WEBSITE"] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

export const STATUSES = ["NEW", "SENT", "REPLIED", "INTERESTED", "WON", "DEAD"] as const;
export type Status = (typeof STATUSES)[number];

export const DEAD_REASONS = [
  "no_reply",
  "not_interested",
  "already_has_site",
  "too_expensive",
  "wrong_person",
  "asked_to_stop",
  "other",
] as const;
export type DeadReason = (typeof DEAD_REASONS)[number];

export interface Lead {
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

  /** Precomputed by the API so the list can offer one-tap WhatsApp. */
  nextTouch: 1 | 2 | 3;
  nextMessage: string;
  waUrl: string | null;
}

export interface LeadEvent {
  _id: string;
  leadId: string;
  type: "IMPORTED" | "MESSAGE_SENT" | "STATUS_CHANGED" | "NOTE_ADDED";
  touch: number | null;
  from: string;
  to: string;
  note: string;
  at: string;
}

export interface LeadListResult {
  leads: Lead[];
  total: number;
  page: number;
  pages: number;
}

export interface LeadFilters {
  status?: Status | "ALL";
  leadType?: LeadType | "ALL";
  area?: string;
  minScore?: number;
  search?: string;
  dueOnly?: boolean;
  page?: number;
  limit?: number;
  sort?: "score" | "reviews" | "recent";
}

export interface NextMessage {
  message: string;
  touch: 1 | 2 | 3;
  waUrl: string | null;
}

export interface TodayUsage {
  sentToday: number;
  cap: number;
}

/** Labels and colours for each pipeline stage, used across the UI. */
export const STATUS_META: Record<Status, { label: string; className: string }> = {
  NEW: { label: "New", className: "bg-muted text-muted-foreground" },
  SENT: { label: "Sent", className: "bg-primary/15 text-primary" },
  REPLIED: { label: "Replied", className: "bg-warning/20 text-warning" },
  INTERESTED: { label: "Interested", className: "bg-warning/25 text-warning" },
  WON: { label: "Won", className: "bg-success/20 text-success" },
  DEAD: { label: "Dead", className: "bg-destructive/15 text-destructive" },
};

export const LEAD_TYPE_META: Record<LeadType, { label: string; className: string }> = {
  NO_WEBSITE: { label: "no website", className: "bg-warning/20 text-warning" },
  SOCIAL_ONLY: { label: "social only", className: "bg-primary/15 text-primary" },
  HAS_WEBSITE: { label: "has website", className: "bg-muted text-muted-foreground" },
};

export const DEAD_REASON_LABELS: Record<DeadReason, string> = {
  no_reply: "No reply",
  not_interested: "Not interested",
  already_has_site: "Already has a site",
  too_expensive: "Too expensive",
  wrong_person: "Wrong person",
  asked_to_stop: "Asked to stop",
  other: "Other",
};
