import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import { USER_SECRET } from "../config.js";
import { prisma } from "./lib/prisma.js";
import { sendEmail } from "./utils/emailService.js";

let io;
const liveTrackingState = new Map();
const orderTrackingState = new Map();

function parseCookieHeader(cookieHeader = "") {
  return cookieHeader
    .split(";")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .reduce((accumulator, chunk) => {
      const separatorIndex = chunk.indexOf("=");
      if (separatorIndex === -1) {
        return accumulator;
      }

      const name = chunk.slice(0, separatorIndex).trim();
      const value = chunk.slice(separatorIndex + 1).trim();
      if (name) {
        accumulator[name] = value;
      }
      return accumulator;
    }, {});
}

function getSocketToken(socket) {
  if (socket.handshake.auth?.token) {
    return socket.handshake.auth.token;
  }

  const authorizationHeader = socket.handshake.headers?.authorization;
  if (authorizationHeader?.startsWith("Bearer ")) {
    return authorizationHeader.replace("Bearer ", "");
  }

  const cookies = parseCookieHeader(socket.handshake.headers?.cookie);
  return cookies.accessToken || cookies.authcookie || null;
}

function normalizeCoordinates(latitude, longitude) {
  const lat = Number(latitude);
  const lng = Number(longitude);

  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    lat < -90 ||
    lat > 90 ||
    lng < -180 ||
    lng > 180
  ) {
    return null;
  }

  return { latitude: lat, longitude: lng };
}

function getOrderTrackingMode(order) {
  const latestFulfillmentStatus = order?.fulfillments?.[0]?.status || null;

  if (order?.return_status === "requested" && order?.order_status === "delivered") {
    return "return_pickup";
  }

  if (
    ["processing", "shipped"].includes(order?.order_status) ||
    ["processing", "shipped", "in_transit"].includes(latestFulfillmentStatus)
  ) {
    return "delivery";
  }

  return null;
}

async function getTrackingAccess(jobId, socket) {
  const job = await prisma.job.findUnique({
    where: { job_id: jobId },
    select: {
      job_id: true,
      status: true,
      request: {
        select: {
          user_id: true,
        },
      },
      technician: {
        select: {
          user_id: true,
          latitude: true,
          longitude: true,
        },
      },
    },
  });

  if (!job) {
    return { allowed: false, reason: "Job not found" };
  }

  if (socket.userRole === "admin") {
    return { allowed: true, mode: "viewer", job };
  }

  if (socket.userRole === "user" && job.request?.user_id === socket.userId) {
    return { allowed: true, mode: "viewer", job };
  }

  if (
    socket.userRole === "technician" &&
    job.technician?.user_id === socket.userId
  ) {
    return { allowed: true, mode: "publisher", job };
  }

  return { allowed: false, reason: "Not authorized for this job" };
}

function buildTrackingPayload(jobId, technicianId, latitude, longitude, source = "live") {
  return {
    jobId,
    technicianId,
    latitude,
    longitude,
    timestamp: new Date().toISOString(),
    source,
  };
}

async function getChatAccess(requestId, socket) {
  const serviceRequest = await prisma.serviceRequest.findUnique({
    where: { request_id: requestId },
    select: {
      request_id: true,
      user_id: true,
      status: true,
      deleted_at: true,
      offers: {
        where: {
          status: "accepted",
          technician: {
            user_id: socket.userId,
          },
        },
        select: {
          offer_id: true,
        },
        take: 1,
      },
    },
  });

  if (!serviceRequest || serviceRequest.deleted_at) {
    return { allowed: false, reason: "Service request not found" };
  }

  if (!["offer_accepted", "in_progress", "completed"].includes(serviceRequest.status)) {
    return {
      allowed: false,
      reason: "Messages unlock after the request is accepted",
    };
  }

  if (socket.userRole === "admin") {
    return { allowed: true, request: serviceRequest };
  }

  if (socket.userRole === "user" && serviceRequest.user_id === socket.userId) {
    return { allowed: true, request: serviceRequest };
  }

  if (
    socket.userRole === "technician" &&
    Array.isArray(serviceRequest.offers) &&
    serviceRequest.offers.length > 0
  ) {
    return { allowed: true, request: serviceRequest };
  }

  return { allowed: false, reason: "Not authorized for this request chat" };
}

async function getOrderTrackingAccess(orderId, socket) {
  const order = await prisma.order.findUnique({
    where: { order_id: orderId },
    select: {
      order_id: true,
      order_status: true,
      return_status: true,
      user_id: true,
      warehouse: {
        select: {
          vendor_id: true,
          latitude: true,
          longitude: true,
        },
      },
      fulfillments: {
        orderBy: { created_at: "desc" },
        take: 1,
        select: {
          status: true,
        },
      },
    },
  });

  if (!order) {
    return { allowed: false, reason: "Order not found" };
  }

  const trackingType = getOrderTrackingMode(order);
  if (!trackingType) {
    return {
      allowed: false,
      reason: "Live order tracking is unavailable for the current order stage",
    };
  }

  if (socket.userRole === "admin") {
    return { allowed: true, mode: "viewer", order, trackingType };
  }

  if (socket.userRole === "user" && order.user_id === socket.userId) {
    return { allowed: true, mode: "viewer", order, trackingType };
  }

  if (socket.userRole === "vendor" && order.warehouse?.vendor_id === socket.userId) {
    return { allowed: true, mode: "publisher", order, trackingType };
  }

  return { allowed: false, reason: "Not authorized for this order" };
}

function buildOrderTrackingPayload(
  orderId,
  vendorId,
  latitude,
  longitude,
  trackingType,
  source = "live"
) {
  return {
    orderId,
    vendorId,
    latitude,
    longitude,
    trackingType,
    timestamp: new Date().toISOString(),
    source,
  };
}

export function initSocket(httpServer) {
  const allowedOrigins = (
    process.env.CORS_ORIGIN ||
    "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:5176,http://localhost:5177"
  )
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  io = new Server(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    pingInterval: 25000,
    pingTimeout: 20000,
  });

  io.use(async (socket, next) => {
    try {
      const token = getSocketToken(socket);
      if (!token) {
        return next(new Error("Authentication required"));
      }

      const decoded = jwt.verify(token, USER_SECRET);
      const user = await prisma.user.findUnique({
        where: { user_id: decoded.userId },
        select: {
          user_id: true,
          role: true,
          full_name: true,
          is_active: true,
        },
      });

      if (!user || !user.is_active) {
        return next(new Error("User not found or inactive"));
      }

      socket.userId = user.user_id;
      socket.userRole = user.role;
      socket.userName = user.full_name;
      next();
    } catch {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    socket.data.chatRequests = new Set();
    socket.join(`user:${socket.userId}`);
    socket.join(`role:${socket.userRole}`);
    console.log(`[Socket] ${socket.userRole}:${socket.userId} connected`);

    socket.on("tracking:join", (jobId) => {
      void (async () => {
        if (typeof jobId !== "string" || !jobId.trim()) {
          socket.emit("tracking:error", {
            jobId,
            message: "A valid job ID is required to join live tracking",
          });
          return;
        }

        const access = await getTrackingAccess(jobId, socket);
        if (!access.allowed) {
          socket.emit("tracking:error", {
            jobId,
            message: access.reason,
          });
          return;
        }

        socket.join(`tracking:${jobId}`);

        const currentPayload = liveTrackingState.get(jobId);
        if (currentPayload) {
          socket.emit("tracking:location", currentPayload);
          return;
        }

        const technician = access.job?.technician;
        if (
          technician &&
          Number.isFinite(technician.latitude) &&
          Number.isFinite(technician.longitude)
        ) {
          socket.emit(
            "tracking:location",
            buildTrackingPayload(
              jobId,
              technician.user_id,
              technician.latitude,
              technician.longitude,
              "snapshot"
            )
          );
        }
      })().catch((error) => {
        console.error("[Socket] tracking:join failed", error);
      });
    });

    socket.on("tracking:leave", (jobId) => {
      socket.leave(`tracking:${jobId}`);
    });

    socket.on("tracking:stop", (jobId) => {
      if (typeof jobId !== "string" || !jobId.trim()) {
        return;
      }

      void (async () => {
        const access = await getTrackingAccess(jobId, socket);
        if (!access.allowed || access.mode !== "publisher") {
          return;
        }

        clearTrackingLocation(jobId);
      })().catch((error) => {
        console.error("[Socket] tracking:stop failed", error);
      });
    });

    socket.on("order_tracking:join", (orderId) => {
      void (async () => {
        if (typeof orderId !== "string" || !orderId.trim()) {
          socket.emit("order_tracking:error", {
            orderId,
            message: "A valid order ID is required to join live tracking",
          });
          return;
        }

        const access = await getOrderTrackingAccess(orderId, socket);
        if (!access.allowed) {
          socket.emit("order_tracking:error", {
            orderId,
            message: access.reason,
          });
          return;
        }

        socket.join(`order_tracking:${orderId}`);

        const currentPayload = orderTrackingState.get(orderId);
        if (currentPayload) {
          socket.emit("order_tracking:location", currentPayload);
          return;
        }

        const warehouse = access.order?.warehouse;
        if (
          warehouse &&
          Number.isFinite(warehouse.latitude) &&
          Number.isFinite(warehouse.longitude)
        ) {
          socket.emit(
            "order_tracking:location",
            buildOrderTrackingPayload(
              orderId,
              warehouse.vendor_id,
              warehouse.latitude,
              warehouse.longitude,
              access.trackingType,
              "snapshot"
            )
          );
        }
      })().catch((error) => {
        console.error("[Socket] order_tracking:join failed", error);
      });
    });

    socket.on("order_tracking:leave", (orderId) => {
      socket.leave(`order_tracking:${orderId}`);
    });

    socket.on("order_tracking:stop", (data) => {
      void (async () => {
        const orderId = typeof data === "string" ? data : data?.orderId;

        if (typeof orderId !== "string" || !orderId.trim()) {
          socket.emit("order_tracking:error", {
            message: "A valid order ID is required to stop live tracking",
          });
          return;
        }

        const access = await getOrderTrackingAccess(orderId, socket);
        if (!access.allowed || access.mode !== "publisher") {
          socket.emit("order_tracking:error", {
            orderId,
            message: access.reason || "Not authorized to stop live tracking",
          });
          return;
        }

        const fallbackReason =
          access.trackingType === "return_pickup"
            ? "return_pickup_paused"
            : "delivery_paused";

        clearOrderTrackingLocation(orderId, data?.reason || fallbackReason);
      })().catch((error) => {
        console.error("[Socket] order_tracking:stop failed", error);
      });
    });

    socket.on("order_tracking:update", (data) => {
      void (async () => {
        if (socket.userRole !== "vendor") {
          return;
        }

        const orderId = data?.orderId;
        if (typeof orderId !== "string" || !orderId.trim()) {
          socket.emit("order_tracking:error", {
            message: "A valid order ID is required for live tracking updates",
          });
          return;
        }

        const access = await getOrderTrackingAccess(orderId, socket);
        if (!access.allowed || access.mode !== "publisher") {
          socket.emit("order_tracking:error", {
            orderId,
            message: access.reason || "Not authorized to publish live tracking",
          });
          return;
        }

        const coordinates = normalizeCoordinates(data?.latitude, data?.longitude);
        if (!coordinates) {
          socket.emit("order_tracking:error", {
            orderId,
            message: "Latitude and longitude are invalid",
          });
          return;
        }

        const payload = buildOrderTrackingPayload(
          orderId,
          socket.userId,
          coordinates.latitude,
          coordinates.longitude,
          access.trackingType
        );

        orderTrackingState.set(orderId, payload);
        io.to(`order_tracking:${orderId}`).emit("order_tracking:location", payload);
      })().catch((error) => {
        console.error("[Socket] order_tracking:update failed", error);
      });
    });

    socket.on("tracking:update", (data) => {
      void (async () => {
        if (socket.userRole !== "technician") {
          return;
        }

        const jobId = data?.jobId;
        if (typeof jobId !== "string" || !jobId.trim()) {
          socket.emit("tracking:error", {
            message: "A valid job ID is required for live tracking updates",
          });
          return;
        }

        const access = await getTrackingAccess(jobId, socket);
        if (!access.allowed || access.mode !== "publisher") {
          socket.emit("tracking:error", {
            jobId,
            message: access.reason || "Not authorized to publish live tracking",
          });
          return;
        }

        if (!["assigned", "in_progress"].includes(access.job.status)) {
          socket.emit("tracking:error", {
            jobId,
            message: `Live tracking is unavailable when the job is '${access.job.status}'`,
          });
          return;
        }

        const coordinates = normalizeCoordinates(data?.latitude, data?.longitude);
        if (!coordinates) {
          socket.emit("tracking:error", {
            jobId,
            message: "Latitude and longitude are invalid",
          });
          return;
        }

        const payload = buildTrackingPayload(
          jobId,
          socket.userId,
          coordinates.latitude,
          coordinates.longitude
        );

        liveTrackingState.set(jobId, payload);
        io.to(`tracking:${jobId}`).emit("tracking:location", payload);
      })().catch((error) => {
        console.error("[Socket] tracking:update failed", error);
      });
    });

    socket.on("chat:join", (requestId) => {
      void (async () => {
        if (typeof requestId !== "string" || !requestId.trim()) {
          socket.emit("chat:error", {
            requestId,
            message: "A valid request ID is required to join chat",
          });
          return;
        }

        const access = await getChatAccess(requestId, socket);
        if (!access.allowed) {
          socket.emit("chat:error", {
            requestId,
            message: access.reason,
          });
          return;
        }

        socket.join(`chat:${requestId}`);
        socket.data.chatRequests.add(requestId);
      })().catch((error) => {
        console.error("[Socket] chat:join failed", error);
      });
    });

    socket.on("chat:leave", (requestId) => {
      if (typeof requestId !== "string" || !requestId.trim()) {
        return;
      }
      socket.leave(`chat:${requestId}`);
      socket.data.chatRequests.delete(requestId);
    });

    socket.on("chat:message", (msg) => {
      const requestId = msg?.requestId;
      if (!socket.data.chatRequests.has(requestId)) {
        socket.emit("chat:error", {
          requestId,
          message: "Join the request chat before sending messages",
        });
        return;
      }

      io.to(`chat:${requestId}`).emit("chat:new_message", {
        ...msg,
        senderName: socket.userName,
      });
    });

    socket.on("chat:typing", ({ requestId }) => {
      if (!socket.data.chatRequests.has(requestId)) {
        return;
      }
      socket.to(`chat:${requestId}`).emit("chat:typing", {
        userId: socket.userId,
        userName: socket.userName,
      });
    });

    socket.on("chat:stop_typing", ({ requestId }) => {
      if (!socket.data.chatRequests.has(requestId)) {
        return;
      }
      socket.to(`chat:${requestId}`).emit("chat:stop_typing", {
        userId: socket.userId,
      });
    });

    socket.on("disconnect", () => {
      console.log(`[Socket] ${socket.userRole}:${socket.userId} disconnected`);
    });
  });

  return io;
}

export function getIO() {
  if (!io) {
    throw new Error("Socket.io not initialised - call initSocket first");
  }
  return io;
}

export function clearTrackingLocation(jobId) {
  if (!jobId) {
    return false;
  }
  const removed = liveTrackingState.delete(jobId);

  if (io) {
    io.to(`tracking:${jobId}`).emit("tracking:ended", {
      jobId,
      timestamp: new Date().toISOString(),
    });
  }

  return removed;
}

export function clearOrderTrackingLocation(orderId, reason) {
  if (!orderId) {
    return false;
  }

  const removed = orderTrackingState.delete(orderId);

  if (io && reason) {
    io.to(`order_tracking:${orderId}`).emit("order_tracking:ended", {
      orderId,
      reason,
      timestamp: new Date().toISOString(),
    });
  }

  return removed;
}

export function emitRoleEvent(role, eventName, payload = {}) {
  if (!io) return false;
  io.to(`role:${role}`).emit(eventName, {
    ...payload,
    emitted_at: new Date().toISOString(),
  });
  return true;
}

export function emitUserEvent(userId, eventName, payload = {}) {
  if (!io || !userId) return false;
  io.to(`user:${userId}`).emit(eventName, {
    ...payload,
    emitted_at: new Date().toISOString(),
  });
  return true;
}

function formatNotificationLabel(value, fallback = "update") {
  if (!value || typeof value !== "string") {
    return fallback;
  }

  return value
    .split("_")
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function buildNotificationData(payload = {}) {
  const allowedKeys = [
    "request_id",
    "job_id",
    "offer_id",
    "order_id",
    "invoice_id",
    "fulfillment_id",
    "user_id",
    "status",
    "source",
    "entity",
    "action",
    "email",
  ];

  return allowedKeys.reduce((data, key) => {
    if (payload[key] !== undefined && payload[key] !== null) {
      data[key] = payload[key];
    }
    return data;
  }, {});
}

function buildAdminDashboardNotification(payload = {}) {
  const sourceLabel = formatNotificationLabel(payload.source, "System");
  const entityLabel = formatNotificationLabel(payload.entity, "activity");
  const actionLabel = formatNotificationLabel(payload.action, "updated").toLowerCase();
  const statusLabel = formatNotificationLabel(payload.status, "updated").toLowerCase();
  const eventKey = `${payload.entity || "unknown"}:${payload.action || "updated"}`;

  let title = `${entityLabel} updated`;
  let message = `${sourceLabel} ${actionLabel} ${entityLabel.toLowerCase()}.`;

  switch (eventKey) {
    case "service_request:created":
      title = "New service request";
      message = "A customer created a new roadside assistance request.";
      break;
    case "job:booked":
      title = "Technician booking sent";
      message = "A customer booked a technician and is waiting for confirmation.";
      break;
    case "job:accepted":
      title = "Technician accepted";
      message = "A technician accepted a job and started the service.";
      break;
    case "job:rejected":
      title = "Technician declined";
      message = "A technician declined a booking request.";
      break;
    case "job:completed":
      title = "Job completed";
      message = "A technician marked a job as completed.";
      break;
    case "job:status_updated":
      title = `Job ${statusLabel}`;
      message = `${sourceLabel} changed a job to ${statusLabel}.`;
      break;
    case "job:cancelled_before_confirmation":
      title = "Booking cancelled";
      message = "A customer cancelled a booking before the technician confirmed it.";
      break;
    case "service_request_parts:suggested":
      title = "Parts suggested";
      message = "A technician suggested parts for an in-progress job.";
      break;
    case "invoice:created":
      title = "Invoice created";
      message = "A technician created a new invoice for a completed job.";
      break;
    case "order:created":
      title = "New order placed";
      message = "A customer placed a new parts order.";
      break;
    case "order:confirmed":
      title = "Order confirmed";
      message = "A vendor confirmed a customer order.";
      break;
    case "order:processing":
      title = "Order in progress";
      message = "A vendor started preparing an order.";
      break;
    case "order:cancelled":
      title = "Order cancelled";
      message = `${sourceLabel} cancelled an order.`;
      break;
    case "order:returned":
      title = "Order returned";
      message = "A return has been completed for an order.";
      break;
    case "order_payment:paid":
      title = "Order payment received";
      message = "A customer completed payment for an order.";
      break;
    case "order_payment:cash_on_delivery_selected":
      title = "Cash on delivery selected";
      message = "A customer chose cash on delivery for an order.";
      break;
    case "order_payment:cash_on_delivery_collected":
      title = "Cash on delivery collected";
      message = "A vendor marked cash on delivery as collected.";
      break;
    case "fulfillment:created":
      title = "Shipment created";
      message = "A vendor created a shipment for an order.";
      break;
    case "fulfillment:status_updated":
      title = `Shipment ${statusLabel}`;
      message = `A shipment was updated to ${statusLabel}.`;
      break;
    case "order_return:requested":
      title = "Return requested";
      message = "A customer requested a return for an order.";
      break;
    case "order_return:approved":
      title = "Return approved";
      message = "A vendor approved an order return.";
      break;
    case "order_return:rejected":
      title = "Return rejected";
      message = "A vendor rejected an order return request.";
      break;
    case "order_return:processed":
      title = "Return processed";
      message = "An order return was completed and processed.";
      break;
    case "user:signup":
    case "technician:signup":
    case "vendor:signup":
      title = `${sourceLabel} signed up`;
      message = `A new ${payload.source} account was created.`;
      break;
    case "user:login":
    case "technician:login":
    case "vendor:login":
    case "admin:login":
      title = `${sourceLabel} logged in`;
      message = `${sourceLabel} signed in to the platform.`;
      break;
    case "payout:completed":
      title = "Payout processed";
      message = "A payout was marked as completed.";
      break;
    default:
      title = `${entityLabel} ${actionLabel}`;
      message = `${sourceLabel} ${actionLabel} ${entityLabel.toLowerCase()}.`;
      break;
  }

  return {
    title,
    message,
    data: buildNotificationData(payload),
  };
}

async function getUnreadNotificationCount(userId) {
  if (!userId) {
    return 0;
  }

  return prisma.notification.count({
    where: {
      user_id: userId,
      is_read: false,
    },
  });
}

export function emitAdminDashboardRefresh(payload = {}) {
  void notifyAdminsOfDashboardEvent(payload);
  return emitRoleEvent("admin", "admin:dashboard_refresh", payload);
}

export async function isUserViewingRequestChat(userId, requestId) {
  if (!io || !userId || !requestId) {
    return false;
  }

  const sockets = await io.in(`chat:${requestId}`).fetchSockets();
  return sockets.some((socket) => socket.userId === userId);
}

export async function emitNotificationChanged(userId, payload = {}) {
  if (!userId) {
    return false;
  }

  const unreadCount = await getUnreadNotificationCount(userId);
  return emitUserEvent(userId, "notification:changed", {
    ...payload,
    unreadCount,
  });
}

export async function pushNotification({
  userId,
  type,
  title,
  message,
  data,
  sendOfflineEmail = true,
}) {
  const notification = await prisma.notification.create({
    data: {
      user_id: userId,
      type,
      title,
      message,
      data: data || undefined,
    },
  });
  const unreadCount = await getUnreadNotificationCount(userId);

  const roomName = `user:${userId}`;
  let isOnline = false;

  if (io) {
    const sockets = await io.in(roomName).fetchSockets();
    isOnline = sockets.length > 0;

    if (isOnline) {
      io.to(roomName).emit("notification:new", {
        notification_id: notification.notification_id,
        type,
        title,
        message,
        data,
        is_read: false,
        created_at: notification.created_at,
        unreadCount,
      });
    }
  }

  if (sendOfflineEmail && !isOnline) {
    try {
      const userRecord = await prisma.user.findUnique({
        where: { user_id: userId },
        select: { email: true, full_name: true },
      });

      if (userRecord?.email) {
        await sendEmail({
          to: userRecord.email,
          subject: `Quick Auto Assist - ${title}`,
          text: `Hi ${userRecord.full_name || "User"},\n\n${message}\n\nPlease check your dashboard for more details.\n\n- Quick Auto Assist`,
          html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
              <h2 style="color:#2563eb;">New Notification: ${title}</h2>
              <p>Hi ${userRecord.full_name || "User"},</p>
              <p>${message}</p>
              <br/>
              <p>Please log in to your dashboard to view the full details.</p>
              <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
              <p style="font-size:12px;color:#94a3b8;">- Quick Auto Assist</p>
            </div>
          `,
        });
        console.log(
          `[Socket] Sent offline fallback email notification to ${userRecord.email} for ${type}`
        );
      }
    } catch (error) {
      console.error("[Socket] Failed to send offline email fallback", error);
    }
  }

  return notification;
}

export async function pushNotificationToUsers({
  userIds = [],
  type,
  title,
  message,
  data,
  sendOfflineEmail = false,
}) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  if (uniqueUserIds.length === 0) {
    return [];
  }

  return Promise.all(
    uniqueUserIds.map((targetUserId) =>
      pushNotification({
        userId: targetUserId,
        type,
        title,
        message,
        data,
        sendOfflineEmail,
      })
    )
  );
}

export async function pushRoleNotification({
  role,
  type,
  title,
  message,
  data,
  excludeUserIds = [],
  sendOfflineEmail = false,
}) {
  if (!role) {
    return [];
  }

  const users = await prisma.user.findMany({
    where: {
      role,
      deleted_at: null,
      is_active: true,
      ...(excludeUserIds.length > 0
        ? {
            user_id: {
              notIn: excludeUserIds.filter(Boolean),
            },
          }
        : {}),
    },
    select: {
      user_id: true,
    },
  });

  return pushNotificationToUsers({
    userIds: users.map((user) => user.user_id),
    type,
    title,
    message,
    data,
    sendOfflineEmail,
  });
}

async function notifyAdminsOfDashboardEvent(payload = {}) {
  const notification = buildAdminDashboardNotification(payload);
  const excludeUserIds =
    payload.source === "admin" && payload.actor_user_id
      ? [payload.actor_user_id]
      : [];

  await pushRoleNotification({
    role: "admin",
    type: "system",
    title: notification.title,
    message: notification.message,
    data: notification.data,
    excludeUserIds,
    sendOfflineEmail: false,
  }).catch((error) => {
    console.error("[Socket] Failed to notify admins about dashboard event", error);
  });
}
