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

export interface Stats {
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
  sampleSize: number;
}

export interface Insights {
  observations: string[];
  narrative?: string;
  lowConfidence: boolean;
  sampleSize: number;
  generatedAt: string;
}
