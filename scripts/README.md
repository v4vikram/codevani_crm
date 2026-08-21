# Delhi NCR lead finder — builders & contractors with no website

Pulls Google Business listings for construction / real-estate / builder firms across
Delhi NCR and keeps only the ones that have **no real website but a working phone
number**. Those businesses are already getting found on Google and have nowhere to
send the people who find them. That is the pitch.

Runs on Node (you have v24). **No install, no dependencies.**

There are two ways to get the raw listings. Both feed the same scoring rules
in [`lead-rules.mjs`](lead-rules.mjs), so the output CSV is identical either way.

| | Path A — **Apify** (no card) | Path B — Google API |
|---|---|---|
| Script | `score-leads.mjs` | `find-leads.mjs` |
| Cost | Free $5/mo credit ≈ 1,000 listings | Free 10k calls/mo |
| Needs a card? | **No** | Yes (billing account required) |
| Effort | Run in browser, export CSV | Fully automated |

**Start with Path A.** Google requires a linked billing account before it will
serve even free-tier calls, and that is where this stalled.

---

# Path A — Apify (no card needed)

1. Sign up free at [apify.com](https://apify.com) (no card on the free plan).
2. In **Apify Store**, search **"Google Maps Scraper"** (by Compass — the most
   popular one). Open it and click **Try for free**.
3. Fill the input:
   - **Search terms** — one per line:
     ```
     builders in Rohini Delhi
     civil contractor in Rohini Delhi
     property dealer in Dwarka Delhi
     construction company in Noida
     building contractor in Gurgaon
     ```
   - **Location** — `Delhi, India`
   - **Max places per search** — start at `50` while you're learning the tool
   - Leave everything else at defaults
4. **Start**. When it finishes: **Export → CSV → Download**.
5. Score it:
   ```bash
   node score-leads.mjs "C:\path\to\dataset.csv"
   ```

Output is **`leads-scored.csv`**, hot leads first.

**Watch your credits.** $5/month ≈ 1,000 listings, so don't set max places to
1,000 on your first run. Do ~200 listings, check the output is what you expect,
then spend the rest. Credits reset monthly.

Merging several exports is fine — duplicates are removed by phone number:
```bash
node score-leads.mjs rohini.csv dwarka.csv gurgaon.csv --out ncr-leads.csv
```

`score-leads.mjs` auto-detects columns, so **RERA downloads and JustDial exports
work too** — anything with a name, phone, and website column. If it can't find
the name column it prints the headers it saw so you can tell what went wrong.

Useful flags: `--out <file>`, `--keep-all` (keep firms that do have sites),
`--allow-no-phone`.

### Also worth mining (free, no tools)

**RERA registries** — UP RERA, Haryana RERA and Delhi RERA publish every
registered builder and agent with name, phone and address. These are verified,
funded businesses, many with no website, and almost nobody cold-calls from
RERA. Download the list, run it through `score-leads.mjs`.

---

# Path B — Google Places API (needs a billing account)

## One-time setup (~5 minutes)

1. **Get a Google Maps API key**
   - Go to https://console.cloud.google.com/ and create a project (any name).
   - **APIs & Services → Library →** search *Places API (New)* → **Enable**.
   - **APIs & Services → Credentials → Create credentials → API key.** Copy it.
   - **A linked, `Active` billing account is mandatory** — even for free-tier
     calls. Without it every request returns `403 PERMISSION_DENIED`.
     Use a debit/credit card, not UPI AutoPay: UPI mandates often fail
     verification and Google then closes the billing account.
   - You get **10,000 free calls per month**; a full NCR run uses under 1,000.
   - Recommended: click the key → **API restrictions → Restrict key → Places API (New)**
     so the key is useless if it ever leaks.

2. **Save the key**
   - Copy `.env.example` to `.env` and paste your key after `GOOGLE_MAPS_API_KEY=`.
   - `.env` is gitignored, so the key never leaves your machine.

## Running it

```bash
node find-leads.mjs --dry-run                     # see the query plan, costs nothing
node find-leads.mjs --areas Rohini --max-pages 1  # small test, ~12 calls
node find-leads.mjs                               # full NCR run, ~900 calls
```

Output is **`leads-delhi-ncr.csv`** — opens straight in Excel or Google Sheets,
sorted best-lead-first.

Every response is cached in `.cache-places.json`, so re-running does **not**
spend your quota again. Delete that file when you want genuinely fresh data
(worth doing about once a month).

### Useful flags

| Flag | What it does |
|---|---|
| `--areas Rohini,Dwarka` | Only those areas (27 available, see `AREAS` in the script) |
| `--keywords builders,"civil contractor"` | Only those business types |
| `--max-pages 1` | 20 results per query instead of 60 — cheap test runs |
| `--dry-run` | Print the plan, make zero API calls |

---

# Sending: `make-messages.mjs`

Turns a lead CSV into an HTML page of pre-written, personalised WhatsApp
messages. Each has an **Open WhatsApp** button that launches the chat with the
message already typed — you read it and hit send. Tick the box to mark it done
(saved in your browser, survives refresh).

```bash
node score-leads.mjs dataset.csv              # -> leads-scored.csv
node make-messages.mjs leads-scored.csv --limit 20
start outreach.html
```

Flags: `--limit 20` (how many leads), `--cap 30` (daily-cap warning),
`--from "Vikram, Codevani"`, `--out today.html`.

**Edit the message template** — it's the `buildMessage()` function at the top of
[`make-messages.mjs`](make-messages.mjs). It personalises on rating, review
count and area, and says something different for firms whose only presence is a
social page. Re-run after editing.

## Why click-to-send instead of automation

Fully automatic senders (whatsapp-web.js, Baileys) violate WhatsApp's terms and
get numbers banned. The ban signal is mostly **recipient behaviour** — blocks
and reports — not send volume, so there is no "safe rate" to tune to. A
personalised message a human actually read before sending gets blocked far less
than a blasted one, which protects both your number and your reply rate.

Keep it to ~30/day from a number you care about, and stop the moment replies
turn hostile.

---

# Working the leads (both paths)

## Reading the CSV

| Column | Meaning |
|---|---|
| `score` | 0–100. Work top-down. |
| `lead_type` | `NO_WEBSITE` = nothing at all. `SOCIAL_ONLY` = their "website" is Facebook / JustDial / IndiaMART / a `business.site` page. |
| `reviews` / `rating` | Proof the business is real and active. 20+ reviews means real cash flow. |
| `maps_url` | Open their listing before calling — see their photos and what customers say. |
| `status` | Yours to fill: `NEW` → `CONTACTED` → `REPLIED` → `WON` / `DEAD`. |

**`SOCIAL_ONLY` leads are usually your best ones** — that is exactly the profile of
the client you already converted. A firm running a Facebook page has already decided
online presence matters and is already spending effort on it. They just never took
the next step. You are not selling them the idea, only the upgrade.

## Why this converts better than what you were doing

Messaging lots of people found by browsing gets ~1 in 50 because there is no filter
on *need*. This list is filtered on need three ways before you ever open a chat:

1. They have a Google listing → they already care about being found.
2. They have no website → the gap is real, not one you have to invent.
3. They have reviews and ratings → they have customers and money.

### The angle that works on these leads

Open with the specific gap, not with your services. Before you call, open their
`maps_url` and read one real review. Then:

> "Saw your listing for [name] in [area] — 4.6 stars across 31 reviews, that's
> genuinely strong. But when someone Googles you there's no site to land on, so
> that reputation isn't doing any work for you. I build sites for construction firms.
> Can I show you a one-page mockup of yours — free, no commitment?"

Then actually build the mockup for the top 3–5 leads. A builder who sees their own
name, their own project photos and their own review count on a real page converts far
better than one who receives a services list. That is worth more than another 100
cold messages.

Track outcomes in the `status` column. After ~30 calls you will see which
`keyword` and which `area` actually reply — then re-run the script narrowed to
only those, and stop wasting time on the rest.
