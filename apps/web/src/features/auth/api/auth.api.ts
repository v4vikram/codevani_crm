import { api } from "@/lib/api-client";
import type { AuthResponse, Credentials, RegisterInput, User } from "../types";

export const authKeys = {
  me: ["auth", "me"] as const,
  setup: ["auth", "setup"] as const,
};

export async function login(credentials: Credentials): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/api/auth/login", credentials);
  return data;
}

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/api/auth/register", input);
  return data;
}

export async function fetchMe(): Promise<User> {
  const { data } = await api.get<{ user: User }>("/api/auth/me");
  return data.user;
}

/** Whether this deployment still has no accounts, so we offer first-run setup. */
export async function fetchSetupState(): Promise<{ needsSetup: boolean }> {
  const { data } = await api.get<{ needsSetup: boolean }>("/api/auth/setup");
  return data;
}
