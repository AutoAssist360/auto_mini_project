// backend/testLedger.js
import "dotenv/config";
import { prisma } from "./src/lib/prisma.js";
import { processJobPaymentLedger } from "./src/modules/payments/ledgerService.js";
import { aggregateDailyLedgers } from "./src/cron/settlement.js";

async function runTest() {
    console.log("--- STARTING LEDGER TESTS ---");

    // 1. Create a dummy User, Technician, Request, Job, and Invoice
    const user = await prisma.user.create({
        data: {
            email: `test_user_${Date.now()}@example.com`,
            password: "hashed",
            role: "user",
            full_name: "Test User",
            phone_number: `888${Math.floor(Math.random() * 10000000)}`,
            is_active: true
        }
    });

    const tech = await prisma.user.create({
        data: {
            email: `test_tech_${Date.now()}@example.com`,
            password: "hashed",
            role: "technician",
            full_name: "Test Technician",
            phone_number: `888${Math.floor(Math.random() * 10000000)}`,
            is_active: true
        }
    });

    const techProfile = await prisma.technicianProfile.create({
        data: {
            user_id: tech.user_id,
            technician_type: "individual",
            location: "Test City",
            latitude: 12.34,
            longitude: 56.78,
            service_radius: 10
        }
    });

    const variant = await prisma.carVariant.findFirst();
    const vehicle = await prisma.userVehicle.create({
        data: {
            user_id: user.user_id,
            variant_id: variant ? variant.variant_id : 1,
            registration_number: `REG${Date.now()}`,
            vin_number: `VIN${Date.now()}`
        }
    });

    const requestOn = await prisma.serviceRequest.create({
        data: {
            user_id: user.user_id,
            vehicle_id: vehicle.vehicle_id,
            issue_type: "battery_issue",
            issue_description: "Dead battery (Online)",
            service_location_type: "roadside",
            status: "in_progress",
            breakdown_latitude: 0,
            breakdown_longitude: 0,
        }
    });

    const requestOff = await prisma.serviceRequest.create({
        data: {
            user_id: user.user_id,
            vehicle_id: vehicle.vehicle_id,
            issue_type: "battery_issue",
            issue_description: "Dead battery (Cash)",
            service_location_type: "roadside",
            status: "in_progress",
            breakdown_latitude: 0,
            breakdown_longitude: 0,
        }
    });

    const offerOn = await prisma.technicianOffer.create({
        data: {
            request_id: requestOn.request_id,
            technician_id: techProfile.technician_id,
            repair_mode: "onsite",
            estimated_cost: 1000,
            estimated_time: 30,
            status: "accepted"
        }
    });

    const offerOff = await prisma.technicianOffer.create({
        data: {
            request_id: requestOff.request_id,
            technician_id: techProfile.technician_id,
            repair_mode: "onsite",
            estimated_cost: 1000,
            estimated_time: 30,
            status: "accepted"
        }
    });

    const jobOn = await prisma.job.create({
        data: {
            request_id: requestOn.request_id,
            technician_id: techProfile.technician_id,
            offer_id: offerOn.offer_id,
            status: "completed"
        }
    });

    const jobOff = await prisma.job.create({
        data: {
            request_id: requestOff.request_id,
            technician_id: techProfile.technician_id,
            offer_id: offerOff.offer_id,
            status: "completed"
        }
    });

    const invoiceOnline = await prisma.invoice.create({
        data: {
            job_id: jobOn.job_id,
            subtotal: 1000,
            tax: 0,
            total_amount: 1000,
            payment_status: "pending"
        }
    });

    const invoiceCash = await prisma.invoice.create({
        data: {
            job_id: jobOff.job_id,
            subtotal: 1000,
            tax: 0,
            total_amount: 1000,
            payment_status: "pending"
        }
    });

    console.log("Created Mock Data.");

    // Test 1: Process Online Payment (1000 total -> +800 technician share)
    await prisma.invoice.update({
        where: { invoice_id: invoiceOnline.invoice_id },
        data: { payment_status: "completed", payment_method: "card" }
    });
    const payout1 = await processJobPaymentLedger(invoiceOnline.invoice_id, "online");
    console.log("TEST 1 - Online Payment Ledger:", payout1.amount === 800 ? "PASS (+800)" : `FAIL (${payout1.amount})`);

    // Test 2: Process Cash Payment (1000 total -> -200 admin commission)
    await prisma.invoice.update({
        where: { invoice_id: invoiceCash.invoice_id },
        data: { payment_status: "completed", payment_method: "cash" }
    });
    const payout2 = await processJobPaymentLedger(invoiceCash.invoice_id, "cash");
    console.log("TEST 2 - Cash Payment Ledger:", payout2.amount === -200 ? "PASS (-200)" : `FAIL (${payout2.amount})`);

    // Test 3: Run CRON Aggregation (800 - 200 = 600 net positive)
    await aggregateDailyLedgers();

    const finalPayouts = await prisma.payout.findMany({
        where: { technician_id: techProfile.technician_id }
    });

    const allProcessed = finalPayouts.every(p => p.payout_status === "completed" || p.payout_status === "failed");
    console.log("TEST 3 - Daily Ledger CRON Processed Pendings:", allProcessed ? "PASS" : "FAIL (Still Pending)");

    // Cleanup
    await prisma.payout.deleteMany({ where: { technician_id: techProfile.technician_id } });
    await prisma.invoice.deleteMany({ where: { job_id: { in: [jobOn.job_id, jobOff.job_id] } } });
    await prisma.job.deleteMany({ where: { request_id: { in: [requestOn.request_id, requestOff.request_id] } } });
    await prisma.technicianOffer.deleteMany({ where: { technician_id: techProfile.technician_id } });
    await prisma.serviceRequest.deleteMany({ where: { user_id: user.user_id } });
    await prisma.userVehicle.deleteMany({ where: { vehicle_id: vehicle.vehicle_id } });
    await prisma.technicianProfile.deleteMany({ where: { technician_id: techProfile.technician_id } });
    await prisma.user.deleteMany({ where: { OR: [{ user_id: user.user_id }, { user_id: tech.user_id }] } });

    console.log("--- TESTS COMPLETED AND CLEANED ---");
    process.exit(0);
}

runTest().catch(e => {
    console.error(e);
    process.exit(1);
}).finally(() => prisma.$disconnect());
