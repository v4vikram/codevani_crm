import { api } from "@/lib/api-client";
import type {
  Lead,
  LeadEvent,
  LeadFilters,
  LeadListResult,
  NextMessage,
  Status,
  DeadReason,
  TodayUsage,
} from "../types";

export const leadKeys = {
  all: ["leads"] as const,
  list: (filters: LeadFilters) => [...leadKeys.all, "list", filters] as const,
  detail: (id: string) => [...leadKeys.all, "detail", id] as const,
  message: (id: string) => [...leadKeys.all, "message", id] as const,
  areas: () => [...leadKeys.all, "areas"] as const,
  usage: () => [...leadKeys.all, "usage"] as const,
};

export async function fetchLeads(filters: LeadFilters): Promise<LeadListResult> {
  // Drop empty values so the API applies its own defaults.
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== "" && v !== false),
  );
  const { data } = await api.get<LeadListResult>("/api/leads", { params });
  return data;
}

export async function fetchLead(id: string): Promise<{ lead: Lead; events: LeadEvent[] }> {
  const { data } = await api.get<{ lead: Lead; events: LeadEvent[] }>(`/api/leads/${id}`);
  return data;
}

export async function fetchNextMessage(id: string): Promise<NextMessage> {
  const { data } = await api.get<NextMessage>(`/api/leads/${id}/message`);
  return data;
}

export async function fetchAreas(): Promise<string[]> {
  const { data } = await api.get<{ areas: string[] }>("/api/leads/areas");
  return data.areas;
}

export async function fetchTodayUsage(): Promise<TodayUsage> {
  const { data } = await api.get<TodayUsage>("/api/leads/usage/today");
  return data;
}

export async function updateLead(
  id: string,
  patch: { status?: Status; notes?: string; deadReason?: DeadReason | null },
): Promise<Lead> {
  const { data } = await api.patch<{ lead: Lead }>(`/api/leads/${id}`, patch);
  return data.lead;
}

/** Call this the moment the user taps through to WhatsApp. */
export async function markSent(id: string): Promise<Lead> {
  const { data } = await api.post<{ lead: Lead }>(`/api/leads/${id}/sent`);
  return data.lead;
}
