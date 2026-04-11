import { Router } from "express";
import crypto from "crypto";
import Decimal from "decimal.js";
import { prisma } from "../../../lib/prisma.js";
import { userAuth } from "../../../middleware/auth.js";
import { roleGuard } from "../../../middleware/roleGuard.js";
import { asyncWrapper } from "../../../utils/asyncWrapper.js";
import { AppError } from "../../../utils/AppError.js";
import { validate } from "../../../middleware/validate.js";
import {
  clearOrderTrackingLocation,
  emitUserEvent,
  emitAdminDashboardRefresh,
  pushNotification,
} from "../../../socket.js";
import {
  createOrderSchema,
  payOrderSchema,
  requestOrderReturnSchema,
  reservePartSchema,
} from "./orders.schemas.js";
import { paginate, paginationQuery } from "../../../utils/paginate.js";
import { releaseOrderReservations } from "../../vendor/vendor.helpers.js";
import {
  assertReturnWindow,
  getOrderReturnWindowMeta,
  normalizeOrderPaymentMethod,
} from "../../../utils/orderLifecycle.js";

export const orderRouter = Router();

orderRouter.use(userAuth, roleGuard("user", "admin"));

// ─── Helper: generate human-readable order number ────────────
const generateOrderNumber = () => {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `ORD-${ts}-${rand}`;
};

// ─── Tax rate (placeholder — externalise to config) ──────────
const TAX_RATE = 0.18; // 18% GST
const POSTGRES_INT_MAX = 2147483647;
const ORDER_RESERVATION_EXPIRY_MS = 30 * 24 * 60 * 60 * 1000;
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

function buildDeliverySnapshot(payload, currentUser, serviceRequest) {
  const fallbackLatitude =
    payload.delivery_latitude ?? serviceRequest?.breakdown_latitude ?? undefined;
  const fallbackLongitude =
    payload.delivery_longitude ?? serviceRequest?.breakdown_longitude ?? undefined;

  const snapshot = {
    delivery_contact_name: payload.delivery_contact_name || currentUser.full_name,
    delivery_phone: payload.delivery_phone || currentUser.phone_number,
    delivery_address: payload.delivery_address?.trim() || null,
    delivery_city: payload.delivery_city?.trim() || null,
    delivery_state: payload.delivery_state?.trim() || null,
    delivery_postal_code: payload.delivery_postal_code?.trim() || null,
    delivery_latitude: fallbackLatitude,
    delivery_longitude: fallbackLongitude,
    delivery_instructions:
      payload.delivery_instructions?.trim() || payload.notes?.trim() || null,
  };

  if (!snapshot.delivery_address && (snapshot.delivery_latitude == null || snapshot.delivery_longitude == null)) {
    throw new AppError(
      "Please provide a delivery address or drop a map pin before placing this order",
      400
    );
  }

  return snapshot;
}

// ═════════════════════════════════════════════════════════════
//  ORDER ROUTES
// ═════════════════════════════════════════════════════════════

// ─── GET /orders ─────────────────────────────────────────────
orderRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const { status } = req.query;
    const { page, limit } = paginationQuery.parse(req.query);
    const { skip, take } = paginate(page, limit);

    const where = { user_id: req.userId };

    if (status && typeof status === "string") {
      const statuses = status.split(",");
      where.order_status = { in: statuses };
    }

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          warehouse: {
            select: { warehouse_id: true, name: true, city: true },
          },
          items: {
            include: {
              part: { select: { part_id: true, part_name: true } },
            },
          },
          fulfillments: {
            select: {
              fulfillment_id: true,
              status: true,
              tracking_number: true,
              carrier: true,
              estimated_delivery: true,
              shipped_at: true,
              delivered_at: true,
            },
            orderBy: { created_at: "desc" },
            take: 1,
          },
        },
        orderBy: { created_at: "desc" },
        skip,
        take,
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      orders: orders.map((order) => withOrderLifecycleMeta(order)),
      total,
      page,
      limit,
    });
  })
);

// ─── GET /orders/:orderId ────────────────────────────────────
orderRouter.get(
  "/:orderId",
  asyncWrapper(async (req, res) => {
    const orderId = req.params.orderId ;

    const order = await prisma.order.findUnique({
      where: { order_id: orderId },
      include: {
        warehouse: true,
        items: {
          include: {
            part: {
              select: {
                part_id: true,
                part_name: true,
                category: { select: { category_name: true } },
              },
            },
          },
        },
        fulfillments: { orderBy: { created_at: "desc" } },
        reservations: {
          select: {
            reservation_id: true,
            inventory_id: true,
            quantity: true,
            status: true,
            expires_at: true,
          },
        },
        request: {
          select: { request_id: true, issue_description: true, status: true },
        },
      },
    });

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    // Ownership validation
    if (order.user_id !== req.userId) {
      throw new AppError("You do not have access to this order", 403);
    }

    res.json({ order: withOrderLifecycleMeta(order) });
  })
);

// ─── POST /orders ────────────────────────────────────────────
orderRouter.post(
  "/",
  validate(createOrderSchema),
  asyncWrapper(async (req, res) => {
    const {
      warehouse_id,
      request_id,
      items,
      notes,
      payment_method,
      delivery_contact_name,
      delivery_phone,
      delivery_address,
      delivery_city,
      delivery_state,
      delivery_postal_code,
      delivery_latitude,
      delivery_longitude,
      delivery_instructions,
    } = req.body;
    let resolvedWarehouseId = warehouse_id;
    let serviceRequest = null;

    if (!resolvedWarehouseId) {
      const inventoryIds = items
        .map((item) => item.inventory_id)
        .filter(Boolean);

      if (inventoryIds.length !== items.length) {
        throw new AppError("Warehouse could not be resolved from cart items", 400);
      }

      const inventoriesById = await prisma.inventory.findMany({
        where: { inventory_id: { in: inventoryIds } },
        select: {
          inventory_id: true,
          warehouse_id: true,
          part_id: true,
        },
      });

      if (inventoriesById.length !== inventoryIds.length) {
        throw new AppError("Some cart items are no longer available", 400);
      }

      const warehouseIds = new Set(
        inventoriesById.map((inventory) => inventory.warehouse_id)
      );
      if (warehouseIds.size !== 1) {
        throw new AppError("Cart items must belong to the same warehouse", 400);
      }

      const inventoryMap = new Map(
        inventoriesById.map((inventory) => [inventory.inventory_id, inventory])
      );

      for (const item of items) {
        const inventory = inventoryMap.get(item.inventory_id);
        if (!inventory || inventory.part_id !== item.part_id) {
          throw new AppError("Cart item does not match warehouse inventory", 400);
        }
      }

      resolvedWarehouseId = inventoriesById[0].warehouse_id;
    }

    const [warehouse, currentUser] = await Promise.all([
      prisma.warehouse.findUnique({
        where: { warehouse_id: resolvedWarehouseId },
      }),
      prisma.user.findUnique({
        where: { user_id: req.userId },
        select: { full_name: true, phone_number: true },
      }),
    ]);

    if (!warehouse || !warehouse.is_active) {
      throw new AppError("Warehouse not found or inactive", 404);
    }

    if (!currentUser) {
      throw new AppError("User not found", 404);
    }

    if (request_id) {
      serviceRequest = await prisma.serviceRequest.findUnique({
        where: { request_id },
        select: {
          request_id: true,
          user_id: true,
          breakdown_latitude: true,
          breakdown_longitude: true,
        },
      });

      if (!serviceRequest) {
        throw new AppError("Service request not found", 404);
      }

      if (serviceRequest.user_id !== req.userId) {
        throw new AppError("This service request does not belong to you", 403);
      }
    }

    const deliverySnapshot = buildDeliverySnapshot(
      {
        delivery_contact_name,
        delivery_phone,
        delivery_address,
        delivery_city,
        delivery_state,
        delivery_postal_code,
        delivery_latitude,
        delivery_longitude,
        delivery_instructions,
        notes,
      },
      currentUser,
      serviceRequest
    );

    const order = await prisma.$transaction(async (tx) => {
      const partIds = items.map((item) => item.part_id);
      const inventories = await tx.inventory.findMany({
        where: {
          warehouse_id: resolvedWarehouseId,
          part_id: { in: partIds },
        },
        include: {
          part: { select: { part_id: true, part_name: true } },
        },
      });

      const inventoryMap = new Map(
        inventories.map((inventory) => [inventory.part_id, inventory])
      );

      let subtotal = new Decimal(0);
      const orderItemsData = [];
      const reservationExpiresAt = new Date(Date.now() + ORDER_RESERVATION_EXPIRY_MS);

      for (const item of items) {
        const inventory = inventoryMap.get(item.part_id);

        if (!inventory) {
          throw new AppError(
            `Part ID ${item.part_id} is not available in this warehouse`,
            400
          );
        }

        const available = inventory.quantity_available - inventory.quantity_reserved;
        if (available < item.quantity) {
          throw new AppError(
            `Insufficient stock for '${inventory.part.part_name}'. Available: ${available}, Requested: ${item.quantity}`,
            400
          );
        }

        const unit_price = inventory.unit_cost;
        const total_price = unit_price.mul(item.quantity);

        orderItemsData.push({
          part_id: item.part_id,
          quantity: item.quantity,
          unit_price,
          total_price,
        });

        subtotal = subtotal.add(total_price);
      }

      const tax = subtotal.mul(TAX_RATE).toDecimalPlaces(2);
      const total = subtotal.add(tax);
      const order_number = generateOrderNumber();

      const newOrder = await tx.order.create({
        data: {
          order_number,
          user_id: req.userId,
          warehouse_id: resolvedWarehouseId,
          request_id: request_id || null,
          payment_method: normalizeOrderPaymentMethod(payment_method),
          ...deliverySnapshot,
          subtotal,
          tax,
          total,
          notes: notes || null,
          items: {
            create: orderItemsData,
          },
        },
        include: {
          items: {
            include: {
              part: { select: { part_id: true, part_name: true } },
            },
          },
        },
      });

      for (const item of orderItemsData) {
        const reserved = await tx.inventory.updateMany({
          where: {
            warehouse_id: resolvedWarehouseId,
            part_id: item.part_id,
            quantity_available: { gte: item.quantity },
            quantity_reserved: { lte: POSTGRES_INT_MAX - item.quantity },
          },
          data: {
            quantity_reserved: { increment: item.quantity },
          },
        });

        if (reserved.count !== 1) {
          throw new AppError(
            `Insufficient stock while reserving part ID ${item.part_id}`,
            409
          );
        }

        const updatedInventory = await tx.inventory.findUnique({
          where: {
            warehouse_id_part_id: {
              warehouse_id: resolvedWarehouseId,
              part_id: item.part_id,
            },
          },
          select: {
            inventory_id: true,
            quantity_available: true,
            quantity_reserved: true,
          },
        });

        if (
          !updatedInventory ||
          updatedInventory.quantity_reserved > updatedInventory.quantity_available
        ) {
          throw new AppError(
            `Insufficient stock while reserving part ID ${item.part_id}`,
            409
          );
        }

        await tx.inventoryReservation.create({
          data: {
            inventory_id: updatedInventory.inventory_id,
            order_id: newOrder.order_id,
            request_id: request_id || null,
            quantity: item.quantity,
            expires_at: reservationExpiresAt,
          },
        });
      }

      return newOrder;
    });

    await pushNotification({
      userId: warehouse.vendor_id,
      type: "order_update",
      title: "New parts order received",
      message:
        normalizeOrderPaymentMethod(order.payment_method) === "cash_on_delivery"
          ? `Order ${order.order_number} has been placed with cash on delivery.`
          : `Order ${order.order_number} has been created and is waiting for payment confirmation.`,
      data: { order_id: order.order_id },
    }).catch(() => {});

    emitAdminDashboardRefresh({
      source: "user",
      entity: "order",
      action: "created",
      order_id: order.order_id,
    });

    emitUserEvent(req.userId, "user:orders_refresh", {
      reason: "order_created",
      order_id: order.order_id,
    });
    emitUserEvent(warehouse.vendor_id, "vendor:orders_refresh", {
      reason: "order_created",
      order_id: order.order_id,
    });
    emitUserEvent(warehouse.vendor_id, "vendor:dashboard_refresh", {
      reason: "order_created",
      order_id: order.order_id,
    });

    res.status(201).json({
      message: "Order created successfully",
      order: withOrderLifecycleMeta(order),
    });
  })
);

// ─── POST /orders/:orderId/pay ───────────────────────────────
// NOTE: This is for ORDER payments only, separate from service invoice payments.
orderRouter.post(
  "/:orderId/pay",
  validate(payOrderSchema),
  asyncWrapper(async (req, res) => {
    const orderId = req.params.orderId ;
    const paymentMethod = normalizeOrderPaymentMethod(req.body.payment_method);
    const transactionId = req.body.transaction_id?.trim() || null;

    const order = await prisma.order.findUnique({
      where: { order_id: orderId },
      include: { warehouse: { select: { vendor_id: true } } },
    });

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    // Ownership validation
    if (order.user_id !== req.userId) {
      throw new AppError("You do not have access to this order", 403);
    }

    if (order.payment_status === "completed") {
      throw new AppError("Order has already been paid", 400);
    }

    if (normalizeOrderPaymentMethod(order.payment_method) === "cash_on_delivery") {
      throw new AppError(
        "UPI QR payment is not available because this order is set to cash on delivery",
        400
      );
    }

    if (order.order_status === "cancelled") {
      throw new AppError("Cannot pay for a cancelled order", 400);
    }

    if (order.order_status === "returned") {
      throw new AppError("Cannot pay for a returned order", 400);
    }

    // Check duplicate transaction_id across both orders and invoices
    if (transactionId) {
      const [existingOrder, existingInvoice] = await Promise.all([
        prisma.order.findFirst({ where: { transaction_id: transactionId } }),
        prisma.invoice.findFirst({ where: { transaction_id: transactionId } }),
      ]);

      if (existingOrder || existingInvoice) {
        throw new AppError("Transaction ID already used", 409);
      }
    }

    if (paymentMethod === "cash_on_delivery") {
      const updatedOrder = await prisma.order.update({
        where: { order_id: orderId },
        data: {
          payment_method: "cash_on_delivery",
          transaction_id: null,
          order_status:
            order.order_status === "pending" ? "confirmed" : order.order_status,
        },
        include: {
          items: {
            include: {
              part: { select: { part_id: true, part_name: true } },
            },
          },
          fulfillments: { orderBy: { created_at: "desc" } },
        },
      });

      await pushNotification({
        userId: order.warehouse?.vendor_id,
        type: "order_update",
        title: "Cash on delivery selected",
        message: `Customer selected cash on delivery for order ${updatedOrder.order_number}.`,
        data: { order_id: orderId },
      }).catch(() => {});

      await pushNotification({
        userId: req.userId,
        type: "order_update",
        title: "Cash on delivery selected",
        message: `Order ${updatedOrder.order_number} will be paid in cash at delivery.`,
        data: { order_id: orderId },
      }).catch(() => {});

      emitAdminDashboardRefresh({
        source: "user",
        entity: "order_payment",
        action: "cash_on_delivery_selected",
        order_id: updatedOrder.order_id,
      });

      emitUserEvent(req.userId, "user:orders_refresh", {
        reason: "cash_on_delivery_selected",
        order_id: updatedOrder.order_id,
      });
      if (order.warehouse?.vendor_id) {
        emitUserEvent(order.warehouse.vendor_id, "vendor:orders_refresh", {
          reason: "cash_on_delivery_selected",
          order_id: updatedOrder.order_id,
        });
        emitUserEvent(order.warehouse.vendor_id, "vendor:dashboard_refresh", {
          reason: "cash_on_delivery_selected",
          order_id: updatedOrder.order_id,
        });
      }

      return res.json({
        message: "Cash on delivery selected successfully",
        order: withOrderLifecycleMeta(updatedOrder),
      });
    }

    const nextOrderStatus =
      order.order_status === "pending" ? "confirmed" : order.order_status;
    const vendorId = order.warehouse?.vendor_id;
    const now = new Date();
    const orderTotal = new Decimal(order.total);
    const commissionAmount = orderTotal.mul(ADMIN_COMMISSION_RATE).toDecimalPlaces(2);

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { order_id: orderId },
        data: {
          payment_status: "completed",
          payment_method: paymentMethod,
          transaction_id: transactionId,
          order_status: nextOrderStatus,
        },
        include: {
          items: {
            include: {
              part: { select: { part_id: true, part_name: true } },
            },
          },
          fulfillments: { orderBy: { created_at: "desc" } },
        },
      });

      if (vendorId) {
        await tx.payout.create({
          data: {
            recipient_id: vendorId,
            recipient_role: "vendor",
            amount: Number(orderTotal.toFixed(2)),
            month: now.getMonth() + 1,
            year: now.getFullYear(),
            status: "completed",
            source_type: "order",
            source_id: orderId,
            payment_method: paymentMethod || "upi",
            transaction_id: transactionId,
            paid_at: now,
            notes: "Vendor received direct customer payment",
          },
        });

        if (commissionAmount.gt(0)) {
          await tx.payout.create({
            data: {
              recipient_id: vendorId,
              recipient_role: "vendor",
              amount: -Number(commissionAmount.toFixed(2)),
              month: now.getMonth() + 1,
              year: now.getFullYear(),
              status: "pending",
              source_type: "order",
              source_id: orderId,
              payment_method: "upi",
              notes: "5% admin commission due for direct vendor payment",
            },
          });
        }
      }

      return updated;
    });

    // ── Auto-transfer payout to the vendor ──
    if (vendorId) {
      await pushNotification({
        userId: vendorId,
        type: "payment_received",
        title: "Order payment confirmed",
        message: `Payment for order ${updatedOrder.order_number} has been confirmed by the customer.`,
        data: { order_id: orderId },
      }).catch(() => {});
    }

    await pushNotification({
      userId: req.userId,
      type: "order_update",
      title: "Order payment successful",
      message: `Order ${updatedOrder.order_number} is now awaiting vendor confirmation.`,
      data: { order_id: orderId },
    }).catch(() => {});

    emitAdminDashboardRefresh({
      source: "user",
      entity: "order_payment",
      action: "paid",
      order_id: updatedOrder.order_id,
    });

    emitUserEvent(req.userId, "user:orders_refresh", {
      reason: "order_paid",
      order_id: updatedOrder.order_id,
    });
    if (vendorId) {
      emitUserEvent(vendorId, "vendor:orders_refresh", {
        reason: "order_paid",
        order_id: updatedOrder.order_id,
      });
      emitUserEvent(vendorId, "vendor:dashboard_refresh", {
        reason: "order_paid",
        order_id: updatedOrder.order_id,
      });
    }

    res.json({
      message: "Order payment successful",
      order: withOrderLifecycleMeta(updatedOrder),
    });
  })
);

orderRouter.patch(
  "/:orderId/cancel",
  asyncWrapper(async (req, res) => {
    const orderId = req.params.orderId;

    const order = await prisma.order.findUnique({
      where: { order_id: orderId },
      include: {
        warehouse: { select: { vendor_id: true } },
      },
    });

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    if (req.userRole !== "admin" && order.user_id !== req.userId) {
      throw new AppError("You do not have access to this order", 403);
    }

    if (!["pending", "confirmed", "processing"].includes(order.order_status)) {
      throw new AppError(
        `Cannot cancel an order in '${order.order_status}' status`,
        400
      );
    }

    const updatedOrder = await prisma.$transaction(async (tx) => {
      const updated = await tx.order.update({
        where: { order_id: orderId },
        data: {
          order_status: "cancelled",
          ...(order.payment_status === "completed"
            ? { payment_status: "refunded" }
            : {}),
        },
        include: {
          items: {
            include: {
              part: { select: { part_id: true, part_name: true } },
            },
          },
          fulfillments: { orderBy: { created_at: "desc" } },
        },
      });

      await releaseOrderReservations(tx, orderId);

      return updated;
    });

    await pushNotification({
      userId: order.warehouse?.vendor_id,
      type: "order_update",
      title: "Order cancelled by customer",
      message: `Customer cancelled order ${updatedOrder.order_number}.`,
      data: { order_id: orderId },
    }).catch(() => {});

    emitAdminDashboardRefresh({
      source: "user",
      entity: "order",
      action: "cancelled",
      order_id: updatedOrder.order_id,
    });

    clearOrderTrackingLocation(updatedOrder.order_id, "cancelled");
    emitUserEvent(req.userId, "user:orders_refresh", {
      reason: "order_cancelled",
      order_id: updatedOrder.order_id,
    });
    if (order.warehouse?.vendor_id) {
      emitUserEvent(order.warehouse.vendor_id, "vendor:orders_refresh", {
        reason: "order_cancelled",
        order_id: updatedOrder.order_id,
      });
      emitUserEvent(order.warehouse.vendor_id, "vendor:dashboard_refresh", {
        reason: "order_cancelled",
        order_id: updatedOrder.order_id,
      });
    }

    res.json({
      message:
        order.payment_status === "completed"
          ? "Order cancelled and refunded successfully"
          : "Order cancelled successfully",
      order: withOrderLifecycleMeta(updatedOrder),
    });
  })
);

orderRouter.post(
  "/:orderId/return-request",
  validate(requestOrderReturnSchema),
  asyncWrapper(async (req, res) => {
    const orderId = req.params.orderId;
    const { reason } = req.body;

    const order = await prisma.order.findUnique({
      where: { order_id: orderId },
      include: {
        warehouse: { select: { vendor_id: true, name: true } },
        fulfillments: {
          select: {
            delivered_at: true,
          },
        },
      },
    });

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    if (order.user_id !== req.userId) {
      throw new AppError("You do not have access to this order", 403);
    }

    if (order.order_status !== "delivered") {
      throw new AppError("Return requests can only be raised after delivery", 400);
    }

    assertReturnWindow(order);

    if (order.return_status === "requested") {
      throw new AppError("A return request is already pending for this order", 400);
    }

    if (order.order_status === "returned" || order.return_status === "approved") {
      throw new AppError("This order has already been returned", 400);
    }

    const updatedOrder = await prisma.order.update({
      where: { order_id: orderId },
      data: {
        return_status: "requested",
        return_reason: reason.trim(),
        return_requested_at: new Date(),
        return_requested_by: "user",
        return_reviewed_at: null,
        return_resolution_notes: null,
      },
    });

    await pushNotification({
      userId: order.warehouse.vendor_id,
      type: "order_update",
      title: "Return requested",
      message: `Customer has requested a return for order ${order.order_number}.`,
      data: { order_id: orderId },
    }).catch(() => {});

    emitAdminDashboardRefresh({
      source: "user",
      entity: "order_return",
      action: "requested",
      order_id: updatedOrder.order_id,
    });

    emitUserEvent(req.userId, "user:orders_refresh", {
      reason: "return_requested",
      order_id: updatedOrder.order_id,
    });
    emitUserEvent(order.warehouse.vendor_id, "vendor:orders_refresh", {
      reason: "return_requested",
      order_id: updatedOrder.order_id,
    });
    emitUserEvent(order.warehouse.vendor_id, "vendor:dashboard_refresh", {
      reason: "return_requested",
      order_id: updatedOrder.order_id,
    });

    res.json({
      message: "Return request submitted successfully",
      order: withOrderLifecycleMeta({
        ...order,
        ...updatedOrder,
      }),
    });
  })
);

// ─── GET /orders/:orderId/qr-data ────────────────────────────
// Returns UPI deep-link string for dynamic QR code generation
orderRouter.get(
  "/:orderId/qr-data",
  asyncWrapper(async (req, res) => {
    const orderId = req.params.orderId;

    const order = await prisma.order.findUnique({
      where: { order_id: orderId },
      include: {
        warehouse: {
          select: {
            name: true,
            vendor: {
              select: {
                full_name: true,
                upi_id: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    if (order.user_id !== req.userId) {
      throw new AppError("You do not have access to this order", 403);
    }

    if (order.payment_status === "completed") {
      throw new AppError("Order has already been paid", 400);
    }

    const vendorUpiId = order.warehouse?.vendor?.upi_id?.trim();
    if (!vendorUpiId) {
      throw new AppError(
        "Vendor UPI ID is not available for this order. Please contact support.",
        400
      );
    }

    const amount = Number(order.total).toFixed(2);
    const txnRef = order.order_id.slice(0, 20);
    const note = `Order ${(order.order_number || order.order_id).slice(0, 8)}`;
    const vendorName = order.warehouse?.vendor?.full_name || order.warehouse?.name || "Vendor";
    const upiUrl = `upi://pay?pa=${encodeURIComponent(vendorUpiId)}&pn=${encodeURIComponent(vendorName)}&am=${amount}&tr=${encodeURIComponent(txnRef)}&tn=${encodeURIComponent(note)}&cu=INR`;

    res.json({
      upi_url: upiUrl,
      vendor_upi_id: vendorUpiId,
      vendor_name: vendorName,
      warehouse_name: order.warehouse?.name || null,
      amount,
      reference: txnRef,
    });
  })
);

// ─── GET /orders/:orderId/fulfillment ────────────────────────
orderRouter.get(
  "/:orderId/fulfillment",
  asyncWrapper(async (req, res) => {
    const orderId = req.params.orderId ;

    const order = await prisma.order.findUnique({
      where: { order_id: orderId },
      select: { order_id: true, user_id: true, order_status: true },
    });

    if (!order) {
      throw new AppError("Order not found", 404);
    }

    // Ownership validation
    if (order.user_id !== req.userId) {
      throw new AppError("You do not have access to this order", 403);
    }

    const fulfillments = await prisma.fulfillment.findMany({
      where: { order_id: orderId },
      orderBy: { created_at: "desc" },
    });

    res.json({
      order_id: orderId,
      order_status: order.order_status,
      fulfillments,
    });
  })
);

// ═════════════════════════════════════════════════════════════
//  PART RESERVATION ROUTE
// ═════════════════════════════════════════════════════════════

// ─── POST /orders/reserve-parts ──────────────────────────────
orderRouter.post(
  "/reserve-parts",
  validate(reservePartSchema),
  asyncWrapper(async (req, res) => {
    const { inventory_id, quantity, request_id, ttl_minutes } = req.body;

    // 1. Validate inventory exists
    const inventory = await prisma.inventory.findUnique({
      where: { inventory_id },
      include: {
        part: { select: { part_name: true } },
        warehouse: { select: { name: true, is_active: true } },
      },
    });

    if (!inventory) {
      throw new AppError("Inventory record not found", 404);
    }

    if (!inventory.warehouse.is_active) {
      throw new AppError("Warehouse is inactive", 400);
    }

    // 2. If linked to a service request, validate ownership
    if (request_id) {
      const serviceRequest = await prisma.serviceRequest.findUnique({
        where: { request_id },
      });

      if (!serviceRequest) {
        throw new AppError("Service request not found", 404);
      }

      if (serviceRequest.user_id !== req.userId) {
        throw new AppError(
          "This service request does not belong to you",
          403
        );
      }
    }

    // 3. Calculate TTL expiry
    const expires_at = new Date(Date.now() + ttl_minutes * 60 * 1000);

    // 4. Transaction: check stock + create reservation + update reserved count
    //    Stock check is INSIDE the transaction to prevent race conditions
    const reservation = await prisma.$transaction(async (tx) => {
      // Re-read inventory inside transaction for accurate stock
      const freshInv = await tx.inventory.findUnique({
        where: { inventory_id },
      });

      if (!freshInv) {
        throw new AppError("Inventory record not found", 404);
      }

      const available = freshInv.quantity_available - freshInv.quantity_reserved;
      if (available < quantity) {
        throw new AppError(
          `Insufficient stock for '${inventory.part.part_name}'. Available: ${available}, Requested: ${quantity}`,
          400
        );
      }

      const newReservation = await tx.inventoryReservation.create({
        data: {
          inventory_id,
          quantity,
          request_id: request_id || null,
          expires_at,
        },
      });

      const reserved = await tx.inventory.updateMany({
        where: {
          inventory_id,
          quantity_available: { gte: quantity },
          quantity_reserved: { lte: POSTGRES_INT_MAX - quantity },
        },
        data: {
          quantity_reserved: { increment: quantity },
        },
      });

      if (reserved.count !== 1) {
        throw new AppError(
          `Insufficient stock for '${inventory.part.part_name}'. Available: ${available}, Requested: ${quantity}`,
          409
        );
      }

      const updatedInv = await tx.inventory.findUnique({
        where: { inventory_id },
        select: { quantity_available: true, quantity_reserved: true },
      });

      if (
        !updatedInv ||
        updatedInv.quantity_reserved > updatedInv.quantity_available
      ) {
        throw new AppError(
          `Insufficient stock for '${inventory.part.part_name}'. Available: ${available}, Requested: ${quantity}`,
          409
        );
      }

      return newReservation;
    });

    // TODO: Schedule a background job (e.g. BullMQ / node-cron) to
    //       expire this reservation at `expires_at` and decrement
    //       quantity_reserved if still active.

    res.status(201).json({
      message: "Inventory reserved successfully",
      reservation: {
        ...reservation,
        part_name: inventory.part.part_name,
        warehouse_name: inventory.warehouse.name,
      },
    });
  })
);
