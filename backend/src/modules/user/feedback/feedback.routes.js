import { Router } from "express";
import { submitFeedback, getMyFeedback } from "./feedback.controller.js";
import { userAuth } from "../../../middleware/auth.js";
import { roleGuard } from "../../../middleware/roleGuard.js";

export const userFeedbackRouter = Router();

userFeedbackRouter.use(userAuth, roleGuard("user", "admin"));

userFeedbackRouter.post("/", submitFeedback);
userFeedbackRouter.get("/", getMyFeedback);
