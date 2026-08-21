import axios from "axios";

const TOKEN_KEY = "peoples-token";

/**
 * One axios instance for the whole app. The base URL points at the Express API
 * (localhost in dev, the Render URL in production) and must be baked in at
 * build time, hence NEXT_PUBLIC_.
 */
export const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000",
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

/**
 * The token lives in localStorage rather than a cookie because the app and API
 * sit on different domains (Vercel and Render) — browsers that block
 * third-party cookies would silently drop a cross-site session cookie.
 *
 * The trade-off is that XSS could read it, so never render untrusted HTML.
 */
export function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null; // private mode, or site data blocked
  }
}

export function setAuthToken(token: string | null): void {
  if (typeof window === "undefined") return;
  try {
    if (token) window.localStorage.setItem(TOKEN_KEY, token);
    else window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* storage unavailable; the session simply won't survive a reload */
  }
}

let unauthorizedHandler: (() => void) | null = null;

/** Registers what to do when the API rejects the session. Returns an unsubscribe. */
export function onUnauthorized(handler: () => void): () => void {
  unauthorizedHandler = handler;
  return () => {
    if (unauthorizedHandler === handler) unauthorizedHandler = null;
  };
}

api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Signing in with the wrong password also returns 401 — that must show an
    // error on the form, not bounce the user to the login page they're on.
    const url = error?.config?.url ?? "";
    const isAuthAttempt = url.includes("/api/auth/login") || url.includes("/api/auth/register");

    if (error?.response?.status === 401 && !isAuthAttempt) {
      unauthorizedHandler?.();
    }
    return Promise.reject(error);
  },
);

/**
 * The API returns { error, details? }. Surface that text rather than axios's
 * generic "Request failed with status code 400", which tells the user nothing.
 */
export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { error?: string; details?: { message: string }[] } | undefined;
    if (data?.details?.length) {
      return `${data.error ?? "Invalid request"}: ${data.details.map((d) => d.message).join(", ")}`;
    }
    if (data?.error) return data.error;
    if (err.code === "ECONNABORTED") return "The API took too long to respond.";
    if (!err.response) {
      return "Cannot reach the API. Is it running on " + (api.defaults.baseURL ?? "?") + " ?";
    }
    return err.message;
  }
  return err instanceof Error ? err.message : "Something went wrong";
}
