import { prisma } from "../../../lib/prisma.js";
import { asyncWrapper } from "../../../utils/asyncWrapper.js";
import { AppError } from "../../../utils/AppError.js";

export const submitFeedback = asyncWrapper(async (req, res) => {
  const { type, subject, message } = req.body;
  if (!type || !subject || !message) {
    throw new AppError("Type, subject, and message are required", 400);
  }

  const feedback = await prisma.feedbackSubmission.create({
    data: {
      user_id: req.userId,
      type,
      subject,
      message,
    },
  });

  res.status(201).json({ message: "Your feedback has been received. We'll review it shortly.", feedback });
});

export const getMyFeedback = asyncWrapper(async (req, res) => {
  const feedback = await prisma.feedbackSubmission.findMany({
    where: { user_id: req.userId },
    orderBy: { created_at: "desc" },
  });

  res.json({ feedback });
});
