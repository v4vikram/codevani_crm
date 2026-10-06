"use client";

import { useCallback, useEffect, useState } from "react";
import type { PaginationMode } from "./components/pagination";

const KEY = "peoples-pagination-mode";

/**
 * Remembers whether this person prefers numbered pages or endless scroll.
 * Per-browser only (localStorage) -- it's a viewing preference, not account data.
 */
export function usePaginationMode(): [PaginationMode, (mode: PaginationMode) => void] {
  const [mode, setModeState] = useState<PaginationMode>("pages");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY);
      // Read after mount so the server and first client render agree.
      if (saved === "pages" || saved === "scroll") queueMicrotask(() => setModeState(saved));
    } catch {
      /* storage blocked; stay on the default */
    }
  }, []);

  const setMode = useCallback((next: PaginationMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      /* the choice just won't survive a reload */
    }
  }, []);

  return [mode, setMode];
}
