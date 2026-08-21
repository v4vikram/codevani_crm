import mongoose from "mongoose";
import { createApp } from "./app.js";
import { env } from "./core/env.js";

const server = createApp().listen(env.PORT, () => {
  console.log(`[api] listening on :${env.PORT}`);
  if (!env.MONGODB_URI) {
    console.warn("[api] MONGODB_URI is not set — /api routes will return 503 until it is.");
  }
});

for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    console.log(`[api] ${signal} received, shutting down`);
    server.close(() => {
      void mongoose.disconnect().finally(() => process.exit(0));
    });
  });
}
