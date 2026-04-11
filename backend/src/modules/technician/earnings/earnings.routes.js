import { Router } from "express";
import { prisma } from "../../../lib/prisma.js";
import { asyncWrapper } from "../../../utils/asyncWrapper.js";
import { AppError } from "../../../utils/AppError.js";
import { userAuth } from "../../../middleware/auth.js";
import { roleGuard } from "../../../middleware/roleGuard.js";

export const techEarningsRouter = Router();
const INDIA_TIME_ZONE = "Asia/Kolkata";

function getIndiaDayBounds(now = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: INDIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [{ value: year }, , { value: month }, , { value: day }] = formatter.formatToParts(now);
  const start = new Date(`${year}-${month}-${day}T00:00:00+05:30`);
  const end = new Date(`${year}-${month}-${day}T23:59:59.999+05:30`);

  return { start, end };
}

techEarningsRouter.use(userAuth, roleGuard("technician"));

// ─── GET /tech/earnings ─────────────────────────────────────────
techEarningsRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const profile = await prisma.technicianProfile.findUnique({
      where: { user_id: req.userId },
    });
    if (!profile) throw new AppError("Technician profile not found", 404);

    // 1. All completed jobs with paid invoices for the UI list
    const completedJobs = await prisma.job.findMany({
      where: {
        technician_id: profile.technician_id,
        status: { in: ["completed", "verified"] },
        deleted_at: null,
        invoice: { isNot: null },
      },
      include: {
        invoice: {
          select: {
            invoice_id: true,
            subtotal: true,
            tax: true,
            total: true,
            payment_status: true,
            payment_method: true,
            paid_at: true,
            issued_at: true,
          },
        },
        request: {
          select: {
            request_id: true,
            issue_type: true,
            issue_description: true,
          },
        },
      },
      orderBy: { completed_at: "desc" },
    });

    // 2. Fetch actual Virtual Ledger from Payouts
    const allPayouts = await prisma.payout.findMany({
      where: {
        recipient_id: req.userId,
        recipient_role: "technician",
      },
      orderBy: { created_at: "desc" },
    });
    const { start, end } = getIndiaDayBounds();
    const todayCommissionByInvoiceId = new Map();

    const summary = {
      total_jobs: completedJobs.length,
      total_earned: 0,
      net_pending: 0, // Admin owes tech (if > 0) or Tech owes Admin (if < 0)
      owed_to_admin: 0, // Only the negative amount
      pending_credits: 0,
      today_commission_due: 0,
      today_commission_jobs: 0,
      today_reset_at: end.toISOString(),
      paid_count: completedJobs.filter(j => j.invoice?.payment_status === "completed").length,
      pending_count: completedJobs.filter(j => j.invoice?.payment_status === "pending").length,
    };

    allPayouts.forEach(p => {
      const amt = Number(p.amount);
      if (p.status === "completed") {
        if (amt > 0) summary.total_earned += amt;
      } else if (p.status === "pending") {
        summary.net_pending += amt;
        if (amt > 0) summary.pending_credits += amt;
        if (amt < 0) {
          summary.owed_to_admin += Math.abs(amt);
          if (p.created_at >= start && p.created_at <= end) {
            const commissionAmount = Math.abs(amt);
            summary.today_commission_due += commissionAmount;
            summary.today_commission_jobs += 1;
            if (p.source_id) {
              todayCommissionByInvoiceId.set(p.source_id, commissionAmount);
            }
          }
        }
      }
    });

    const jobs = completedJobs.map((job) => {
      const commissionAmount = todayCommissionByInvoiceId.get(job.invoice?.invoice_id) ?? 0;
      return {
        ...job,
        commission_amount: Number(commissionAmount.toFixed(2)),
        commission_due_today: commissionAmount > 0,
      };
    });

    res.json({
      summary: {
        ...summary,
        total_earned: Number(summary.total_earned.toFixed(2)),
        net_pending: Number(summary.net_pending.toFixed(2)),
        owed_to_admin: Number(summary.owed_to_admin.toFixed(2)),
        pending_credits: Number(summary.pending_credits.toFixed(2)),
        today_commission_due: Number(summary.today_commission_due.toFixed(2)),
      },
      jobs,
    });
  })
);
