import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

export const EVENT_TYPES = [
  "IMPORTED",
  "MESSAGE_SENT",
  "STATUS_CHANGED",
  "NOTE_ADDED",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

/**
 * Append-only log of what happened to each lead. The Lead document holds
 * current state; this holds the history the insights feature needs to work out
 * when things went right or wrong.
 */
const eventSchema = new Schema({
  leadId: { type: Schema.Types.ObjectId, ref: "Lead", required: true, index: true },
  type: { type: String, enum: EVENT_TYPES, required: true, index: true },
  /** Which touch this was: 1 = first message, 2 and 3 = follow-ups. */
  touch: { type: Number, default: null },
  from: { type: String, default: "" },
  to: { type: String, default: "" },
  note: { type: String, default: "" },
  at: { type: Date, default: Date.now, index: true },
});

eventSchema.index({ leadId: 1, at: -1 });

export type EventDoc = InferSchemaType<typeof eventSchema>;

export const Event: Model<EventDoc> =
  (mongoose.models.Event as Model<EventDoc>) ?? mongoose.model<EventDoc>("Event", eventSchema);
