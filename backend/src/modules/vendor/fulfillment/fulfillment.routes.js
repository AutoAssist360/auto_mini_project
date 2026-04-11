import { Router } from "express";
import { prisma } from "../../../lib/prisma.js";
import { asyncWrapper } from "../../../utils/asyncWrapper.js";
import { AppError } from "../../../utils/AppError.js";
import { userAuth } from "../../../middleware/auth.js";
import { roleGuard } from "../../../middleware/roleGuard.js";
import { requireVendorVerification } from "../../../middleware/vendorVerification.js";
import { validate } from "../../../middleware/validate.js";
import {
  clearOrderTrackingLocation,
  emitAdminDashboardRefresh,
  emitUserEvent,
  pushNotification,
} from "../../../socket.js";
import {
  updateFulfillmentStatusSchema,
  createFulfillmentSchema,
} from "../vendor.schemas.js";
import {
  assertFulfillmentTransition,
  assertOrderIsPaid,
  commitOrderReservations,
} from "../vendor.helpers.js";

export const vendorFulfillmentRouter = Router();
vendorFulfillmentRouter.use(userAuth, roleGuard("vendor"), requireVendorVerification);

// ─── POST /vendor/orders/:orderId/fulfillment ────────────────
// Create a new fulfillment record for an order (splits allowed)
vendorFulfillmentRouter.post(
  "/orders/:orderId/fulfillment",
  validate(createFulfillmentSchema),
  asyncWrapper(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { order_id: req.params.orderId },
      include: { warehouse: { select: { vendor_id: true } } },
    });

    if (!order || order.warehouse.vendor_id !== req.userId)
      throw new AppError("Order not found", 404);

    assertOrderIsPaid(order);

    // Only confirmed or processing orders can have fulfillments created
    if (!["confirmed", "processing"].includes(order.order_status)) {
      throw new AppError(
        `Cannot create fulfillment: order is in '${order.order_status}' state. Order must be 'confirmed' or 'processing'.`,
        400
      );
    }

    const { tracking_number, carrier, estimated_delivery, notes } = req.body;

    const data = {
      order_id: order.order_id,
      status: "pending",
    };
    if (tracking_number) data.tracking_number = tracking_number;
    if (carrier) data.carrier = carrier;
    if (estimated_delivery) data.estimated_delivery = new Date(estimated_delivery);
    if (notes) data.notes = notes;

    // Auto-move order to processing if still confirmed
    const fulfillment = await prisma.$transaction(async (tx) => {
      const f = await tx.fulfillment.create({ data });

      if (order.order_status === "confirmed") {
        await tx.order.update({
          where: { order_id: order.order_id },
          data: { order_status: "processing" },
        });
      }

      return f;
    });

    await pushNotification({
      userId: order.user_id,
      type: "order_update",
      title: "Shipment created",
      message: `Vendor created a shipment record for order ${order.order_number}.`,
      data: { order_id: order.order_id, fulfillment_id: fulfillment.fulfillment_id },
    }).catch(() => {});

    emitAdminDashboardRefresh({
      source: "vendor",
      entity: "fulfillment",
      action: "created",
      fulfillment_id: fulfillment.fulfillment_id,
      order_id: order.order_id,
    });

    emitUserEvent(req.userId, "vendor:orders_refresh", {
      reason: "fulfillment_created",
      order_id: order.order_id,
      fulfillment_id: fulfillment.fulfillment_id,
    });
    emitUserEvent(req.userId, "vendor:dashboard_refresh", {
      reason: "fulfillment_created",
      order_id: order.order_id,
      fulfillment_id: fulfillment.fulfillment_id,
    });
    emitUserEvent(order.user_id, "user:orders_refresh", {
      reason: "fulfillment_created",
      order_id: order.order_id,
      fulfillment_id: fulfillment.fulfillment_id,
    });

    res.status(201).json({
      message: "Fulfillment created",
      fulfillment,
    });
  })
);

// ─── GET /vendor/orders/:orderId/fulfillment ─────────────────
vendorFulfillmentRouter.get(
  "/orders/:orderId/fulfillment",
  asyncWrapper(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { order_id: req.params.orderId  },
      include: { warehouse: { select: { vendor_id: true } } },
    });

    if (!order || order.warehouse.vendor_id !== req.userId)
      throw new AppError("Order not found", 404);

    const fulfillments = await prisma.fulfillment.findMany({
      where: { order_id: order.order_id },
      orderBy: { created_at: "desc" },
    });

    res.json({ fulfillments });
  })
);

// ─── PATCH /vendor/fulfillment/:fulfillmentId/status ─────────
vendorFulfillmentRouter.patch(
  "/fulfillment/:fulfillmentId/status",
  validate(updateFulfillmentStatusSchema),
  asyncWrapper(async (req, res) => {
    const fulfillment = await prisma.fulfillment.findUnique({
      where: { fulfillment_id: req.params.fulfillmentId  },
      include: {
        order: {
          include: { warehouse: { select: { vendor_id: true } } },
        },
      },
    });

    if (!fulfillment || fulfillment.order.warehouse.vendor_id !== req.userId)
      throw new AppError("Fulfillment not found", 404);

    const { status, tracking_number, carrier, estimated_delivery, notes } =
      req.body;

    assertOrderIsPaid(fulfillment.order);
    assertFulfillmentTransition(fulfillment.status, status);

    // Validate that the order is in a valid state for fulfillment updates
    const validOrderStatesForShipping = ["confirmed", "processing", "shipped"];
    if (
      status === "shipped" &&
      !validOrderStatesForShipping.includes(fulfillment.order.order_status)
    ) {
      throw new AppError(
        `Cannot ship fulfillment: order is in '${fulfillment.order.order_status}' state. Order must be at least 'confirmed'.`,
        400
      );
    }

    const now = new Date();
    const data = { status };

    if (tracking_number !== undefined) data.tracking_number = tracking_number;
    if (carrier !== undefined) data.carrier = carrier;
    if (estimated_delivery !== undefined)
      data.estimated_delivery = new Date(estimated_delivery);
    if (notes !== undefined) data.notes = notes;

    // Auto-set timestamps based on status
    if (status === "shipped") data.shipped_at = now;
    if (status === "delivered") data.delivered_at = now;

    const updated = await prisma.$transaction(async (tx) => {
      const f = await tx.fulfillment.update({
        where: { fulfillment_id: fulfillment.fulfillment_id },
        data,
      });

      // If delivered, update order status to delivered
      if (status === "delivered") {
        // Check if ALL fulfillments for this order are delivered
        const pending = await tx.fulfillment.count({
          where: {
            order_id: fulfillment.order_id,
            status: { not: "delivered" },
            fulfillment_id: { not: fulfillment.fulfillment_id },
          },
        });

        if (pending === 0) {
          await tx.order.update({
            where: { order_id: fulfillment.order_id },
            data: { order_status: "delivered" },
          });
        }
      }

      // If shipped, ensure order is at least "shipped"
      if (status === "shipped") {
        await commitOrderReservations(tx, fulfillment.order);

        const order = await tx.order.findUnique({
          where: { order_id: fulfillment.order_id },
          select: { order_status: true },
        });
        if (
          order &&
          !["shipped", "delivered"].includes(order.order_status)
        ) {
          await tx.order.update({
            where: { order_id: fulfillment.order_id },
            data: { order_status: "shipped" },
          });
        }
      }

      return f;
    });

    await pushNotification({
      userId: fulfillment.order.user_id,
      type: "order_update",
      title: `Shipment ${status.replace(/_/g, " ")}`,
      message: `Order ${fulfillment.order.order_number} shipment is now ${status.replace(/_/g, " ")}.`,
      data: {
        order_id: fulfillment.order_id,
        fulfillment_id: fulfillment.fulfillment_id,
        status,
      },
    }).catch(() => {});

    emitAdminDashboardRefresh({
      source: "vendor",
      entity: "fulfillment",
      action: "status_updated",
      fulfillment_id: updated.fulfillment_id,
      order_id: fulfillment.order_id,
      status,
    });

    if (["delivered", "failed"].includes(status)) {
      clearOrderTrackingLocation(fulfillment.order_id, status);
    }

    emitUserEvent(req.userId, "vendor:orders_refresh", {
      reason: "fulfillment_status_updated",
      order_id: fulfillment.order_id,
      fulfillment_id: updated.fulfillment_id,
      status,
    });
    emitUserEvent(req.userId, "vendor:dashboard_refresh", {
      reason: "fulfillment_status_updated",
      order_id: fulfillment.order_id,
      fulfillment_id: updated.fulfillment_id,
      status,
    });
    emitUserEvent(fulfillment.order.user_id, "user:orders_refresh", {
      reason: "fulfillment_status_updated",
      order_id: fulfillment.order_id,
      fulfillment_id: updated.fulfillment_id,
      status,
    });

    res.json({ message: "Fulfillment status updated", fulfillment: updated });
  })
);
