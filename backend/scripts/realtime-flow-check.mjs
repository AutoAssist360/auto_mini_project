import "dotenv/config";
import { createServer } from "node:http";
import { io as createSocketClient } from "../../user_dashboard/node_modules/socket.io-client/build/esm/index.js";
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
  assert(jar.accessToken, `Access token cookie missing for ${email}`);
  return { jar, accessToken: data?.accessToken || null };
}

async function connectSocketWithCookies(baseUrl, jar, label) {
  const socket = createSocketClient(baseUrl, {
    transports: ["websocket"],
    reconnection: false,
    extraHeaders: {
      Cookie: cookieHeader(jar),
    },
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

function waitForSocketEvent(socket, eventName, predicate, label, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off(eventName, handler);
      reject(new Error(`Timed out waiting for ${label}`));
    }, timeoutMs);

    function handler(payload) {
      try {
        if (!predicate || predicate(payload)) {
          clearTimeout(timeout);
          socket.off(eventName, handler);
          resolve(payload);
        }
      } catch (error) {
        clearTimeout(timeout);
        socket.off(eventName, handler);
        reject(error);
      }
    }

    socket.on(eventName, handler);
  });
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

    console.log(`Running realtime flow checks against ${baseUrl}`);

    const [rahulSession, priyaSession, techSession, vendorSession] = await Promise.all([
      login(baseUrl, "/auth/signin", "rahul@test.com"),
      login(baseUrl, "/auth/signin", "priya@test.com"),
      login(baseUrl, "/tech/auth/signin", "tech1@test.com"),
      login(baseUrl, "/vendor/auth/signin", "vendor1@test.com"),
    ]);

    const [rahulSocket, priyaSocket, techSocket, vendorSocket] = await Promise.all([
      connectSocketWithCookies(baseUrl, rahulSession.jar, "rahul user"),
      connectSocketWithCookies(baseUrl, priyaSession.jar, "priya user"),
      connectSocketWithCookies(baseUrl, techSession.jar, "technician"),
      connectSocketWithCookies(baseUrl, vendorSession.jar, "vendor"),
    ]);

    sockets.push(rahulSocket, priyaSocket, techSocket, vendorSocket);
    console.log("Cookie-authenticated realtime sockets connected.");

    const [rahul, priya, rahulVehicle, techProfile, inventoryItem] = await Promise.all([
      prisma.user.findUnique({ where: { email: "rahul@test.com" } }),
      prisma.user.findUnique({ where: { email: "priya@test.com" } }),
      prisma.userVehicle.findFirst({
        where: { user: { email: "rahul@test.com" } },
        select: { vehicle_id: true },
      }),
      prisma.technicianProfile.findFirst({
        where: { user: { email: "tech1@test.com" } },
        select: { technician_id: true },
      }),
      prisma.inventory.findFirst({
        where: {
          warehouse: { vendor: { email: "vendor1@test.com" }, is_active: true },
          quantity_available: { gt: 10 },
        },
        include: {
          warehouse: true,
        },
        orderBy: { quantity_available: "desc" },
      }),
    ]);

    assert(rahul?.user_id, "rahul@test.com seed user not found");
    assert(priya?.user_id, "priya@test.com seed user not found");
    assert(rahulVehicle?.vehicle_id, "Rahul seed vehicle not found");
    assert(techProfile?.technician_id, "Technician profile not found");
    assert(inventoryItem?.warehouse_id, "Inventory record for realtime order test not found");

    const createRequestRes = await api(baseUrl, "/requests", {
      method: "POST",
      jar: rahulSession.jar,
      body: {
        vehicle_id: rahulVehicle.vehicle_id,
        issue_description: "Realtime tracking verification request",
        issue_type: "battery_issue",
        service_location_type: "roadside",
        breakdown_latitude: 21.1458,
        breakdown_longitude: 79.0882,
        requires_towing: false,
      },
    });
    assert(createRequestRes.response.ok, `Creating realtime request failed: ${JSON.stringify(createRequestRes.data)}`);
    const requestId = createRequestRes.data?.serviceRequest?.request_id;
    assert(requestId, "Realtime request ID missing");

    const bookingRes = await api(baseUrl, `/requests/${requestId}/book`, {
      method: "POST",
      jar: rahulSession.jar,
      body: { technician_id: techProfile.technician_id },
    });
    assert(bookingRes.response.ok, `Booking technician failed: ${JSON.stringify(bookingRes.data)}`);
    const jobId = bookingRes.data?.job?.job_id;
    assert(jobId, "Job ID missing for realtime tracking test");

    const trackingPromise = waitForSocketEvent(
      rahulSocket,
      "tracking:location",
      (payload) =>
        payload?.jobId === jobId &&
        payload?.source === "live" &&
        payload?.latitude === 21.146 &&
        payload?.longitude === 79.089,
      "live tracking location"
    );

    rahulSocket.emit("tracking:join", jobId);
    techSocket.emit("tracking:join", jobId);
    techSocket.emit("tracking:update", {
      jobId,
      latitude: 21.146,
      longitude: 79.089,
    });

    const trackingPayload = await trackingPromise;
    assert(trackingPayload.technicianId, "Tracking payload missing technician ID");
    console.log("Technician live tracking reached the user in real time.");

    const vendorNewOrderPromise = waitForSocketEvent(
      vendorSocket,
      "notification:new",
      (payload) => payload?.data?.order_id && payload?.title === "New parts order received",
      "vendor new order notification"
    );

    const orderRes = await api(baseUrl, "/orders", {
      method: "POST",
      jar: priyaSession.jar,
      body: {
        warehouse_id: inventoryItem.warehouse_id,
        delivery_contact_name: "Priya Realtime",
        delivery_phone: "9876543210",
        delivery_address: "Realtime verification address",
        delivery_city: "Nagpur",
        delivery_state: "Maharashtra",
        delivery_postal_code: "440001",
        items: [{ part_id: inventoryItem.part_id, quantity: 1 }],
      },
    });
    assert(orderRes.response.ok, `Creating realtime order failed: ${JSON.stringify(orderRes.data)}`);
    const orderId = orderRes.data?.order?.order_id;
    assert(orderId, "Realtime order ID missing");
    const vendorNewOrder = await vendorNewOrderPromise;
    assert(vendorNewOrder?.data?.order_id === orderId, "Vendor received notification for the wrong order");

    const payOrderRes = await api(baseUrl, `/orders/${orderId}/pay`, {
      method: "POST",
      jar: priyaSession.jar,
      body: {
        payment_method: "upi",
        transaction_id: `RT-${Date.now()}`,
      },
    });
    assert(payOrderRes.response.ok, `Order payment failed: ${JSON.stringify(payOrderRes.data)}`);

    const userProcessingPromise = waitForSocketEvent(
      priyaSocket,
      "notification:new",
      (payload) => payload?.data?.order_id === orderId && payload?.title === "Order is being prepared",
      "user order processing notification"
    );

    const processOrderRes = await api(baseUrl, `/vendor/orders/${orderId}/processing`, {
      method: "PATCH",
      jar: vendorSession.jar,
    });
    assert(processOrderRes.response.ok, `Vendor processing update failed: ${JSON.stringify(processOrderRes.data)}`);
    await userProcessingPromise;

    const deliveryTrackingPromise = waitForSocketEvent(
      priyaSocket,
      "order_tracking:location",
      (payload) =>
        payload?.orderId === orderId &&
        payload?.trackingType === "delivery" &&
        payload?.source === "live" &&
        payload?.latitude === 21.151 &&
        payload?.longitude === 79.091,
      "live order delivery tracking"
    );

    priyaSocket.emit("order_tracking:join", orderId);
    vendorSocket.emit("order_tracking:join", orderId);
    vendorSocket.emit("order_tracking:update", {
      orderId,
      latitude: 21.151,
      longitude: 79.091,
    });

    const deliveryTrackingPayload = await deliveryTrackingPromise;
    assert(deliveryTrackingPayload.vendorId, "Order tracking payload missing vendor ID");
    console.log("Vendor live delivery tracking reached the user in real time.");

    const deliveryPausedPromise = waitForSocketEvent(
      priyaSocket,
      "order_tracking:ended",
      (payload) => payload?.orderId === orderId && payload?.reason === "delivery_paused",
      "paused order delivery tracking"
    );

    vendorSocket.emit("order_tracking:stop", {
      orderId,
      reason: "delivery_paused",
    });

    await deliveryPausedPromise;

    const resumedDeliveryTrackingPromise = waitForSocketEvent(
      priyaSocket,
      "order_tracking:location",
      (payload) =>
        payload?.orderId === orderId &&
        payload?.trackingType === "delivery" &&
        payload?.source === "live" &&
        payload?.latitude === 21.1515 &&
        payload?.longitude === 79.0915,
      "resumed live order delivery tracking"
    );

    vendorSocket.emit("order_tracking:update", {
      orderId,
      latitude: 21.1515,
      longitude: 79.0915,
    });

    await resumedDeliveryTrackingPromise;
    console.log("Vendor delivery tracking pause and resume both work.");

    const fulfillmentRes = await api(baseUrl, `/vendor/orders/${orderId}/fulfillment`, {
      method: "POST",
      jar: vendorSession.jar,
      body: {
        tracking_number: `REALTIME-${Date.now()}`,
        carrier: "Realtime Carrier",
        estimated_delivery: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    });
    assert(fulfillmentRes.response.ok, `Create fulfillment failed: ${JSON.stringify(fulfillmentRes.data)}`);
    const fulfillmentId = fulfillmentRes.data?.fulfillment?.fulfillment_id;
    assert(fulfillmentId, "Fulfillment ID missing");

    const moveProcessingRes = await api(baseUrl, `/vendor/fulfillment/${fulfillmentId}/status`, {
      method: "PATCH",
      jar: vendorSession.jar,
      body: { status: "processing" },
    });
    assert(moveProcessingRes.response.ok, `Move fulfillment to processing failed: ${JSON.stringify(moveProcessingRes.data)}`);

    const moveShippedRes = await api(baseUrl, `/vendor/fulfillment/${fulfillmentId}/status`, {
      method: "PATCH",
      jar: vendorSession.jar,
      body: { status: "shipped" },
    });
    assert(moveShippedRes.response.ok, `Ship fulfillment failed: ${JSON.stringify(moveShippedRes.data)}`);

    const moveDeliveredRes = await api(baseUrl, `/vendor/fulfillment/${fulfillmentId}/status`, {
      method: "PATCH",
      jar: vendorSession.jar,
      body: { status: "delivered" },
    });
    assert(moveDeliveredRes.response.ok, `Deliver fulfillment failed: ${JSON.stringify(moveDeliveredRes.data)}`);

    const vendorReturnPromise = waitForSocketEvent(
      vendorSocket,
      "notification:new",
      (payload) => payload?.data?.order_id === orderId && payload?.title === "Return requested",
      "vendor return-request notification"
    );

    const returnRes = await api(baseUrl, `/orders/${orderId}/return-request`, {
      method: "POST",
      jar: priyaSession.jar,
      body: {
        reason: "Realtime return request verification",
      },
    });
    assert(returnRes.response.ok, `Return request failed: ${JSON.stringify(returnRes.data)}`);
    await vendorReturnPromise;

    const returnTrackingPromise = waitForSocketEvent(
      priyaSocket,
      "order_tracking:location",
      (payload) =>
        payload?.orderId === orderId &&
        payload?.trackingType === "return_pickup" &&
        payload?.source === "live" &&
        payload?.latitude === 21.152 &&
        payload?.longitude === 79.092,
      "live return pickup tracking"
    );

    vendorSocket.emit("order_tracking:update", {
      orderId,
      latitude: 21.152,
      longitude: 79.092,
    });

    await returnTrackingPromise;
    console.log("Vendor live return pickup tracking reached the user in real time.");

    const vendorCancelNewOrderPromise = waitForSocketEvent(
      vendorSocket,
      "notification:new",
      (payload) => payload?.data?.order_id && payload?.title === "New parts order received",
      "vendor new order notification for cancel flow"
    );

    const cancelFlowOrderRes = await api(baseUrl, "/orders", {
      method: "POST",
      jar: priyaSession.jar,
      body: {
        warehouse_id: inventoryItem.warehouse_id,
        delivery_contact_name: "Priya Cancel Realtime",
        delivery_phone: "9876543210",
        delivery_address: "Realtime cancel verification address",
        delivery_city: "Nagpur",
        delivery_state: "Maharashtra",
        delivery_postal_code: "440001",
        items: [{ part_id: inventoryItem.part_id, quantity: 1 }],
      },
    });
    assert(cancelFlowOrderRes.response.ok, `Creating cancel-flow order failed: ${JSON.stringify(cancelFlowOrderRes.data)}`);
    const cancelOrderId = cancelFlowOrderRes.data?.order?.order_id;
    assert(cancelOrderId, "Cancel-flow order ID missing");
    await vendorCancelNewOrderPromise;

    const vendorCancelPromise = waitForSocketEvent(
      vendorSocket,
      "notification:new",
      (payload) => payload?.data?.order_id === cancelOrderId && payload?.title === "Order cancelled by customer",
      "vendor cancellation notification"
    );

    const cancelRes = await api(baseUrl, `/orders/${cancelOrderId}/cancel`, {
      method: "PATCH",
      jar: priyaSession.jar,
    });
    assert(cancelRes.response.ok, `Cancelling order failed: ${JSON.stringify(cancelRes.data)}`);
    await vendorCancelPromise;

    success = true;
    console.log("All realtime flow checks passed.");
  } catch (error) {
    console.error("Realtime flow check failed:", error);
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
