import { api } from "@/lib/api-client";
import type { Stats } from "../types";

export const statsKeys = {
  all: ["stats"] as const,
  overview: () => [...statsKeys.all, "overview"] as const,
};

export async function fetchStats(): Promise<Stats> {
  const { data } = await api.get<Stats>("/api/stats");
  return data;
}
