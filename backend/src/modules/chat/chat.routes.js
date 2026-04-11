import { Router } from "express";
import { handleChat } from "./chat.controller.js";

const chatRouter = Router();

// Endpoint for processing AI chat messages
chatRouter.post("/", handleChat);

export { chatRouter };
