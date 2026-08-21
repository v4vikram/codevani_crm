import { Router } from "express";
import { asyncHandler } from "../../core/http.js";
import { requireAuth } from "./auth.middleware.js";
import * as controller from "./auth.controller.js";

export const authRoutes = Router();

// Public: needed before a session exists.
authRoutes.get("/setup", asyncHandler(controller.setupState));
authRoutes.post("/register", asyncHandler(controller.register));
authRoutes.post("/login", asyncHandler(controller.login));

authRoutes.get("/me", requireAuth, asyncHandler(controller.me));
