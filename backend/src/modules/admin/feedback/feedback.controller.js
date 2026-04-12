import { prisma } from "../../../lib/prisma.js";
import { asyncWrapper } from "../../../utils/asyncWrapper.js";
import { AppError } from "../../../utils/AppError.js";

export const getAllFeedback = asyncWrapper(async (req, res) => {
  const status = req.query.status;
  const type = req.query.type;
  
  const where = {};
  if (status) where.status = status;
  if (type) where.type = type;

  const feedbackList = await prisma.feedbackSubmission.findMany({
    where,
    orderBy: { created_at: "desc" },
    include: {
      user: {
        select: {
          full_name: true,
          email: true,
        }
      }
    }
  });

  res.json({ feedbackList });
});

export const updateFeedbackStatus = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  if (!status) {
    throw new AppError("Status is required", 400);
  }

  const updatedFeedback = await prisma.feedbackSubmission.update({
    where: { id },
    data: { status },
  });

  res.json({ message: "Feedback status updated", feedback: updatedFeedback });
});

export const replyToFeedback = asyncWrapper(async (req, res) => {
  const { id } = req.params;
  const { replyText, status } = req.body;

  if (!replyText) {
    throw new AppError("Reply text is required", 400);
  }

  const data = {
    admin_reply: replyText,
    admin_reply_at: new Date(),
  };

  if (status) {
      data.status = status;
  }

  const updatedFeedback = await prisma.feedbackSubmission.update({
    where: { id },
    data,
  });

  res.json({ message: "Reply sent to user", feedback: updatedFeedback });
});
