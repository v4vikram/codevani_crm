import { Router } from "express";
import { asyncHandler } from "../../core/http.js";
import * as controller from "./lead.controller.js";

export const leadRoutes = Router();

// Static paths must be registered before "/:id" or they get captured by it.
leadRoutes.get("/areas", asyncHandler(controller.areas));
leadRoutes.get("/usage/today", asyncHandler(controller.todayUsage));

leadRoutes.get("/", asyncHandler(controller.list));
leadRoutes.get("/:id", asyncHandler(controller.detail));
leadRoutes.get("/:id/message", asyncHandler(controller.nextMessage));
leadRoutes.patch("/:id", asyncHandler(controller.update));
leadRoutes.post("/:id/sent", asyncHandler(controller.markSent));
