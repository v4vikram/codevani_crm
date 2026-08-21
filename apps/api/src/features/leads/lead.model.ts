import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";
import { LEAD_TYPES, STATUSES, DEAD_REASONS } from "./lead.rules.js";

const leadSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, trim: true },
    /** 10-digit form. The dedupe key -- one row per business phone. */
    phoneKey: { type: String, required: true, unique: true, index: true },
    /** Country-coded, ready for wa.me. Null when the number looked unusable. */
    waNumber: { type: String, default: null },

    leadType: { type: String, enum: LEAD_TYPES, required: true, index: true },
    score: { type: Number, required: true, min: 0, max: 100, index: true },
    status: { type: String, enum: STATUSES, default: "NEW", index: true },

    rating: { type: Number, default: 0 },
    reviews: { type: Number, default: 0 },
    area: { type: String, default: "", trim: true, index: true },
    category: { type: String, default: "", trim: true },
    address: { type: String, default: "" },
    websiteUrl: { type: String, default: "" },
    mapsUrl: { type: String, default: "" },

    source: { type: String, default: "" },
    keyword: { type: String, default: "" },

    notes: { type: String, default: "" },
    deadReason: { type: String, enum: [...DEAD_REASONS, null], default: null },

    /** How many times you have messaged them. Decides which template is used next. */
    touches: { type: Number, default: 0 },
    sentAt: { type: Date, default: null },
    repliedAt: { type: Date, default: null },
    nextFollowUpAt: { type: Date, default: null, index: true },
  },
  { timestamps: true },
);

/** The lead list is almost always "best first within a status". */
leadSchema.index({ status: 1, score: -1, reviews: -1 });

export type LeadDoc = InferSchemaType<typeof leadSchema>;

export const Lead: Model<LeadDoc> =
  (mongoose.models.Lead as Model<LeadDoc>) ?? mongoose.model<LeadDoc>("Lead", leadSchema);
