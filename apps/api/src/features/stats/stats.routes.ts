import { Router } from "express";
import { asyncHandler } from "../../core/http.js";
import * as controller from "./stats.controller.js";

export const statsRoutes = Router();

statsRoutes.get("/", asyncHandler(controller.overview));
