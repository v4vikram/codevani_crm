#!/usr/bin/env node
/**
 * Phase 0: turn a lead CSV into click-to-send WhatsApp messages.
 *
 * Builds an HTML page with one pre-written, personalised message per lead and
 * a button that opens WhatsApp with it already typed. You read it, hit send.
 * No automation, no ban risk, ~3 seconds per lead.
 *
 * Works on a raw Apify export OR the output of score-leads.mjs.
 *
 *   node make-messages.mjs dataset.csv
 *   node make-messages.mjs dataset.csv --limit 20
 *   node make-messages.mjs dataset.csv --out today.html --from "Vikram, Codevani"
 */

import { readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { parseArgs } from "node:util";
import path from "node:path";
import { classifyWebsite, scoreLead, normalisePhone, parseCsv } from "./lead-rules.mjs";

/* ------------------------------------------------------------------ *
 * EDIT YOUR MESSAGE HERE. Keep it short -- long WhatsApp messages from
 * unknown numbers get ignored or reported. Lead with THEIR data, not your
 * services, so it reads as noticed-you rather than blasted-everyone.
 * ------------------------------------------------------------------ */
function buildMessage(lead, from) {
  const name = lead.name.replace(/\s*(pvt\.?\s*ltd\.?|private limited|llp)\s*$/i, "").trim();
  const where = lead.area ? ` in ${lead.area}` : "";

  // Their reputation is the hook -- but only if it is genuinely good.
  let hook;
  if (lead.reviews >= 20 && lead.rating >= 4.3) {
    hook = `${lead.rating}★ from ${lead.reviews} reviews — that's a strong reputation`;
  } else if (lead.reviews >= 5) {
    hook = `${lead.rating}★ from ${lead.reviews} reviews`;
  } else {
    hook = `you're listed on Google Maps`;
  }

  const gap = lead.lead_type === "SOCIAL_ONLY"
    ? `but there's no website linked — just a social page, so people who search for you have nowhere proper to land`
    : `but there's no website linked, so people who search for you have nowhere to land`;

  return `Namaste 🙏 I came across ${name}${where} on Google — ${hook}, ${gap}.

I design websites for construction & property firms in NCR. Can I make you a free sample page with your name and project photos? No charge, no commitment — if you don't like it, just ignore it.

— ${from}`;
}

/* ------------------------------------------------------------------ */

const COLS = {
  name: ["name", "title", "businessname", "companyname"],
  website: ["website", "websiteuri", "social_or_listing_url", "site"],
  phone: ["phone", "phoneunformatted", "phonenumber", "mobile", "contact"],
  rating: ["rating", "totalscore", "stars"],
  reviews: ["reviews", "reviewscount", "userratingcount", "reviewcount"],
  area: ["area", "city", "neighborhood", "locality"],
  lead_type: ["lead_type", "leadtype"],
  score: ["score"],
};

const norm = (s) => String(s).toLowerCase().replace(/[\s_-]/g, "");

function detect(headers) {
  const lookup = new Map(headers.map((h) => [norm(h), h]));
  const found = {};
  for (const [field, cands] of Object.entries(COLS)) {
    for (const c of cands) if (lookup.has(c)) { found[field] = lookup.get(c); break; }
  }
  return found;
}

/** wa.me needs country code, digits only. Indian mobiles are 10 digits. */
function waNumber(raw) {
  const digits = String(raw ?? "").replace(/\D/g, "");
  if (digits.length === 10) return "91" + digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits;
  if (digits.length === 11 && digits.startsWith("0")) return "91" + digits.slice(1);
  return digits.length >= 10 ? digits : null;
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;")
  .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function renderHtml(leads, { cap }) {
  const cards = leads.map((l, i) => `
  <li class="card" data-i="${i}">
    <div class="head">
      <label class="done"><input type="checkbox" data-key="${esc(l.wa)}"><span></span></label>
      <div class="who">
        <h2>${esc(l.name)}</h2>
        <p class="meta">
          <span class="pill ${l.lead_type === "NO_WEBSITE" ? "hot" : "warm"}">${l.lead_type === "NO_WEBSITE" ? "no website" : "social only"}</span>
          ${l.rating ? `<span>${esc(l.rating)}★ · ${esc(l.reviews)} reviews</span>` : `<span>no reviews yet</span>`}
          ${l.area ? `<span>${esc(l.area)}</span>` : ""}
          <span class="score">score ${l.score}</span>
        </p>
      </div>
    </div>
    <pre class="msg">${esc(l.message)}</pre>
    <div class="actions">
      <a class="btn primary" href="https://wa.me/${l.wa}?text=${encodeURIComponent(l.message)}" target="_blank" rel="noopener">Open WhatsApp →</a>
      <button class="btn" data-copy="${i}">Copy message</button>
      <a class="btn ghost" href="tel:+${l.wa}">${esc(l.phone)}</a>
    </div>
  </li>`).join("");

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Outreach — ${leads.length} leads</title>
<style>
:root{--bg:#f6f7f9;--card:#fff;--ink:#14161a;--dim:#6b7280;--line:#e5e7eb;--accent:#128c7e;--hot:#b45309;--hotbg:#fef3c7;--warm:#3730a3;--warmbg:#e0e7ff}
@media(prefers-color-scheme:dark){:root{--bg:#0e1013;--card:#181b20;--ink:#e8eaed;--dim:#9aa0a6;--line:#2a2f36;--accent:#25d366;--hot:#fbbf24;--hotbg:#3a2f10;--warm:#a5b4fc;--warmbg:#232449}}
*{box-sizing:border-box}
body{margin:0;padding:24px 16px 80px;background:var(--bg);color:var(--ink);font:15px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.wrap{max-width:760px;margin:0 auto}
h1{font-size:22px;margin:0 0 4px}
.sub{color:var(--dim);margin:0 0 20px;font-size:14px}
.bar{position:sticky;top:0;z-index:5;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 16px;margin-bottom:20px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
.bar strong{font-size:18px}
.track{flex:1;min-width:120px;height:8px;background:var(--line);border-radius:99px;overflow:hidden}
.track i{display:block;height:100%;background:var(--accent);width:0;transition:width .2s}
.warn{color:var(--hot);font-weight:600}
ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:14px}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px}
.card.is-done{opacity:.45}
.head{display:flex;gap:12px;align-items:flex-start}
h2{font-size:16px;margin:0 0 4px}
.meta{margin:0;color:var(--dim);font-size:13px;display:flex;gap:10px;flex-wrap:wrap;align-items:center}
.pill{padding:2px 8px;border-radius:99px;font-size:11px;font-weight:600;letter-spacing:.02em}
.pill.hot{background:var(--hotbg);color:var(--hot)}
.pill.warm{background:var(--warmbg);color:var(--warm)}
.score{margin-left:auto}
.done{cursor:pointer;flex-shrink:0;padding-top:2px}
.done input{width:20px;height:20px;accent-color:var(--accent);cursor:pointer}
pre.msg{white-space:pre-wrap;font:inherit;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:12px;margin:12px 0}
.actions{display:flex;gap:8px;flex-wrap:wrap}
.btn{display:inline-block;padding:9px 14px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);font-size:14px;font-weight:500;text-decoration:none;cursor:pointer;font-family:inherit}
.btn.primary{background:var(--accent);border-color:var(--accent);color:#fff}
.btn.ghost{color:var(--dim)}
.btn:hover{filter:brightness(1.08)}
</style></head><body><div class="wrap">
<h1>Outreach list</h1>
<p class="sub">Read each message before sending — tweak anything that reads wrong. Tick the box once sent.</p>
<div class="bar">
  <strong id="count">0</strong><span class="sub" style="margin:0">of ${leads.length} sent</span>
  <div class="track"><i id="fill"></i></div>
  <span id="warn"></span>
</div>
<ul>${cards}</ul>
</div>
<script>
const CAP = ${cap};
const KEY = "outreach-sent";
let sent;
try { sent = new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); } catch { sent = new Set(); }

function save(){ try { localStorage.setItem(KEY, JSON.stringify([...sent])); } catch {} }
function paint(){
  document.getElementById("count").textContent = sent.size;
  document.getElementById("fill").style.width = Math.min(100, sent.size / ${leads.length} * 100) + "%";
  const w = document.getElementById("warn");
  w.textContent = sent.size >= CAP ? "Daily cap reached — stop here, continue tomorrow." : "";
  w.className = sent.size >= CAP ? "warn" : "";
}
document.querySelectorAll(".done input").forEach(box => {
  if (sent.has(box.dataset.key)) { box.checked = true; box.closest(".card").classList.add("is-done"); }
  box.addEventListener("change", () => {
    box.checked ? sent.add(box.dataset.key) : sent.delete(box.dataset.key);
    box.closest(".card").classList.toggle("is-done", box.checked);
    save(); paint();
  });
});
document.querySelectorAll("[data-copy]").forEach(btn => {
  btn.addEventListener("click", async () => {
    const text = btn.closest(".card").querySelector(".msg").textContent;
    try { await navigator.clipboard.writeText(text); btn.textContent = "Copied ✓";
          setTimeout(() => btn.textContent = "Copy message", 1400); } catch {}
  });
});
paint();
</script></body></html>`;
}

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      out: { type: "string", default: "outreach.html" },
      limit: { type: "string", default: "20" },
      cap: { type: "string", default: "30" },
      from: { type: "string", default: "Vikram, Codevani" },
    },
  });

  const file = positionals[0];
  if (!file || !existsSync(file)) {
    console.error("Usage: node make-messages.mjs <leads.csv> [--limit 20] [--from \"Name, Company\"]");
    process.exit(1);
  }

  const rows = parseCsv(await readFile(file, "utf8"));
  if (!rows.length) { console.error("Empty CSV."); process.exit(1); }

  const cols = detect(Object.keys(rows[0]));
  if (!cols.name || !cols.phone) {
    console.error(`Need a name and a phone column. Saw: ${Object.keys(rows[0]).join(", ")}`);
    process.exit(1);
  }

  const seen = new Set();
  const leads = [];
  for (const r of rows) {
    const get = (f) => (cols[f] ? String(r[cols[f]] ?? "").trim() : "");
    const name = get("name");
    const wa = waNumber(get("phone"));
    if (!name || !wa) continue;

    const key = normalisePhone(wa);
    if (seen.has(key)) continue;
    seen.add(key);

    const website = get("website");
    const lead_type = get("lead_type") || classifyWebsite(website);
    if (lead_type === "HAS_WEBSITE") continue;

    const rating = parseFloat(get("rating")) || 0;
    const reviews = parseInt(get("reviews"), 10) || 0;
    const lead = {
      name, wa, phone: get("phone"), area: get("area"), rating, reviews, lead_type,
      score: parseInt(get("score"), 10) || scoreLead({ phone: wa, reviews, rating }, lead_type),
    };
    lead.message = buildMessage(lead, values.from);
    leads.push(lead);
  }

  leads.sort((a, b) => b.score - a.score || b.reviews - a.reviews);
  const limit = parseInt(values.limit, 10) || 20;
  const picked = leads.slice(0, limit);

  if (!picked.length) { console.error("No usable leads (need name + phone, no real website)."); process.exit(1); }

  await writeFile(values.out, renderHtml(picked, { cap: parseInt(values.cap, 10) || 30 }), "utf8");

  console.log(`${leads.length} leads ready, wrote top ${picked.length} -> ${values.out}`);
  console.log(`  ${picked.filter((l) => l.lead_type === "NO_WEBSITE").length} no website, ` +
              `${picked.filter((l) => l.lead_type === "SOCIAL_ONLY").length} social only`);
  console.log(`\nOpen it:  start ${path.basename(values.out)}`);
  console.log(`Edit the message template at the top of make-messages.mjs, then re-run.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
