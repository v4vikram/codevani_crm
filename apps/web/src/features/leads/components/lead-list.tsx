"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQuery, keepPreviousData } from "@tanstack/react-query";
import { Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { apiErrorMessage } from "@/lib/api-client";
import { fetchLeads, fetchTodayUsage, leadKeys } from "../api/leads.api";
import { STATUSES, STATUS_META, type LeadFilters, type Status } from "../types";
import { usePaginationMode } from "../use-pagination-mode";
import { LeadCard } from "./lead-card";
import { ModeSwitch, PageNav } from "./pagination";

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

  const [mode, setMode] = usePaginationMode();

  // Only the active mode's query runs; the other keeps its cache for when you switch back.
  const paged = useQuery({
    queryKey: leadKeys.list(filters),
    queryFn: () => fetchLeads(filters),
    placeholderData: keepPreviousData,
    enabled: mode === "pages",
  });

  // Scroll mode owns the page number, so it is stripped from the cache key.
  const scrollFilters: LeadFilters = { ...filters, page: undefined };
  const scrolled = useInfiniteQuery({
    queryKey: leadKeys.infinite(scrollFilters),
    queryFn: ({ pageParam }) => fetchLeads({ ...scrollFilters, page: pageParam }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.pages ? last.page + 1 : undefined),
    enabled: mode === "scroll",
  });

  const active = mode === "pages" ? paged : scrolled;
  const { isPending, isError, error } = active;
  const isPlaceholderData = mode === "pages" && paged.isPlaceholderData;

  // Rows can shift between page fetches (a lead changes status, an import lands),
  // so a lead may appear on two loaded pages; keep the first occurrence.
  const leads = useMemo(() => {
    if (mode === "pages") return paged.data?.leads;
    const all = scrolled.data?.pages.flatMap((p) => p.leads);
    return all && [...new Map(all.map((l) => [l._id, l])).values()];
  }, [mode, paged.data, scrolled.data]);

  const first = mode === "pages" ? paged.data : scrolled.data?.pages[0];
  const total = first?.total ?? 0;
  const totalPages = first?.pages ?? 1;
  const currentPage = mode === "pages" ? (paged.data?.page ?? 1) : 1;

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = scrolled;
  const sentinel = useRef<HTMLDivElement>(null);
  const loadedPages = scrolled.data?.pages.length ?? 0;

  useEffect(() => {
    const el = sentinel.current;
    if (mode !== "scroll" || !el || !hasNextPage) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "400px" }, // start fetching before the bottom is actually reached
    );
    observer.observe(el);
    return () => observer.disconnect();
    // loadedPages: re-observe after each load, so a sentinel still in view keeps pulling.
  }, [mode, hasNextPage, isFetchingNextPage, fetchNextPage, loadedPages]);

  const goToPage = (page: number) => {
    setFilters((f) => ({ ...f, page }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

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

      {leads && leads.length === 0 && (
        <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No leads match this filter.
        </p>
      )}

      {leads && leads.length > 0 && (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              {mode === "scroll" && total > leads.length
                ? `${leads.length} of ${total} leads`
                : `${total} lead${total === 1 ? "" : "s"}`}
            </p>
            {totalPages > 1 && <ModeSwitch mode={mode} onChange={setMode} />}
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
            {leads.map((lead) => (
              <LeadCard key={lead._id} lead={lead} atCap={atCap} />
            ))}
          </div>

          {mode === "pages" && totalPages > 1 && (
            <PageNav page={currentPage} pages={totalPages} onChange={goToPage} />
          )}

          {mode === "scroll" && (
            <div ref={sentinel} className="py-4 text-center text-sm text-muted-foreground" aria-live="polite">
              {isFetchingNextPage
                ? "Loading more…"
                : hasNextPage
                  ? ""
                  : total > PAGE_SIZE
                    ? `You've reached the end — ${total} leads`
                    : ""}
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
