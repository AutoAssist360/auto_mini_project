import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";
import { isCashOnDeliveryOrder } from "../../utils/orderLifecycle.js";

/**
 * Verify a warehouse belongs to the requesting vendor.
 * Returns the warehouse if found; throws 404 otherwise.
 */
export async function ownerWarehouse(warehouseId, vendorId) {
  const warehouse = await prisma.warehouse.findUnique({
    where: { warehouse_id: warehouseId },
  });

  if (!warehouse) throw new AppError("Warehouse not found", 404);
  if (warehouse.vendor_id !== vendorId)
    throw new AppError("Warehouse not found", 404);
  if (!warehouse.is_active)
    throw new AppError("Warehouse is inactive", 400);

  return warehouse;
}

/**
 * Build a Prisma-compatible date range filter.
 */
export function dateFilter(from, to) {
  if (!from && !to) return undefined;
  const filter = {};
  if (from) filter.gte = new Date(from);
  if (to) {
    let dt = new Date(to);
    if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
      dt.setHours(23, 59, 59, 999);
    }
    filter.lte = dt;
  }
  return filter;
}

/**
 * Calculate skip/take from page + limit.
 */
export function paginate(page, limit) {
  return { skip: (page - 1) * limit, take: limit };
}

// ─── Order status transition map ─────────────────────────────

const ORDER_TRANSITIONS = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["delivered"],
  delivered: ["returned"],
  returned: [],
  cancelled: [],
};

export function assertOrderTransition(current, next) {
  const allowed = ORDER_TRANSITIONS[current];
  if (!allowed || !allowed.includes(next)) {
    throw new AppError(
      `Cannot transition order from '${current}' to '${next}'`,
      400
    );
  }
}

export function assertOrderIsPaid(order) {
  if (order.payment_status === "completed") {
    return;
  }

  if (isCashOnDeliveryOrder(order) && order.payment_status !== "refunded") {
    return;
  }

  throw new AppError(
    "Order payment is still pending. Confirm payment first or use cash on delivery.",
    400
  );
}

export async function releaseOrderReservations(tx, orderId) {
  const reservations = await tx.inventoryReservation.findMany({
    where: { order_id: orderId, status: "active" },
  });

  for (const reservation of reservations) {
    await tx.inventory.update({
      where: { inventory_id: reservation.inventory_id },
      data: {
        quantity_reserved: { decrement: reservation.quantity },
      },
    });

    await tx.inventoryReservation.update({
      where: { reservation_id: reservation.reservation_id },
      data: { status: "cancelled" },
    });
  }

  return reservations.length;
}

export async function commitOrderReservations(tx, order) {
  if (order.stock_committed_at) {
    return false;
  }

  const reservations = await tx.inventoryReservation.findMany({
    where: { order_id: order.order_id, status: "active" },
  });

  if (reservations.length > 0) {
    for (const reservation of reservations) {
      await tx.inventory.update({
        where: { inventory_id: reservation.inventory_id },
        data: {
          quantity_available: { decrement: reservation.quantity },
          quantity_reserved: { decrement: reservation.quantity },
        },
      });

      await tx.inventoryReservation.update({
        where: { reservation_id: reservation.reservation_id },
        data: { status: "converted" },
      });
    }
  } else {
    const orderItems = await tx.orderItem.findMany({
      where: { order_id: order.order_id },
    });

    for (const item of orderItems) {
      await tx.inventory.updateMany({
        where: {
          warehouse_id: order.warehouse_id,
          part_id: item.part_id,
          quantity_available: { gte: item.quantity },
        },
        data: {
          quantity_available: { decrement: item.quantity },
        },
      });
    }
  }

  await tx.order.update({
    where: { order_id: order.order_id },
    data: { stock_committed_at: new Date() },
  });

  return true;
}

// ─── Fulfillment status transition map ───────────────────────

const FULFILLMENT_TRANSITIONS = {
  pending: ["processing", "failed"],
  processing: ["shipped", "failed"],
  shipped: ["in_transit", "delivered", "failed"],
  in_transit: ["delivered", "failed"],
  delivered: [],
  failed: [],
};

export function assertFulfillmentTransition(current, next) {
  const allowed = FULFILLMENT_TRANSITIONS[current];
  if (!allowed || !allowed.includes(next)) {
    throw new AppError(
      `Cannot transition fulfillment from '${current}' to '${next}'`,
      400
    );
  }
}
