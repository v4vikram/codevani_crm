/**
 * End-to-end smoke test against a throwaway in-memory MongoDB.
 *
 *   npm run smoke
 *
 * Creates an account, imports the real CSV, walks a lead through the pipeline,
 * and checks the stats and insights maths. No Atlas account or network needed.
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

const EMAIL = "vikram@codevani.com";
const PASSWORD = "a-long-enough-password";

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
  delete process.env.SIGNUP_CODE; // registration closed after the first account

  const { createApp } = await import("./app.js");
  const agent = request(createApp());

  console.log("\nhealth");
  const health = await agent.get("/health");
  check("responds 200 without a session", health.status === 200, health.body);

  console.log("\nauth — everything is locked by default");
  for (const [label, res] of [
    ["leads", await agent.get("/api/leads")],
    ["import", await agent.post("/api/import")],
    ["stats", await agent.get("/api/stats")],
    ["insights", await agent.get("/api/insights")],
  ] as const) {
    check(`${label} rejects an anonymous request`, res.status === 401, res.status);
  }

  const setupState = await agent.get("/api/auth/setup");
  check("reports first-run setup", setupState.body.needsSetup === true, setupState.body);

  const weak = await agent.post("/api/auth/register").send({ email: "a@b.com", password: "short" });
  check("rejects a weak password", weak.status === 400, weak.status);

  const registered = await agent
    .post("/api/auth/register")
    .send({ email: "Vikram@Codevani.com", password: PASSWORD, name: "Vikram" });
  check("creates the first account", registered.status === 201, registered.body);
  check("normalises the email", registered.body.user?.email === EMAIL, registered.body.user?.email);
  check("never returns a password hash", !JSON.stringify(registered.body).includes("passwordHash"));

  const token = registered.body.token as string;
  check("issues a JWT", typeof token === "string" && token.split(".").length === 3);

  const second = await agent
    .post("/api/auth/register")
    .send({ email: "someone@else.com", password: "another-long-password" });
  check("blocks a second signup with no code set", second.status === 403, second.status);

  const wrongPw = await agent.post("/api/auth/login").send({ email: EMAIL, password: "wrong-password" });
  check("rejects a wrong password", wrongPw.status === 401, wrongPw.status);

  const unknown = await agent
    .post("/api/auth/login")
    .send({ email: "nobody@nowhere.com", password: "wrong-password" });
  check("gives the same error for unknown emails", unknown.body.error === wrongPw.body.error, unknown.body.error);

  const loggedIn = await agent.post("/api/auth/login").send({ email: EMAIL, password: PASSWORD });
  check("signs in with the right password", loggedIn.status === 200, loggedIn.status);

  const forged = await agent.get("/api/leads").set("Authorization", "Bearer not.a.real.token");
  check("rejects a forged token", forged.status === 401, forged.status);

  let auth = { Authorization: `Bearer ${token}` };

  const me = await agent.get("/api/auth/me").set(auth);
  check("returns the signed-in user", me.body.user?.email === EMAIL, me.body);

  console.log("\nforgot password");
  const { testOutbox } = await import("./core/mailer.js");
  const NEW_PASSWORD = "a-brand-new-password";
  const resetLink = () => testOutbox.at(-1)?.text.match(/token=([\w-]+)/)?.[1];

  const unknownReset = await agent.post("/api/auth/forgot-password").send({ email: "nobody@nowhere.com" });
  check("unknown email gets the same 200", unknownReset.status === 200, unknownReset.status);
  check("unknown email sends nothing", testOutbox.length === 0, testOutbox.length);

  const forgot = await agent.post("/api/auth/forgot-password").send({ email: EMAIL });
  check("known email gets 200 with the same body", forgot.body.message === unknownReset.body.message, forgot.body);
  check("emails the reset link", testOutbox.length === 1 && testOutbox[0]?.to === EMAIL, testOutbox.length);
  const resetToken = resetLink();
  check("link carries a token", Boolean(resetToken), testOutbox[0]?.text);

  await agent.post("/api/auth/forgot-password").send({ email: EMAIL });
  check("a second request inside the cooldown sends nothing", testOutbox.length === 1, testOutbox.length);

  const badToken = await agent.post("/api/auth/reset-password").send({ token: "nope", password: NEW_PASSWORD });
  check("rejects an unknown token", badToken.status === 400, badToken.status);

  const weakReset = await agent.post("/api/auth/reset-password").send({ token: resetToken, password: "short" });
  check("rejects a weak new password", weakReset.status === 400, weakReset.status);

  await new Promise((r) => setTimeout(r, 1100)); // iat has 1s resolution; the reset must post-date the old session
  const reset = await agent.post("/api/auth/reset-password").send({ token: resetToken, password: NEW_PASSWORD });
  check("resets with a valid token", reset.status === 200, reset.body);
  check("signs in with a fresh JWT", typeof reset.body.token === "string");

  const reused = await agent.post("/api/auth/reset-password").send({ token: resetToken, password: "yet-another-password" });
  check("the link works only once", reused.status === 400, reused.status);

  const oldPw = await agent.post("/api/auth/login").send({ email: EMAIL, password: PASSWORD });
  check("old password stops working", oldPw.status === 401, oldPw.status);
  const newPw = await agent.post("/api/auth/login").send({ email: EMAIL, password: NEW_PASSWORD });
  check("new password works", newPw.status === 200, newPw.status);

  const staleSession = await agent.get("/api/auth/me").set("Authorization", `Bearer ${token}`);
  check("sessions from before the reset are revoked", staleSession.status === 401, staleSession.status);
  const freshSession = await agent.get("/api/leads").set("Authorization", `Bearer ${reset.body.token}`);
  check("the new session works", freshSession.status === 200, freshSession.status);
  auth = { Authorization: `Bearer ${reset.body.token}` }; // the rest of the run uses the new session

  console.log("\nimport");
  const csv = readFileSync(CSV);
  const imported = await agent.post("/api/import").set(auth).attach("file", csv, "dataset.csv");
  check("responds 200", imported.status === 200, imported.body);
  check("read 50 rows", imported.body.rowsRead === 50, imported.body.rowsRead);
  check("inserted 27 leads", imported.body.inserted === 27, imported.body.inserted);
  check("dropped 16 with websites", imported.body.dropped?.hasWebsite === 16, imported.body.dropped);
  check("dropped 7 without phones", imported.body.dropped?.noPhone === 7, imported.body.dropped);
  check("detected the title column", imported.body.detectedColumns?.name === "title");

  console.log("\nre-import is idempotent");
  const again = await agent.post("/api/import").set(auth).attach("file", csv, "dataset.csv");
  check("inserts nothing new", again.body.inserted === 0, again.body.inserted);

  console.log("\nlist");
  const list = await agent.get("/api/leads?limit=5").set(auth);
  check("responds 200", list.status === 200);
  check("total is 27", list.body.total === 27, list.body.total);
  check("returns 5", list.body.leads?.length === 5, list.body.leads?.length);
  check(
    "sorted best-first",
    list.body.leads[0].score >= list.body.leads[4].score,
    list.body.leads?.map((l: { score: number }) => l.score),
  );

  const lead = list.body.leads[0];
  check("has a wa number", /^91\d{10}$/.test(lead.waNumber ?? ""), lead.waNumber);
  check("list carries a ready message", (lead.nextMessage ?? "").length > 80);
  check("list carries a wa link", (lead.waUrl ?? "").startsWith("https://wa.me/"), lead.waUrl?.slice(0, 40));
  check("list message is touch 1", lead.nextTouch === 1, lead.nextTouch);

  console.log(`\nmessage for "${lead.name}"`);
  const msg = await agent.get(`/api/leads/${lead._id}/message`).set(auth);
  check("responds 200", msg.status === 200, msg.body);
  check("is touch 1", msg.body.touch === 1, msg.body.touch);
  check("mentions the business", msg.body.message?.includes(lead.name.split(" ")[0]));
  check("wa url is a wa.me link", msg.body.waUrl?.startsWith("https://wa.me/"), msg.body.waUrl);

  console.log("\nmark sent");
  const sent = await agent.post(`/api/leads/${lead._id}/sent`).set(auth);
  check("status becomes SENT", sent.body.lead?.status === "SENT", sent.body.lead?.status);
  check("touches becomes 1", sent.body.lead?.touches === 1, sent.body.lead?.touches);
  check("schedules a follow-up", Boolean(sent.body.lead?.nextFollowUpAt), sent.body.lead?.nextFollowUpAt);

  const msg2 = await agent.get(`/api/leads/${lead._id}/message`).set(auth);
  check("next message is the touch-2 template", msg2.body.touch === 2, msg2.body.touch);
  check("touch-2 text differs", msg2.body.message !== msg.body.message);

  // The list must advance too, or the button there would resend touch 1.
  const listAfter = await agent.get("/api/leads?limit=5").set(auth);
  const same = listAfter.body.leads.find((l: { _id: string }) => l._id === lead._id);
  check("list advances to touch 2 after sending", same?.nextTouch === 2, same?.nextTouch);
  check("list wa link uses the follow-up text", same?.waUrl !== lead.waUrl);

  console.log("\ndaily cap counter");
  const today = await agent.get("/api/leads/usage/today").set(auth);
  check("counts 1 sent today", today.body.sentToday === 1, today.body);
  check("reports the cap", today.body.cap === 30, today.body.cap);

  console.log("\nstatus change");
  const replied = await agent.patch(`/api/leads/${lead._id}`).set(auth).send({ status: "REPLIED" });
  check("status becomes REPLIED", replied.body.lead?.status === "REPLIED", replied.body.lead?.status);
  check("stamps repliedAt", Boolean(replied.body.lead?.repliedAt));

  const bad = await agent.patch(`/api/leads/${lead._id}`).set(auth).send({ status: "NONSENSE" });
  check("rejects an invalid status with 400", bad.status === 400, bad.status);

  console.log("\nstats");
  const stats = await agent.get("/api/stats").set(auth);
  check("responds 200", stats.status === 200);
  check("27 leads", stats.body.totals?.leads === 27, stats.body.totals);
  check("sample size 1", stats.body.sampleSize === 1, stats.body.sampleSize);
  check("reply rate 100%", stats.body.replyRate === 100, stats.body.replyRate);

  console.log("\ninsights (no API key configured)");
  const insights = await agent.get("/api/insights").set(auth);
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
  const due = await agent.get("/api/leads?dueOnly=true").set(auth);
  check("nothing due yet", due.body.total === 0, due.body.total);

  await mongo.stop();
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
