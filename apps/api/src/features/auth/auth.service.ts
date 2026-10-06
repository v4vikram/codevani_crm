import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { env } from "../../core/env.js";
import { HttpError } from "../../core/http.js";
import { sendMail } from "../../core/mailer.js";
import { User, type UserDoc } from "./auth.model.js";
import type { LoginInput, RegisterInput, ResetPasswordInput, UserDTO } from "./auth.dto.js";

const BCRYPT_ROUNDS = 12;
const TOKEN_TTL = "7d";
const RESET_TTL_MS = 30 * 60 * 1000;
/** Stops the forgot-password form being used to flood someone's inbox. */
const RESET_COOLDOWN_MS = 60 * 1000;

interface TokenPayload {
  sub: string;
  email: string;
  /** Seconds since epoch, added by jsonwebtoken. */
  iat: number;
}

type LeanUser = UserDoc & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };

function toUserDTO(doc: LeanUser): UserDTO {
  return {
    _id: doc._id.toString(),
    email: doc.email,
    name: doc.name ?? "",
    createdAt: doc.createdAt.toISOString(),
  };
}

function signToken(user: LeanUser): string {
  const payload = { sub: user._id.toString(), email: user.email };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  } catch {
    throw new HttpError(401, "Session expired. Please sign in again.");
  }
}

/**
 * Rejects a token issued before the password last changed, so resetting a
 * password also signs out whoever else held a session.
 */
export async function assertSessionCurrent(payload: TokenPayload): Promise<void> {
  if (!Types.ObjectId.isValid(payload.sub)) throw new HttpError(401, "Invalid session.");
  const user = await User.findById(payload.sub).select("passwordChangedAt").lean();
  if (!user) throw new HttpError(401, "Account no longer exists.");
  if (user.passwordChangedAt && Math.floor(user.passwordChangedAt.getTime() / 1000) > payload.iat) {
    throw new HttpError(401, "Your password was changed. Please sign in again.");
  }
}

/** True while nobody has signed up — the UI uses this to show first-run setup. */
export async function needsSetup(): Promise<boolean> {
  return (await User.estimatedDocumentCount()) === 0;
}

/**
 * Registration is closed by default. The very first account can be created
 * freely (first-run setup); after that a SIGNUP_CODE is required, so a public
 * URL cannot be used to mint accounts.
 */
export async function register(input: RegisterInput) {
  const isFirstUser = await needsSetup();

  if (!isFirstUser) {
    if (!env.SIGNUP_CODE) {
      throw new HttpError(403, "Registration is closed.");
    }
    if (input.signupCode !== env.SIGNUP_CODE) {
      throw new HttpError(403, "That signup code is not valid.");
    }
  }

  const email = input.email.toLowerCase().trim();
  if (await User.exists({ email })) {
    throw new HttpError(409, "An account with that email already exists.");
  }

  const doc = await User.create({
    email,
    name: input.name ?? "",
    passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
  });

  const user = doc.toObject() as LeanUser;
  return { user: toUserDTO(user), token: signToken(user) };
}

export async function login(input: LoginInput) {
  const email = input.email.toLowerCase().trim();
  // passwordHash is select:false, so ask for it explicitly.
  const doc = await User.findOne({ email }).select("+passwordHash");

  // Same message either way, so the response cannot be used to discover
  // which emails have accounts.
  const invalid = new HttpError(401, "Email or password is incorrect.");
  if (!doc) {
    // Spend comparable time so timing does not reveal whether the user exists.
    await bcrypt.compare(input.password, "$2b$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv");
    throw invalid;
  }

  if (!(await bcrypt.compare(input.password, doc.passwordHash))) throw invalid;

  doc.lastLoginAt = new Date();
  await doc.save();

  const user = doc.toObject() as LeanUser;
  return { user: toUserDTO(user), token: signToken(user) };
}

export async function getUser(id: string): Promise<UserDTO> {
  if (!Types.ObjectId.isValid(id)) throw new HttpError(401, "Invalid session.");
  const doc = await User.findById(id).lean<LeanUser>();
  if (!doc) throw new HttpError(401, "Account no longer exists.");
  return toUserDTO(doc);
}

function hashResetToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Emails a reset link. Always resolves the same way whether or not the address
 * has an account — the response must not reveal who is registered — and the
 * send is not awaited, so response time doesn't reveal it either.
 */
export async function requestPasswordReset(emailInput: string): Promise<void> {
  const email = emailInput.toLowerCase().trim();
  const doc = await User.findOne({ email }).select("+resetTokenExpiresAt");
  if (!doc) return;

  const issuedAt = doc.resetTokenExpiresAt ? doc.resetTokenExpiresAt.getTime() - RESET_TTL_MS : 0;
  if (Date.now() - issuedAt < RESET_COOLDOWN_MS) return;

  // The raw token only ever exists in the email; the database holds its hash.
  const token = randomBytes(32).toString("base64url");
  doc.resetTokenHash = hashResetToken(token);
  doc.resetTokenExpiresAt = new Date(Date.now() + RESET_TTL_MS);
  await doc.save();

  const link = `${env.APP_URL.replace(/\/+$/, "")}/reset-password?token=${token}`;
  const minutes = RESET_TTL_MS / 60_000;

  sendMail({
    to: doc.email,
    subject: "Reset your Peoples password",
    text: `Use this link to choose a new password (valid for ${minutes} minutes):\n\n${link}\n\nIf you didn't ask for this, ignore this email — your password hasn't changed.`,
    html: `<p>Use the button below to choose a new password. The link is valid for ${minutes} minutes.</p>
<p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#111;color:#fff;border-radius:6px;text-decoration:none">Reset password</a></p>
<p style="color:#666;font-size:13px">Or paste this into your browser:<br>${link}</p>
<p style="color:#666;font-size:13px">If you didn't ask for this, ignore this email — your password hasn't changed.</p>`,
  }).catch((err) => console.error("[mail] could not send password reset:", err));
}

/** Consumes a reset token (single use) and signs the user in with the new password. */
export async function resetPassword(input: ResetPasswordInput) {
  const doc = await User.findOne({
    resetTokenHash: hashResetToken(input.token),
    resetTokenExpiresAt: { $gt: new Date() },
  }).select("+resetTokenHash +resetTokenExpiresAt");

  if (!doc) throw new HttpError(400, "This reset link is invalid or has expired. Request a new one.");

  doc.passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  doc.resetTokenHash = null;
  doc.resetTokenExpiresAt = null;
  doc.passwordChangedAt = new Date();
  doc.lastLoginAt = new Date();
  await doc.save();

  const user = doc.toObject() as LeanUser;
  return { user: toUserDTO(user), token: signToken(user) };
}
