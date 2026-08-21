import type { Request, Response } from "express";
import { param } from "../../core/http.js";
import { listQuerySchema, updateLeadSchema } from "./lead.dto.js";
import * as service from "./lead.service.js";

/** Controllers only translate HTTP <-> service calls. No business logic here. */

export async function list(req: Request, res: Response) {
  res.json(await service.listLeads(listQuerySchema.parse(req.query)));
}

export async function areas(_req: Request, res: Response) {
  res.json({ areas: await service.listAreas() });
}

export async function todayUsage(_req: Request, res: Response) {
  res.json(await service.getTodayUsage());
}

export async function detail(req: Request, res: Response) {
  res.json(await service.getLead(param(req.params.id)));
}

export async function nextMessage(req: Request, res: Response) {
  res.json(await service.getNextMessage(param(req.params.id)));
}

export async function update(req: Request, res: Response) {
  const lead = await service.updateLead(param(req.params.id), updateLeadSchema.parse(req.body));
  res.json({ lead });
}

export async function markSent(req: Request, res: Response) {
  const lead = await service.markSent(param(req.params.id));
  res.json({ lead });
}
