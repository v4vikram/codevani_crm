import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Types } from "mongoose";
import { env } from "../../core/env.js";
import { HttpError } from "../../core/http.js";
import { User, type UserDoc } from "./auth.model.js";
import type { LoginInput, RegisterInput, UserDTO } from "./auth.dto.js";

const BCRYPT_ROUNDS = 12;
const TOKEN_TTL = "7d";

interface TokenPayload {
  sub: string;
  email: string;
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
  const payload: TokenPayload = { sub: user._id.toString(), email: user.email };
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: TOKEN_TTL });
}

export function verifyToken(token: string): TokenPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET) as TokenPayload;
  } catch {
    throw new HttpError(401, "Session expired. Please sign in again.");
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
