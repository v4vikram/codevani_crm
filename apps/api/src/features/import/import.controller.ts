import type { Request, Response } from "express";
import { HttpError } from "../../core/http.js";
import { importCsv } from "./import.service.js";

export async function upload(req: Request, res: Response) {
  if (!req.file) {
    throw new HttpError(400, "No CSV uploaded. Send it as multipart field 'file'.");
  }
  res.json(await importCsv(req.file.buffer, req.file.originalname));
}
