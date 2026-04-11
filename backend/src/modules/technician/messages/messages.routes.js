import { Router } from "express";
import { prisma } from "../../../lib/prisma.js";
import { asyncWrapper } from "../../../utils/asyncWrapper.js";
import { AppError } from "../../../utils/AppError.js";
import { userAuth } from "../../../middleware/auth.js";
import { roleGuard } from "../../../middleware/roleGuard.js";
import { validate } from "../../../middleware/validate.js";
import { sendMessageSchema } from "../technician.schemas.js";
import { paginate, paginationQuery } from "../../../utils/paginate.js";
import { getIO, isUserViewingRequestChat, pushNotification } from "../../../socket.js";
import { clearRequestMessageNotifications } from "../../shared/messageNotifications.js";

const ACTIVE_CHAT_REQUEST_STATUSES = ["offer_accepted", "in_progress", "completed"];

export const techMessagesRouter = Router();

techMessagesRouter.use(userAuth, roleGuard("technician"));

// ─── GET /tech/requests/:requestId/messages ─────────────────────
techMessagesRouter.get(
  "/:requestId/messages",
  asyncWrapper(async (req, res) => {
    const requestId = req.params.requestId;

    const request = await prisma.serviceRequest.findUnique({
      where: { request_id: requestId },
      select: { user_id: true, deleted_at: true, status: true },
    });

    if (!request || request.deleted_at) {
      throw new AppError("Service request not found", 404);
    }

    if (!ACTIVE_CHAT_REQUEST_STATUSES.includes(request.status)) {
      throw new AppError(
        "Messages unlock after the customer accepts the job",
        403
      );
    }

    const profile = await prisma.technicianProfile.findUnique({
      where: { user_id: req.userId },
    });
    if (!profile) throw new AppError("Technician profile not found", 404);

    // Verify the technician has an accepted/pending offer for this request
    const involvement = await prisma.technicianOffer.findFirst({
      where: {
        request_id: requestId,
        technician_id: profile.technician_id,
        status: "accepted",
      },
    });
    if (!involvement) {
      throw new AppError("Not authorized to view messages for this request", 403);
    }

    // Only return messages where this tech is sender or receiver
    const { page, limit } = paginationQuery.parse(req.query);
    const { skip, take } = paginate(page, limit);
    const where = {
      request_id: requestId,
      OR: [{ sender_id: req.userId }, { receiver_id: req.userId }],
    };

    const [messages, total] = await Promise.all([
      prisma.platformMessage.findMany({
        where,
        include: {
          sender: {
            select: { user_id: true, full_name: true, role: true },
          },
        },
        orderBy: { sent_at: "asc" },
        skip,
        take,
      }),
      prisma.platformMessage.count({ where }),
    ]);

    // Mark unread messages addressed to this technician as read
    await prisma.platformMessage.updateMany({
      where: {
        request_id: requestId,
        receiver_id: req.userId,
        is_read: false,
      },
      data: { is_read: true },
    });
    await clearRequestMessageNotifications(req.userId, requestId);
    res.json({
      messages,
      total,
      page,
      limit,
      other_party_id: request.user_id,
    });
  })
);

// ─── POST /tech/requests/:requestId/messages ────────────────────
techMessagesRouter.post(
  "/:requestId/messages",
  validate(sendMessageSchema),
  asyncWrapper(async (req, res) => {
    const requestId = req.params.requestId;
    const { receiver_id, message } = req.body;

    const profile = await prisma.technicianProfile.findUnique({
      where: { user_id: req.userId },
    });
    if (!profile) throw new AppError("Technician profile not found", 404);

    // Verify the technician has an active involvement on this request
    const involvement = await prisma.technicianOffer.findFirst({
      where: {
        request_id: requestId,
        technician_id: profile.technician_id,
        status: "accepted",
      },
    });
    if (!involvement) {
      throw new AppError("Not authorized to message on this request", 403);
    }

    // Verify the request exists
    const request = await prisma.serviceRequest.findUnique({
      where: { request_id: requestId },
    });
    if (!request || request.deleted_at) {
      throw new AppError("Service request not found", 404);
    }

    if (!ACTIVE_CHAT_REQUEST_STATUSES.includes(request.status)) {
      throw new AppError(
        "Messages unlock after the customer accepts the job",
        403
      );
    }

    // Verify the receiver exists
    const receiver = await prisma.user.findUnique({
      where: { user_id: receiver_id },
      select: { user_id: true, deleted_at: true },
    });
    if (!receiver || receiver.deleted_at) {
      throw new AppError("Receiver not found", 404);
    }

    // Verify the receiver is actually the request owner (user who created the request)
    if (receiver_id !== request.user_id) {
      throw new AppError(
        "You can only message the user who created this service request",
        403
      );
    }

    const newMessage = await prisma.platformMessage.create({
      data: {
        request_id: requestId,
        sender_id: req.userId,
        receiver_id,
        message,
      },
      include: {
        sender: {
          select: { user_id: true, full_name: true, role: true },
        },
        receiver: {
          select: { user_id: true, full_name: true, role: true },
        },
      },
    });

    // Push real-time message via Socket.io
    try {
      const io = getIO();
      io.to(`chat:${requestId}`).emit("chat:new_message", {
        requestId,
        messageId: newMessage.message_id,
        senderId: req.userId,
        receiverId: receiver_id,
        message,
        senderName: newMessage.sender?.full_name,
        senderRole: newMessage.sender?.role,
        sentAt: newMessage.sent_at,
      });
      const receiverIsInsideChat = await isUserViewingRequestChat(receiver_id, requestId);
      if (!receiverIsInsideChat) {
        await pushNotification({
          userId: receiver_id,
          type: "message_received",
          title: "New Message",
          message: `${newMessage.sender?.full_name || "Technician"} sent you a message`,
          data: { requestId },
        });
      }
    } catch { /* socket not ready */ }

    res.status(201).json({ message: "Message sent", data: newMessage });
  })
);
