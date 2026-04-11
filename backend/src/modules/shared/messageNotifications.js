import { prisma } from "../../lib/prisma.js";
import { emitNotificationChanged } from "../../socket.js";

export async function clearRequestMessageNotifications(userId, requestId) {
  if (!userId || !requestId) {
    return 0;
  }

  const result = await prisma.notification.deleteMany({
    where: {
      user_id: userId,
      type: "message_received",
      OR: [
        {
          data: {
            path: ["requestId"],
            equals: requestId,
          },
        },
        {
          data: {
            path: ["request_id"],
            equals: requestId,
          },
        },
      ],
    },
  });

  if (result.count > 0) {
    await emitNotificationChanged(userId, {
      reason: "message_notifications_cleared",
      requestId,
      count: result.count,
    });
  }

  return result.count;
}
