import "dotenv/config";
import { createServer } from "node:http";
import app from "../src/server.js";
import { prisma } from "../src/lib/prisma.js";
import { initSocket } from "../src/socket.js";

const PASSWORD = "Test@1234";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function cookieHeader(jar) {
  return Object.entries(jar)
    .map(([key, value]) => `${key}=${value}`)
    .join("; ");
}

function updateCookieJar(jar, response) {
  const setCookies = response.headers.getSetCookie?.() || [];

  for (const rawCookie of setCookies) {
    const [pair] = rawCookie.split(";");
    const [name, value] = pair.split("=");
    if (name && value !== undefined) {
      jar[name.trim()] = value.trim();
    }
  }
}

async function api(baseUrl, path, { method = "GET", body, jar } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(jar && Object.keys(jar).length > 0 ? { Cookie: cookieHeader(jar) } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (jar) {
    updateCookieJar(jar, response);
  }

  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  return { response, data };
}

async function login(baseUrl, path, email) {
  const jar = {};
  const { response, data } = await api(baseUrl, path, {
    method: "POST",
    body: { email, password: PASSWORD },
    jar,
  });

  assert(response.ok, `Login failed for ${email}: ${JSON.stringify(data)}`);
  return { jar };
}

function expectStatus(result, status, label) {
  assert(
    result.response.status === status,
    `${label} expected ${status}, got ${result.response.status}: ${JSON.stringify(result.data)}`
  );
}

async function main() {
  const server = createServer(app);
  initSocket(server);
  let success = false;

  try {
    await new Promise((resolve) => server.listen(0, resolve));
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    console.log(`Running edge-case checks against ${baseUrl}`);

    const [{ jar: rahulJar }, { jar: priyaJar }] = await Promise.all([
      login(baseUrl, "/auth/signin", "rahul@test.com"),
      login(baseUrl, "/auth/signin", "priya@test.com"),
    ]);

    const [rahul, priya, techProfile, rahulVehicle, inventoryItem] = await Promise.all([
      prisma.user.findUnique({ where: { email: "rahul@test.com" } }),
      prisma.user.findUnique({ where: { email: "priya@test.com" } }),
      prisma.technicianProfile.findFirst({
        where: { user: { email: "tech1@test.com" } },
      }),
      prisma.userVehicle.findFirst({
        where: { user: { email: "rahul@test.com" } },
        select: { vehicle_id: true },
      }),
      prisma.inventory.findFirst({
        where: {
          warehouse: { vendor: { email: "vendor1@test.com" }, is_active: true },
          quantity_available: { gt: 2 },
        },
        include: {
          warehouse: true,
        },
        orderBy: { quantity_available: "desc" },
      }),
    ]);

    assert(rahul?.user_id, "Seed user rahul@test.com not found");
    assert(priya?.user_id, "Seed user priya@test.com not found");
    assert(techProfile?.technician_id, "Seed technician tech1@test.com not found");
    assert(rahulVehicle?.vehicle_id, "Seed vehicle for rahul@test.com not found");
    assert(inventoryItem?.warehouse_id, "Inventory for vendor edge cases not found");

    const userAdminDashboard = await api(baseUrl, "/admin/dashboard", { jar: rahulJar });
    expectStatus(userAdminDashboard, 403, "User access to admin dashboard");

    const userTechProfile = await api(baseUrl, "/tech/profile", { jar: rahulJar });
    expectStatus(userTechProfile, 403, "User access to technician profile");

    const weakTechSignup = await api(baseUrl, "/tech/auth/signup", {
      method: "POST",
      body: {
        email: `weak-tech-${Date.now()}@test.com`,
        password: "1234567",
        full_name: "Weak Tech",
        phone_number: "9999999999",
        business_name: "Weak Garage",
        technician_type: "individual",
        location: "Nagpur",
        latitude: 21.1458,
        longitude: 79.0882,
        service_radius: 10,
      },
    });
    expectStatus(weakTechSignup, 400, "Weak technician password validation");

    const duplicateVendorSignup = await api(baseUrl, "/vendor/auth/signup", {
      method: "POST",
      body: {
        email: "vendor1@test.com",
        password: PASSWORD,
        full_name: "Duplicate Vendor",
        phone_number: "8888888888",
        upi_id: "duplicate@upi",
      },
    });
    expectStatus(duplicateVendorSignup, 409, "Duplicate vendor email validation");

    const missingVehicleRequest = await api(baseUrl, "/requests", {
      method: "POST",
      jar: rahulJar,
      body: {
        issue_description: "Missing vehicle should fail validation",
        issue_type: "battery_issue",
        service_location_type: "roadside",
        breakdown_latitude: 21.1458,
        breakdown_longitude: 79.0882,
        requires_towing: false,
      },
    });
    expectStatus(missingVehicleRequest, 400, "Missing vehicle request validation");

    const invalidUuidRequest = await api(baseUrl, "/requests/not-a-uuid", { jar: rahulJar });
    expectStatus(invalidUuidRequest, 400, "Invalid UUID request lookup");

    const ownRequestRes = await api(baseUrl, "/requests", {
      method: "POST",
      jar: rahulJar,
      body: {
        vehicle_id: rahulVehicle.vehicle_id,
        issue_description: "Ownership guard verification request",
        issue_type: "battery_issue",
        service_location_type: "roadside",
        breakdown_latitude: 21.1458,
        breakdown_longitude: 79.0882,
        requires_towing: false,
      },
    });
    assert(ownRequestRes.response.ok, `Ownership setup request failed: ${JSON.stringify(ownRequestRes.data)}`);
    const ownRequestId = ownRequestRes.data?.serviceRequest?.request_id;
    assert(ownRequestId, "Ownership setup request ID missing");

    const crossUserRequestAccess = await api(baseUrl, `/requests/${ownRequestId}`, {
      jar: priyaJar,
    });
    expectStatus(crossUserRequestAccess, 403, "Cross-user request ownership check");

    const inProgressRequest = await prisma.serviceRequest.create({
      data: {
        user_id: rahul.user_id,
        vehicle_id: rahulVehicle.vehicle_id,
        issue_description: "Cancel should fail when request is in progress",
        issue_type: "battery_issue",
        service_location_type: "roadside",
        requires_towing: false,
        status: "in_progress",
      },
    });

    const cancelInProgressRequest = await api(baseUrl, `/requests/${inProgressRequest.request_id}/cancel`, {
      method: "PATCH",
      jar: rahulJar,
    });
    expectStatus(cancelInProgressRequest, 400, "Cancelling in-progress request");

    const qrOrderRes = await api(baseUrl, "/orders", {
      method: "POST",
      jar: priyaJar,
      body: {
        warehouse_id: inventoryItem.warehouse_id,
        payment_method: "upi",
        delivery_contact_name: "Priya Edge",
        delivery_phone: "9876543210",
        delivery_address: "Edge-case delivery address",
        delivery_city: "Nagpur",
        delivery_state: "Maharashtra",
        delivery_postal_code: "440001",
        items: [{ part_id: inventoryItem.part_id, quantity: 1 }],
      },
    });
    assert(qrOrderRes.response.ok, `Order QR setup failed: ${JSON.stringify(qrOrderRes.data)}`);
    const qrOrderId = qrOrderRes.data?.order?.order_id;
    assert(qrOrderId, "QR order ID missing");

    const orderQrData = await api(baseUrl, `/orders/${qrOrderId}/qr-data`, { jar: priyaJar });
    assert(orderQrData.response.ok, `Order QR lookup failed: ${JSON.stringify(orderQrData.data)}`);
    assert(orderQrData.data?.upi_url, "Order QR data missing upi_url");

    const returnBeforeDelivery = await api(baseUrl, `/orders/${qrOrderId}/return-request`, {
      method: "POST",
      jar: priyaJar,
      body: { reason: "Trying to return before delivery" },
    });
    expectStatus(returnBeforeDelivery, 400, "Return before delivery");

    const platformFeeQr = await api(baseUrl, "/payments/platform-fee/qr", { jar: rahulJar });
    assert(platformFeeQr.response.ok, `Platform fee QR failed: ${JSON.stringify(platformFeeQr.data)}`);
    assert(platformFeeQr.data?.upi_url, "Platform fee QR missing upi_url");

    const invoiceRequest = await prisma.serviceRequest.create({
      data: {
        user_id: rahul.user_id,
        vehicle_id: rahulVehicle.vehicle_id,
        issue_description: "Invoice QR verification request",
        issue_type: "battery_issue",
        service_location_type: "roadside",
        requires_towing: false,
        status: "completed",
      },
    });

    const invoiceOffer = await prisma.technicianOffer.create({
      data: {
        request_id: invoiceRequest.request_id,
        technician_id: techProfile.technician_id,
        repair_mode: "onsite",
        estimated_cost: 999,
        estimated_time: 25,
        status: "accepted",
      },
    });

    const invoiceJob = await prisma.job.create({
      data: {
        request_id: invoiceRequest.request_id,
        technician_id: techProfile.technician_id,
        offer_id: invoiceOffer.offer_id,
        status: "completed",
        started_at: new Date(),
        completed_at: new Date(),
      },
    });

    const invoice = await prisma.invoice.create({
      data: {
        job_id: invoiceJob.job_id,
        subtotal: 999,
        tax: 179.82,
        total: 1178.82,
        payment_status: "pending",
        items: {
          create: [
            {
              item_type: "labor",
              description: "Edge-case invoice QR verification",
              quantity: 1,
              unit_price: 999,
              total_price: 999,
            },
          ],
        },
      },
    });

    const invoiceQrData = await api(baseUrl, `/invoices/${invoice.invoice_id}/qr-data`, { jar: rahulJar });
    assert(invoiceQrData.response.ok, `Invoice QR lookup failed: ${JSON.stringify(invoiceQrData.data)}`);
    assert(invoiceQrData.data?.upi_url, "Invoice QR data missing upi_url");

    success = true;
    console.log("All edge-case checks passed.");
  } catch (error) {
    console.error("Edge-case check failed:", error);
  } finally {
    await Promise.race([
      prisma.$disconnect(),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
    await Promise.race([
      new Promise((resolve) => server.close(resolve)),
      new Promise((resolve) => setTimeout(resolve, 2000)),
    ]);
    process.exit(success ? 0 : 1);
  }
}

main();
