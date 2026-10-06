"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Which page numbers to show: always the first, last and the current page with
 * its neighbours, and "…" for the gaps. A gap of a single page shows that page
 * instead -- an ellipsis that hides one number is worse than the number.
 */
export function pageWindow(page: number, pages: number): (number | "…")[] {
  const wanted = new Set([1, pages, page - 1, page, page + 1]);
  const nums = [...wanted].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);

  const out: (number | "…")[] = [];
  nums.forEach((n, i) => {
    const prev = nums[i - 1];
    if (prev !== undefined && n - prev === 2) out.push(prev + 1);
    else if (prev !== undefined && n - prev > 2) out.push("…");
    out.push(n);
  });
  return out;
}

export function PageNav({
  page,
  pages,
  onChange,
}: {
  page: number;
  pages: number;
  onChange: (page: number) => void;
}) {
  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1 pt-2">
      <Button
        variant="outline"
        size="sm"
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
        aria-label="Previous page"
      >
        <ChevronLeft />
        <span className="hidden sm:inline">Previous</span>
      </Button>

      {pageWindow(page, pages).map((item, i) =>
        item === "…" ? (
          <span key={`gap-${i}`} aria-hidden className="px-1 text-sm text-muted-foreground">
            …
          </span>
        ) : (
          <button
            key={item}
            type="button"
            onClick={() => onChange(item)}
            aria-label={`Page ${item}`}
            aria-current={item === page ? "page" : undefined}
            className={cn(
              "h-9 min-w-9 rounded-md px-2 text-sm font-medium transition-colors",
              item === page
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            {item}
          </button>
        ),
      )}

      <Button
        variant="outline"
        size="sm"
        disabled={page >= pages}
        onClick={() => onChange(page + 1)}
        aria-label="Next page"
      >
        <span className="hidden sm:inline">Next</span>
        <ChevronRight />
      </Button>
    </nav>
  );
}

export type PaginationMode = "pages" | "scroll";

/** Segmented control for choosing how the list paginates. */
export function ModeSwitch({
  mode,
  onChange,
}: {
  mode: PaginationMode;
  onChange: (mode: PaginationMode) => void;
}) {
  const options: { value: PaginationMode; label: string }[] = [
    { value: "pages", label: "Pages" },
    { value: "scroll", label: "Scroll" },
  ];
  return (
    <div role="group" aria-label="Pagination style" className="inline-flex rounded-md bg-secondary p-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={mode === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded px-2.5 py-1 text-xs font-medium transition-colors",
            mode === o.value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
