import axios from "axios";

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
