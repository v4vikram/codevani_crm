import { Lead } from "../leads/lead.model.js";
import {
  scoreBand,
  reviewBand,
  SENT_STATUSES,
  REPLIED_STATUSES,
  type Status,
} from "../leads/lead.rules.js";

/** One slice of the funnel — an area, a business type, a score band. */
export interface Segment {
  key: string;
  label: string;
  total: number;
  sent: number;
  replied: number;
  won: number;
  replyRate: number;
  winRate: number;
}

export interface StatsResult {
  totals: {
    leads: number;
    new: number;
    sent: number;
    replied: number;
    interested: number;
    won: number;
    dead: number;
    dueToday: number;
  };
  replyRate: number;
  winRate: number;
  segments: {
    byArea: Segment[];
    byCategory: Segment[];
    byLeadType: Segment[];
    byScoreBand: Segment[];
    byReviewBand: Segment[];
  };
  deadReasons: { reason: string; count: number }[];
  /** How much outreach has actually happened. Drives the confidence warning. */
  sampleSize: number;
}

interface Bucket {
  total: number;
  sent: number;
  replied: number;
  won: number;
}

const emptyBucket = (): Bucket => ({ total: 0, sent: 0, replied: 0, won: 0 });

const pct = (part: number, whole: number) =>
  whole ? Math.round((part / whole) * 1000) / 10 : 0;

function toSegments(map: Map<string, Bucket>): Segment[] {
  return [...map.entries()]
    .filter(([, b]) => b.sent > 0)
    .map(([key, b]) => ({
      key,
      label: key || "(unknown)",
      total: b.total,
      sent: b.sent,
      replied: b.replied,
      won: b.won,
      replyRate: pct(b.replied, b.sent),
      winRate: pct(b.won, b.sent),
    }))
    .sort((a, b) => b.replyRate - a.replyRate || b.sent - a.sent);
}

/**
 * One pass over the leads producing every breakdown the dashboard and the
 * insights feature need, so the two can never disagree.
 */
export async function computeStats(): Promise<StatsResult> {
  const leads = await Lead.find(
    {},
    { status: 1, area: 1, category: 1, leadType: 1, score: 1, reviews: 1, deadReason: 1 },
  ).lean();

  const totals: StatsResult["totals"] = {
    leads: leads.length,
    new: 0, sent: 0, replied: 0, interested: 0, won: 0, dead: 0, dueToday: 0,
  };

  const maps = {
    byArea: new Map<string, Bucket>(),
    byCategory: new Map<string, Bucket>(),
    byLeadType: new Map<string, Bucket>(),
    byScoreBand: new Map<string, Bucket>(),
    byReviewBand: new Map<string, Bucket>(),
  };
  const deadReasons = new Map<string, number>();

  const bump = (map: Map<string, Bucket>, key: string, sent: boolean, replied: boolean, won: boolean) => {
    const b = map.get(key) ?? emptyBucket();
    b.total++;
    if (sent) b.sent++;
    if (replied) b.replied++;
    if (won) b.won++;
    map.set(key, b);
  };

  for (const l of leads) {
    const status = String(l.status) as Status;
    switch (status) {
      case "NEW": totals.new++; break;
      case "SENT": totals.sent++; break;
      case "REPLIED": totals.replied++; break;
      case "INTERESTED": totals.interested++; break;
      case "WON": totals.won++; break;
      case "DEAD": totals.dead++; break;
    }

    const sent = SENT_STATUSES.includes(status);
    const replied = REPLIED_STATUSES.includes(status);
    const won = status === "WON";

    bump(maps.byArea, l.area ?? "", sent, replied, won);
    bump(maps.byCategory, l.category ?? "", sent, replied, won);
    bump(maps.byLeadType, String(l.leadType), sent, replied, won);
    bump(maps.byScoreBand, scoreBand(l.score ?? 0), sent, replied, won);
    bump(maps.byReviewBand, reviewBand(l.reviews ?? 0), sent, replied, won);

    if (l.deadReason) {
      const r = String(l.deadReason);
      deadReasons.set(r, (deadReasons.get(r) ?? 0) + 1);
    }
  }

  totals.dueToday = await Lead.countDocuments({
    nextFollowUpAt: { $lte: new Date() },
    status: { $in: ["SENT", "REPLIED", "INTERESTED"] },
  });

  const sampleSize = totals.sent + totals.replied + totals.interested + totals.won + totals.dead;
  const repliedTotal = totals.replied + totals.interested + totals.won;

  return {
    totals,
    replyRate: pct(repliedTotal, sampleSize),
    winRate: pct(totals.won, sampleSize),
    segments: {
      byArea: toSegments(maps.byArea),
      byCategory: toSegments(maps.byCategory),
      byLeadType: toSegments(maps.byLeadType),
      byScoreBand: toSegments(maps.byScoreBand),
      byReviewBand: toSegments(maps.byReviewBand),
    },
    deadReasons: [...deadReasons.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count),
    sampleSize,
  };
}
