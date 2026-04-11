import { Router } from "express";
import Stripe from "stripe";
import Razorpay from "razorpay";
import { prisma } from "../../lib/prisma.js";
import { userAuth } from "../../middleware/auth.js";
import { asyncWrapper } from "../../utils/asyncWrapper.js";
import { AppError } from "../../utils/AppError.js";
import { emitAdminDashboardRefresh, emitUserEvent, pushNotification } from "../../socket.js";
import { processJobPaymentLedger, processOrderPaymentLedger } from "./ledgerService.js";
import { ADMIN_UPI_ID, ADMIN_UPI_NAME } from "../../../config.js";

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const FRONTEND_URL = process.env.FRONTEND_URL_USER || "http://localhost:5174";

const RAZORPAY_KEY = process.env.RAZORPAY_KEY_ID || "rzp_test_dummykey";
const RAZORPAY_SECRET = process.env.RAZORPAY_SECRET || "dummy_secret_123";

const stripe = STRIPE_SECRET ? new Stripe(STRIPE_SECRET) : null;
const razorpay = new Razorpay({ key_id: RAZORPAY_KEY, key_secret: RAZORPAY_SECRET });

export const paymentRouter = Router();

const PLATFORM_FEE_AMOUNT = 99; // ₹99 platform fee
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
  const label = new Intl.DateTimeFormat("en-IN", {
    timeZone: INDIA_TIME_ZONE,
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(now);

  return {
    start,
    end,
    label,
    dayKey: `${year}${month}${day}`,
  };
}

function buildUpiPayload({ upiId, upiName, amount, reference, note }) {
  const normalizedAmount = Number(amount).toFixed(2);
  const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiName)}&am=${normalizedAmount}&tr=${encodeURIComponent(reference)}&tn=${encodeURIComponent(note)}&cu=INR`;

  return {
    upi_url: upiUrl,
    upi_id: upiId,
    upi_name: upiName,
    amount: Number(normalizedAmount),
    reference,
    note,
  };
}

// ─── GET /payments/platform-fee/qr ───────────────────────────
// Returns UPI deep-link string for the ₹99 platform fee (paid to admin)
paymentRouter.get(
  "/platform-fee/qr",
  userAuth,
  asyncWrapper(async (req, res) => {
    const txnRef = `PF-${req.userId.slice(0, 8)}-${Date.now().toString(36).toUpperCase()}`;
    const note   = "Platform Fee - Quick Auto Assist";
    res.json(
      buildUpiPayload({
        upiId: ADMIN_UPI_ID,
        upiName: ADMIN_UPI_NAME,
        amount: PLATFORM_FEE_AMOUNT,
        reference: txnRef,
        note,
      })
    );
  })
);

// ─── POST /payments/invoice/:invoiceId/checkout ──────────────
// Creates a Stripe Checkout Session for an invoice
paymentRouter.post(
  "/invoice/:invoiceId/checkout",
  userAuth,
  asyncWrapper(async (req, res) => {
    if (!stripe) throw new AppError("Payment gateway not configured", 503);

    const { invoiceId } = req.params;

    const invoice = await prisma.invoice.findUnique({
      where: { invoice_id: invoiceId },
      include: {
        items: true,
        job: {
          include: {
            request: { select: { user_id: true, issue_description: true } },
          },
        },
      },
    });

    if (!invoice || invoice.deleted_at) {
      throw new AppError("Invoice not found", 404);
    }

    if (invoice.job?.request?.user_id !== req.userId) {
      throw new AppError("Forbidden", 403);
    }

    if (invoice.payment_status === "completed") {
      throw new AppError("Invoice already paid", 400);
    }

    const lineItems = invoice.items.map((item) => ({
      price_data: {
        currency: "inr",
        product_data: {
          name: item.description,
          metadata: { item_type: item.item_type },
        },
        unit_amount: Math.round(Number(item.unit_price) * 100),
      },
      quantity: item.quantity,
    }));

    // Add tax as separate line item
    if (Number(invoice.tax) > 0) {
      lineItems.push({
        price_data: {
          currency: "inr",
          product_data: { name: "Tax (GST)" },
          unit_amount: Math.round(Number(invoice.tax) * 100),
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: lineItems,
      metadata: {
        type: "invoice",
        invoice_id: invoiceId,
        user_id: req.userId,
      },
      success_url: `${FRONTEND_URL}/invoices/${invoiceId}?payment=success`,
      cancel_url: `${FRONTEND_URL}/invoices/${invoiceId}?payment=cancelled`,
    });

    res.json({ sessionId: session.id, url: session.url });
  })
);

// ─── POST /payments/invoice/:invoiceId/qr ────────────────────
// Creates a Razorpay Payment Link (Dynamic QR) for an invoice
paymentRouter.post(
  "/invoice/:invoiceId/qr",
  userAuth,
  asyncWrapper(async (req, res) => {
    const { invoiceId } = req.params;

    const invoice = await prisma.invoice.findUnique({
      where: { invoice_id: invoiceId },
      include: {
        job: {
          include: {
            request: {
              include: {
                user: {
                  select: {
                    full_name: true,
                    email: true,
                    phone_number: true,
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

    if (invoice.payment_status === "completed") {
      throw new AppError("Invoice already paid", 400);
    }

    // Use invoice.total (the correct field name from the Invoice model)
    const totalAmountCents = Math.round(Number(invoice.total) * 100);

    if (totalAmountCents <= 0) {
      throw new AppError("Invoice amount must be greater than zero", 400);
    }

    // Create a Razorpay Payment Link payload
    const paymentLinkRequest = {
      amount: totalAmountCents,
      currency: "INR",
      accept_partial: false,
      description: `Payment for Invoice ${invoiceId}`,
      customer: {
        name: invoice.job?.request?.user?.full_name || "Guest User",
        email: invoice.job?.request?.user?.email || "guest@example.com",
        contact: (() => {
          let phone = invoice.job?.request?.user?.phone_number || "+919999999999";
          if (!phone.startsWith('+')) {
            phone = phone.length === 10 ? `+91${phone}` : `+${phone}`;
          }
          return phone;
        })(),
      },
      notify: { sms: true, email: true },
      reminder_enable: true,
      notes: {
        invoice_id: invoiceId,
        type: "invoice",
      },
    };

    const paymentLink = await razorpay.paymentLink.create(paymentLinkRequest);

    res.json({
      success: true,
      qr_link: paymentLink.short_url,
      qr_id: paymentLink.id,
    });
  })
);

// ─── POST /payments/invoice/:invoiceId/cash ──────────────────
// Manually marks an invoice as Paid via Cash (COD). Updates Ledger to Debt.
paymentRouter.post(
  "/invoice/:invoiceId/cash",
  userAuth,
  asyncWrapper(async (req, res) => {
    const { invoiceId } = req.params;

    const invoice = await prisma.invoice.findUnique({
      where: { invoice_id: invoiceId },
      include: {
        job: {
          include: {
            request: { select: { user_id: true, request_id: true } },
            technician: { select: { user_id: true } },
          },
        },
      },
    });

    if (!invoice || invoice.deleted_at) throw new AppError("Invoice not found", 404);
    if (invoice.payment_status === "completed") throw new AppError("Invoice already paid", 400);

    // Mark as completed
    await prisma.invoice.update({
      where: { invoice_id: invoiceId },
      data: {
        payment_status: "completed",
        payment_method: "cash",
        paid_at: new Date(),
      },
    });

    // Create Ledger Logic (Negative for Admin commission)
    await processJobPaymentLedger(invoiceId, "cash");

    if (invoice.job?.request?.user_id) {
      await pushNotification({
        userId: invoice.job.request.user_id,
        type: "payment_received",
        title: "Invoice paid",
        message: "Your invoice payment was marked as paid successfully.",
        data: { invoice_id: invoiceId, job_id: invoice.job_id, request_id: invoice.job.request.request_id },
      }).catch(() => {});

      emitUserEvent(invoice.job.request.user_id, "user:jobs_refresh", {
        reason: "invoice_paid",
        invoice_id: invoiceId,
        job_id: invoice.job_id,
        request_id: invoice.job.request.request_id,
      });
      emitUserEvent(invoice.job.request.user_id, "user:requests_refresh", {
        reason: "invoice_paid",
        invoice_id: invoiceId,
        job_id: invoice.job_id,
        request_id: invoice.job.request.request_id,
      });
    }

    if (invoice.job?.technician?.user_id) {
      await pushNotification({
        userId: invoice.job.technician.user_id,
        type: "payment_received",
        title: "Invoice payment received",
        message: "A customer completed payment for one of your invoices.",
        data: { invoice_id: invoiceId, job_id: invoice.job_id, request_id: invoice.job?.request?.request_id },
      }).catch(() => {});

      emitUserEvent(invoice.job.technician.user_id, "technician:jobs_refresh", {
        reason: "invoice_paid",
        invoice_id: invoiceId,
        job_id: invoice.job_id,
        request_id: invoice.job?.request?.request_id,
      });
      emitUserEvent(invoice.job.technician.user_id, "technician:dashboard_refresh", {
        reason: "invoice_paid",
        invoice_id: invoiceId,
        job_id: invoice.job_id,
        request_id: invoice.job?.request?.request_id,
      });
    }

    emitAdminDashboardRefresh({
      source: "user",
      entity: "invoice",
      action: "paid",
      invoice_id: invoiceId,
      job_id: invoice.job_id,
      request_id: invoice.job?.request?.request_id,
    });

    res.json({ success: true, message: "Marked as paid via cash. Technician ledger updated." });
  })
);

// ─── POST /payments/order/:orderId/checkout ──────────────────
// Creates a Stripe Checkout Session for an order
paymentRouter.post(
  "/order/:orderId/checkout",
  userAuth,
  asyncWrapper(async (req, res) => {
    if (!stripe) throw new AppError("Payment gateway not configured", 503);

    const { orderId } = req.params;

    const order = await prisma.order.findUnique({
      where: { order_id: orderId },
      include: {
        items: {
          include: { part: { select: { part_name: true } } },
        },
      },
    });

    if (!order) throw new AppError("Order not found", 404);

    if (order.user_id !== req.userId) {
      throw new AppError("Forbidden", 403);
    }

    if (order.payment_status === "completed") {
      throw new AppError("Order already paid", 400);
    }

    if (order.order_status === "cancelled") {
      throw new AppError("Cannot pay for a cancelled order", 400);
    }

    const lineItems = order.items.map((item) => ({
      price_data: {
        currency: "inr",
        product_data: {
          name: item.part?.part_name || `Part #${item.part_id}`,
        },
        unit_amount: Math.round(Number(item.unit_price) * 100),
      },
      quantity: item.quantity,
    }));

    if (Number(order.tax) > 0) {
      lineItems.push({
        price_data: {
          currency: "inr",
          product_data: { name: "Tax (GST)" },
          unit_amount: Math.round(Number(order.tax) * 100),
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: lineItems,
      metadata: {
        type: "order",
        order_id: orderId,
        user_id: req.userId,
      },
      success_url: `${FRONTEND_URL}/orders/${orderId}?payment=success`,
      cancel_url: `${FRONTEND_URL}/orders/${orderId}?payment=cancelled`,
    });

    res.json({ sessionId: session.id, url: session.url });
  })
);

// ─── POST /payments/tech/pay-dues ─────────────────────────────
// Returns admin UPI QR payload for the technician's daily 5% commission.
paymentRouter.post(
  "/tech/pay-dues",
  userAuth,
  asyncWrapper(async (req, res) => {
    const profile = await prisma.technicianProfile.findUnique({
      where: { user_id: req.userId },
      include: {
        user: {
          select: { full_name: true },
        },
      },
    });
    if (!profile) throw new AppError("Technician not found", 404);

    const { start, end, label, dayKey } = getIndiaDayBounds();
    const commissionPayouts = await prisma.payout.findMany({
      where: {
        recipient_id: req.userId,
        recipient_role: "technician",
        status: "pending",
        amount: { lt: 0 },
        created_at: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { created_at: "desc" },
    });

    let totalOwed = 0;
    commissionPayouts.forEach((payout) => {
       const amount = Number(payout.amount);
       if (amount < 0) {
          totalOwed += Math.abs(amount);
       }
    });

    if (totalOwed <= 0) {
      throw new AppError("Today's 5% commission is zero. Nothing to pay right now.", 400);
    }

    const reference = `TC-${req.userId.slice(0, 8)}-${dayKey}`;
    const note = `Daily technician commission ${label}`;
    const payload = buildUpiPayload({
      upiId: ADMIN_UPI_ID,
      upiName: ADMIN_UPI_NAME,
      amount: totalOwed,
      reference,
      note,
    });

    res.json({
      ...payload,
      commission_count: commissionPayouts.length,
      technician_name: profile.user?.full_name || profile.business_name || "Technician",
      reset_at: end.toISOString(),
    });
  })
);

paymentRouter.post(
  "/tech/pay-dues/confirm",
  userAuth,
  asyncWrapper(async (req, res) => {
    const profile = await prisma.technicianProfile.findUnique({
      where: { user_id: req.userId },
      include: {
        user: {
          select: { full_name: true },
        },
      },
    });

    if (!profile) {
      throw new AppError("Technician not found", 404);
    }

    const transactionId =
      typeof req.body?.transaction_id === "string" && req.body.transaction_id.trim()
        ? req.body.transaction_id.trim()
        : null;
    const { start, end } = getIndiaDayBounds();
    const commissionPayouts = await prisma.payout.findMany({
      where: {
        recipient_id: req.userId,
        recipient_role: "technician",
        status: "pending",
        amount: { lt: 0 },
        created_at: {
          gte: start,
          lte: end,
        },
      },
      select: {
        payout_id: true,
        amount: true,
      },
    });

    const totalOwed = commissionPayouts.reduce(
      (sum, payout) => sum + Math.abs(Number(payout.amount || 0)),
      0
    );

    if (commissionPayouts.length === 0 || totalOwed <= 0) {
      throw new AppError("No pending commission dues found for today.", 400);
    }

    const payoutIds = commissionPayouts.map((payout) => payout.payout_id);
    const paidAt = new Date();

    await prisma.payout.updateMany({
      where: { payout_id: { in: payoutIds } },
      data: {
        status: "completed",
        paid_at: paidAt,
        transaction_id: transactionId,
        payment_method: "upi",
        notes: transactionId
          ? `Technician marked daily commission as paid. Txn ID: ${transactionId}`
          : "Technician marked daily commission as paid via UPI",
      },
    });

    emitUserEvent(req.userId, "technician:dashboard_refresh", {
      reason: "technician_commission_paid",
      paid_amount: Number(totalOwed.toFixed(2)),
    });

    res.json({
      message: "Today's technician commission has been marked as paid.",
      settled_count: payoutIds.length,
      settled_amount: Number(totalOwed.toFixed(2)),
      paid_at: paidAt.toISOString(),
      technician_name: profile.user?.full_name || profile.business_name || "Technician",
    });
  })
);

paymentRouter.post(
  "/vendor/pay-dues",
  userAuth,
  asyncWrapper(async (req, res) => {
    const vendor = await prisma.user.findUnique({
      where: { user_id: req.userId },
      select: { full_name: true, role: true },
    });

    if (!vendor || vendor.role !== "vendor") {
      throw new AppError("Vendor not found", 404);
    }

    const { start, end, label, dayKey } = getIndiaDayBounds();
    const commissionPayouts = await prisma.payout.findMany({
      where: {
        recipient_id: req.userId,
        recipient_role: "vendor",
        status: "pending",
        amount: { lt: 0 },
        created_at: {
          gte: start,
          lte: end,
        },
      },
      orderBy: { created_at: "desc" },
    });

    const totalOwed = commissionPayouts.reduce((sum, payout) => {
      const amount = Number(payout.amount || 0);
      return amount < 0 ? sum + Math.abs(amount) : sum;
    }, 0);

    if (totalOwed <= 0) {
      throw new AppError("Today's 5% commission is zero. Nothing to pay right now.", 400);
    }

    const reference = `VC-${req.userId.slice(0, 8)}-${dayKey}`;
    const note = `Daily vendor commission ${label}`;
    const payload = buildUpiPayload({
      upiId: ADMIN_UPI_ID,
      upiName: ADMIN_UPI_NAME,
      amount: totalOwed,
      reference,
      note,
    });

    res.json({
      ...payload,
      commission_count: commissionPayouts.length,
      vendor_name: vendor.full_name || "Vendor",
      reset_at: end.toISOString(),
    });
  })
);

paymentRouter.post(
  "/vendor/pay-dues/confirm",
  userAuth,
  asyncWrapper(async (req, res) => {
    const vendor = await prisma.user.findUnique({
      where: { user_id: req.userId },
      select: { full_name: true, role: true },
    });

    if (!vendor || vendor.role !== "vendor") {
      throw new AppError("Vendor not found", 404);
    }

    const transactionId =
      typeof req.body?.transaction_id === "string" && req.body.transaction_id.trim()
        ? req.body.transaction_id.trim()
        : null;
    const { start, end } = getIndiaDayBounds();
    const commissionPayouts = await prisma.payout.findMany({
      where: {
        recipient_id: req.userId,
        recipient_role: "vendor",
        status: "pending",
        amount: { lt: 0 },
        created_at: {
          gte: start,
          lte: end,
        },
      },
      select: {
        payout_id: true,
        amount: true,
      },
    });

    const totalOwed = commissionPayouts.reduce(
      (sum, payout) => sum + Math.abs(Number(payout.amount || 0)),
      0
    );

    if (commissionPayouts.length === 0 || totalOwed <= 0) {
      throw new AppError("No pending commission dues found for today.", 400);
    }

    const payoutIds = commissionPayouts.map((payout) => payout.payout_id);
    const paidAt = new Date();

    await prisma.payout.updateMany({
      where: { payout_id: { in: payoutIds } },
      data: {
        status: "completed",
        paid_at: paidAt,
        transaction_id: transactionId,
        payment_method: "upi",
        notes: transactionId
          ? `Vendor marked daily commission as paid. Txn ID: ${transactionId}`
          : "Vendor marked daily commission as paid via UPI",
      },
    });

    emitUserEvent(req.userId, "vendor:dashboard_refresh", {
      reason: "vendor_commission_paid",
      paid_amount: Number(totalOwed.toFixed(2)),
    });

    res.json({
      message: "Today's vendor commission has been marked as paid.",
      settled_count: payoutIds.length,
      settled_amount: Number(totalOwed.toFixed(2)),
      paid_at: paidAt.toISOString(),
      vendor_name: vendor.full_name || "Vendor",
    });
  })
);

// ─── POST /payments/webhook ──────────────────────────────────
// Stripe webhook handler (no auth — Stripe signs the payload)
paymentRouter.post(
  "/webhook",
  asyncWrapper(async (req, res) => {
    if (!stripe) return res.status(200).json({ received: true });

    let event;

    if (STRIPE_WEBHOOK_SECRET) {
      const sig = req.headers["stripe-signature"];
      try {
        event = stripe.webhooks.constructEvent(
          req.body,
          sig,
          STRIPE_WEBHOOK_SECRET
        );
      } catch (err) {
        throw new AppError(`Webhook signature verification failed: ${err.message}`, 400);
      }
    } else {
      // Development fallback — trust the payload
      event = req.body;
    }

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const { type, invoice_id, order_id, user_id, technician_id } = session.metadata || {};

      if (type === "invoice" && invoice_id) {
        const updatedInvoice = await prisma.invoice.update({
          where: { invoice_id },
          data: {
            payment_status: "completed",
            payment_method: "stripe",
            transaction_id: session.payment_intent || session.id,
            gateway_response: session,
            paid_at: new Date(),
          },
          include: {
            job: {
              include: {
                request: { select: { user_id: true, request_id: true } },
                technician: { select: { user_id: true } },
              },
            },
          },
        });

        if (user_id) {
          await pushNotification({
            userId: user_id,
            type: "payment_received",
            title: "Payment Successful",
            message: "Your invoice payment has been processed successfully.",
            data: {
              invoice_id,
              job_id: updatedInvoice.job_id,
              request_id: updatedInvoice.job?.request?.request_id,
            },
          });
        }

        if (updatedInvoice.job?.technician?.user_id) {
          await pushNotification({
            userId: updatedInvoice.job.technician.user_id,
            type: "payment_received",
            title: "Invoice payment received",
            message: "A customer paid one of your invoices successfully.",
            data: {
              invoice_id,
              job_id: updatedInvoice.job_id,
              request_id: updatedInvoice.job?.request?.request_id,
            },
          });

          emitUserEvent(updatedInvoice.job.technician.user_id, "technician:jobs_refresh", {
            reason: "invoice_paid",
            invoice_id,
            job_id: updatedInvoice.job_id,
            request_id: updatedInvoice.job?.request?.request_id,
          });
          emitUserEvent(updatedInvoice.job.technician.user_id, "technician:dashboard_refresh", {
            reason: "invoice_paid",
            invoice_id,
            job_id: updatedInvoice.job_id,
            request_id: updatedInvoice.job?.request?.request_id,
          });
        }

        if (updatedInvoice.job?.request?.user_id) {
          emitUserEvent(updatedInvoice.job.request.user_id, "user:jobs_refresh", {
            reason: "invoice_paid",
            invoice_id,
            job_id: updatedInvoice.job_id,
            request_id: updatedInvoice.job.request.request_id,
          });
          emitUserEvent(updatedInvoice.job.request.user_id, "user:requests_refresh", {
            reason: "invoice_paid",
            invoice_id,
            job_id: updatedInvoice.job_id,
            request_id: updatedInvoice.job.request.request_id,
          });
        }

        emitAdminDashboardRefresh({
          source: "user",
          entity: "invoice",
          action: "paid",
          invoice_id,
          job_id: updatedInvoice.job_id,
          request_id: updatedInvoice.job?.request?.request_id,
        });

        // Payout Ledger generation (Online, 95% Tech Share)
        await processJobPaymentLedger(invoice_id, "online");
      }

      if (type === "order" && order_id) {
        const order = await prisma.order.findUnique({
          where: { order_id },
          include: {
            warehouse: { select: { vendor_id: true } },
          },
        });

        const updatedOrder = await prisma.order.update({
          where: { order_id },
          data: {
            payment_status: "completed",
            payment_method: "stripe",
            transaction_id: session.payment_intent || session.id,
            order_status: order?.order_status === "pending" ? "confirmed" : order?.order_status,
          },
          include: {
            warehouse: { select: { vendor_id: true } },
          },
        });

        if (user_id) {
          await pushNotification({
            userId: user_id,
            type: "payment_received",
            title: "Order Payment Successful",
            message: "Your order payment has been processed successfully.",
            data: { order_id },
          });
        }

        if (updatedOrder.warehouse?.vendor_id) {
          await pushNotification({
            userId: updatedOrder.warehouse.vendor_id,
            type: "payment_received",
            title: "Order payment received",
            message: "A customer completed payment for an order.",
            data: { order_id },
          });

          emitUserEvent(updatedOrder.warehouse.vendor_id, "vendor:orders_refresh", {
            reason: "order_paid",
            order_id,
          });
          emitUserEvent(updatedOrder.warehouse.vendor_id, "vendor:dashboard_refresh", {
            reason: "order_paid",
            order_id,
          });
        }

        if (updatedOrder.user_id) {
          emitUserEvent(updatedOrder.user_id, "user:orders_refresh", {
            reason: "order_paid",
            order_id,
          });
        }

        emitAdminDashboardRefresh({
          source: "user",
          entity: "order_payment",
          action: "paid",
          order_id,
        });

        // Payout Ledger generation (Online, 95% Vendor Share)
        await processOrderPaymentLedger(order_id, "online");
      }

      if (type === "pay_dues" && technician_id) {
        // Mark their negative pending payouts as completed (settled)
        await prisma.payout.updateMany({
           where: { recipient_id: technician_id, status: "pending", amount: { lt: 0 } },
           data: { status: "completed" }
        });
        // Reactivate their account
        const techProfile = await prisma.technicianProfile.findUnique({
           where: { technician_id: technician_id },
           select: { user_id: true },
        });
        if (techProfile) {
          await prisma.user.update({
             where: { user_id: techProfile.user_id },
             data: { is_active: true }
          });
        }
        
        if (user_id) {
          await pushNotification({
            userId: user_id,
            type: "system",
            title: "Dues Cleared",
            message: "Your account is active again. Thank you for paying your dues.",
          });
        }
      }
    }

    if (event.type === "checkout.session.expired" || event.type === "payment_intent.payment_failed") {
      const session = event.data.object;
      const meta = session.metadata || {};
      if (meta.user_id) {
        await pushNotification({
          userId: meta.user_id,
          type: "payment_failed",
          title: "Payment Failed",
          message: "Your payment could not be processed. Please try again.",
          data: { invoice_id: meta.invoice_id, order_id: meta.order_id },
        });
      }
    }

    res.json({ received: true });
  })
);
