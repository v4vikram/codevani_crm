#!/usr/bin/env node
/**
 * Find Delhi-NCR builders / contractors / real-estate firms that have a Google
 * Business listing but NO real website.
 *
 * Those are the pitchable ones: Google already knows they exist, customers are
 * already searching for them, and there is nothing to send those customers to.
 *
 * Zero dependencies -- needs only Node 18+.
 *
 *   node find-leads.mjs --dry-run
 *   node find-leads.mjs --areas Rohini,Dwarka --max-pages 1
 *   node find-leads.mjs
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { classifyWebsite, scoreLead, toCsv } from "./lead-rules.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const CACHE_FILE = path.join(ROOT, ".cache-places.json");
const OUT_CSV = path.join(ROOT, "leads-delhi-ncr.csv");

const ENDPOINT = "https://places.googleapis.com/v1/places:searchText";

const FIELD_MASK = [
  "nextPageToken",
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.nationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
  "places.googleMapsUri",
  "places.primaryTypeDisplayName",
].join(",");

/** Business types worth pitching a website to. */
const KEYWORDS = [
  "builders",
  "property dealer",
  "real estate agent",
  "construction company",
  "civil contractor",
  "building contractor",
  "house construction services",
  "turnkey construction",
  "renovation contractor",
  "architect",
  "engineering consultant",
  "interior designer",
];

/**
 * Delhi NCR coverage. Coords are approximate centres; a 6 km bias circle
 * around each gives good overlap without leaving big gaps.
 */
const AREAS = {
  "Rohini": [28.7495, 77.0565],
  "Pitampura": [28.6942, 77.1314],
  "Shalimar Bagh": [28.705, 77.16],
  "Dwarka": [28.5921, 77.046],
  "Janakpuri": [28.6219, 77.0878],
  "Uttam Nagar": [28.6219, 77.055],
  "Najafgarh": [28.609, 76.9856],
  "Karol Bagh": [28.6519, 77.1909],
  "Saket": [28.5245, 77.2066],
  "Laxmi Nagar": [28.6304, 77.2777],
  "Mayur Vihar": [28.609, 77.295],
  "Dilshad Garden": [28.6811, 77.3216],
  "Noida Sector 18": [28.5706, 77.3261],
  "Noida Sector 62": [28.627, 77.372],
  "Noida Extension": [28.61, 77.43],
  "Greater Noida": [28.4744, 77.504],
  "Gurgaon Sector 14": [28.47, 77.03],
  "Sohna Road Gurgaon": [28.4089, 77.04],
  "Golf Course Road": [28.442, 77.099],
  "Faridabad Sector 15": [28.4089, 77.3178],
  "Greater Faridabad": [28.39, 77.33],
  "Raj Nagar Ghaziabad": [28.68, 77.43],
  "Indirapuram": [28.642, 77.371],
  "Vaishali Ghaziabad": [28.642, 77.339],
  "Vasundhara": [28.66, 77.37],
  "Bahadurgarh": [28.6928, 76.9198],
  "Sonipat": [28.9931, 77.0151],
};

const BIAS_RADIUS_M = 6000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function loadCache() {
  if (!existsSync(CACHE_FILE)) return {};
  try {
    return JSON.parse(await readFile(CACHE_FILE, "utf8"));
  } catch {
    console.log("  ! cache file unreadable, starting fresh");
    return {};
  }
}

async function loadApiKey() {
  if (process.env.GOOGLE_MAPS_API_KEY) return process.env.GOOGLE_MAPS_API_KEY;
  const envPath = path.join(ROOT, ".env");
  if (!existsSync(envPath)) return null;
  for (const line of (await readFile(envPath, "utf8")).split(/\r?\n/)) {
    const m = line.trim().match(/^GOOGLE_MAPS_API_KEY\s*=\s*(.+)$/);
    if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

async function search(apiKey, textQuery, lat, lng, pageToken) {
  const body = {
    textQuery,
    pageSize: 20,
    languageCode: "en",
    regionCode: "IN",
    includePureServiceAreaBusinesses: true,
    locationBias: {
      circle: { center: { latitude: lat, longitude: lng }, radius: BIAS_RADIUS_M },
    },
  };
  if (pageToken) body.pageToken = pageToken;

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": FIELD_MASK,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return res.json();
}

async function main() {
  const { values } = parseArgs({
    options: {
      keywords: { type: "string" },
      areas: { type: "string" },
      "max-pages": { type: "string", default: "3" },
      "dry-run": { type: "boolean", default: false },
    },
  });

  const keywords = values.keywords ? values.keywords.split(",").map((s) => s.trim()) : KEYWORDS;
  const areas = values.areas ? values.areas.split(",").map((s) => s.trim()) : Object.keys(AREAS);
  const maxPages = Math.max(1, Math.min(3, Number(values["max-pages"]) || 3));

  const unknown = areas.filter((a) => !(a in AREAS));
  if (unknown.length) {
    console.error(`Unknown area(s): ${unknown.join(", ")}`);
    console.error(`Available: ${Object.keys(AREAS).join(", ")}`);
    process.exit(1);
  }

  const plan = areas.flatMap((a) => keywords.map((k) => [k, a]));
  console.log(
    `${keywords.length} keywords x ${areas.length} areas = ${plan.length} queries, ` +
    `up to ${plan.length * maxPages} API calls (free tier is 10,000/month).`
  );

  if (values["dry-run"]) {
    for (const [k, a] of plan.slice(0, 15)) console.log(`  ${k} in ${a}`);
    if (plan.length > 15) console.log(`  ... and ${plan.length - 15} more`);
    return;
  }

  const apiKey = await loadApiKey();
  if (!apiKey) {
    console.error("No API key. Put GOOGLE_MAPS_API_KEY=... in a .env file next to this script (see README.md).");
    process.exit(1);
  }

  const cache = await loadCache();
  const found = new Map();
  let calls = 0;

  for (const [i, [keyword, area]] of plan.entries()) {
    const [lat, lng] = AREAS[area];
    const query = `${keyword} in ${area} Delhi NCR`;
    console.log(`[${i + 1}/${plan.length}] ${query}`);

    let token;
    for (let page = 0; page < maxPages; page++) {
      const cacheKey = `${query}||${page}||${token ?? ""}`;
      let data = cache[cacheKey];
      if (!data) {
        try {
          data = await search(apiKey, query, lat, lng, token);
        } catch (e) {
          console.log(`    ! ${e.message}`);
          break;
        }
        calls++;
        cache[cacheKey] = data;
        if (calls % 20 === 0) await writeFile(CACHE_FILE, JSON.stringify(cache));
        await sleep(200); // be polite to the API
      }

      for (const p of data.places ?? []) {
        if (!p.id || found.has(p.id)) continue;
        if (p.businessStatus && p.businessStatus !== "OPERATIONAL") continue;
        if (!p.nationalPhoneNumber) continue; // no phone = no way to pitch

        const leadType = classifyWebsite(p.websiteUri);
        if (leadType === "HAS_WEBSITE") continue;

        found.set(p.id, {
          score: scoreLead({ phone: p.nationalPhoneNumber, reviews: p.userRatingCount ?? 0, rating: p.rating ?? 0 }, leadType),
          lead_type: leadType,
          name: p.displayName?.text ?? "",
          phone: p.nationalPhoneNumber,
          category: p.primaryTypeDisplayName?.text ?? "",
          area,
          keyword,
          rating: p.rating ?? "",
          reviews: p.userRatingCount ?? 0,
          address: p.formattedAddress ?? "",
          social_or_listing_url: leadType === "SOCIAL_ONLY" ? p.websiteUri : "",
          maps_url: p.googleMapsUri ?? "",
          status: "NEW",
          contacted_on: "",
          notes: "",
        });
      }

      token = data.nextPageToken;
      if (!token) break;
    }
  }

  await writeFile(CACHE_FILE, JSON.stringify(cache));

  const rows = [...found.values()].sort((a, b) => b.score - a.score || b.reviews - a.reviews);
  if (!rows.length) {
    console.log("\nNo leads found. Try more areas or --max-pages 3.");
    return;
  }
  await writeFile(OUT_CSV, toCsv(rows), "utf8");

  const noSite = rows.filter((r) => r.lead_type === "NO_WEBSITE").length;
  const hot = rows.filter((r) => r.score >= 75).length;
  console.log(`\n${rows.length} leads -> ${path.basename(OUT_CSV)}`);
  console.log(`  ${noSite} with no website at all, ${rows.length - noSite} on Facebook/JustDial only`);
  console.log(`  ${hot} scored 75+ (call these first)`);
  console.log(`  ${calls} API calls used this run`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
