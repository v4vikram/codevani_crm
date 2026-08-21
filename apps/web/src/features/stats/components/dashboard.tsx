"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorMessage } from "@/lib/api-client";
import { fetchStats, statsKeys } from "../api/stats.api";
import { StatTile } from "./stat-tile";

export function Dashboard() {
  const { data, isPending, isError, error } = useQuery({
    queryKey: statsKeys.overview(),
    queryFn: fetchStats,
  });

  if (isPending) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (isError) {
    return (
      <div className="space-y-3 rounded-lg border border-destructive/40 bg-destructive/10 p-4">
        <p className="text-sm text-destructive">{apiErrorMessage(error)}</p>
        <p className="text-sm text-muted-foreground">
          Start the API with <code>npm run dev:api</code>, or check that
          NEXT_PUBLIC_API_URL points at it.
        </p>
      </div>
    );
  }

  const { totals, replyRate, sampleSize } = data;
  const replies = totals.replied + totals.interested + totals.won;

  return (
    <div className="space-y-5">
      {totals.leads === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-8 text-center">
          <p className="font-medium">No leads yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Import an Apify CSV to get started.
          </p>
          <Button asChild className="mt-4">
            <Link href="/import">
              Import a CSV <ArrowRight />
            </Link>
          </Button>
        </div>
      ) : (
        <>
          {totals.dueToday > 0 && (
            <Link
              href="/leads?due=1"
              className="flex items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4"
            >
              <div>
                <p className="font-medium text-warning">
                  {totals.dueToday} follow-up{totals.dueToday === 1 ? "" : "s"} due
                </p>
                <p className="text-sm text-muted-foreground">
                  Most replies come from the second message, not the first.
                </p>
              </div>
              <ArrowRight className="size-5 shrink-0 text-warning" />
            </Link>
          )}

          <div className="grid grid-cols-2 gap-3">
            <StatTile
              label="Ready to contact"
              value={totals.new}
              hint="never messaged"
              href="/leads?status=NEW"
              emphasis={totals.new > 0 ? "success" : "default"}
            />
            <StatTile label="Messaged" value={sampleSize} hint="total sent" href="/leads?status=SENT" />
            <StatTile
              label="Replies"
              value={replies}
              hint={sampleSize > 0 ? `${replyRate}% reply rate` : undefined}
              href="/leads?status=REPLIED"
            />
            <StatTile
              label="Won"
              value={totals.won}
              href="/leads?status=WON"
              emphasis={totals.won > 0 ? "success" : "default"}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline">
              <Link href="/leads?status=NEW">Work the queue</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href="/insights">See what&apos;s working</Link>
            </Button>
          </div>

          {sampleSize > 0 && sampleSize < 30 && (
            <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
              {sampleSize} messages sent so far. Patterns in the data are not trustworthy below
              about 30 — keep sending before drawing conclusions about which areas convert.
            </p>
          )}
        </>
      )}
    </div>
  );
}
