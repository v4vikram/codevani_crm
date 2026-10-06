import type { Request, Response } from "express";
import { HttpError } from "../../core/http.js";
import { forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema } from "./auth.dto.js";
import * as service from "./auth.service.js";

export async function register(req: Request, res: Response) {
  const result = await service.register(registerSchema.parse(req.body));
  res.status(201).json(result);
}

export async function login(req: Request, res: Response) {
  res.json(await service.login(loginSchema.parse(req.body)));
}

export async function forgotPassword(req: Request, res: Response) {
  await service.requestPasswordReset(forgotPasswordSchema.parse(req.body).email);
  // Identical for known and unknown emails.
  res.json({ message: "If that email has an account, a reset link is on its way." });
}

export async function resetPassword(req: Request, res: Response) {
  res.json(await service.resetPassword(resetPasswordSchema.parse(req.body)));
}

/** Lets the login screen offer "create the first account" on a fresh install. */
export async function setupState(_req: Request, res: Response) {
  res.json({ needsSetup: await service.needsSetup() });
}

export async function me(req: Request, res: Response) {
  if (!req.userId) throw new HttpError(401, "Sign in to continue.");
  res.json({ user: await service.getUser(req.userId) });
}
