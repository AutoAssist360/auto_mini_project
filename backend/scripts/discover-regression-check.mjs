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
  assert(jar.accessToken, `Access token cookie missing for ${email}`);
  return { jar };
}

async function main() {
  const server = createServer(app);
  initSocket(server);
  let success = false;

  try {
    await new Promise((resolve) => server.listen(0, resolve));
    const address = server.address();
    const baseUrl = `http://127.0.0.1:${address.port}`;

    console.log(`Running discover regression check against ${baseUrl}`);

    const technicianSession = await login(baseUrl, "/tech/auth/signin", "tech1@test.com");

    const initialDiscoverRes = await api(baseUrl, "/tech/discover?page=1&limit=100", {
      method: "GET",
      jar: technicianSession.jar,
    });
    assert(initialDiscoverRes.response.ok, `Initial discover API failed: ${JSON.stringify(initialDiscoverRes.data)}`);

    const candidateRequest = (initialDiscoverRes.data?.requests || [])[0];
    assert(candidateRequest?.request_id, "No discoverable technician request was available for the regression check");
    const requestId = candidateRequest.request_id;

    const oldCreatedAt = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    await prisma.serviceRequest.update({
      where: { request_id: requestId },
      data: {
        created_at: oldCreatedAt,
      },
    });

    const discoverRes = await api(baseUrl, "/tech/discover?page=1&limit=100", {
      method: "GET",
      jar: technicianSession.jar,
    });
    assert(discoverRes.response.ok, `Discover API failed: ${JSON.stringify(discoverRes.data)}`);

    const matchingRequest = (discoverRes.data?.requests || []).find(
      (request) => request.request_id === requestId
    );

    assert(
      matchingRequest,
      "Older open request was not returned by technician discover results"
    );

    console.log("Older open requests remain visible in technician discover results.");
    success = true;
  } catch (error) {
    console.error("Discover regression check failed:", error);
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
