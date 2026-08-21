"use client";

import { useQuery } from "@tanstack/react-query";
import { Sparkles, Info } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorMessage } from "@/lib/api-client";
import { fetchStats, statsKeys } from "@/features/stats/api/stats.api";
import type { Segment } from "@/features/stats/types";
import { fetchInsights, insightsKeys } from "../api/insights.api";

export function InsightsPanel() {
  const insights = useQuery({ queryKey: insightsKeys.all, queryFn: fetchInsights });
  const stats = useQuery({ queryKey: statsKeys.overview(), queryFn: fetchStats });

  if (insights.isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (insights.isError) {
    return (
      <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
        {apiErrorMessage(insights.error)}
      </p>
    );
  }

  const data = insights.data;

  return (
    <div className="space-y-5">
      {data.lowConfidence && (
        <p className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm text-warning">
          <Info className="mt-0.5 size-4 shrink-0" />
          <span>
            Only {data.sampleSize} message{data.sampleSize === 1 ? "" : "s"} sent. That is too few
            to tell which areas or business types actually convert — anything below looks like a
            pattern but is mostly luck. Aim for 30+ before trusting it.
          </span>
        </p>
      )}

      <section className="space-y-2">
        <h2 className="font-semibold">What the numbers say</h2>
        <ul className="space-y-2">
          {data.observations.map((o, i) => (
            <li key={i} className="rounded-lg border border-border bg-card p-3 text-sm">
              {o}
            </li>
          ))}
        </ul>
      </section>

      {data.narrative ? (
        <section className="space-y-2">
          <h2 className="flex items-center gap-2 font-semibold">
            <Sparkles className="size-4 text-primary" /> Analysis
          </h2>
          <div className="whitespace-pre-wrap rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm leading-relaxed">
            {data.narrative}
          </div>
        </section>
      ) : (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Written analysis is off. Add <code>ANTHROPIC_API_KEY</code> to the API environment to turn
          it on — everything above works without it.
        </p>
      )}

      {stats.data && stats.data.sampleSize > 0 && (
        <section className="space-y-4">
          <h2 className="font-semibold">Breakdown</h2>
          <SegmentTable title="By area" segments={stats.data.segments.byArea} />
          <SegmentTable title="By business type" segments={stats.data.segments.byCategory} />
          <SegmentTable title="By listing type" segments={stats.data.segments.byLeadType} />
          <SegmentTable title="By review count" segments={stats.data.segments.byReviewBand} />
        </section>
      )}
    </div>
  );
}

function SegmentTable({ title, segments }: { title: string; segments: Segment[] }) {
  if (!segments.length) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-muted-foreground">{title}</h3>
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead className="bg-secondary/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Segment</th>
              <th className="px-3 py-2 text-right font-medium">Sent</th>
              <th className="px-3 py-2 text-right font-medium">Replied</th>
              <th className="px-3 py-2 text-right font-medium">Rate</th>
            </tr>
          </thead>
          <tbody>
            {segments.map((s) => (
              <tr key={s.key} className="border-t border-border">
                <td className="px-3 py-2">{s.label}</td>
                <td className="px-3 py-2 text-right tabular-nums">{s.sent}</td>
                <td className="px-3 py-2 text-right tabular-nums">{s.replied}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {/* Below 5 sends a percentage is theatre, so show the raw split. */}
                  {s.sent < 5 ? (
                    <span className="text-muted-foreground">
                      {s.replied}/{s.sent}
                    </span>
                  ) : (
                    `${s.replyRate}%`
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
