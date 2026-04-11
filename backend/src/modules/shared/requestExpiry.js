import { prisma } from "../../lib/prisma.js";
import {
  emitAdminDashboardRefresh,
  emitRoleEvent,
  emitUserEvent,
  pushNotification,
} from "../../socket.js";

const ACTIVE_REQUEST_STATUSES = ["created", "pending_offers"];
const BUSINESS_DAY_UTC_OFFSET_MINUTES = 5.5 * 60;

function getBusinessDayStart() {
  const now = new Date();
  const utcNowMs = now.getTime() + now.getTimezoneOffset() * 60_000;
  const businessNow = new Date(
    utcNowMs + BUSINESS_DAY_UTC_OFFSET_MINUTES * 60_000
  );

  businessNow.setUTCHours(0, 0, 0, 0);

  return new Date(
    businessNow.getTime() - BUSINESS_DAY_UTC_OFFSET_MINUTES * 60_000
  );
}

export async function rejectExpiredOpenRequests({ requestIds } = {}) {
  const where = {
    deleted_at: null,
    status: { in: ACTIVE_REQUEST_STATUSES },
    created_at: { lt: getBusinessDayStart() },
    ...(Array.isArray(requestIds) && requestIds.length > 0
      ? { request_id: { in: requestIds } }
      : {}),
  };

  const staleRequests = await prisma.serviceRequest.findMany({
    where,
    select: {
      request_id: true,
      user_id: true,
    },
  });

  if (staleRequests.length === 0) {
    return [];
  }

  const staleRequestIds = staleRequests.map((request) => request.request_id);

  await prisma.$transaction(async (tx) => {
    await tx.technicianOffer.updateMany({
      where: {
        request_id: { in: staleRequestIds },
        status: "pending",
      },
      data: {
        status: "expired",
      },
    });

    await tx.serviceRequest.updateMany({
      where: {
        request_id: { in: staleRequestIds },
        status: { in: ACTIVE_REQUEST_STATUSES },
      },
      data: {
        status: "rejected",
      },
    });
  });

  await Promise.allSettled(
    staleRequests.map((request) =>
      pushNotification({
        userId: request.user_id,
        type: "system",
        title: "Request closed",
        message:
          "Your service request was closed because no technician accepted it before the day ended. Please raise a new request if you still need help.",
        data: {
          request_id: request.request_id,
          status: "rejected",
          reason: "same_day_request_window_closed",
        },
      })
    )
  );

  const affectedUsers = [...new Set(staleRequests.map((request) => request.user_id))];

  affectedUsers.forEach((userId) => {
    emitUserEvent(userId, "user:requests_refresh", {
      reason: "request_rejected_due_to_age",
    });
  });

  emitRoleEvent("technician", "technician:discover_refresh", {
    reason: "expired_requests_rejected",
    count: staleRequestIds.length,
  });

  emitAdminDashboardRefresh({
    source: "system",
    entity: "service_request",
    action: "expired_requests_rejected",
    count: staleRequestIds.length,
  });

  return staleRequestIds;
}
