import type { Request, Response } from "express";
import { computeStats } from "./stats.service.js";

export async function overview(_req: Request, res: Response) {
  res.json(await computeStats());
}
