import { AppError } from "./AppError.js";

export const RETURN_WINDOW_DAYS = 7;
const RETURN_WINDOW_MS = RETURN_WINDOW_DAYS * 24 * 60 * 60 * 1000;
const COD_PAYMENT_METHODS = new Set(["cash_on_delivery", "cod"]);

export function normalizeOrderPaymentMethod(paymentMethod) {
  if (!paymentMethod || typeof paymentMethod !== "string") {
    return null;
  }

  const normalized = paymentMethod.trim().toLowerCase();

  if (!normalized) {
    return null;
  }

  if (COD_PAYMENT_METHODS.has(normalized)) {
    return "cash_on_delivery";
  }

  return normalized;
}

export function isCashOnDeliveryOrder(order) {
  return normalizeOrderPaymentMethod(order?.payment_method) === "cash_on_delivery";
}

export function getOrderDeliveredAt(order) {
  const deliveredAtCandidates = Array.isArray(order?.fulfillments)
    ? order.fulfillments
        .map((fulfillment) => fulfillment?.delivered_at)
        .filter(Boolean)
        .map((value) => new Date(value))
    : [];

  if (deliveredAtCandidates.length > 0) {
    return deliveredAtCandidates.sort((a, b) => b.getTime() - a.getTime())[0];
  }

  if (order?.order_status === "delivered" && order?.updated_at) {
    return new Date(order.updated_at);
  }

  return null;
}

export function getReturnDeadline(deliveredAt) {
  if (!deliveredAt) {
    return null;
  }

  return new Date(deliveredAt.getTime() + RETURN_WINDOW_MS);
}

export function getOrderReturnWindowMeta(order) {
  const deliveredAt = getOrderDeliveredAt(order);
  const deadlineAt = getReturnDeadline(deliveredAt);
  const now = Date.now();
  const isEligible = Boolean(
    order?.order_status === "delivered" &&
      deliveredAt &&
      deadlineAt &&
      now <= deadlineAt.getTime()
  );

  const remainingMs = deadlineAt ? Math.max(0, deadlineAt.getTime() - now) : 0;
  const remainingDays = deadlineAt
    ? Math.ceil(remainingMs / (24 * 60 * 60 * 1000))
    : 0;

  return {
    delivered_at: deliveredAt?.toISOString() || null,
    return_deadline_at: deadlineAt?.toISOString() || null,
    is_return_eligible: isEligible,
    return_window_days_remaining: isEligible ? remainingDays : 0,
  };
}

export function assertReturnWindow(order) {
  const deliveredAt = getOrderDeliveredAt(order);

  if (!deliveredAt) {
    throw new AppError("Return eligibility could not be determined for this order", 400);
  }

  const deadlineAt = getReturnDeadline(deliveredAt);
  if (!deadlineAt || Date.now() > deadlineAt.getTime()) {
    throw new AppError(
      `Orders can only be returned within ${RETURN_WINDOW_DAYS} days of delivery`,
      400
    );
  }

  return { deliveredAt, deadlineAt };
}

export function getReturnPaymentUpdate(order) {
  if (order?.payment_status === "completed") {
    return { payment_status: "refunded" };
  }

  return {};
}
