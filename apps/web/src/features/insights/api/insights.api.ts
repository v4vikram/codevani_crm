import { api } from "@/lib/api-client";
import type { Insights } from "@/features/stats/types";

export const insightsKeys = {
  all: ["insights"] as const,
};

export async function fetchInsights(): Promise<Insights> {
  // The AI narrative can take a few seconds; allow for it.
  const { data } = await api.get<Insights>("/api/insights", { timeout: 90_000 });
  return data;
}
