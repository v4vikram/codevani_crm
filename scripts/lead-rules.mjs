/**
 * Shared lead rules: what counts as "no real website", how leads are scored,
 * and CSV writing. Used by both find-leads.mjs (Google API) and
 * score-leads.mjs (Apify / RERA / any CSV).
 */

/**
 * A "website" on one of these is not a website. It is a directory listing or a
 * social page, which means the business still has nowhere of its own to send
 * customers -- the strongest pitch there is.
 */
export const NOT_A_REAL_SITE = [
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

/** "NO_WEBSITE" | "SOCIAL_ONLY" | "HAS_WEBSITE". First two are leads. */
export function classifyWebsite(url) {
  if (!url) return "NO_WEBSITE";
  let raw = String(url).trim();
  if (EMPTYISH.has(raw.toLowerCase())) return "NO_WEBSITE";
  if (!/^https?:\/\//i.test(raw)) raw = "https://" + raw;
  let host;
  try {
    host = new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "NO_WEBSITE";
  }
  const listing = NOT_A_REAL_SITE.some((d) => host === d || host.endsWith("." + d));
  return listing ? "SOCIAL_ONLY" : "HAS_WEBSITE";
}

/**
 * 0-100. Higher = more worth your time.
 * @param {{phone?: string, reviews?: number, rating?: number}} lead
 */
export function scoreLead({ phone, reviews = 0, rating = 0 }, leadType) {
  let s = leadType === "NO_WEBSITE" ? 35 : 25; // nothing to send customers to
  if (phone) s += 25;                          // you can actually reach them
  if (reviews >= 20) s += 25;                  // established, has cash flow
  else if (reviews >= 5) s += 15;
  if (rating >= 4.0) s += 15;                  // happy customers, nowhere to show them off
  return Math.min(s, 100);
}

/** Indian phone numbers, normalised so duplicates collapse. */
export function normalisePhone(raw) {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export function toCsv(rows) {
  if (!rows.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + [
    cols.join(","),
    ...rows.map((r) => cols.map((c) => esc(r[c])).join(",")),
  ].join("\r\n");
}

/** Minimal RFC-4180 CSV parser: handles quotes, embedded commas and newlines. */
export function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQuotes = false;
  const src = text.replace(/^﻿/, "");

  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (inQuotes) {
      if (c === '"') {
        if (src[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field); field = "";
    } else if (c === "\n") {
      row.push(field); rows.push(row); row = []; field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field || row.length) { row.push(field); rows.push(row); }

  if (!rows.length) return [];
  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1)
    .filter((r) => r.some((v) => v.trim()))
    .map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])));
}
