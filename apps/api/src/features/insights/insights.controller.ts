import type { Request, Response } from "express";
import { getInsights } from "./insights.service.js";

export async function analyse(_req: Request, res: Response) {
  res.json(await getInsights());
}
