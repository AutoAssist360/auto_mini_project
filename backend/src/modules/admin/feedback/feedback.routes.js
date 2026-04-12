import { Router } from "express";
import { getAllFeedback, updateFeedbackStatus, replyToFeedback } from "./feedback.controller.js";
import { userAuth } from "../../../middleware/auth.js";
import { roleGuard } from "../../../middleware/roleGuard.js";

export const adminFeedbackRouter = Router();

adminFeedbackRouter.use(userAuth, roleGuard("admin"));

adminFeedbackRouter.get("/", getAllFeedback);
adminFeedbackRouter.patch("/:id/status", updateFeedbackStatus);
adminFeedbackRouter.patch("/:id/reply", replyToFeedback);
