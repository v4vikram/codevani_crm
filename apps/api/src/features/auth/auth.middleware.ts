import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../../core/http.js";
import { assertSessionCurrent, verifyToken } from "./auth.service.js";

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

/**
 * Bearer tokens rather than cookies: the web app and API are on different
 * domains (Vercel and Render), and browsers that block third-party cookies
 * would silently drop a cross-site session cookie.
 */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new HttpError(401, "Sign in to continue."));
  }

  try {
    const payload = verifyToken(header.slice(7).trim());
    await assertSessionCurrent(payload);
    req.userId = payload.sub;
    next();
  } catch (err) {
    next(err);
  }
}
