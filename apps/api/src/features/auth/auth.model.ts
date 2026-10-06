import mongoose, { Schema, type InferSchemaType, type Model } from "mongoose";

const userSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
      lowercase: true,
    },
    name: { type: String, default: "", trim: true },
    /** bcrypt hash. Never selected by default so it cannot leak into a response. */
    passwordHash: { type: String, required: true, select: false },
    lastLoginAt: { type: Date, default: null },
    /** SHA-256 of the emailed reset token — the raw token is never stored. */
    resetTokenHash: { type: String, default: null, select: false, index: true },
    resetTokenExpiresAt: { type: Date, default: null, select: false },
    /** Sessions issued before this are rejected, so a reset signs out every other device. */
    passwordChangedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema>;

export const User: Model<UserDoc> =
  (mongoose.models.User as Model<UserDoc>) ?? mongoose.model<UserDoc>("User", userSchema);
