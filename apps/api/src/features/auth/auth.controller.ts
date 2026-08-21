import type { Request, Response } from "express";
import { HttpError } from "../../core/http.js";
import { loginSchema, registerSchema } from "./auth.dto.js";
import * as service from "./auth.service.js";

export async function register(req: Request, res: Response) {
  const result = await service.register(registerSchema.parse(req.body));
  res.status(201).json(result);
}

export async function login(req: Request, res: Response) {
  res.json(await service.login(loginSchema.parse(req.body)));
}

/** Lets the login screen offer "create the first account" on a fresh install. */
export async function setupState(_req: Request, res: Response) {
  res.json({ needsSetup: await service.needsSetup() });
}

export async function me(req: Request, res: Response) {
  if (!req.userId) throw new HttpError(401, "Sign in to continue.");
  res.json({ user: await service.getUser(req.userId) });
}
