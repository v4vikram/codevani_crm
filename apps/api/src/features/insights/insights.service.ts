import Anthropic from "@anthropic-ai/sdk";
import { env } from "../../core/env.js";
import { computeStats, type Segment, type StatsResult } from "../stats/stats.service.js";

export interface InsightsResult {
  /** Deterministic, always present — computed from your data, no AI involved. */
  observations: string[];
  /** Written interpretation. Absent when no ANTHROPIC_API_KEY is configured. */
  narrative?: string;
  /** True when there is too little outreach for any of this to mean much. */
  lowConfidence: boolean;
  sampleSize: number;
  generatedAt: string;
}

/**
 * Below this many sent messages, differences between segments are almost
 * certainly noise. 30 is still small — it is simply the point where a 2x gap in
 * reply rate stops being explainable by one lucky lead.
 */
const CONFIDENCE_THRESHOLD = 30;

/** A segment needs this many sends before it is worth comparing to another. */
const MIN_SEGMENT_SENDS = 5;

/**
 * Deterministic reading of the numbers. Always available, always reproducible —
 * the AI narrative sits on top of this rather than replacing it.
 */
export function observe(stats: StatsResult): string[] {
  const out: string[] = [];
  const { totals, sampleSize, replyRate } = stats;

  if (sampleSize === 0) {
    return [
      "No messages sent yet. Send some outreach and come back — there is nothing to analyse.",
    ];
  }

  const replies = totals.replied + totals.interested + totals.won;
  out.push(
    `${sampleSize} messages sent, ${replies} replies (${replyRate}% reply rate), ${totals.won} won.`,
  );

  if (sampleSize < CONFIDENCE_THRESHOLD) {
    out.push(
      `Sample is small (${sampleSize} sent). Treat every comparison below as a hint, not a finding — one extra reply would move these numbers a lot.`,
    );
  }

  const compare = (segments: Segment[], label: string) => {
    const usable = segments.filter((s) => s.sent >= MIN_SEGMENT_SENDS);
    if (usable.length < 2) return;

    const best = usable[0];
    const worst = usable[usable.length - 1];
    if (!best || !worst || best.key === worst.key) return;
    if (best.replyRate <= worst.replyRate) return;

    out.push(
      `By ${label}: "${best.label}" replies best at ${best.replyRate}% (${best.replied}/${best.sent}), "${worst.label}" worst at ${worst.replyRate}% (${worst.replied}/${worst.sent}).`,
    );
  };

  compare(stats.segments.byArea, "area");
  compare(stats.segments.byCategory, "business type");
  compare(stats.segments.byLeadType, "listing type");
  compare(stats.segments.byScoreBand, "score band");
  compare(stats.segments.byReviewBand, "review count");

  const topDead = stats.deadReasons[0];
  if (topDead) {
    out.push(`Most common reason leads die: ${topDead.reason.replace(/_/g, " ")} (${topDead.count}).`);
  }
  if (totals.new > 0) {
    out.push(`${totals.new} leads have never been contacted.`);
  }
  if (totals.dueToday > 0) {
    out.push(
      `${totals.dueToday} leads are due a follow-up now — follow-ups usually out-convert first messages.`,
    );
  }

  return out;
}

const SYSTEM_PROMPT = `You analyse cold-outreach results for a small web design agency in Delhi NCR that sells websites to construction and real-estate firms found on Google Maps.

You will be given real outreach statistics. Write a short, blunt analysis for the agency owner.

Rules:
- Be honest about sample size. If fewer than 30 messages have been sent, say plainly that the data cannot yet support conclusions, and say what to do instead. Never manufacture a pattern from a handful of data points.
- Quote the actual numbers you are reasoning from, including the denominators.
- Prefer "we cannot tell yet" over a confident guess.
- Give at most 3 concrete next actions, ordered by expected impact.
- No preamble, no headings, no bullet padding. 150 words maximum.`;

async function writeNarrative(stats: StatsResult, observations: string[]): Promise<string | undefined> {
  try {
    const client = new Anthropic();
    const response = await client.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 4000,
      system: SYSTEM_PROMPT,
      thinking: { type: "adaptive" },
      output_config: { effort: "medium" },
      messages: [
        {
          role: "user",
          content: `Outreach statistics as JSON:

${JSON.stringify(
  {
    totals: stats.totals,
    replyRatePercent: stats.replyRate,
    winRatePercent: stats.winRate,
    messagesSent: stats.sampleSize,
    segments: stats.segments,
    deadReasons: stats.deadReasons,
  },
  null,
  2,
)}

Deterministic observations already shown to the user:
${observations.map((o) => `- ${o}`).join("\n")}`,
        },
      ],
    });

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return text || undefined;
  } catch (err) {
    // A missing key, a rate limit or a refusal must not take down the page.
    console.error("[insights] narrative unavailable:", err instanceof Error ? err.message : err);
    return undefined;
  }
}

export async function getInsights(): Promise<InsightsResult> {
  const stats = await computeStats();
  const observations = observe(stats);

  const result: InsightsResult = {
    observations,
    lowConfidence: stats.sampleSize < CONFIDENCE_THRESHOLD,
    sampleSize: stats.sampleSize,
    generatedAt: new Date().toISOString(),
  };

  // The narrative is a bonus layer. No key configured is a normal state, not an
  // error — the page still works on the deterministic numbers alone.
  if (env.ANTHROPIC_API_KEY) {
    const narrative = await writeNarrative(stats, observations);
    if (narrative) result.narrative = narrative;
  }

  return result;
}
