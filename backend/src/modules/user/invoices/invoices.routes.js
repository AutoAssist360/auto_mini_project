import { Router } from "express";
import { prisma } from "../../../lib/prisma.js";
import { userAuth } from "../../../middleware/auth.js";
import { roleGuard } from "../../../middleware/roleGuard.js";
import { asyncWrapper } from "../../../utils/asyncWrapper.js";
import { AppError } from "../../../utils/AppError.js";
import { validate } from "../../../middleware/validate.js";
import { payInvoiceSchema } from "./invoices.schemas.js";
import { ADMIN_UPI_ID, ADMIN_UPI_NAME } from "../../../../config.js";

export const invoiceRouter = Router();

invoiceRouter.use(userAuth, roleGuard("user", "admin"));

// ─── GET /invoices ───────────────────────────────────────────
// List all invoices for the authenticated user
invoiceRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const skip = (page - 1) * limit;
    const paymentStatus = req.query.payment_status || undefined;

    const where = {
      deleted_at: null,
      job: {
        request: {
          user_id: req.userId,
        },
      },
    };

    if (paymentStatus) {
      where.payment_status = paymentStatus;
    }

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: { issued_at: "desc" },
        include: {
          items: true,
          job: {
            include: {
              request: {
                select: {
                  request_id: true,
                  issue_description: true,
                  issue_type: true,
                },
              },
              technician: {
                include: {
                  user: { select: { full_name: true } },
                },
              },
            },
          },
        },
      }),
      prisma.invoice.count({ where }),
    ]);

    res.json({ invoices, total, page, limit });
  })
);

// ─── GET /invoices/:invoiceId ────────────────────────────────
invoiceRouter.get(
  "/:invoiceId",
  asyncWrapper(async (req, res) => {
    const invoiceId = req.params.invoiceId ;

    const invoice = await prisma.invoice.findUnique({
      where: { invoice_id: invoiceId },
      include: {
        items: true,
        job: {
          include: {
            request: {
              select: {
                request_id: true,
                user_id: true,
                issue_description: true,
                issue_type: true,
              },
            },
            technician: {
              include: {
                user: { select: { full_name: true } },
              },
            },
          },
        },
      },
    });

    if (!invoice || invoice.deleted_at) {
      throw new AppError("Invoice not found", 404);
    }

    // Ownership validation via job → request → user_id
    const ownerUserId = invoice?.job?.request?.user_id;
    if (!ownerUserId || ownerUserId !== req.userId) {
      throw new AppError("You do not have access to this invoice", 403);
    }

    res.json({ invoice });
  })
);

// ─── POST /invoices/:invoiceId/pay ───────────────────────────
// NOTE: This endpoint is for SERVICE invoices only (linked to a Job).
// Order payments use POST /orders/:orderId/pay instead.
invoiceRouter.post(
  "/:invoiceId/pay",
  validate(payInvoiceSchema),
  asyncWrapper(async (req, res) => {
    const invoiceId = req.params.invoiceId ;
    const { payment_method, transaction_id } = req.body;

    const invoice = await prisma.invoice.findUnique({
      where: { invoice_id: invoiceId },
      include: {
        job: {
          include: {
            request: { select: { user_id: true } },
            technician: { select: { user_id: true } },
          },
        },
      },
    });

    if (!invoice || invoice.deleted_at) {
      throw new AppError("Invoice not found", 404);
    }

    // Ownership validation
    const payOwnerUserId = invoice?.job?.request?.user_id;
    if (!payOwnerUserId || payOwnerUserId !== req.userId) {
      throw new AppError("You do not have access to this invoice", 403);
    }

    if (invoice.payment_status === "completed") {
      throw new AppError("Invoice has already been paid", 400);
    }

    if (invoice.payment_status === "refunded") {
      throw new AppError("Cannot pay a refunded invoice", 400);
    }

    // Check duplicate transaction_id
    if (transaction_id) {
      const existingTx = await prisma.invoice.findFirst({
        where: { transaction_id },
      });
      if (existingTx) {
        throw new AppError("Transaction ID already used", 409);
      }
    }

    const updatedInvoice = await prisma.invoice.update({
      where: { invoice_id: invoiceId },
      data: {
        payment_status: "completed",
        payment_method,
        transaction_id,
        paid_at: new Date(),
      },
      include: { items: true },
    });

    // ── Auto-transfer payout to the technician ──
    const techUserId = invoice.job?.technician?.user_id;
    if (techUserId) {
      const now = new Date();
      await prisma.payout.create({
        data: {
          recipient_id: techUserId,
          recipient_role: "technician",
          amount: Number(invoice.total),
          month: now.getMonth() + 1,
          year: now.getFullYear(),
          status: "completed",
          source_type: "invoice",
          source_id: invoiceId,
          payment_method: payment_method || "upi",
          transaction_id: transaction_id || null,
          paid_at: now,
          notes: "Auto-transferred from user payment",
        },
      }).catch(() => {}); // non-blocking — don't fail the payment
    }

    res.json({
      message: "Payment successful",
      invoice: updatedInvoice,
    });
  })
);

// ─── GET /invoices/:invoiceId/qr-data ────────────────────────
// Returns UPI deep-link string for dynamic QR code generation
invoiceRouter.get(
  "/:invoiceId/qr-data",
  asyncWrapper(async (req, res) => {
    const invoiceId = req.params.invoiceId;

    const invoice = await prisma.invoice.findUnique({
      where: { invoice_id: invoiceId },
      include: {
        job: {
          include: {
            request: { select: { user_id: true } },
            technician: {
              include: {
                user: {
                  select: {
                    upi_id: true,
                    full_name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!invoice || invoice.deleted_at) {
      throw new AppError("Invoice not found", 404);
    }

    const ownerUserId = invoice?.job?.request?.user_id;
    if (!ownerUserId || ownerUserId !== req.userId) {
      throw new AppError("You do not have access to this invoice", 403);
    }

    if (invoice.payment_status === "completed") {
      throw new AppError("Invoice has already been paid", 400);
    }

    // Use technician's UPI ID if set, otherwise fall back to admin UPI
    const techUpiId = invoice.job?.technician?.user?.upi_id;
    const techName = invoice.job?.technician?.user?.full_name;
    const payeeUpiId = techUpiId || ADMIN_UPI_ID;
    const payeeName = techName || ADMIN_UPI_NAME;

    const amount = Number(invoice.total).toFixed(2);
    const txnRef = invoice.invoice_id.slice(0, 20);
    const note = `Invoice ${invoice.invoice_id.slice(0, 8)}`;

    const upiUrl = `upi://pay?pa=${encodeURIComponent(payeeUpiId)}&pn=${encodeURIComponent(payeeName)}&am=${amount}&tr=${encodeURIComponent(txnRef)}&tn=${encodeURIComponent(note)}&cu=INR`;

    res.json({
      upi_url: upiUrl,
      upi_id: payeeUpiId,
      upi_name: payeeName,
      admin_upi_id: payeeUpiId,
      amount,
      reference: txnRef,
      note,
    });
  })
);
