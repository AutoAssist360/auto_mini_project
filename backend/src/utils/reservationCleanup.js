import { prisma } from "../lib/prisma.js";

/**
 * Expire stale inventory reservations that have passed their `expires_at`.
 * Releases the reserved quantity back to available inventory.
 *
 * Runs every 5 minutes via setInterval.
 */
async function cleanupExpiredReservations() {
  try {
    const now = new Date();

    // Find all active reservations past their expiry
    const expired = await prisma.inventoryReservation.findMany({
      where: {
        status: "active",
        order_id: null,
        expires_at: { lt: now },
      },
    });

    if (expired.length === 0) return;

    // Process each in a transaction to avoid race conditions
    await prisma.$transaction(async (tx) => {
      for (const r of expired) {
        // Release reserved quantity back to available
        await tx.inventory.update({
          where: { inventory_id: r.inventory_id },
          data: {
            quantity_reserved: { decrement: r.quantity },
          },
        });

        // Mark reservation as expired
        await tx.inventoryReservation.update({
          where: { reservation_id: r.reservation_id },
          data: { status: "expired" },
        });
      }
    });

    console.log(`[ReservationCleanup] Expired ${expired.length} reservation(s)`);
  } catch (err) {
    console.error("[ReservationCleanup] Error:", err.message);
  }
}

const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Start the periodic reservation cleanup.
 * Call once at server boot.
 */
export function startReservationCleanup() {
  // Run once immediately
  cleanupExpiredReservations();
  // Then every 5 minutes
  const timer = setInterval(cleanupExpiredReservations, INTERVAL_MS);
  // Allow process to exit cleanly
  timer.unref();
  console.log("[ReservationCleanup] Scheduled every 5 minutes");
}
