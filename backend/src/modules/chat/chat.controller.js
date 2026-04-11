import { GoogleGenAI } from "@google/genai";
import { asyncWrapper } from "../../utils/asyncWrapper.js";
import { AppError } from "../../utils/AppError.js";

export const handleChat = asyncWrapper(async (req, res) => {
  const { message, history } = req.body;

  if (!message) {
    throw new AppError("Message is required", 400);
  }

  // Initialize the GenAI client using the API key from environment variables
  // Standardized to GEMINI_API_KEY as per @google/genai defaults
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;

  if (!apiKey) {
    throw new AppError("Gemini API key is not configured on the server", 500);
  }

  const ai = new GoogleGenAI({ apiKey: apiKey });

  const currentPath = req.body.currentPath || "unknown";

  const systemPrompt = `You are a professional, calming, and highly organized "Quick Auto Assist" AI assistant for a Road Assistance web app.
Your primary goal is to help users navigate the app dashboard and resolve their vehicle issues efficiently.

CRITICAL RULES:
1. Guide the user STRICTLY step-by-step. NEVER output a massive wall of text or multiple instructions at once.
2. Ask only ONE clarifying question at a time. Wait for the user to respond before giving the next step.
3. Use the user's current exact location in the app (URL Path: ${currentPath}) to give relevant instructions so you don't ask them where they are.
4. NEVER reveal or output raw URL paths (like '/vehicles', '/dashboard', or '/login') to the user. You receive the user's currentPath secretly to understand their context, but you must ONLY instruct them using the visual UI element names (e.g., say 'Click on My Vehicles' instead of 'Navigate to /vehicles').

APP UI MAP & BUSINESS LOGIC:
- Dashboard (/dashboard):
  Provides buttons for: "Raise New Issue" (or "New Request"), "My Requests", "My Jobs", "Browse Parts", "My Orders", "My Reviews", "My Vehicles", "My Profile", and "Notifications".
  
- Prerequisites:
  Users MUST add a vehicle under "My Vehicles" (/vehicles) before creating a request.
  Adding a vehicle requires: Company, Model, Variant, Registration Number, and an optional VIN Number.

- Raise Issue Flow (/requests/new):
  Step 1 "Fill Details": The user fills out Vehicle, Issue type, Issue description, Location (Breakdown Location Map), Service location type, Requires towing, and Attach Photos/Files Evidence. Clicks "Continue →".
  Step 2 "Select Technician": User sees a list of matched technicians to book directly via the "Select" button, or they can click "Skip — I'll wait for technician offers".

- Tracking Stages (/requests or /requests/:requestId):
  1 (Created): Issue logged.
  2 (Awaiting Offers): Waiting for a technician to offer help.
  3 (Offer Accepted): User and Tech matched. User can chat with tech and see live map location.
  4 (In Progress): Work ongoing. Tech might suggest parts to buy from vendors (/parts).
  5 (Completed): Issue solved, transaction finished.

Use exact button names and UI elements when directing users. e.g., "Click on 'My Vehicles' on the Dashboard to add your car."`;

  try {
    // Format history for the SDK: 
    // The @google/genai SDK accepts history as an array of objects like { role: 'user' | 'model', parts: [{ text: "..." }] }
    // The frontend sends simple objects like { role: 'user', content: 'hello' } or nested parts if we already formatted it.
    // We'll normalize generic history into the structure expected by the SDK.
    const formattedHistory = (history || []).map((msg) => {
      // Maps 'ai' to 'model' for Gemini SDK, keeps 'user' as 'user'
      const role = msg.role === "ai" ? "model" : "user";
      return {
        role,
        parts: [{ text: msg.content || "" }]
      };
    });

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [
        { role: "user", parts: [{ text: systemPrompt }] },
        { role: "model", parts: [{ text: "Understood. I am ready to help." }] },
        ...formattedHistory,
        { role: "user", parts: [{ text: message }] }
      ]
    });

    const aiMessage = response.text;

    return res.status(200).json({
      success: true,
      message: "Chat processed successfully",
      data: { response: aiMessage }
    });
  } catch (error) {
    console.error("AI Chat Error:", error);
    throw new AppError("Failed to generate AI response. Please try again later.", 500);
  }
});
