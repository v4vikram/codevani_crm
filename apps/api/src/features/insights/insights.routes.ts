import { Router } from "express";
import { asyncHandler } from "../../core/http.js";
import * as controller from "./insights.controller.js";

export const insightsRoutes = Router();

insightsRoutes.get("/", asyncHandler(controller.analyse));
