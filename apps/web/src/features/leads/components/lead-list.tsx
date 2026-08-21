"use client";

import { useState } from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorMessage } from "@/lib/api-client";
import { fetchLeads, fetchTodayUsage, leadKeys } from "../api/leads.api";
import { STATUSES, STATUS_META, type LeadFilters, type Status } from "../types";
import { LeadCard } from "./lead-card";

const PAGE_SIZE = 25;

export function LeadList({ initialFilters = {} }: { initialFilters?: LeadFilters }) {
  const [filters, setFilters] = useState<LeadFilters>({
    status: "ALL",
    sort: "score",
    page: 1,
    limit: PAGE_SIZE,
    ...initialFilters,
  });
  const [searchDraft, setSearchDraft] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const { data, isPending, isError, error, isPlaceholderData } = useQuery({
    queryKey: leadKeys.list(filters),
    queryFn: () => fetchLeads(filters),
    placeholderData: keepPreviousData,
  });

  const { data: usage } = useQuery({ queryKey: leadKeys.usage(), queryFn: fetchTodayUsage });
  const atCap = usage ? usage.sentToday >= usage.cap : false;

  /** Any filter change resets to page 1 -- staying on page 4 of a new filter is disorienting. */
  const setFilter = (patch: Partial<LeadFilters>) =>
    setFilters((f) => ({ ...f, ...patch, page: 1 }));

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setFilter({ search: searchDraft.trim() || undefined });
        }}
        className="flex gap-2"
      >
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchDraft}
            onChange={(e) => setSearchDraft(e.target.value)}
            placeholder="Search by name"
            className="pl-9"
            type="search"
            enterKeyHint="search"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Filters"
          aria-expanded={showFilters}
          onClick={() => setShowFilters((v) => !v)}
        >
          <SlidersHorizontal />
        </Button>
      </form>

      {showFilters && (
        <div className="flex flex-wrap gap-2 rounded-lg border border-border bg-card p-3">
          <FilterChip
            label="All"
            active={filters.status === "ALL"}
            onClick={() => setFilter({ status: "ALL" })}
          />
          {STATUSES.map((s: Status) => (
            <FilterChip
              key={s}
              label={STATUS_META[s].label}
              active={filters.status === s}
              onClick={() => setFilter({ status: s })}
            />
          ))}
          <div className="w-full border-t border-border pt-2" />
          <FilterChip
            label="Best score"
            active={filters.sort === "score"}
            onClick={() => setFilter({ sort: "score" })}
          />
          <FilterChip
            label="Most reviews"
            active={filters.sort === "reviews"}
            onClick={() => setFilter({ sort: "reviews" })}
          />
          <FilterChip
            label="Recently touched"
            active={filters.sort === "recent"}
            onClick={() => setFilter({ sort: "recent" })}
          />
        </div>
      )}

      {isPending && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      )}

      {isError && (
        <p className="rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
          {apiErrorMessage(error)}
        </p>
      )}

      {data && data.leads.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No leads match this filter.
        </p>
      )}

      {data && data.leads.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {data.total} lead{data.total === 1 ? "" : "s"}
            </p>
            {usage && (
              <p className={atCap ? "text-sm font-medium text-warning" : "text-sm text-muted-foreground"}>
                {usage.sentToday}/{usage.cap} sent today
              </p>
            )}
          </div>

          {atCap && (
            <p className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm text-warning">
              You have hit today&apos;s cap. Stopping here is what keeps your number alive.
            </p>
          )}
          <div className={isPlaceholderData ? "space-y-3 opacity-60" : "space-y-3"}>
            {data.leads.map((lead) => (
              <LeadCard key={lead._id} lead={lead} atCap={atCap} />
            ))}
          </div>

          {data.pages > 1 && (
            <div className="flex items-center justify-between gap-3 pt-2">
              <Button
                variant="outline"
                disabled={data.page <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) - 1 }))}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                {data.page} / {data.pages}
              </span>
              <Button
                variant="outline"
                disabled={data.page >= data.pages}
                onClick={() => setFilters((f) => ({ ...f, page: (f.page ?? 1) + 1 }))}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        active
          ? "rounded-full bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground"
          : "rounded-full bg-secondary px-3 py-1.5 text-sm font-medium text-secondary-foreground hover:brightness-95"
      }
    >
      {label}
    </button>
  );
}
