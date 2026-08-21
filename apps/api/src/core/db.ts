import mongoose from "mongoose";

let connecting: Promise<typeof mongoose> | null = null;

/**
 * Render idles free instances down and restarts them, so connect lazily and
 * reuse the in-flight promise rather than assuming a connection exists at boot.
 * MONGODB_URI is read at call time so tests can point it at a memory server.
 */
export async function connectDB(): Promise<typeof mongoose> {
  if (mongoose.connection.readyState === 1) return mongoose;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error(
      "MONGODB_URI is not set. Copy apps/api/.env.example to apps/api/.env and add your Atlas connection string.",
    );
  }

  if (!connecting) {
    connecting = mongoose
      .connect(uri, { bufferCommands: false, maxPoolSize: 10, serverSelectionTimeoutMS: 10_000 })
      .catch((err) => {
        connecting = null; // let the next request retry instead of caching the failure
        throw err;
      });
  }
  return connecting;
}

export async function disconnectDB(): Promise<void> {
  connecting = null;
  await mongoose.disconnect();
}

export const dbState = () =>
  mongoose.connection.readyState === 1 ? "connected" : "disconnected";
