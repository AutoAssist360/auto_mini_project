import { Router } from "express";
import { prisma } from "../../../lib/prisma.js";
import { asyncWrapper } from "../../../utils/asyncWrapper.js";
import { AppError } from "../../../utils/AppError.js";
import { userAuth } from "../../../middleware/auth.js";
import { roleGuard } from "../../../middleware/roleGuard.js";
import { paginate, paginationQuery } from "../../../utils/paginate.js";
import { haversineDistance } from "../../../utils/geo.js";
import { vehicleDetailSelect } from "../../shared/vehicle.select.js";
import { attachRequestVehicleSnapshot } from "../../shared/requestVehicleSnapshot.js";
import { rejectExpiredOpenRequests } from "../../shared/requestExpiry.js";

export const techDiscoveryRouter = Router();

techDiscoveryRouter.use(userAuth, roleGuard("technician"));

// ─── GET /tech/discover ────────────────────────────────────────
// Returns open service requests (status = created | pending_offers)
// that the current technician has NOT already submitted an offer for.
//
// Smart filtering & sorting (production-grade):
//  1. Excludes requests the tech already offered on
//  2. Filters by distance (within tech's service_radius) when coords available
//  3. Checks car brand/model support (TechnicianCarSupport)
//  4. Sorts by: distance ASC → rating DESC → created_at DESC
//  5. Returns distance_km + car_match flag per request
techDiscoveryRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    await rejectExpiredOpenRequests();

    // ── 1. Get technician profile with car support info ──
    const profile = await prisma.technicianProfile.findUnique({
      where: { user_id: req.userId },
      include: {
        carSupports: {
          select: { company_id: true, variant_id: true },
        },
      },
    });
    if (!profile) throw new AppError("Technician profile not found", 404);

    const { page, limit } = paginationQuery.parse(req.query);

    // ── 2. Find request IDs where this tech already has an active offer ──
    const existingOffers = await prisma.technicianOffer.findMany({
      where: {
        technician_id: profile.technician_id,
        status: { in: ["pending", "accepted"] },
      },
      select: { request_id: true },
    });
    const excludedRequestIds = existingOffers.map((o) => o.request_id);

    const where = {
      status: { in: ["created", "pending_offers"] },
      deleted_at: null,
      ...(excludedRequestIds.length > 0
        ? { request_id: { notIn: excludedRequestIds } }
        : {}),
    };

    // ── 3. Fetch ALL matching requests (we filter/sort in JS for geo+matching) ──
    const allRequests = await prisma.serviceRequest.findMany({
      where,
      include: {
        vehicle: {
          select: vehicleDetailSelect,
        },
        user: {
          select: { full_name: true },
        },
        offers: {
          select: { status: true, updated_at: true },
        },
        _count: {
          select: { offers: true },
        },
      },
      orderBy: { created_at: "desc" },
    });

    const techLat = profile.latitude;
    const techLng = profile.longitude;
    const techRadius = profile.service_radius || 50; // default 50 km

    // Build a set of supported company IDs for quick lookup
    const supportedCompanyIds = new Set(
      profile.carSupports.map((cs) => cs.company_id)
    );
    const supportedVariantIds = new Set(
      profile.carSupports
        .filter((cs) => cs.variant_id)
        .map((cs) => cs.variant_id)
    );
    const hasCarSupports = profile.carSupports.length > 0;

    // ── 4. Enrich, filter, and sort ──
    const enriched = allRequests
      .map((r) => {
        // Distance calculation
        let distance_km = null;
        if (
          techLat != null &&
          techLng != null &&
          r.breakdown_latitude != null &&
          r.breakdown_longitude != null
        ) {
          distance_km = haversineDistance(
            techLat,
            techLng,
            r.breakdown_latitude,
            r.breakdown_longitude
          );
        }

        // Car brand/model match
        const requestCompanyId =
          r.vehicle?.variant?.model?.company?.company_id ?? null;
        const requestVariantId = r.vehicle?.variant?.variant_id ?? null;

        let car_match = false;
        if (!hasCarSupports) {
          // Technician hasn't set car supports — match everything
          car_match = true;
        } else if (requestCompanyId && supportedCompanyIds.has(requestCompanyId)) {
          // Company matches; check if variant-level restriction applies
          if (supportedVariantIds.size === 0) {
            car_match = true; // company-level support only
          } else if (
            requestVariantId &&
            supportedVariantIds.has(requestVariantId)
          ) {
            car_match = true;
          } else if (
            // Check if this company has ANY entry without variant_id (= supports all variants)
            profile.carSupports.some(
              (cs) =>
                cs.company_id === requestCompanyId && cs.variant_id === null
            )
          ) {
            car_match = true;
          }
        }

        return { ...r, distance_km, car_match };
      })
      // ── Filter: within service_radius (if both coords exist) ──
      .filter((r) => {
        if (r.distance_km !== null && r.distance_km > techRadius) return false;

        // Verify if 5-minute discover window has expired
        const now = Date.now();
        const activeOffers = r.offers?.filter((o) => ["pending", "accepted"].includes(o.status)) || [];
        if (activeOffers.length === 0) {
          const closedOffers = r.offers?.filter((o) => ["rejected", "withdrawn", "cancelled"].includes(o.status)) || [];
          let baseTime = new Date(r.created_at).getTime();
          if (closedOffers.length > 0) {
            const latestClosed = Math.max(...closedOffers.map((o) => new Date(o.updated_at).getTime()));
            if (latestClosed > baseTime) {
              baseTime = latestClosed;
            }
          }
          const expiryTime = baseTime + 5 * 60 * 1000;
          if (now > expiryTime) {
            return false; // Skip it!
          }
        }
        return true;
      })
      // ── Sort: car_match first → distance ASC → newest first ──
      .sort((a, b) => {
        const createdAtDiff = new Date(b.created_at) - new Date(a.created_at);
        if (createdAtDiff !== 0) return createdAtDiff;

        // Car match requests first
        if (a.car_match && !b.car_match) return -1;
        if (!a.car_match && b.car_match) return 1;

        // Then by distance (closest first), nulls last
        if (a.distance_km !== null && b.distance_km !== null) {
          if (a.distance_km !== b.distance_km)
            return a.distance_km - b.distance_km;
        }
        if (a.distance_km !== null && b.distance_km === null) return -1;
        if (a.distance_km === null && b.distance_km !== null) return 1;

        return 0;
      });

    // ── 5. Paginate the enriched list ──
    const total = enriched.length;
    const { skip, take } = paginate(page, limit);
    const paginatedRequests = enriched.slice(skip, skip + take);

    res.json({
      requests: paginatedRequests.map(attachRequestVehicleSnapshot),
      total,
      page,
      limit,
    });
  })
);

// ─── GET /tech/discover/:requestId ─────────────────────────────
// Returns a single request's full detail for the offer modal.
techDiscoveryRouter.get(
  "/:requestId",
  asyncWrapper(async (req, res) => {
    await rejectExpiredOpenRequests({ requestIds: [req.params.requestId] });

    const profile = await prisma.technicianProfile.findUnique({
      where: { user_id: req.userId },
    });
    if (!profile) throw new AppError("Technician profile not found", 404);

    const request = await prisma.serviceRequest.findUnique({
      where: { request_id: req.params.requestId },
      include: {
        vehicle: {
          select: vehicleDetailSelect,
        },
        user: {
          select: { full_name: true, phone_number: true },
        },
        parts: { include: { part: true } },
        _count: { select: { offers: true } },
      },
    });

    if (!request || request.deleted_at) {
      throw new AppError("Service request not found", 404);
    }
    if (request.status !== "created" && request.status !== "pending_offers") {
      throw new AppError("Request is no longer accepting offers", 400);
    }

    // Check if tech already has an offer
    const existingOffer = await prisma.technicianOffer.findFirst({
      where: {
        request_id: request.request_id,
        technician_id: profile.technician_id,
        status: { in: ["pending", "accepted"] },
      },
    });

    res.json({
      request: attachRequestVehicleSnapshot(request),
      already_offered: !!existingOffer,
    });
  })
);
