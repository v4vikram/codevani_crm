import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../../core/http.js";
import * as controller from "./import.controller.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // far more than any Apify export
  fileFilter: (_req, file, cb) => {
    const ok =
      /\.(csv|txt)$/i.test(file.originalname) ||
      ["text/csv", "application/vnd.ms-excel", "text/plain"].includes(file.mimetype);
    cb(null, ok);
  },
});

export const importRoutes = Router();

importRoutes.post("/", upload.single("file"), asyncHandler(controller.upload));
