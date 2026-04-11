// backend/src/lib/redis.js
import Redis from "ioredis";

const REDIS_URL = process.env.REDIS_URL || null; // No fallback to localhost — require explicit config

let redisClient = null;
let isRedisAvailable = false;

if (REDIS_URL) {
  try {
    redisClient = new Redis(REDIS_URL, {
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
      retryStrategy(times) {
        if (times >= 3) {
          console.warn("[Redis] Max reconnect attempts reached. Redis will be disabled.");
          return null; // Stop retrying
        }
        return Math.min(times * 500, 3000);
      },
    });

    redisClient.on("connect", () => {
      isRedisAvailable = true;
      console.log("[Redis] Connected successfully ✓");
    });

    redisClient.on("error", (err) => {
      if (isRedisAvailable) {
        console.error("[Redis] Connection lost:", err.message);
      }
      isRedisAvailable = false;
    });

    redisClient.on("end", () => {
      isRedisAvailable = false;
      console.warn("[Redis] Connection closed.");
    });

    // Attempt connection (non-blocking)
    redisClient.connect().catch((err) => {
      console.warn("[Redis] Could not connect:", err.message, "— Redis features will be disabled.");
      isRedisAvailable = false;
    });
  } catch (err) {
    console.warn("[Redis] Initialization failed:", err.message, "— Redis features will be disabled.");
    redisClient = null;
  }
} else {
  console.info("[Redis] REDIS_URL not set — Redis features disabled. Set REDIS_URL in .env to enable.");
}

/**
 * Returns the Redis client if available, or null.
 * Always check `isRedisReady()` before using the client.
 */
export function getRedisClient() {
  return redisClient;
}

/**
 * Returns true if Redis is currently connected and ready.
 */
export function isRedisReady() {
  return isRedisAvailable && redisClient !== null;
}

// Legacy exports for backward compatibility
export const redis = new Proxy({}, {
  get(_, prop) {
    if (!redisClient) {
      return async () => { throw new Error("Redis is not configured"); };
    }
    const val = redisClient[prop];
    return typeof val === "function" ? val.bind(redisClient) : val;
  }
});
