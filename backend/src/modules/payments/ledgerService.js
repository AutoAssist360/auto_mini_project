// backend/src/modules/payments/ledgerService.js
import { prisma } from "../../lib/prisma.js";
import { AppError } from "../../utils/AppError.js";

const ADMIN_COMMISSION_PERCENTAGE = 5;

/**
 * Calculates and creates the appropriate Payout/Ledger record 
 * after a successful job payment (Online via Razorpay or Offline via COD).
 * 
 * @param {string} invoiceId 
 * @param {string} paymentMethod - 'online' | 'cash'
 */
export async function processJobPaymentLedger(invoiceId, paymentMethod) {
    const invoice = await prisma.invoice.findUnique({
        where: { invoice_id: invoiceId },
        include: {
            job: {
                include: {
                    technician: true
                }
            }
        }
    });

    if (!invoice) throw new AppError("Invoice not found for ledger processing", 404);
    if (!invoice.job || !invoice.job.technician_id) {
        // If it's an order without a technician (e.g., parts order from inventory), skip technician ledger.
        return null;
    }

    const techId = invoice.job.technician.user_id;
    const totalAmount = Number(invoice.total); // 'total' is the correct Prisma field name

    // Calculate splits
    const adminCommission = (totalAmount * ADMIN_COMMISSION_PERCENTAGE) / 100;
    const technicianShare = totalAmount - adminCommission;

    if (paymentMethod === "online") {
        // Online Payment: User paid Admin 100%. Admin owes Technician 95%.
        // Create a positive payout for the technician.
        return await prisma.payout.create({
            data: {
                recipient_id: techId,
                recipient_role: "technician",
                amount: technicianShare,
                status: "pending",
                month: new Date().getMonth() + 1,
                year: new Date().getFullYear(),
                source_type: "invoice",
                source_id: invoiceId,
            }
        });

    } else if (paymentMethod === "cash") {
        // Cash Payment: User paid Technician 100%. Technician owes Admin 5%.
        // We record this as a NEGATIVE payout to signify debt.
        return await prisma.payout.create({
            data: {
                recipient_id: techId,
                recipient_role: "technician",
                amount: -adminCommission, // Negative amount
                status: "pending",
                month: new Date().getMonth() + 1,
                year: new Date().getFullYear(),
                source_type: "invoice",
                source_id: invoiceId,
            }
        });
    }

    return null;
}

/**
 * Calculates and creates the appropriate Payout/Ledger record 
 * after a successful order payment (Parts sale from a Vendor).
 * 
 * @param {string} orderId 
 * @param {string} paymentMethod - 'online' | 'cash'
 */
export async function processOrderPaymentLedger(orderId, paymentMethod) {
    const order = await prisma.order.findUnique({
        where: { order_id: orderId },
        include: {
            warehouse: true
        }
    });

    if (!order) throw new AppError("Order not found for ledger processing", 404);
    if (!order.warehouse || !order.warehouse.vendor_id) return null;

    const vendorId = order.warehouse.vendor_id;
    const totalAmount = Number(order.total);

    // Calculate splits
    const adminCommission = (totalAmount * ADMIN_COMMISSION_PERCENTAGE) / 100;
    const vendorShare = totalAmount - adminCommission;

    if (paymentMethod === "online" || paymentMethod === "stripe") {
        // Online Payment: User paid Admin 100%. Admin owes Vendor 95%.
        // Create a positive payout for the vendor.
        return await prisma.payout.create({
            data: {
                recipient_id: vendorId,
                recipient_role: "vendor",
                amount: vendorShare,
                status: "pending",
                month: new Date().getMonth() + 1,
                year: new Date().getFullYear(),
                source_type: "order",
                source_id: orderId,
            }
        });
    } else if (paymentMethod === "cash") {
        // Cash Payment: User paid Vendor 100%. Vendor owes Admin 5%.
        return await prisma.payout.create({
            data: {
                recipient_id: vendorId,
                recipient_role: "vendor",
                amount: -adminCommission, // Negative amount
                status: "pending",
                month: new Date().getMonth() + 1,
                year: new Date().getFullYear(),
                source_type: "order",
                source_id: orderId,
            }
        });
    }

    return null;
}
