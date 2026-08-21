import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./core/env.js";
import { connectDB, dbState } from "./core/db.js";
import { asyncHandler, errorHandler } from "./core/http.js";
import { authRoutes } from "./features/auth/auth.routes.js";
import { requireAuth } from "./features/auth/auth.middleware.js";
import { leadRoutes } from "./features/leads/lead.routes.js";
import { importRoutes } from "./features/import/import.routes.js";
import { statsRoutes } from "./features/stats/stats.routes.js";
import { insightsRoutes } from "./features/insights/insights.routes.js";

/**
 * Every feature registers itself here and nowhere else.
 * Everything listed is behind requireAuth — this data is a list of real
 * businesses and their phone numbers, so nothing here is public.
 */
const FEATURES = [
  { path: "/api/leads", router: leadRoutes },
  { path: "/api/import", router: importRoutes },
  { path: "/api/stats", router: statsRoutes },
  { path: "/api/insights", router: insightsRoutes },
] as const;

export function createApp() {
  const app = express();

  app.set("trust proxy", 1); // Render terminates TLS in front of us

  app.use(helmet());
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan(env.isProduction ? "combined" : "dev"));

  /** Health check must not need the database, so Render's probe still passes. */
  app.get("/health", (_req, res) => {
    res.json({ ok: true, db: dbState(), uptime: Math.round(process.uptime()) });
  });

  /**
   * Render idles free instances down. Connecting per-request (the driver
   * no-ops when already connected) means the first call after a wake works
   * instead of failing on a dead pool.
   */
  app.use(
    "/api",
    asyncHandler(async (_req, _res, next) => {
      await connectDB();
      next();
    }),
  );

  // Auth is mounted before the guard: you cannot sign in through it otherwise.
  app.use("/api/auth", authRoutes);

  for (const { path, router } of FEATURES) app.use(path, requireAuth, router);

  app.use((_req, res) => res.status(404).json({ error: "Not found" }));
  app.use(errorHandler);

  return app;
}
