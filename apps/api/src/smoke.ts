/**
 * End-to-end smoke test against a throwaway in-memory MongoDB.
 *
 *   npm run smoke -w @peoples/api
 *
 * Imports the real CSV, walks a lead through the pipeline, and checks the
 * stats and insights maths. No Atlas account or network needed.
 */
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const CSV = path.resolve(
  here,
  "../../../cvs/dataset_crawler-google-places_2026-08-21_06-20-24-923.csv",
);

let passed = 0;
let failed = 0;

function check(label: string, condition: boolean, detail?: unknown) {
  if (condition) {
    passed++;
    console.log(`  ok   ${label}`);
  } else {
    failed++;
    console.error(`  FAIL ${label}${detail === undefined ? "" : ` -> ${JSON.stringify(detail)}`}`);
  }
}

async function main() {
  const mongo = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongo.getUri("peoples-smoke");
  process.env.NODE_ENV = "test";
  delete process.env.ANTHROPIC_API_KEY; // exercise the no-key path

  const { createApp } = await import("./app.js");
  const agent = request(createApp());

  console.log("\nhealth");
  const health = await agent.get("/health");
  check("responds 200", health.status === 200, health.body);

  console.log("\nimport");
  const csv = readFileSync(CSV);
  const imported = await agent
    .post("/api/import")
    .attach("file", csv, "dataset.csv");
  check("responds 200", imported.status === 200, imported.body);
  check("read 50 rows", imported.body.rowsRead === 50, imported.body.rowsRead);
  check("inserted 27 leads", imported.body.inserted === 27, imported.body.inserted);
  check("dropped 16 with websites", imported.body.dropped?.hasWebsite === 16, imported.body.dropped);
  check("dropped 7 without phones", imported.body.dropped?.noPhone === 7, imported.body.dropped);
  check("detected the title column", imported.body.detectedColumns?.name === "title");

  console.log("\nre-import is idempotent");
  const again = await agent.post("/api/import").attach("file", csv, "dataset.csv");
  check("inserts nothing new", again.body.inserted === 0, again.body.inserted);

  console.log("\nlist");
  const list = await agent.get("/api/leads?limit=5");
  check("responds 200", list.status === 200);
  check("total is 27", list.body.total === 27, list.body.total);
  check("returns 5", list.body.leads?.length === 5, list.body.leads?.length);
  check(
    "sorted best-first",
    list.body.leads[0].score >= list.body.leads[4].score,
    list.body.leads?.map((l: { score: number }) => l.score),
  );
  check("has a wa number", /^91\d{10}$/.test(list.body.leads[0].waNumber ?? ""), list.body.leads[0].waNumber);
  check("list carries a ready message", (list.body.leads[0].nextMessage ?? "").length > 80);
  check(
    "list carries a wa link",
    (list.body.leads[0].waUrl ?? "").startsWith("https://wa.me/"),
    list.body.leads[0].waUrl?.slice(0, 40),
  );
  check("list message is touch 1", list.body.leads[0].nextTouch === 1, list.body.leads[0].nextTouch);

  const lead = list.body.leads[0];
  console.log(`\nmessage for "${lead.name}"`);
  const msg = await agent.get(`/api/leads/${lead._id}/message`);
  check("responds 200", msg.status === 200, msg.body);
  check("is touch 1", msg.body.touch === 1, msg.body.touch);
  check("mentions the business", msg.body.message?.includes(lead.name.split(" ")[0]));
  check("wa url is a wa.me link", msg.body.waUrl?.startsWith("https://wa.me/"), msg.body.waUrl);

  console.log("\nmark sent");
  const sent = await agent.post(`/api/leads/${lead._id}/sent`);
  check("status becomes SENT", sent.body.lead?.status === "SENT", sent.body.lead?.status);
  check("touches becomes 1", sent.body.lead?.touches === 1, sent.body.lead?.touches);
  check("schedules a follow-up", Boolean(sent.body.lead?.nextFollowUpAt), sent.body.lead?.nextFollowUpAt);

  const msg2 = await agent.get(`/api/leads/${lead._id}/message`);
  check("next message is the touch-2 template", msg2.body.touch === 2, msg2.body.touch);
  check("touch-2 text differs", msg2.body.message !== msg.body.message);

  // The list must advance too, or the button there would resend touch 1.
  const listAfter = await agent.get("/api/leads?limit=5");
  const same = listAfter.body.leads.find((l: { _id: string }) => l._id === lead._id);
  check("list advances to touch 2 after sending", same?.nextTouch === 2, same?.nextTouch);
  check("list wa link uses the follow-up text", same?.waUrl !== list.body.leads[0].waUrl);

  console.log("\ndaily cap counter");
  const today = await agent.get("/api/leads/usage/today");
  check("counts 1 sent today", today.body.sentToday === 1, today.body);

  console.log("\nstatus change");
  const replied = await agent.patch(`/api/leads/${lead._id}`).send({ status: "REPLIED" });
  check("status becomes REPLIED", replied.body.lead?.status === "REPLIED", replied.body.lead?.status);
  check("stamps repliedAt", Boolean(replied.body.lead?.repliedAt));

  const bad = await agent.patch(`/api/leads/${lead._id}`).send({ status: "NONSENSE" });
  check("rejects an invalid status with 400", bad.status === 400, bad.status);

  console.log("\nstats");
  const stats = await agent.get("/api/stats");
  check("responds 200", stats.status === 200);
  check("27 leads", stats.body.totals?.leads === 27, stats.body.totals);
  check("sample size 1", stats.body.sampleSize === 1, stats.body.sampleSize);
  check("reply rate 100%", stats.body.replyRate === 100, stats.body.replyRate);

  console.log("\ninsights (no API key configured)");
  const insights = await agent.get("/api/insights");
  check("responds 200", insights.status === 200, insights.body);
  check("has observations", insights.body.observations?.length > 0);
  check("flags low confidence", insights.body.lowConfidence === true);
  check("omits narrative without a key", insights.body.narrative === undefined);
  check(
    "warns about small sample",
    insights.body.observations.some((o: string) => o.toLowerCase().includes("small")),
    insights.body.observations,
  );

  console.log("\nfollow-up queue");
  const due = await agent.get("/api/leads?dueOnly=true");
  check("nothing due yet", due.body.total === 0, due.body.total);

  await mongo.stop();
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
