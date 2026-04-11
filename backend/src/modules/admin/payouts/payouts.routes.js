import { Router } from "express";
import { prisma } from "../../../lib/prisma.js";
import { userAuth } from "../../../middleware/auth.js";
import { roleGuard } from "../../../middleware/roleGuard.js";
import { asyncWrapper } from "../../../utils/asyncWrapper.js";
import { AppError } from "../../../utils/AppError.js";

export const adminPayoutsRouter = Router();
adminPayoutsRouter.use(userAuth, roleGuard("admin"));

// ─── GET /admin/payouts/summary ──────────────────────────────
// Returns aggregated auto-transferred payout totals for the month.
adminPayoutsRouter.get(
  "/summary",
  asyncWrapper(async (req, res) => {
    const { month, year } = req.query;

    const now = new Date();
    const where = {
      month: month ? Number(month) : now.getMonth() + 1,
      year: year ? Number(year) : now.getFullYear(),
    };

    const [techPayouts, vendorPayouts, total] = await Promise.all([
      prisma.payout.aggregate({
        where: { ...where, recipient_role: "technician" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payout.aggregate({
        where: { ...where, recipient_role: "vendor" },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.payout.aggregate({
        where,
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    res.json({
      technician_count: techPayouts._count,
      technician_total: Number(techPayouts._sum.amount || 0),
      vendor_count: vendorPayouts._count,
      vendor_total: Number(vendorPayouts._sum.amount || 0),
      total_count: total._count,
      total_amount: Number(total._sum.amount || 0),
    });
  })
);

// ─── GET /admin/payouts/history ──────────────────────────────
// Returns all auto-transferred payouts with optional filters.
adminPayoutsRouter.get(
  "/history",
  asyncWrapper(async (req, res) => {
    const { month, year, recipient_role, page = 1, limit = 50 } = req.query;

    const now = new Date();
    const where = {
      month: month ? Number(month) : now.getMonth() + 1,
      year: year ? Number(year) : now.getFullYear(),
    };
    if (recipient_role) where.recipient_role = recipient_role;

    const skip = (Number(page) - 1) * Number(limit);

    const [payouts, total] = await Promise.all([
      prisma.payout.findMany({
        where,
        include: {
          recipient: {
            select: {
              user_id: true,
              full_name: true,
              email: true,
              upi_id: true,
              bank_account_number: true,
              bank_ifsc: true,
              bank_holder_name: true,
            },
          },
        },
        orderBy: { paid_at: "desc" },
        skip,
        take: Number(limit),
      }),
      prisma.payout.count({ where }),
    ]);

    res.json({ payouts, total, page: Number(page), limit: Number(limit) });
  })
);

// ─── POST /admin/payouts/:payoutId/mark-paid ─────────────────
// Manually mark a positive payout as 'paid' via NEFT/GPay.
adminPayoutsRouter.post(
  "/:payoutId/mark-paid",
  asyncWrapper(async (req, res) => {
    const { payoutId } = req.params;
    const { transaction_id } = req.body; // Manual UTR

    const payout = await prisma.payout.findUnique({
      where: { payout_id: payoutId },
      include: { recipient: true }
    });

    if (!payout) throw new AppError("Payout not found", 404);
    if (payout.status !== "completed") {
      // 'completed' means the day is over and locked. This means it is ready to be paid.
      // Wait, in our cron job, we marked positive payouts as 'completed' at the end of day.
    }

    const updated = await prisma.payout.update({
      where: { payout_id: payoutId },
      data: {
        paid_at: new Date(),
        transaction_id,
        performed_by: req.userId,
        status: "settled", // Custom status or keep as completed? Let's keep as completed but set paid_at. Oh wait, 'paid_at' becoming non-null means it's paid. 'settled' would be clearer.
      },
    });

    // Notify the user
    if (payout.recipient?.user_id) {
       await import("../../../socket.js").then(module => {
           module.pushNotification({
              userId: payout.recipient.user_id,
              type: "system",
              title: "Payment Received",
              message: `The admin has transferred ₹${Number(payout.amount)} to your bank account. (Txn ID: ${transaction_id || 'N/A'})`,
           });
       });
    }

    res.json({ message: "Payout marked as paid successfully.", payout: updated });
  })
);
