import { Router } from "express";
import { prisma } from "../../lib/prisma.js";
import { userAuth } from "../../middleware/auth.js";
import { asyncWrapper } from "../../utils/asyncWrapper.js";
import { AppError } from "../../utils/AppError.js";
import { emitNotificationChanged } from "../../socket.js";

export const notificationRouter = Router();

notificationRouter.use(userAuth);

// ─── GET /notifications ──────────────────────────────────────
// List notifications for the authenticated user
notificationRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const unreadOnly = req.query.unread === "true";

    const where = { user_id: req.userId };
    if (unreadOnly) where.is_read = false;

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { user_id: req.userId, is_read: false },
      }),
    ]);

    res.json({ notifications, total, unreadCount, page, limit });
  })
);

// ─── GET /notifications/unread-count ─────────────────────────
notificationRouter.get(
  "/unread-count",
  asyncWrapper(async (req, res) => {
    const count = await prisma.notification.count({
      where: { user_id: req.userId, is_read: false },
    });
    res.json({ unreadCount: count });
  })
);

// ─── PATCH /notifications/:id/read ───────────────────────────
notificationRouter.patch(
  "/:notificationId/read",
  asyncWrapper(async (req, res) => {
    const { notificationId } = req.params;

    const notification = await prisma.notification.findUnique({
      where: { notification_id: notificationId },
    });

    if (!notification) throw new AppError("Notification not found", 404);
    if (notification.user_id !== req.userId) {
      throw new AppError("Forbidden", 403);
    }

    await prisma.notification.update({
      where: { notification_id: notificationId },
      data: { is_read: true },
    });

    await emitNotificationChanged(req.userId, {
      reason: "notification_marked_read",
      notificationId,
    });

    res.json({ message: "Notification marked as read" });
  })
);

// ─── PATCH /notifications/read-all ───────────────────────────
notificationRouter.patch(
  "/read-all",
  asyncWrapper(async (req, res) => {
    await prisma.notification.updateMany({
      where: { user_id: req.userId, is_read: false },
      data: { is_read: true },
    });

    await emitNotificationChanged(req.userId, {
      reason: "notifications_marked_read",
    });

    res.json({ message: "All notifications marked as read" });
  })
);

// ─── DELETE /notifications/:id ───────────────────────────────
notificationRouter.delete(
  "/:notificationId",
  asyncWrapper(async (req, res) => {
    const { notificationId } = req.params;

    const notification = await prisma.notification.findUnique({
      where: { notification_id: notificationId },
    });

    if (!notification) throw new AppError("Notification not found", 404);
    if (notification.user_id !== req.userId) {
      throw new AppError("Forbidden", 403);
    }

    await prisma.notification.delete({
      where: { notification_id: notificationId },
    });

    await emitNotificationChanged(req.userId, {
      reason: "notification_deleted",
      notificationId,
    });

    res.json({ message: "Notification deleted" });
  })
);
