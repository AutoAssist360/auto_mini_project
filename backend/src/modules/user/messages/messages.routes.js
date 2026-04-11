import { Router } from "express";
import { prisma } from "../../../lib/prisma.js";
import { userAuth } from "../../../middleware/auth.js";
import { roleGuard } from "../../../middleware/roleGuard.js";
import { asyncWrapper } from "../../../utils/asyncWrapper.js";
import { AppError } from "../../../utils/AppError.js";
import { validate } from "../../../middleware/validate.js";
import { sendMessageSchema } from "./messages.schemas.js";
import { paginate, paginationQuery } from "../../../utils/paginate.js";
import { getIO, isUserViewingRequestChat, pushNotification } from "../../../socket.js";
import { clearRequestMessageNotifications } from "../../shared/messageNotifications.js";

const ACTIVE_CHAT_REQUEST_STATUSES = ["offer_accepted", "in_progress", "completed"];

export const messageRouter = Router();

// ─── GET /requests/:requestId/messages ───────────────────────
messageRouter.get(
  "/requests/:requestId/messages",
  userAuth,
  roleGuard("user", "admin"),
  asyncWrapper(async (req, res) => {
    const requestId = req.params.requestId;

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { request_id: requestId },
    });

    if (!serviceRequest || serviceRequest.deleted_at) {
      throw new AppError("Service request not found", 404);
    }

    if (serviceRequest.user_id !== req.userId) {
      throw new AppError("You do not have access to these messages", 403);
    }

    if (!ACTIVE_CHAT_REQUEST_STATUSES.includes(serviceRequest.status)) {
      throw new AppError(
        "Messages unlock after a technician accepts your request",
        403
      );
    }

    const { page, limit } = paginationQuery.parse(req.query);
    const { skip, take } = paginate(page, limit);
    const where = { request_id: requestId };

    const [messages, total] = await Promise.all([
      prisma.platformMessage.findMany({
        where,
        include: {
          sender: {
            select: { user_id: true, full_name: true, role: true },
          },
          receiver: {
            select: { user_id: true, full_name: true, role: true },
          },
        },
        orderBy: { sent_at: "asc" },
        skip,
        take,
      }),
      prisma.platformMessage.count({ where }),
    ]);

    // Mark messages sent to this user as read
    await prisma.platformMessage.updateMany({
      where: {
        request_id: requestId,
        receiver_id: req.userId,
        is_read: false,
      },
      data: { is_read: true },
    });
    await clearRequestMessageNotifications(req.userId, requestId);

    // Determine the technician's user_id from an accepted offer to allow the user to message them
    let other_party_id = null;
    const acceptedOffer = await prisma.technicianOffer.findFirst({
      where: {
        request_id: requestId,
        status: "accepted",
      },
      include: {
        technician: true,
      },
    });

    if (acceptedOffer && acceptedOffer.technician) {
      other_party_id = acceptedOffer.technician.user_id;
    }

    res.json({
      messages,
      total,
      page,
      limit,
      other_party_id,
    });
  })
);

// ─── POST /requests/:requestId/messages ──────────────────────
messageRouter.post(
  "/requests/:requestId/messages",
  userAuth,
  roleGuard("user", "admin"),
  validate(sendMessageSchema),
  asyncWrapper(async (req, res) => {
    const requestId = req.params.requestId;
    const { receiver_id, message } = req.body;

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { request_id: requestId },
    });

    if (!serviceRequest || serviceRequest.deleted_at) {
      throw new AppError("Service request not found", 404);
    }

    if (serviceRequest.user_id !== req.userId) {
      throw new AppError("You do not have access to this request", 403);
    }

    if (!ACTIVE_CHAT_REQUEST_STATUSES.includes(serviceRequest.status)) {
      throw new AppError(
        "Messages unlock after a technician accepts your request",
        403
      );
    }

    const receiver = await prisma.user.findUnique({
      where: { user_id: receiver_id },
    });

    if (!receiver || receiver.deleted_at) {
      throw new AppError("Receiver not found", 404);
    }

    // Users can only message technicians involved in this request
    if (receiver.role !== "technician") {
      throw new AppError(
        "You can only message technicians involved in this service request",
        403
      );
    }

    const techProfile = await prisma.technicianProfile.findUnique({
      where: { user_id: receiver_id },
    });
    if (!techProfile) {
      throw new AppError("Receiver does not have a technician profile", 400);
    }

    const involvement = await prisma.technicianOffer.findFirst({
      where: {
        request_id: requestId,
        technician_id: techProfile.technician_id,
        status: "accepted",
      },
    });
    if (!involvement) {
      throw new AppError(
        "Receiver is not involved in this service request",
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
        sender: { select: { user_id: true, full_name: true, role: true } },
        receiver: { select: { user_id: true, full_name: true, role: true } },
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
          message: `${newMessage.sender?.full_name} sent you a message`,
          data: { requestId },
        });
      }
    } catch { /* socket not ready */ }

    res.status(201).json({
      message: "Message sent successfully",
      data: newMessage,
    });
  })
);
