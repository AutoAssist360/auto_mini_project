// backend/src/cron/settlement.js
import cron from "node-cron";
import { prisma } from "../lib/prisma.js";
import { pushNotification } from "../socket.js";

/**
 * Sweeps all pending Payouts up to midnight today,
 * aggregates them per technician, and creates a consolidated Ledger entry.
 */
async function aggregateDailyLedgers() {
    console.log("[CRON] Starting Daily Ledger Aggregation...");

    try {
        // 1. Find all technicians who have pending payouts
        const pendingPayouts = await prisma.payout.groupBy({
            by: ['recipient_id'],
            where: {
                status: "pending",
            },
            _sum: {
                amount: true
            }
        });

        for (const group of pendingPayouts) {
            const techId = group.recipient_id;
            const totalAmount = Number(group._sum.amount) || 0;

            // 2. Fetch all individual pending payouts to mark them as 'processed'
            const techPayouts = await prisma.payout.findMany({
                where: {
                    recipient_id: techId,
                    status: "pending",
                }
            });

            const payoutIds = techPayouts.map(p => p.payout_id);

            if (totalAmount < 0) {
                // Technician owes the Admin money (did mostly Cash jobs)
                const userRec = await prisma.technicianProfile.findUnique({
                    where: { technician_id: techId },
                    select: { user_id: true }
                });

                // Suspend the technician if debt exceeds ₹2000
                if (totalAmount <= -2000) {
                     if (userRec) {
                       await prisma.user.update({
                           where: { user_id: userRec.user_id },
                           data: { is_active: false }
                       });
                     }
                     if (userRec) {
                         await pushNotification({
                             userId: userRec.user_id,
                             type: "system",
                             title: "Account Suspended",
                             message: `Your account is temporarily inactive. You owe the admin ₹${Math.abs(totalAmount)}. Please clear your dues immediately.`,
                         });
                     }
                } else if (userRec) {
                     // Just a friendly warning
                     await pushNotification({
                        userId: userRec.user_id,
                        type: "system",
                        title: "Outstanding Commission Dues",
                        message: `Your daily ledger has a negative balance of ₹${Math.abs(totalAmount)}. Please pay the admin soon.`,
                    });
                }
                
                // Keep negative records pending so they still owe the debt.
                // Or you can create a single aggregate minus record. We'll leave them pending.
            } else {
                 // Positive balance. The Admin owes the Technician this money.
                 // Mark these as "completed" (or a custom "settled" status) so they aren't processed tomorrow.
                 // In our schema, status takes a String, default pending.
                 await prisma.payout.updateMany({
                    where: { payout_id: { in: payoutIds } },
                    data: { status: "completed" } // This means the day's earnings are locked. Admin needs to pay them.
                 });
            }

            console.log(`[CRON] Aggregated ledger for Tech ${techId}: ₹${totalAmount}`);
        }

        console.log("[CRON] Daily Ledger Aggregation Completed.");
    } catch (err) {
        console.error("[CRON] Error during ledger aggregation:", err);
    }
}

// Schedule to run at 23:59 every day
cron.schedule("59 23 * * *", aggregateDailyLedgers);

export { aggregateDailyLedgers };
