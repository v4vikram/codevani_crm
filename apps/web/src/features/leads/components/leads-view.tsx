"use client";

import { useSearchParams } from "next/navigation";
import { LeadList } from "./lead-list";
import { STATUSES, type Status, type LeadFilters } from "../types";

/**
 * Reads the deep links the dashboard produces (/leads?status=NEW, /leads?due=1)
 * and turns them into the list's starting filters.
 */
export function LeadsView() {
  const params = useSearchParams();

  const statusParam = params.get("status");
  const dueOnly = params.get("due") === "1";
  const status: Status | "ALL" =
    statusParam && (STATUSES as readonly string[]).includes(statusParam)
      ? (statusParam as Status)
      : "ALL";

  const initialFilters: LeadFilters = dueOnly
    ? { dueOnly: true, sort: "score" }
    : { status, sort: "score" };

  return (
    <>
      <header>
        <h1 className="text-xl font-semibold">
          {dueOnly ? "Follow-ups due" : status === "ALL" ? "All leads" : `${status.toLowerCase()} leads`}
        </h1>
        <p className="text-sm text-muted-foreground">
          {dueOnly
            ? "Second and third messages are where most replies come from."
            : "Highest score first — those are the ones worth your time."}
        </p>
      </header>
      <LeadList initialFilters={initialFilters} />
    </>
  );
}
