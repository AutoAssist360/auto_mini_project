import { getRedisClient, isRedisReady } from "../lib/redis.js";

export const TECHNICIAN_LOCATIONS_KEY = "technician_locations";
export const TECHNICIAN_LOCATION_TTL_SECONDS = 60 * 60;

function getTechnicianLocationTtlKey(technicianId) {
  return `technician_location_ttl:${technicianId}`;
}

/**
 * Haversine distance calculator returns distance in kilometres
 * between two lat/lng coordinate pairs.
 *
 * @param {number} lat1  Latitude of point A (degrees)
 * @param {number} lon1  Longitude of point A (degrees)
 * @param {number} lat2  Latitude of point B (degrees)
 * @param {number} lon2  Longitude of point B (degrees)
 * @returns {number}     Distance in km (rounded to 2 decimals)
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371; // Earth's mean radius in km
  const toRad = (deg) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c * 100) / 100;
}

/**
 * Updates a technician's real-time location in the Redis GEO cache.
 * No-ops gracefully if Redis is not available.
 * @param {string} technicianId
 * @param {number} lon
 * @param {number} lat
 */
export async function updateTechnicianLocation(technicianId, lon, lat) {
  if (!technicianId || !Number.isFinite(lon) || !Number.isFinite(lat) || !isRedisReady()) {
    return false;
  }

  try {
    const client = getRedisClient();
    const pipeline = client.multi();

    // Keep the geo index and activity marker aligned for best-effort cache freshness.
    pipeline.geoadd(TECHNICIAN_LOCATIONS_KEY, lon, lat, technicianId);
    pipeline.set(
      getTechnicianLocationTtlKey(technicianId),
      "active",
      "EX",
      TECHNICIAN_LOCATION_TTL_SECONDS
    );

    await pipeline.exec();
    return true;
  } catch (error) {
    console.error("[Geo] Failed to update technician location in Redis:", error.message);
    return false;
  }
}

/**
 * Retrieves technician IDs within a radius using Redis GEO search.
 * Returns null if Redis is unavailable so callers can fall back to DB.
 * @param {number} lon
 * @param {number} lat
 * @param {number} radiusKm
 * @returns {Promise<{id: string, distance: number}[] | null>}
 */
export async function getNearbyTechnicians(lon, lat, radiusKm = 50) {
  if (!isRedisReady()) {
    return null;
  }

  try {
    const client = getRedisClient();
    const results = await client.georadius(
      TECHNICIAN_LOCATIONS_KEY,
      lon,
      lat,
      radiusKm,
      "km",
      "WITHDIST",
      "ASC"
    );

    if (results.length === 0) {
      return [];
    }

    const technicianIds = results.map(([technicianId]) => technicianId);
    const ttlValues = await client.mget(
      technicianIds.map(getTechnicianLocationTtlKey)
    );

    const activeTechnicians = [];
    const staleTechnicianIds = [];

    results.forEach(([technicianId, distance], index) => {
      if (ttlValues[index]) {
        activeTechnicians.push({
          id: technicianId,
          distance: parseFloat(distance),
        });
        return;
      }

      staleTechnicianIds.push(technicianId);
    });

    if (staleTechnicianIds.length > 0) {
      const cleanupPipeline = client.multi();
      for (const technicianId of staleTechnicianIds) {
        cleanupPipeline.zrem(TECHNICIAN_LOCATIONS_KEY, technicianId);
        cleanupPipeline.del(getTechnicianLocationTtlKey(technicianId));
      }
      await cleanupPipeline.exec();
    }

    return activeTechnicians;
  } catch (error) {
    console.error("[Geo] Failed to fetch nearby technicians from Redis:", error.message);
    return null;
  }
}
