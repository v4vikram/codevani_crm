# Peoples — outreach CRM for firms with no website

Finds Delhi NCR construction and real-estate firms that have a Google Business
listing but **no real website**, then helps you actually work them: personalised
WhatsApp messages, follow-up scheduling, and honest reporting on what converts.

Those businesses are already being found on Google and have nowhere to send the
people who find them. That gap is the pitch.

## Layout

```
apps/
  api/     Express + Mongoose, feature-modular   -> Render
  web/     Next.js 16 + shadcn-style UI + axios  -> Vercel
scripts/   Standalone CLI tools (see scripts/README.md)
```

The two apps are fully independent — no shared package. Types are duplicated on
purpose so either side can be deployed, versioned, or rewritten alone.

### Feature modules

Every feature owns its model, service, controller and routes. Controllers only
translate HTTP; all logic lives in services.

```
apps/api/src/
  core/                env (zod-validated) · db · http
  app.ts               the feature registry
  features/
    auth/              JWT sessions, bcrypt, first-run setup
    leads/             rules · model · dto · service · controller · routes
    events/            append-only history of every touch
    import/            CSV column detection + idempotent upsert
    stats/             funnel segmentation
    insights/          deterministic observations + optional AI narrative
    messaging/         WhatsApp templates for touches 1-3

apps/web/src/
  app/                 routes only — each renders one feature component
  components/ui/       shadcn-style primitives
  lib/                 axios client, helpers
  features/
    auth/              context · guard · login
    leads/             api · types · components
    import/ stats/ insights/ messaging/
```

`apps/api/src/features/leads/lead.rules.ts` is the domain core — what counts as
a lead, and how leads are scored. Everything else is plumbing.

## Running it locally

```bash
npm install
npm run dev          # api on :4000, web on :3000
```

You need a **MongoDB Atlas** connection string (free M0 tier is plenty):

```bash
cp apps/api/.env.example apps/api/.env    # add MONGODB_URI
cp apps/web/.env.local.example apps/web/.env.local
```

Then open http://localhost:3000, go to **Import**, and drop in an Apify CSV.

### Verifying without Atlas

```bash
npm run smoke        # spins up an in-memory MongoDB, runs 58 checks
```

This imports the real CSV in `cvs/`, walks a lead through the whole pipeline,
and asserts the stats maths. No account or network needed.

## Accounts

Every data route requires a session — the lead list holds real businesses'
phone numbers, so nothing is public.

**First run:** open the site and it offers to create the first account. After
that, registration is closed unless `SIGNUP_CODE` is set on the API.

Sessions are JWTs valid for 7 days, sent as a Bearer token. Cookies would be
cleaner, but the app and API sit on different domains (Vercel and Render) and
browsers that block third-party cookies would silently drop a cross-site
session cookie.

`JWT_SECRET` must be set in production — the API refuses to boot with the
development default, since a known secret lets anyone forge a session.

## The daily loop

1. **Import** — drop the CSV in. Firms with real websites, no phone, or
   permanently closed are dropped automatically.
2. **Work the queue** — highest score first. Each lead shows a message already
   written from their own rating, review count and area.
3. **Tap "Open WhatsApp"** — the message is pre-filled; you read it and send.
   The touch is recorded and a follow-up scheduled 3 days out.
4. **Mark what happened** — replied, interested, won, dead (with a reason).
5. **Follow up** — the dashboard surfaces what is due. Touches 2 and 3 use
   different, shorter templates.

### Why sending stays manual

Automated senders (whatsapp-web.js, Baileys) violate WhatsApp's terms and get
numbers banned. The ban signal is mostly **recipient behaviour** — blocks and
reports — not volume, so there is no safe rate to tune to. A personalised
message a human read before sending gets blocked far less, which protects both
your number and your reply rate. The app enforces a soft daily cap
(`DAILY_SEND_CAP`, default 30) for the same reason.

### Why the insights page refuses to over-claim

Below 30 sent messages the API flags `lowConfidence` and the UI says so.
Segments with fewer than 5 sends show the raw split (`1/3`) instead of a
percentage. The AI prompt is explicitly instructed to say "we cannot tell yet"
rather than invent a pattern.

An analyser that confidently reports "Rohini converts 3× better" off 20 messages
would actively mislead your targeting. This one is built to stay quiet until the
data earns a conclusion — roughly 100+ touches.

The written analysis needs `ANTHROPIC_API_KEY`. Without it, every number and
observation on the page still works; only the prose is missing.

## Deploying

**API → Render.** Import the repo as a Blueprint; `render.yaml` is already
configured. Set `MONGODB_URI` and `CORS_ORIGINS` (your Vercel URL) in the
dashboard. Note the free tier sleeps after inactivity, so the first request
after idle takes ~30s.

**Web → Vercel.** Import the repo; `vercel.json` handles the monorepo build.
Set `NEXT_PUBLIC_API_URL` to your Render URL — it is baked in at build time, so
changing it later needs a redeploy.

**Atlas.** Allow access from anywhere (`0.0.0.0/0`) in Network Access, since
Render's free tier has no static outbound IP.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Both apps, watched |
| `npm run build` | Build API then web |
| `npm run smoke` | End-to-end API test on in-memory Mongo |
| `npm run typecheck` | Both workspaces |

Standalone CLI tools for scraping and scoring live in [`scripts/`](scripts/README.md).
