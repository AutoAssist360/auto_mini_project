import { Router } from "express";
import Decimal from "decimal.js";
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
  listOrdersQuery,
  returnOrderSchema,
  reviewOrderReturnSchema,
} from "../vendor.schemas.js";
import {
  paginate,
  dateFilter,
  assertOrderTransition,
  assertOrderIsPaid,
  releaseOrderReservations,
} from "../vendor.helpers.js";
import {
  assertReturnWindow,
  getOrderReturnWindowMeta,
  getReturnPaymentUpdate,
  isCashOnDeliveryOrder,
} from "../../../utils/orderLifecycle.js";

export const vendorOrdersRouter = Router();
vendorOrdersRouter.use(userAuth, roleGuard("vendor"), requireVendorVerification);
const ADMIN_COMMISSION_RATE = new Decimal(0.05);

function withOrderLifecycleMeta(order) {
  if (!order) {
    return order;
  }

  return {
    ...order,
    ...getOrderReturnWindowMeta(order),
  };
}

// ─── Helper: find order owned by vendor ──────────────────────
async function findVendorOrder(orderId, vendorId) {
  const order = await prisma.order.findUnique({
    where: { order_id: orderId },
    include: {
      warehouse: { select: { vendor_id: true } },
      fulfillments: {
        select: {
          delivered_at: true,
        },
      },
    },
  });

  if (!order || order.warehouse.vendor_id !== vendorId)
    throw new AppError("Order not found", 404);

  return order;
}

// ─── GET /vendor/orders ──────────────────────────────────────
vendorOrdersRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const { page, limit, order_status, payment_status, from, to } =
      listOrdersQuery.parse(req.query);
    const { skip, take } = paginate(page, limit);

    // Get all warehouse IDs owned by vendor
    const warehouseIds = (
      await prisma.warehouse.findMany({
        where: { vendor_id: req.userId },
        select: { warehouse_id: true },
      })
    ).map((w) => w.warehouse_id);

    if (warehouseIds.length === 0) {
      return res.json({ orders: [], total: 0, page, limit });
    }

    const where = { warehouse_id: { in: warehouseIds } };
    if (order_status) where.order_status = order_status;
    if (payment_status) where.payment_status = payment_status;
    const created = dateFilter(from, to);
    if (created) where.created_at = created;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: "desc" },
        include: {
          user: { select: { user_id: true, full_name: true, email: true } },
          warehouse: { select: { warehouse_id: true, name: true } },
          fulfillments: {
            orderBy: { updated_at: "desc" },
            take: 1,
            select: {
              fulfillment_id: true,
              status: true,
              estimated_delivery: true,
              shipped_at: true,
              delivered_at: true,
            },
          },
          _count: { select: { items: true, fulfillments: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({ orders, total, page, limit });
  })
);

// ─── GET /vendor/orders/:orderId ─────────────────────────────
vendorOrdersRouter.get(
  "/:orderId",
  asyncWrapper(async (req, res) => {
    const order = await prisma.order.findUnique({
      where: { order_id: req.params.orderId  },
      include: {
        user: { select: { user_id: true, full_name: true, email: true, phone_number: true } },
        warehouse: {
          select: {
            warehouse_id: true,
            name: true,
            city: true,
            state: true,
            postal_code: true,
            address: true,
            latitude: true,
            longitude: true,
            phone: true,
          },
        },
        items: {
          include: {
            part: { select: { part_id: true, part_name: true } },
          },
        },
        fulfillments: { orderBy: { created_at: "desc" } },
        reservations: {
          include: {
            inventory: {
              select: {
                part: { select: { part_id: true, part_name: true } },
              },
            },
          },
        },
        // Include linked service request for customer delivery location
        request: {
          select: {
            request_id: true,
            breakdown_latitude: true,
            breakdown_longitude: true,
            service_location_type: true,
          },
        },
      },
    });

    if (!order) throw new AppError("Order not found", 404);

    // Verify ownership
    const warehouse = await prisma.warehouse.findUnique({
      where: { warehouse_id: order.warehouse_id },
      select: { vendor_id: true },
    });
    if (!warehouse || warehouse.vendor_id !== req.userId)
      throw new AppError("Order not found", 404);

    res.json({ order: withOrderLifecycleMeta(order) });
  })
);


// ─── PATCH /vendor/orders/:orderId/confirm ───────────────────
vendorOrdersRouter.patch(
  "/:orderId/confirm",
  asyncWrapper(async (req, res) => {
    const order = await findVendorOrder(
      req.params.orderId ,
      req.userId
    );

    assertOrderIsPaid(order);
    assertOrderTransition(order.order_status, "confirmed");

    const updated = await prisma.order.update({
      where: { order_id: order.order_id },
      data: { order_status: "confirmed" },
    });

    await pushNotification({
      userId: updated.user_id,
      type: "order_update",
      title: "Order confirmed",
      message: `Vendor confirmed order ${updated.order_number}.`,
      data: { order_id: updated.order_id },
    }).catch(() => {});

    emitAdminDashboardRefresh({
      source: "vendor",
      entity: "order",
      action: "confirmed",
      order_id: updated.order_id,
    });

    emitUserEvent(req.userId, "vendor:orders_refresh", {
      reason: "order_confirmed",
      order_id: updated.order_id,
    });
    emitUserEvent(req.userId, "vendor:dashboard_refresh", {
      reason: "order_confirmed",
      order_id: updated.order_id,
    });
    emitUserEvent(updated.user_id, "user:orders_refresh", {
      reason: "order_confirmed",
      order_id: updated.order_id,
    });

    res.json({ message: "Order confirmed", order: updated });
  })
);

// ─── PATCH /vendor/orders/:orderId/processing ────────────────
vendorOrdersRouter.patch(
  "/:orderId/processing",
  asyncWrapper(async (req, res) => {
    const order = await findVendorOrder(
      req.params.orderId ,
      req.userId
    );

    assertOrderIsPaid(order);
    assertOrderTransition(order.order_status, "processing");

    const updated = await prisma.order.update({
      where: { order_id: order.order_id },
      data: { order_status: "processing" },
    });

    await pushNotification({
      userId: updated.user_id,
      type: "order_update",
      title: "Order is being prepared",
      message: `Vendor has started preparing order ${updated.order_number} for dispatch.`,
      data: { order_id: updated.order_id },
    }).catch(() => {});

    emitAdminDashboardRefresh({
      source: "vendor",
      entity: "order",
      action: "processing",
      order_id: updated.order_id,
    });

    emitUserEvent(req.userId, "vendor:orders_refresh", {
      reason: "order_processing",
      order_id: updated.order_id,
    });
    emitUserEvent(req.userId, "vendor:dashboard_refresh", {
      reason: "order_processing",
      order_id: updated.order_id,
    });
    emitUserEvent(updated.user_id, "user:orders_refresh", {
      reason: "order_processing",
      order_id: updated.order_id,
    });

    res.json({ message: "Order moved to processing", order: updated });
  })
);

// ─── PATCH /vendor/orders/:orderId/cancel ────────────────────
vendorOrdersRouter.patch(
  "/:orderId/cancel",
  asyncWrapper(async (req, res) => {
    const order = await findVendorOrder(
      req.params.orderId ,
      req.userId
    );

    assertOrderTransition(order.order_status, "cancelled");

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { order_id: order.order_id },
        data: { order_status: "cancelled" },
      });

      await releaseOrderReservations(tx, order.order_id);

      return updated;
    });

    await pushNotification({
      userId: updatedOrder.user_id,
      type: "order_update",
      title: "Order cancelled",
      message: `Vendor cancelled order ${updatedOrder.order_number}.`,
      data: { order_id: updatedOrder.order_id },
    }).catch(() => {});

    emitAdminDashboardRefresh({
      source: "vendor",
      entity: "order",
      action: "cancelled",
      order_id: updatedOrder.order_id,
    });

    clearOrderTrackingLocation(updatedOrder.order_id, "cancelled");
    emitUserEvent(req.userId, "vendor:orders_refresh", {
      reason: "order_cancelled",
      order_id: updatedOrder.order_id,
    });
    emitUserEvent(req.userId, "vendor:dashboard_refresh", {
      reason: "order_cancelled",
      order_id: updatedOrder.order_id,
    });
    emitUserEvent(updatedOrder.user_id, "user:orders_refresh", {
      reason: "order_cancelled",
      order_id: updatedOrder.order_id,
    });

    res.json({ message: "Order cancelled, inventory reservations released" });
  })
);

vendorOrdersRouter.patch(
  "/:orderId/collect-cod",
  asyncWrapper(async (req, res) => {
    const order = await findVendorOrder(req.params.orderId, req.userId);

    if (!isCashOnDeliveryOrder(order)) {
      throw new AppError("This order is not marked for cash on delivery", 400);
    }

    if (order.payment_status === "completed") {
      throw new AppError("Cash on delivery has already been collected", 400);
    }

    if (order.payment_status === "refunded") {
      throw new AppError("Cannot collect payment for a refunded order", 400);
    }

    if (order.order_status !== "delivered") {
      throw new AppError("Cash on delivery can only be collected after delivery", 400);
    }

    const now = new Date();
    const orderTotal = new Decimal(order.total);
    const commissionAmount = orderTotal.mul(ADMIN_COMMISSION_RATE).toDecimalPlaces(2);
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { order_id: order.order_id },
        data: {
          payment_status: "completed",
          payment_method: "cash_on_delivery",
        },
      });

      await tx.payout.create({
        data: {
          recipient_id: req.userId,
          recipient_role: "vendor",
          amount: Number(orderTotal.toFixed(2)),
          month: now.getMonth() + 1,
          year: now.getFullYear(),
          status: "completed",
          source_type: "order",
          source_id: order.order_id,
          payment_method: "cash_on_delivery",
          paid_at: now,
          notes: "Vendor collected cash on delivery from customer",
        },
      });

      if (commissionAmount.gt(0)) {
        await tx.payout.create({
          data: {
            recipient_id: req.userId,
            recipient_role: "vendor",
            amount: -Number(commissionAmount.toFixed(2)),
            month: now.getMonth() + 1,
            year: now.getFullYear(),
            status: "pending",
            source_type: "order",
            source_id: order.order_id,
            payment_method: "upi",
            notes: "5% admin commission due for cash on delivery order",
          },
        });
      }

      return updated;
    });

    await pushNotification({
      userId: updatedOrder.user_id,
      type: "payment_received",
      title: "Cash on delivery received",
      message: `Vendor recorded cash payment for order ${updatedOrder.order_number}.`,
      data: { order_id: updatedOrder.order_id },
    }).catch(() => {});

    emitAdminDashboardRefresh({
      source: "vendor",
      entity: "order_payment",
      action: "cash_on_delivery_collected",
      order_id: updatedOrder.order_id,
    });

    emitUserEvent(req.userId, "vendor:orders_refresh", {
      reason: "cash_on_delivery_collected",
      order_id: updatedOrder.order_id,
    });
    emitUserEvent(req.userId, "vendor:dashboard_refresh", {
      reason: "cash_on_delivery_collected",
      order_id: updatedOrder.order_id,
    });
    emitUserEvent(updatedOrder.user_id, "user:orders_refresh", {
      reason: "cash_on_delivery_collected",
      order_id: updatedOrder.order_id,
    });

    res.json({
      message: "Cash on delivery marked as collected",
      order: updatedOrder,
    });
  })
);

// ─── POST /vendor/orders/:orderId/return ─────────────────────
vendorOrdersRouter.post(
  "/:orderId/return",
  validate(returnOrderSchema),
  asyncWrapper(async (req, res) => {
    const order = await findVendorOrder(
      req.params.orderId ,
      req.userId
    );

    // Only delivered orders can be returned
    if (order.order_status !== "delivered") {
      throw new AppError("Only delivered orders can be returned", 400);
    }

    assertReturnWindow(order);

    const { reason } = req.body;

    const result = await prisma.$transaction(async (tx) => {
      const updatedOrder = await tx.order.update({
        where: { order_id: order.order_id },
        data: {
          order_status: "returned",
          return_status: "approved",
          return_reason: order.return_reason || reason,
          return_requested_at: order.return_requested_at || new Date(),
          return_requested_by: order.return_requested_by || "vendor",
          return_reviewed_at: new Date(),
          return_resolution_notes: reason,
          notes: `Return reason: ${reason}`,
          ...getReturnPaymentUpdate(order),
        },
      });

      // Restore inventory from order items
      const items = await tx.orderItem.findMany({
        where: { order_id: order.order_id },
      });

      const missingInventory = [];
      for (const item of items) {
        // Find inventory in same warehouse for this part
        const inv = await tx.inventory.findUnique({
          where: {
            warehouse_id_part_id: {
              warehouse_id: order.warehouse_id,
              part_id: item.part_id,
            },
          },
        });

        if (inv) {
          await tx.inventory.update({
            where: { inventory_id: inv.inventory_id },
            data: { quantity_available: { increment: item.quantity } },
          });
        } else {
          missingInventory.push(item.part_id);
        }
      }

      // Cancel any remaining active reservations
      await tx.inventoryReservation.updateMany({
        where: { order_id: order.order_id, status: "active" },
        data: { status: "cancelled" },
      });

      return { missingInventory, updatedOrder };
    });

    const response = { message: "Order return processed, inventory restored" };
    if (result.missingInventory.length > 0) {
      response.warning = `Inventory records not found for part IDs: ${result.missingInventory.join(", ")}. Stock was not restored for these parts.`;
    }

    await pushNotification({
      userId: result.updatedOrder.user_id,
      type: "order_update",
      title: "Return completed",
      message: `Return for order ${result.updatedOrder.order_number} has been completed.`,
      data: { order_id: result.updatedOrder.order_id },
    }).catch(() => {});

    emitAdminDashboardRefresh({
      source: "vendor",
      entity: "order",
      action: "returned",
      order_id: result.updatedOrder.order_id,
    });

    clearOrderTrackingLocation(result.updatedOrder.order_id, "returned");
    emitUserEvent(req.userId, "vendor:orders_refresh", {
      reason: "order_returned",
      order_id: result.updatedOrder.order_id,
    });
    emitUserEvent(req.userId, "vendor:dashboard_refresh", {
      reason: "order_returned",
      order_id: result.updatedOrder.order_id,
    });
    emitUserEvent(result.updatedOrder.user_id, "user:orders_refresh", {
      reason: "order_returned",
      order_id: result.updatedOrder.order_id,
    });

    res.json({
      ...response,
      order: withOrderLifecycleMeta({
        ...order,
        ...result.updatedOrder,
      }),
    });
  })
);

vendorOrdersRouter.patch(
  "/:orderId/return-review",
  validate(reviewOrderReturnSchema),
  asyncWrapper(async (req, res) => {
    const order = await findVendorOrder(req.params.orderId, req.userId);
    const { decision, resolution_notes } = req.body;

    if (order.return_status !== "requested") {
      throw new AppError("There is no pending return request for this order", 400);
    }

    if (decision === "approved") {
      assertReturnWindow(order);

      const updated = await prisma.$transaction(async (tx) => {
        const updatedOrder = await tx.order.update({
          where: { order_id: order.order_id },
          data: {
            order_status: "returned",
            return_status: "approved",
            return_reviewed_at: new Date(),
            return_resolution_notes: resolution_notes || null,
            ...getReturnPaymentUpdate(order),
          },
        });

        const items = await tx.orderItem.findMany({
          where: { order_id: order.order_id },
        });

        for (const item of items) {
          const inventory = await tx.inventory.findUnique({
            where: {
              warehouse_id_part_id: {
                warehouse_id: order.warehouse_id,
                part_id: item.part_id,
              },
            },
          });

          if (inventory) {
            await tx.inventory.update({
              where: { inventory_id: inventory.inventory_id },
              data: { quantity_available: { increment: item.quantity } },
            });
          }
        }

        await tx.inventoryReservation.updateMany({
          where: { order_id: order.order_id, status: "active" },
          data: { status: "cancelled" },
        });

        return updatedOrder;
      });

      await pushNotification({
        userId: updated.user_id,
        type: "order_update",
        title: "Return approved",
        message: `Vendor approved your return request for order ${updated.order_number}.`,
        data: { order_id: updated.order_id },
      }).catch(() => {});

      emitAdminDashboardRefresh({
        source: "vendor",
        entity: "order_return",
        action: "approved",
        order_id: updated.order_id,
      });

      clearOrderTrackingLocation(updated.order_id, "returned");
      emitUserEvent(req.userId, "vendor:orders_refresh", {
        reason: "return_approved",
        order_id: updated.order_id,
      });
      emitUserEvent(req.userId, "vendor:dashboard_refresh", {
        reason: "return_approved",
        order_id: updated.order_id,
      });
      emitUserEvent(updated.user_id, "user:orders_refresh", {
        reason: "return_approved",
        order_id: updated.order_id,
      });

      return res.json({
        message: "Return request approved and inventory restored",
        order: withOrderLifecycleMeta({
          ...order,
          ...updated,
        }),
      });
    }

    const updated = await prisma.order.update({
      where: { order_id: order.order_id },
      data: {
        return_status: "rejected",
        return_reviewed_at: new Date(),
        return_resolution_notes: resolution_notes || null,
      },
    });

    await pushNotification({
      userId: updated.user_id,
      type: "order_update",
      title: "Return rejected",
      message: `Vendor rejected your return request for order ${updated.order_number}.`,
      data: { order_id: updated.order_id },
    }).catch(() => {});

    emitAdminDashboardRefresh({
      source: "vendor",
      entity: "order_return",
      action: "rejected",
      order_id: updated.order_id,
    });

    clearOrderTrackingLocation(updated.order_id, "rejected");
    emitUserEvent(req.userId, "vendor:orders_refresh", {
      reason: "return_rejected",
      order_id: updated.order_id,
    });
    emitUserEvent(req.userId, "vendor:dashboard_refresh", {
      reason: "return_rejected",
      order_id: updated.order_id,
    });
    emitUserEvent(updated.user_id, "user:orders_refresh", {
      reason: "return_rejected",
      order_id: updated.order_id,
    });

    res.json({
      message: "Return request rejected",
      order: withOrderLifecycleMeta({
        ...order,
        ...updated,
      }),
    });
  })
);
