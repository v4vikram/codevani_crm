/**
 * The rules that decide who is worth pitching, and how they are ranked.
 * This is the domain core of the whole product -- everything else is plumbing.
 */

export const LEAD_TYPES = ["NO_WEBSITE", "SOCIAL_ONLY", "HAS_WEBSITE"] as const;
export type LeadType = (typeof LEAD_TYPES)[number];

/** Pipeline stages, in the order a lead moves through them. */
export const STATUSES = ["NEW", "SENT", "REPLIED", "INTERESTED", "WON", "DEAD"] as const;
export type Status = (typeof STATUSES)[number];

/** Why a lead died. Collected purely so the insights feature has something real to read. */
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

/** A lead counts as "worked" once a message has actually gone out. */
export const SENT_STATUSES: Status[] = ["SENT", "REPLIED", "INTERESTED", "WON", "DEAD"];
export const REPLIED_STATUSES: Status[] = ["REPLIED", "INTERESTED", "WON"];

/**
 * A "website" on one of these is not a website. It is a directory listing or a
 * social page, which means the business still has nowhere of its own to send
 * customers -- the strongest pitch there is.
 */
const NOT_A_REAL_SITE = [
  "facebook.com", "fb.com", "fb.me", "instagram.com", "linktr.ee",
  "wa.me", "api.whatsapp.com", "justdial.com", "indiamart.com",
  "sulekha.com", "tradeindia.com", "urbanpro.com", "99acres.com",
  "magicbricks.com", "housing.com", "youtube.com", "linkedin.com",
  "x.com", "twitter.com", "business.site", "sites.google.com",
  "blogspot.com", "wordpress.com", "wixsite.com", "godaddysites.com",
  "webs.com", "weebly.com", "google.com", "maps.google.com",
];

/**
 * Exports write "no value" in all sorts of ways. Apify's Google Maps CSV puts
 * the literal string "undefined" in the website column, which would otherwise
 * parse as a hostname and silently drop the best leads.
 */
const EMPTYISH = new Set(["", "undefined", "null", "none", "n/a", "na", "-", "--", "nil"]);

export function classifyWebsite(url?: string | null): LeadType {
  if (!url) return "NO_WEBSITE";
  let raw = String(url).trim();
  if (EMPTYISH.has(raw.toLowerCase())) return "NO_WEBSITE";
  if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;

  let host: string;
  try {
    host = new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "NO_WEBSITE";
  }
  const listing = NOT_A_REAL_SITE.some((d) => host === d || host.endsWith("." + d));
  return listing ? "SOCIAL_ONLY" : "HAS_WEBSITE";
}

/** 0-100. Higher = more worth your time. */
export function scoreLead(
  { phone, reviews = 0, rating = 0 }: { phone?: string | null; reviews?: number; rating?: number },
  leadType: LeadType,
): number {
  let s = leadType === "NO_WEBSITE" ? 35 : 25; // nothing to send customers to
  if (phone) s += 25;                          // you can actually reach them
  if (reviews >= 20) s += 25;                  // established, has cash flow
  else if (reviews >= 5) s += 15;
  if (rating >= 4.0) s += 15;                  // happy customers, nowhere to show them off
  return Math.min(s, 100);
}

/** Indian numbers, normalised to 10 digits so duplicates collapse. */
export function normalisePhone(raw?: string | null): string {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

/** wa.me wants country code and digits only. Null when the number is unusable. */
export function waNumber(raw?: string | null): string | null {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 10) return "91" + digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return "91" + digits.slice(1);
  return digits.length >= 10 ? digits : null;
}

/** Bands used for grouping on the insights page. */
export function scoreBand(score: number): string {
  if (score >= 90) return "90-100";
  if (score >= 75) return "75-89";
  if (score >= 60) return "60-74";
  return "under 60";
}

export function reviewBand(reviews: number): string {
  if (reviews >= 50) return "50+";
  if (reviews >= 20) return "20-49";
  if (reviews >= 5) return "5-19";
  return "under 5";
}
