import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** Express 5 forwards rejected promises, but this keeps the intent explicit. */
export function asyncHandler(fn: RequestHandler): RequestHandler {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/** Route params are loosely typed in Express 5; narrow before using them. */
export function param(raw: string | string[] | undefined): string | undefined {
  return Array.isArray(raw) ? raw[0] : raw;
}

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: "Invalid request",
      details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
    });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }

  const message = err instanceof Error ? err.message : "Unexpected error";
  // A missing MONGODB_URI is the most likely first-run failure -- say so
  // plainly rather than returning a generic 500.
  const status = message.includes("MONGODB_URI") ? 503 : 500;

  console.error("[api]", err);
  res.status(status).json({
    error: status === 503 ? message : "Internal server error",
    ...(process.env.NODE_ENV !== "production" && status === 500 ? { detail: message } : {}),
  });
}
