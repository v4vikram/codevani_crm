import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../../core/http.js";
import { verifyToken } from "./auth.service.js";

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
export function requireAuth(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new HttpError(401, "Sign in to continue."));
  }

  try {
    const payload = verifyToken(header.slice(7).trim());
    req.userId = payload.sub;
    next();
  } catch (err) {
    next(err);
  }
}
