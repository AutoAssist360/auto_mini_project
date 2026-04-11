import { Router } from "express";
import { prisma } from "../../../lib/prisma.js";
import { asyncWrapper } from "../../../utils/asyncWrapper.js";
import { AppError } from "../../../utils/AppError.js";
import { userAuth } from "../../../middleware/auth.js";
import { roleGuard } from "../../../middleware/roleGuard.js";
import { validate } from "../../../middleware/validate.js";
import { listOrdersQuery, refundOrderSchema } from "../admin.schemas.js";
import { logAudit, dateFilter, paginate } from "../admin.helpers.js";

export const adminOrdersRouter = Router();

adminOrdersRouter.use(userAuth, roleGuard("admin"));

// ─── GET /admin/orders ───────────────────────────────────────
adminOrdersRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const q = listOrdersQuery.parse(req.query);
    const { skip, take } = paginate(q.page, q.limit);

    const where = {};
    if (q.order_status) where.order_status = q.order_status;
    if (q.payment_status) where.payment_status = q.payment_status;
    if (q.from || q.to) where.created_at = dateFilter(q.from, q.to);

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        skip,
        take,
        include: {
          user: { select: { user_id: true, full_name: true, email: true } },
          warehouse: { select: { warehouse_id: true, name: true, city: true } },
          _count: { select: { items: true, fulfillments: true } },
        },
        orderBy: { created_at: "desc" },
      }),
      prisma.order.count({ where }),
    ]);

    res.json({
      orders,
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit),
      },
    });
  })
);

// ─── GET /admin/orders/:orderId ──────────────────────────────
adminOrdersRouter.get(
  "/:orderId",
  asyncWrapper(async (req, res) => {
    const orderId = req.params.orderId ;

    const order = await prisma.order.findUnique({
      where: { order_id: orderId },
      include: {
        user: { select: { user_id: true, full_name: true, email: true } },
        warehouse: {
          include: {
            vendor: { select: { user_id: true, full_name: true } },
          },
        },
        items: { include: { part: { select: { part_id: true, part_name: true } } } },
        fulfillments: { orderBy: { created_at: "desc" } },
        reservations: true,
      },
    });

    if (!order) throw new AppError("Order not found", 404);

    res.json({ order });
  })
);

// ─── PATCH /admin/orders/:orderId/mark-paid ──────────────────
adminOrdersRouter.patch(
  "/:orderId/mark-paid",
  asyncWrapper(async (req, res) => {
    const orderId = req.params.orderId;

    const order = await prisma.order.findUnique({
      where: { order_id: orderId },
    });

    if (!order) throw new AppError("Order not found", 404);
    if (order.payment_status === "completed")
      throw new AppError("Order is already paid", 400);
    if (order.payment_status === "refunded")
      throw new AppError("Cannot mark a refunded order as paid", 400);

    const nextOrderStatus =
      order.order_status === "pending" ? "confirmed" : order.order_status;

    const updated = await prisma.order.update({
      where: { order_id: orderId },
      data: {
        payment_status: "completed",
        payment_method: "admin_override",
        order_status: nextOrderStatus,
      },
    });

    await logAudit({
      entityType: "Order",
      entityId: orderId,
      action: "MARK_ORDER_PAID",
      performedBy: req.userId,
      oldValue: { payment_status: order.payment_status },
      newValue: { payment_status: "completed", payment_method: "admin_override" },
    });

    res.json({ message: "Order marked as paid", order: updated });
  })
);

// ─── POST /admin/orders/:orderId/refund ──────────────────────
adminOrdersRouter.post(
  "/:orderId/refund",
  validate(refundOrderSchema),
  asyncWrapper(async (req, res) => {
    const orderId = req.params.orderId ;
    const { reason } = req.body;

    // Use a transaction to avoid TOCTOU race conditions
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { order_id: orderId },
        include: { items: true, reservations: { where: { status: "active" } } },
      });

      if (!order) throw new AppError("Order not found", 404);
      if (order.payment_status === "refunded")
        throw new AppError("Order is already refunded", 400);
      if (order.payment_status !== "completed")
        throw new AppError("Only paid orders can be refunded", 400);

      // Mark order as refunded and cancelled
      await tx.order.update({
        where: { order_id: orderId },
        data: {
          payment_status: "refunded",
          order_status: "cancelled",
          notes: `REFUND: ${reason}`,
        },
      });

      // Release active reservations and restore inventory
      for (const reservation of order.reservations) {
        await tx.inventoryReservation.update({
          where: { reservation_id: reservation.reservation_id },
          data: { status: "cancelled" },
        });

        // Guard against negative quantity_reserved
        const inv = await tx.inventory.findUnique({
          where: { inventory_id: reservation.inventory_id },
        });
        if (inv) {
          const safeDecrement = Math.min(reservation.quantity, inv.quantity_reserved);
          await tx.inventory.update({
            where: { inventory_id: reservation.inventory_id },
            data: {
              quantity_reserved: { decrement: safeDecrement },
            },
          });
        }
      }

      const oldValues = { payment_status: order.payment_status, order_status: order.order_status };

      await logAudit({
        entityType: "Order",
        entityId: orderId,
        action: "REFUND_ORDER",
        performedBy: req.userId,
        oldValue: oldValues,
        newValue: { payment_status: "refunded", order_status: "cancelled", reason },
        tx,
      });
    });

    res.json({ message: "Order refunded" });
  })
);
