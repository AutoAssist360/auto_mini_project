import "dotenv/config";
import { createServer } from "node:http";
import { io as createSocketClient } from "../../user_dashboard/node_modules/socket.io-client/build/esm/index.js";
import app from "../src/server.js";
import { prisma } from "../src/lib/prisma.js";
import { initSocket } from "../src/socket.js";

const PASSWORD = "Test@1234";
const USER_VEHICLE_SELECT = {
  vehicle_id: true,
  user_id: true,
  variant_id: true,
  registration_number: true,
};

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

function daysAgo(n) {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
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
  assert(jar.accessToken, `No accessToken cookie returned for ${email}`);
  assert(jar.refreshToken, `No refreshToken cookie returned for ${email}`);
  assert(data?.accessToken, `No access token returned in body for ${email}`);
  return { jar, accessToken: data.accessToken };
}

async function connectSocket(baseUrl, accessToken, label) {
  const socket = createSocketClient(baseUrl, {
    auth: { token: accessToken },
    transports: ["websocket"],
    reconnection: false,
  });

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error(`Socket connection timed out for ${label}`));
    }, 10000);

    socket.once("connect", () => {
      clearTimeout(timeout);
      resolve();
    });

    socket.once("connect_error", (error) => {
      clearTimeout(timeout);
      socket.disconnect();
      reject(error);
    });
  });

  return socket;
}

async function main() {
  const server = createServer(app);
  initSocket(server);
  const sockets = [];
  let success = false;

  try {
    await new Promise((resolve) => server.listen(0, resolve));
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    console.log(`Running demo flow checks against ${baseUrl}`);

    const userSession = await login(baseUrl, "/auth/signin", "rahul@test.com");
    const techSession = await login(baseUrl, "/tech/auth/signin", "tech1@test.com");
    const tech2Session = await login(baseUrl, "/tech/auth/signin", "tech2@test.com");
    const vendorSession = await login(baseUrl, "/vendor/auth/signin", "vendor1@test.com");
    const adminSession = await login(baseUrl, "/admin/auth/signin", "admin@quickassist.com");
    console.log("Role logins passed.");

    const userJar = userSession.jar;
    const techJar = techSession.jar;
    const tech2Jar = tech2Session.jar;
    const vendorJar = vendorSession.jar;
    const adminJar = adminSession.jar;

    sockets.push(await connectSocket(baseUrl, techSession.accessToken, "technician"));
    sockets.push(await connectSocket(baseUrl, vendorSession.accessToken, "vendor"));
    console.log("Realtime socket connections passed.");

    const userProfile = await api(baseUrl, "/profile", { jar: userJar });
    assert(userProfile.response.ok, `User profile failed: ${JSON.stringify(userProfile.data)}`);
    assert(userProfile.data?.user?.role === "user", "User profile role mismatch");

    const techProfile = await api(baseUrl, "/tech/profile", { jar: techJar });
    assert(techProfile.response.ok, `Tech profile failed: ${JSON.stringify(techProfile.data)}`);
    assert(techProfile.data?.profile?.user?.role === "technician", "Technician profile role mismatch");

    const vendorWarehouses = await api(baseUrl, "/vendor/warehouses?page=1&limit=5", { jar: vendorJar });
    assert(vendorWarehouses.response.ok, `Vendor warehouses failed: ${JSON.stringify(vendorWarehouses.data)}`);
    assert((vendorWarehouses.data?.warehouses || []).length > 0, "Vendor has no warehouses");

    const adminDashboard = await api(baseUrl, "/admin/dashboard", { jar: adminJar });
    assert(adminDashboard.response.ok, `Admin dashboard failed: ${JSON.stringify(adminDashboard.data)}`);
    assert(adminDashboard.data?.users?.total > 0, "Admin dashboard returned empty user totals");
    console.log("Role landing endpoints passed.");

    // Vehicle catalog + add/remove vehicle
    const companiesRes = await api(baseUrl, "/vehicles/companies", { jar: userJar });
    assert(companiesRes.response.ok, `Companies lookup failed: ${JSON.stringify(companiesRes.data)}`);
    const company = companiesRes.data?.companies?.[0];
    assert(company?.company_id, "No company returned from catalog");

    const modelsRes = await api(baseUrl, `/vehicles/companies/${company.company_id}/models`, { jar: userJar });
    assert(modelsRes.response.ok, `Models lookup failed: ${JSON.stringify(modelsRes.data)}`);
    const model = modelsRes.data?.models?.[0];
    assert(model?.model_id, "No model returned from catalog");

    const variantsRes = await api(baseUrl, `/vehicles/models/${model.model_id}/variants`, { jar: userJar });
    assert(variantsRes.response.ok, `Variants lookup failed: ${JSON.stringify(variantsRes.data)}`);
    const variant = variantsRes.data?.variants?.[0];
    assert(variant?.variant_id, "No variant returned from catalog");

    const uniqueSuffix = Date.now().toString().slice(-8);
    const addVehicleRes = await api(baseUrl, "/vehicles", {
      method: "POST",
      jar: userJar,
      body: {
        variant_id: variant.variant_id,
        registration_number: `DL${uniqueSuffix}QA`,
        vin_number: `ABCDM${uniqueSuffix}1234`,
      },
    });
    assert(addVehicleRes.response.ok, `Add vehicle failed: ${JSON.stringify(addVehicleRes.data)}`);
    const createdVehicleId = addVehicleRes.data?.vehicle?.vehicle_id;
    assert(createdVehicleId, "Vehicle was not created");

    const deleteVehicleRes = await api(baseUrl, `/vehicles/${createdVehicleId}`, {
      method: "DELETE",
      jar: userJar,
    });
    assert(deleteVehicleRes.response.ok, `Delete vehicle failed: ${JSON.stringify(deleteVehicleRes.data)}`);
    console.log("Vehicle catalog and add/remove flow passed.");

    // Order creation + direct payment verification
    const [priya, inventoryItem] = await Promise.all([
      prisma.user.findUnique({ where: { email: "priya@test.com" } }),
      prisma.inventory.findFirst({
        where: {
          warehouse: { vendor: { email: "vendor1@test.com" }, is_active: true },
          quantity_available: { gt: 5 },
        },
        include: {
          warehouse: true,
          part: true,
        },
        orderBy: { quantity_available: "desc" },
      }),
    ]);

    assert(priya?.user_id, "Seed user priya@test.com not found");
    assert(inventoryItem?.inventory_id, "No inventory available for vendor order test");

    const priyaSession = await login(baseUrl, "/auth/signin", "priya@test.com");
    const priyaJar = priyaSession.jar;

    const createOrderRes = await api(baseUrl, "/orders", {
      method: "POST",
      jar: priyaJar,
      body: {
        warehouse_id: inventoryItem.warehouse_id,
        delivery_contact_name: "Priya Demo",
        delivery_phone: "9876543210",
        delivery_address: "Demo delivery address, Civil Lines",
        delivery_city: "Nagpur",
        delivery_state: "Maharashtra",
        delivery_postal_code: "440001",
        items: [{ part_id: inventoryItem.part_id, quantity: 1 }],
        notes: "Automated demo verification order",
      },
    });
    assert(createOrderRes.response.ok, `Create order failed: ${JSON.stringify(createOrderRes.data)}`);
    const createdOrderId = createOrderRes.data?.order?.order_id;
    assert(createdOrderId, "Order was not created");

    const directOrderRes = await api(baseUrl, `/orders/${createdOrderId}/pay`, {
      method: "POST",
      jar: priyaJar,
      body: {
        payment_method: "upi",
        transaction_id: `DEMO-ORDER-${Date.now()}`,
      },
    });
    assert(directOrderRes.response.ok, `Order payment failed: ${JSON.stringify(directOrderRes.data)}`);

    const [paidOrder, vendorLedger] = await Promise.all([
      prisma.order.findUnique({ where: { order_id: createdOrderId } }),
      api(baseUrl, "/vendor/ledger?page=1&limit=20", { jar: vendorJar }),
    ]);

    assert(paidOrder?.payment_status === "completed", "Order payment status did not update");
    assert(paidOrder?.payment_method === "upi", "Order payment method did not update to direct payment");
    assert(vendorLedger.response.ok, `Vendor ledger lookup failed: ${JSON.stringify(vendorLedger.data)}`);
    assert(
      (vendorLedger.data?.ledger || []).some((entry) => entry.reference === createdOrderId),
      "Vendor ledger did not include the paid order"
    );
    console.log("Order creation, direct payment, and vendor ledger flow passed.");

    // Invoice creation + direct payment verification
    const [rahul, techUser, techProfileRecord, rahulVehicle] = await Promise.all([
      prisma.user.findUnique({ where: { email: "rahul@test.com" } }),
      prisma.user.findUnique({ where: { email: "tech1@test.com" } }),
      prisma.technicianProfile.findFirst({
        where: { user: { email: "tech1@test.com" } },
      }),
      prisma.userVehicle.findFirst({
        where: { user: { email: "rahul@test.com" } },
        select: USER_VEHICLE_SELECT,
      }),
    ]);

    assert(rahul?.user_id, "Seed user rahul@test.com not found");
    assert(techUser?.user_id, "Seed technician tech1@test.com not found");
    assert(techProfileRecord?.technician_id, "Technician profile for tech1@test.com not found");
    assert(rahulVehicle?.vehicle_id, "Seed vehicle for rahul@test.com not found");

    const rahulSession = await login(baseUrl, "/auth/signin", "rahul@test.com");
    const rahulJar = rahulSession.jar;

    const request = await prisma.serviceRequest.create({
      data: {
        user_id: rahul.user_id,
        vehicle_id: rahulVehicle.vehicle_id,
        issue_description: "Automated invoice payment verification request",
        issue_type: "battery_issue",
        service_location_type: "roadside",
        requires_towing: false,
        status: "completed",
      },
    });

    const offer = await prisma.technicianOffer.create({
      data: {
        request_id: request.request_id,
        technician_id: techProfileRecord.technician_id,
        repair_mode: "onsite",
        estimated_cost: 1800,
        estimated_time: 30,
        status: "accepted",
      },
    });

    const job = await prisma.job.create({
      data: {
        request_id: request.request_id,
        technician_id: techProfileRecord.technician_id,
        offer_id: offer.offer_id,
        status: "completed",
        started_at: new Date(),
        completed_at: new Date(),
      },
    });

    const invoice = await prisma.invoice.create({
      data: {
        job_id: job.job_id,
        subtotal: 1800,
        tax: 324,
        total: 2124,
        payment_status: "pending",
        items: {
          create: [
            {
              item_type: "labor",
              description: "Automated verification labor",
              quantity: 1,
              unit_price: 1800,
              total_price: 1800,
            },
          ],
        },
      },
      include: { items: true },
    });

    const directInvoiceRes = await api(baseUrl, `/invoices/${invoice.invoice_id}/pay`, {
      method: "POST",
      jar: rahulJar,
      body: {
        payment_method: "upi",
        transaction_id: `DEMO-INVOICE-${Date.now()}`,
      },
    });
    assert(directInvoiceRes.response.ok, `Invoice payment failed: ${JSON.stringify(directInvoiceRes.data)}`);

    const paidInvoice = await prisma.invoice.findUnique({
      where: { invoice_id: invoice.invoice_id },
    });

    assert(paidInvoice?.payment_status === "completed", "Invoice payment status did not update");
    assert(paidInvoice?.payment_method === "upi", "Invoice payment method did not update to direct payment");

    // Technician rejection should allow the user to rebook another technician
    const [rahulVehicleForRebook, techOneProfile, techTwoProfile] = await Promise.all([
      prisma.userVehicle.findFirst({
        where: { user: { email: "rahul@test.com" } },
        select: USER_VEHICLE_SELECT,
      }),
      prisma.technicianProfile.findFirst({
        where: { user: { email: "tech1@test.com" } },
        select: { technician_id: true },
      }),
      prisma.technicianProfile.findFirst({
        where: { user: { email: "tech2@test.com" } },
        select: { technician_id: true },
      }),
    ]);

    assert(rahulVehicleForRebook?.vehicle_id, "Seed vehicle missing for rebooking verification");
    assert(techOneProfile?.technician_id, "Tech1 profile missing for rebooking verification");
    assert(techTwoProfile?.technician_id, "Tech2 profile missing for rebooking verification");

    const rebookRequestRes = await api(baseUrl, "/requests", {
      method: "POST",
      jar: userJar,
      body: {
        vehicle_id: rahulVehicleForRebook.vehicle_id,
        issue_description: "Verification flow: technician rejection should allow rebooking",
        issue_type: "battery_issue",
        service_location_type: "roadside",
        breakdown_latitude: 21.1458,
        breakdown_longitude: 79.0882,
        requires_towing: false,
      },
    });
    assert(rebookRequestRes.response.ok, `Create request for rebooking failed: ${JSON.stringify(rebookRequestRes.data)}`);
    const rebookRequestId = rebookRequestRes.data?.serviceRequest?.request_id;
    assert(rebookRequestId, "Rebooking verification request was not created");

    const firstBookingRes = await api(baseUrl, `/requests/${rebookRequestId}/book`, {
      method: "POST",
      jar: userJar,
      body: { technician_id: techOneProfile.technician_id },
    });
    assert(firstBookingRes.response.ok, `Initial booking failed: ${JSON.stringify(firstBookingRes.data)}`);
    const firstJobId = firstBookingRes.data?.job?.job_id;
    assert(firstJobId, "Initial booking did not create a job");

    const rejectAssignmentRes = await api(baseUrl, `/tech/assignments/${firstJobId}/reject`, {
      method: "POST",
      jar: techJar,
    });
    assert(rejectAssignmentRes.response.ok, `Technician rejection failed: ${JSON.stringify(rejectAssignmentRes.data)}`);

    const requestAfterReject = await api(baseUrl, `/requests/${rebookRequestId}`, {
      jar: userJar,
    });
    assert(requestAfterReject.response.ok, `Fetching request after rejection failed: ${JSON.stringify(requestAfterReject.data)}`);
    assert(
      !requestAfterReject.data?.serviceRequest?.job,
      "Rejected assignment still appears as an active job on the request"
    );
    assert(
      ["created", "pending_offers"].includes(requestAfterReject.data?.serviceRequest?.status),
      `Request status after rejection should reopen, got ${requestAfterReject.data?.serviceRequest?.status}`
    );

    const secondBookingRes = await api(baseUrl, `/requests/${rebookRequestId}/book`, {
      method: "POST",
      jar: userJar,
      body: { technician_id: techTwoProfile.technician_id },
    });
    assert(secondBookingRes.response.ok, `Rebooking after rejection failed: ${JSON.stringify(secondBookingRes.data)}`);
    assert(secondBookingRes.data?.job?.job_id, "Rebooking after rejection did not create a new job");
    console.log("Technician rejection and rebooking flow passed.");

    // Cash on delivery + return flow within 7 days
    const codOrderRes = await api(baseUrl, "/orders", {
      method: "POST",
      jar: priyaJar,
      body: {
        warehouse_id: inventoryItem.warehouse_id,
        payment_method: "cash_on_delivery",
        delivery_contact_name: "Priya COD",
        delivery_phone: "9876543210",
        delivery_address: "COD verification address, Civil Lines",
        delivery_city: "Nagpur",
        delivery_state: "Maharashtra",
        delivery_postal_code: "440001",
        items: [{ part_id: inventoryItem.part_id, quantity: 1 }],
        notes: "COD verification order",
      },
    });
    assert(codOrderRes.response.ok, `COD order creation failed: ${JSON.stringify(codOrderRes.data)}`);
    const codOrderId = codOrderRes.data?.order?.order_id;
    assert(codOrderId, "COD order was not created");
    assert(codOrderRes.data?.order?.payment_method === "cash_on_delivery", "COD payment method was not stored on order creation");

    const vendorConfirmCod = await api(baseUrl, `/vendor/orders/${codOrderId}/confirm`, {
      method: "PATCH",
      jar: vendorJar,
    });
    assert(vendorConfirmCod.response.ok, `Vendor confirm COD order failed: ${JSON.stringify(vendorConfirmCod.data)}`);

    const createFulfillmentRes = await api(baseUrl, `/vendor/orders/${codOrderId}/fulfillment`, {
      method: "POST",
      jar: vendorJar,
      body: {
        tracking_number: `CODTRACK-${Date.now()}`,
        carrier: "Verification Carrier",
        estimated_delivery: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        notes: "COD verification fulfillment",
      },
    });
    assert(createFulfillmentRes.response.ok, `Create COD fulfillment failed: ${JSON.stringify(createFulfillmentRes.data)}`);
    const codFulfillmentId = createFulfillmentRes.data?.fulfillment?.fulfillment_id;
    assert(codFulfillmentId, "COD fulfillment was not created");

    const shipFulfillmentRes = await api(baseUrl, `/vendor/fulfillment/${codFulfillmentId}/status`, {
      method: "PATCH",
      jar: vendorJar,
      body: {
        status: "processing",
        tracking_number: `CODTRACK-${Date.now()}`,
        carrier: "Verification Carrier",
      },
    });
    assert(shipFulfillmentRes.response.ok, `Moving COD fulfillment to processing failed: ${JSON.stringify(shipFulfillmentRes.data)}`);

    const dispatchFulfillmentRes = await api(baseUrl, `/vendor/fulfillment/${codFulfillmentId}/status`, {
      method: "PATCH",
      jar: vendorJar,
      body: {
        status: "shipped",
        tracking_number: `CODTRACK-${Date.now()}`,
        carrier: "Verification Carrier",
      },
    });
    assert(dispatchFulfillmentRes.response.ok, `Shipping COD fulfillment failed: ${JSON.stringify(dispatchFulfillmentRes.data)}`);

    const deliverFulfillmentRes = await api(baseUrl, `/vendor/fulfillment/${codFulfillmentId}/status`, {
      method: "PATCH",
      jar: vendorJar,
      body: {
        status: "delivered",
      },
    });
    assert(deliverFulfillmentRes.response.ok, `Delivering COD fulfillment failed: ${JSON.stringify(deliverFulfillmentRes.data)}`);

    const collectCodRes = await api(baseUrl, `/vendor/orders/${codOrderId}/collect-cod`, {
      method: "PATCH",
      jar: vendorJar,
    });
    assert(collectCodRes.response.ok, `Collect COD failed: ${JSON.stringify(collectCodRes.data)}`);

    const requestReturnRes = await api(baseUrl, `/orders/${codOrderId}/return-request`, {
      method: "POST",
      jar: priyaJar,
      body: {
        reason: "The delivered part is damaged and I need to return it immediately.",
      },
    });
    assert(requestReturnRes.response.ok, `Return request within window failed: ${JSON.stringify(requestReturnRes.data)}`);

    const approveReturnRes = await api(baseUrl, `/vendor/orders/${codOrderId}/return-review`, {
      method: "PATCH",
      jar: vendorJar,
      body: {
        decision: "approved",
        resolution_notes: "Approved after verifying customer damage report",
      },
    });
    assert(approveReturnRes.response.ok, `Vendor return approval failed: ${JSON.stringify(approveReturnRes.data)}`);

    const codOrderAfterReturn = await prisma.order.findUnique({
      where: { order_id: codOrderId },
    });
    assert(codOrderAfterReturn?.order_status === "returned", "COD return flow did not move order to returned");
    assert(codOrderAfterReturn?.payment_status === "refunded", "COD return flow did not refund the collected COD payment");
    console.log("Cash on delivery, delivery, collection, and return flow passed.");

    // Return should fail after 7 days
    const expiredReturnOrder = await prisma.order.create({
      data: {
        order_number: `ORD-EXPIRED-${Date.now()}`,
        user_id: priya.user_id,
        warehouse_id: inventoryItem.warehouse_id,
        delivery_contact_name: "Priya Expired Return",
        delivery_phone: "9876543210",
        delivery_address: "Expired return verification address",
        delivery_city: "Nagpur",
        delivery_state: "Maharashtra",
        delivery_postal_code: "440001",
        subtotal: 500,
        tax: 90,
        total: 590,
        payment_status: "completed",
        payment_method: "upi",
        transaction_id: `EXPIRED-${Date.now()}`,
        order_status: "delivered",
        items: {
          create: [
            {
              part_id: inventoryItem.part_id,
              quantity: 1,
              unit_price: 500,
              total_price: 500,
            },
          ],
        },
        fulfillments: {
          create: [
            {
              status: "delivered",
              tracking_number: `OLDTRACK-${Date.now()}`,
              carrier: "Verification Carrier",
              shipped_at: daysAgo(10),
              delivered_at: daysAgo(8),
              estimated_delivery: daysAgo(8),
              notes: "Expired return verification delivery",
            },
          ],
        },
      },
    });

    const expiredReturnRes = await api(baseUrl, `/orders/${expiredReturnOrder.order_id}/return-request`, {
      method: "POST",
      jar: priyaJar,
      body: {
        reason: "Trying to return after the seven day eligibility period has passed.",
      },
    });
    assert(
      expiredReturnRes.response.status === 400,
      `Expired return request should fail with 400, got ${expiredReturnRes.response.status}: ${JSON.stringify(expiredReturnRes.data)}`
    );
    console.log("Return window expiry validation passed.");

    // User should be able to cancel an order before shipment
    const cancellableOrderRes = await api(baseUrl, "/orders", {
      method: "POST",
      jar: priyaJar,
      body: {
        warehouse_id: inventoryItem.warehouse_id,
        payment_method: "upi",
        delivery_contact_name: "Priya Cancel",
        delivery_phone: "9876543210",
        delivery_address: "Cancellation verification address",
        delivery_city: "Nagpur",
        delivery_state: "Maharashtra",
        delivery_postal_code: "440001",
        items: [{ part_id: inventoryItem.part_id, quantity: 1 }],
        notes: "Cancellation verification order",
      },
    });
    assert(cancellableOrderRes.response.ok, `Cancellable order creation failed: ${JSON.stringify(cancellableOrderRes.data)}`);
    const cancellableOrderId = cancellableOrderRes.data?.order?.order_id;
    assert(cancellableOrderId, "Cancellable order was not created");

    const cancelOrderRes = await api(baseUrl, `/orders/${cancellableOrderId}/cancel`, {
      method: "PATCH",
      jar: priyaJar,
    });
    assert(cancelOrderRes.response.ok, `User order cancellation failed: ${JSON.stringify(cancelOrderRes.data)}`);

    const cancelledOrder = await prisma.order.findUnique({
      where: { order_id: cancellableOrderId },
    });
    assert(cancelledOrder?.order_status === "cancelled", "User order cancellation did not persist");
    console.log("User order cancellation flow passed.");

    success = true;
    console.log("All demo flow checks passed.");
  } catch (error) {
    console.error("Demo flow check failed:", error);
  } finally {
    for (const socket of sockets) {
      socket.disconnect();
    }
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
