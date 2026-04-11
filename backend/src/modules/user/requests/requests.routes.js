import { Router } from "express";
import { prisma } from "../../../lib/prisma.js";
import { userAuth } from "../../../middleware/auth.js";
import { roleGuard } from "../../../middleware/roleGuard.js";
import { asyncWrapper } from "../../../utils/asyncWrapper.js";
import { AppError } from "../../../utils/AppError.js";
import { validate } from "../../../middleware/validate.js";
import { createRequestSchema } from "./requests.schemas.js";
import { paginate, paginationQuery } from "../../../utils/paginate.js";
import { haversineDistance, getNearbyTechnicians } from "../../../utils/geo.js";
import { calculateTechnicianScore } from "../../../utils/matchingAlgorithm.js";
import {
  emitAdminDashboardRefresh,
  emitRoleEvent,
  emitUserEvent,
  pushNotification,
  pushRoleNotification,
} from "../../../socket.js";
import {
  vehicleDetailSelect,
  vehicleSummarySelect,
} from "../../shared/vehicle.select.js";
import {
  attachRequestVehicleSnapshot,
  createRequestVehicleSnapshotData,
} from "../../shared/requestVehicleSnapshot.js";
import { rejectExpiredOpenRequests } from "../../shared/requestExpiry.js";
import {
  attachAssignmentWindow,
  isAssignmentExpired,
} from "../../shared/assignmentWindow.js";

export const requestRouter = Router();

requestRouter.use(userAuth, roleGuard("user", "admin"));

function sanitizeRequestJob(serviceRequest) {
  const hydratedRequest = attachRequestVehicleSnapshot(serviceRequest);

  if (!hydratedRequest?.job?.deleted_at) {
    return {
      ...hydratedRequest,
      job: attachAssignmentWindow(hydratedRequest?.job),
    };
  }

  return {
    ...hydratedRequest,
    job: null,
  };
}

// ─── POST /requests ──────────────────────────────────────────
requestRouter.post(
  "/",
  validate(createRequestSchema),
  asyncWrapper(async (req, res) => {
    const {
      vehicle_id,
      issue_description,
      issue_type,
      breakdown_latitude,
      breakdown_longitude,
      service_location_type,
      requires_towing,
      file_ids,
    } = req.body;

    const vehicle = await prisma.userVehicle.findUnique({
      where: { vehicle_id },
      select: vehicleDetailSelect,
    });

    if (!vehicle) {
      throw new AppError("Vehicle not found", 404);
    }

    if (vehicle.user_id !== req.userId) {
      throw new AppError("This vehicle does not belong to you", 403);
    }

    const serviceRequest = await prisma.serviceRequest.create({
      data: {
        user_id: req.userId,
        vehicle_id,
        issue_description,
        issue_type,
        breakdown_latitude,
        breakdown_longitude,
        service_location_type,
        requires_towing,
        ...createRequestVehicleSnapshotData(vehicle),
      },
      include: {
        vehicle: {
          select: vehicleDetailSelect,
        },
      },
    });

    if (file_ids && file_ids.length > 0) {
      await prisma.fileUpload.updateMany({
        where: {
          file_id: { in: file_ids },
          uploader_id: req.userId, // Security check
        },
        data: {
          entity_type: "request",
          entity_id: serviceRequest.request_id,
        },
      });
    }

    emitAdminDashboardRefresh({
      source: "user",
      entity: "service_request",
      action: "created",
      request_id: serviceRequest.request_id,
    });

    emitUserEvent(req.userId, "user:requests_refresh", {
      reason: "request_created",
      request_id: serviceRequest.request_id,
    });
    await pushRoleNotification({
      role: "technician",
      type: "request_created",
      title: "New service request",
      message: "A new customer request is available in Discover.",
      data: {
        request_id: serviceRequest.request_id,
      },
      sendOfflineEmail: false,
    }).catch(() => {});
    emitRoleEvent("technician", "technician:discover_refresh", {
      reason: "request_created",
      request_id: serviceRequest.request_id,
    });

    res.status(201).json({
      message: "Service request created successfully",
      serviceRequest,
    });
  })
);

// ─── GET /requests ───────────────────────────────────────────
requestRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    await rejectExpiredOpenRequests();

    const { status } = req.query;
    const { page, limit } = paginationQuery.parse(req.query);
    const { skip, take } = paginate(page, limit);

    const where = {
      user_id: req.userId,
      deleted_at: null,
    };

    if (status && typeof status === "string") {
      const statuses = status.split(",");
      where.status = { in: statuses };
    }

    const [requests, total] = await Promise.all([
      prisma.serviceRequest.findMany({
        where,
        include: {
          vehicle: {
            select: vehicleDetailSelect,
          },
          offers: { select: { offer_id: true, status: true } },
          job: {
            select: {
              job_id: true,
              status: true,
              deleted_at: true,
              offer: {
                select: {
                  created_at: true,
                  updated_at: true,
                },
              },
            },
          },
        },
        orderBy: { created_at: "desc" },
        skip,
        take,
      }),
      prisma.serviceRequest.count({ where }),
    ]);

    res.json({
      requests: requests.map((request) => sanitizeRequestJob(request)),
      total,
      page,
      limit,
    });
  })
);

// ─── GET /requests/:requestId ────────────────────────────────
requestRouter.get(
  "/:requestId",
  asyncWrapper(async (req, res) => {
    const requestId = req.params.requestId;
    await rejectExpiredOpenRequests({ requestIds: [requestId] });

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { request_id: requestId },
      include: {
        vehicle: {
          select: vehicleDetailSelect,
        },
        parts: { include: { part: true } },
        media: true,
        offers: true,
        job: {
          include: {
            offer: {
              select: {
                created_at: true,
                updated_at: true,
              },
            },
          },
        },
      },
    });

    if (!serviceRequest || serviceRequest.deleted_at) {
      throw new AppError("Service request not found", 404);
    }

    if (serviceRequest.user_id !== req.userId) {
      throw new AppError("You do not have access to this request", 403);
    }

    res.json({ serviceRequest: sanitizeRequestJob(serviceRequest) });
  })
);

// ─── PATCH /requests/:requestId/cancel ───────────────────────
requestRouter.patch(
  "/:requestId/cancel",
  asyncWrapper(async (req, res) => {
    const requestId = req.params.requestId;

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { request_id: requestId },
    });

    if (!serviceRequest) {
      throw new AppError("Service request not found", 404);
    }

    if (serviceRequest.user_id !== req.userId) {
      throw new AppError("You do not have access to this request", 403);
    }

    if (!["created", "pending_offers"].includes(serviceRequest.status)) {
      throw new AppError(
        `Cannot cancel request with status '${serviceRequest.status}'. Only 'created' or 'pending_offers' requests can be cancelled.`,
        400
      );
    }

    const updated = await prisma.serviceRequest.update({
      where: { request_id: requestId },
      data: { status: "cancelled" },
    });

    emitAdminDashboardRefresh({
      source: "user",
      entity: "service_request",
      action: "cancelled",
      request_id: updated.request_id,
    });

    emitUserEvent(req.userId, "user:requests_refresh", {
      reason: "request_cancelled",
      request_id: updated.request_id,
    });
    emitRoleEvent("technician", "technician:discover_refresh", {
      reason: "request_cancelled",
      request_id: updated.request_id,
    });

    res.json({
      message: "Service request cancelled successfully",
      serviceRequest: updated,
    });
  })
);

// ─── GET /requests/:requestId/technicians ─────────────────────
// Retrieve a list of suitable online technicians scored and sorted
// based on distance, rating, and feedback volume.
requestRouter.patch(
  "/:requestId/cancel-booking",
  asyncWrapper(async (req, res) => {
    const requestId = req.params.requestId;

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { request_id: requestId },
      include: {
        job: {
          include: {
            offer: {
              select: {
                created_at: true,
                updated_at: true,
              },
            },
          },
        },
      },
    });

    if (!serviceRequest || serviceRequest.deleted_at) {
      throw new AppError("Service request not found", 404);
    }

    if (serviceRequest.user_id !== req.userId) {
      throw new AppError("You do not have access to this request", 403);
    }

    if (serviceRequest.status !== "offer_accepted") {
      throw new AppError(
        `Cannot cancel the pending technician confirmation when request status is '${serviceRequest.status}'.`,
        400
      );
    }

    if (!serviceRequest.job || serviceRequest.job.deleted_at) {
      throw new AppError(
        "No pending technician confirmation was found for this request",
        400
      );
    }

    if (serviceRequest.job.status !== "assigned") {
      throw new AppError(
        "The technician has already responded to this booking request",
        400
      );
    }

    const technicianProfile = await prisma.technicianProfile.findUnique({
      where: { technician_id: serviceRequest.job.technician_id },
      select: { user_id: true },
    });

    const result = await prisma.$transaction(async (tx) => {
      const freshRequest = await tx.serviceRequest.findUnique({
        where: { request_id: requestId },
        include: {
          job: {
            include: {
              offer: {
                select: {
                  created_at: true,
                  updated_at: true,
                },
              },
            },
          },
        },
      });

      if (!freshRequest || freshRequest.deleted_at) {
        throw new AppError("Service request not found", 404);
      }

      if (freshRequest.status !== "offer_accepted") {
        throw new AppError(
          `Cannot cancel the pending technician confirmation when request status is '${freshRequest.status}'.`,
          400
        );
      }

      if (
        !freshRequest.job ||
        freshRequest.job.deleted_at ||
        freshRequest.job.status !== "assigned"
      ) {
        throw new AppError(
          "The technician has already responded to this booking request",
          400
        );
      }

      await tx.job.delete({
        where: { job_id: freshRequest.job.job_id },
      });

      await tx.technicianOffer.update({
        where: { offer_id: freshRequest.job.offer_id },
        data: { status: "rejected" },
      });

      const remainingOffers = await tx.technicianOffer.count({
        where: {
          request_id: requestId,
          status: { in: ["pending", "accepted"] },
        },
      });

      const updatedRequest = await tx.serviceRequest.update({
        where: { request_id: requestId },
        data: {
          status: remainingOffers > 0 ? "pending_offers" : "created",
        },
      });

      return {
        updatedRequest,
        cancelledJobId: freshRequest.job.job_id,
      };
    });

    if (technicianProfile?.user_id) {
      await pushNotification({
        userId: technicianProfile.user_id,
        type: "offer_rejected",
        title: "Booking cancelled",
        message:
          "The customer cancelled the booking before you confirmed it. The request has been reopened.",
        data: {
          request_id: requestId,
        },
      }).catch(() => {});
    }

    emitAdminDashboardRefresh({
      source: "user",
      entity: "job",
      action: "cancelled_before_confirmation",
      job_id: result.cancelledJobId,
      request_id: requestId,
    });

    emitUserEvent(req.userId, "user:requests_refresh", {
      reason: "booking_cancelled",
      request_id: requestId,
      job_id: result.cancelledJobId,
    });
    emitUserEvent(req.userId, "user:jobs_refresh", {
      reason: "booking_cancelled",
      request_id: requestId,
      job_id: result.cancelledJobId,
    });

    if (technicianProfile?.user_id) {
      emitUserEvent(technicianProfile.user_id, "technician:assignments_refresh", {
        reason: "booking_cancelled",
        request_id: requestId,
        job_id: result.cancelledJobId,
      });
      emitUserEvent(technicianProfile.user_id, "technician:jobs_refresh", {
        reason: "booking_cancelled",
        request_id: requestId,
        job_id: result.cancelledJobId,
      });
      emitUserEvent(technicianProfile.user_id, "technician:dashboard_refresh", {
        reason: "booking_cancelled",
        request_id: requestId,
        job_id: result.cancelledJobId,
      });
    }

    emitRoleEvent("technician", "technician:discover_refresh", {
      reason: "booking_cancelled",
      request_id: requestId,
      job_id: result.cancelledJobId,
    });

    res.json({
      message: "Pending technician confirmation cancelled successfully",
      serviceRequest: result.updatedRequest,
    });
  })
);

requestRouter.patch(
  "/:requestId/close-booking",
  asyncWrapper(async (req, res) => {
    const requestId = req.params.requestId;

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { request_id: requestId },
      include: {
        job: {
          include: {
            offer: {
              select: {
                created_at: true,
                updated_at: true,
              },
            },
          },
        },
      },
    });

    if (!serviceRequest || serviceRequest.deleted_at) {
      throw new AppError("Service request not found", 404);
    }

    if (serviceRequest.user_id !== req.userId) {
      throw new AppError("You do not have access to this request", 403);
    }

    if (serviceRequest.status !== "offer_accepted") {
      throw new AppError(
        `Cannot close the pending technician confirmation when request status is '${serviceRequest.status}'.`,
        400
      );
    }

    if (
      !serviceRequest.job ||
      serviceRequest.job.deleted_at ||
      serviceRequest.job.status !== "assigned"
    ) {
      throw new AppError(
        "The technician has already responded to this booking request",
        400
      );
    }

    if (!isAssignmentExpired(serviceRequest.job)) {
      throw new AppError(
        "You can close this request after the 5 minute technician confirmation timer ends.",
        400
      );
    }

    const technicianProfile = await prisma.technicianProfile.findUnique({
      where: { technician_id: serviceRequest.job.technician_id },
      select: { user_id: true },
    });

    const result = await prisma.$transaction(async (tx) => {
      const freshRequest = await tx.serviceRequest.findUnique({
        where: { request_id: requestId },
        include: {
          job: {
            include: {
              offer: {
                select: {
                  created_at: true,
                  updated_at: true,
                },
              },
            },
          },
        },
      });

      if (!freshRequest || freshRequest.deleted_at) {
        throw new AppError("Service request not found", 404);
      }

      if (freshRequest.status !== "offer_accepted") {
        throw new AppError(
          `Cannot close the pending technician confirmation when request status is '${freshRequest.status}'.`,
          400
        );
      }

      if (
        !freshRequest.job ||
        freshRequest.job.deleted_at ||
        freshRequest.job.status !== "assigned"
      ) {
        throw new AppError(
          "The technician has already responded to this booking request",
          400
        );
      }

      if (!isAssignmentExpired(freshRequest.job)) {
        throw new AppError(
          "You can close this request after the 5 minute technician confirmation timer ends.",
          400
        );
      }

      await tx.job.delete({
        where: { job_id: freshRequest.job.job_id },
      });

      await tx.technicianOffer.update({
        where: { offer_id: freshRequest.job.offer_id },
        data: { status: "expired" },
      });

      const updatedRequest = await tx.serviceRequest.update({
        where: { request_id: requestId },
        data: { status: "cancelled" },
      });

      return {
        updatedRequest,
        closedJobId: freshRequest.job.job_id,
      };
    });

    if (technicianProfile?.user_id) {
      await pushNotification({
        userId: technicianProfile.user_id,
        type: "offer_rejected",
        title: "Booking closed",
        message:
          "The customer closed the booking after the confirmation timer ended.",
        data: {
          request_id: requestId,
        },
      }).catch(() => {});
    }

    emitAdminDashboardRefresh({
      source: "user",
      entity: "job",
      action: "closed_after_assignment_timeout",
      job_id: result.closedJobId,
      request_id: requestId,
    });

    emitUserEvent(req.userId, "user:requests_refresh", {
      reason: "booking_closed_after_timeout",
      request_id: requestId,
      job_id: result.closedJobId,
    });
    emitUserEvent(req.userId, "user:jobs_refresh", {
      reason: "booking_closed_after_timeout",
      request_id: requestId,
      job_id: result.closedJobId,
    });

    if (technicianProfile?.user_id) {
      emitUserEvent(technicianProfile.user_id, "technician:assignments_refresh", {
        reason: "booking_closed_after_timeout",
        request_id: requestId,
        job_id: result.closedJobId,
      });
      emitUserEvent(technicianProfile.user_id, "technician:jobs_refresh", {
        reason: "booking_closed_after_timeout",
        request_id: requestId,
        job_id: result.closedJobId,
      });
      emitUserEvent(technicianProfile.user_id, "technician:dashboard_refresh", {
        reason: "booking_closed_after_timeout",
        request_id: requestId,
        job_id: result.closedJobId,
      });
    }

    emitRoleEvent("technician", "technician:discover_refresh", {
      reason: "booking_closed_after_timeout",
      request_id: requestId,
      job_id: result.closedJobId,
    });

    res.json({
      message: "Request closed successfully",
      serviceRequest: result.updatedRequest,
    });
  })
);

requestRouter.get(
  "/:requestId/technicians",
  asyncWrapper(async (req, res) => {
    const requestId = req.params.requestId;
    await rejectExpiredOpenRequests({ requestIds: [requestId] });

    const request = await prisma.serviceRequest.findUnique({
      where: { request_id: requestId },
      include: {
        vehicle: {
          select: vehicleDetailSelect,
        },
        parts: {
          select: {
            part_id: true,
            quantity: true,
          },
        },
      },
    });

    if (!request || request.deleted_at) {
      throw new AppError("Service request not found", 404);
    }
    if (request.status !== "created" && request.status !== "pending_offers") {
      throw new AppError("Request is no longer accepting new technicians.", 400);
    }

    // Must be online and active
    const reqLat = request.breakdown_latitude;
    const reqLng = request.breakdown_longitude;

    // Try Redis GEORADIUS for fast spatial queries — returns null if Redis is unavailable
    let nearbyRedisTechs = null;
    if (reqLat != null && reqLng != null) {
      nearbyRedisTechs = await getNearbyTechnicians(reqLng, reqLat, 50);
    }

    const usingRedis = nearbyRedisTechs !== null;
    const redisTechIds = usingRedis ? nearbyRedisTechs.map(t => t.id) : [];

    // If Redis is available and returned IDs, filter by those; otherwise fetch all active techs (DB fallback)
    const candidateProfiles = await prisma.technicianProfile.findMany({
      where: {
        is_verified: true,
        user: { is_active: true },
        // is_online: true,    // Uncomment when online/offline toggle is enforced
        ...(usingRedis && redisTechIds.length > 0 ? { technician_id: { in: redisTechIds } } : {})
      },
      include: {
        user: { select: { full_name: true, phone_number: true, is_active: true } },
        carSupports: true,
        partSkills: {
          select: {
            part_id: true,
          },
        },
      },
    });

    const userCompanyId = request.vehicle?.variant?.model?.company?.company_id;
    const userVariantId = request.vehicle?.variant?.variant_id;
    const MAX_RADIUS_KM = 50;
    const requestPartIds = request.parts.map((part) => part.part_id);

    const rankedTechnicians = candidateProfiles.map(tech => {
      // ── Car Support Check ─────────────────────────────────────
      // Pass if:
      //  (a) Tech supports all cars (no carSupports rows)
      //  (b) We couldn't determine user's car company (vehicle data incomplete)
      //  (c) Tech explicitly supports this company/variant
      const hasCarSupports = tech.carSupports.length > 0;
      let carMatch = false;

      if (!hasCarSupports) {
        // Supports all cars — always a match
        carMatch = true;
      } else if (!userCompanyId) {
        // Can't determine user's car — don't penalize the tech, show them anyway
        carMatch = true;
      } else {
        const companySupports = tech.carSupports.filter(cs => cs.company_id === userCompanyId);
        if (companySupports.length > 0) {
          const supportsAllVariants = companySupports.some(cs => cs.variant_id === null);
          const supportsSpecificVariant = userVariantId
            ? companySupports.some(cs => cs.variant_id === userVariantId)
            : false;
          if (supportsAllVariants || supportsSpecificVariant) {
            carMatch = true;
          }
        }
      }

      // ── Distance Calculation ──────────────────────────────────
      let distance_km = null;
      if (usingRedis) {
        const redisData = nearbyRedisTechs.find(rt => rt.id === tech.technician_id);
        distance_km = redisData ? redisData.distance : null;
      }

      // Haversine fallback: used when Redis is down OR Redis had no data for this tech
      if (distance_km === null && reqLat != null && reqLng != null && tech.latitude != null && tech.longitude != null) {
        distance_km = haversineDistance(tech.latitude, tech.longitude, reqLat, reqLng);
      }

      // ── Distance Filter ──────────────────────────────────────
      // Only drop a tech when we KNOW their real distance AND it exceeds radius.
      // If tech has no lat/lng in their profile → show them with unknown distance (don't silently drop).
      if (carMatch && reqLat != null && reqLng != null && distance_km !== null) {
        const radius = Math.min(tech.service_radius || MAX_RADIUS_KM, MAX_RADIUS_KM);
        if (distance_km > radius) {
          carMatch = false; // Confirmed too far away
        }
      }

      // Calculate Score
      const score = calculateTechnicianScore(tech, distance_km, {
        requestPartIds,
      });

      return {
        ...tech,
        carMatch,
        distance_km,
        matchScore: score,
      };
    })
      .filter(tech => tech.carMatch) // Only valid candidates
      .sort((a, b) => b.matchScore - a.matchScore); // Highest score first

    res.json({ technicians: rankedTechnicians, source: usingRedis ? "redis" : "db" });
  })
);

// ─── POST /requests/:requestId/book ───────────────────────────
// Directly book a specific technician. This creates a pending
// assignment that the technician still needs to confirm.
requestRouter.post(
  "/:requestId/book",
  asyncWrapper(async (req, res) => {
    const requestId = req.params.requestId;
    const { technician_id } = req.body;

    if (!technician_id) throw new AppError("technician_id is required", 400);

    await rejectExpiredOpenRequests({ requestIds: [requestId] });

    const request = await prisma.serviceRequest.findUnique({
      where: { request_id: requestId },
      include: {
        job: true,
        offers: true,
      },
    });

    if (!request || request.deleted_at) {
      throw new AppError("Service request not found", 404);
    }
    if (req.userRole !== "admin" && request.user_id !== req.userId) {
      throw new AppError("You do not have access to this request", 403);
    }
    if (!["created", "pending_offers"].includes(request.status)) {
      throw new AppError(
        `Cannot book a technician when request status is '${request.status}'`,
        400
      );
    }
    if (request.job && !request.job.deleted_at) {
      throw new AppError("This request is already assigned to a job.", 400);
    }

    const techProfile = await prisma.technicianProfile.findUnique({
      where: { technician_id },
      include: {
        user: {
          select: {
            is_active: true,
          },
        },
      },
    });

    if (!techProfile) throw new AppError("Technician not found", 404);
    if (!techProfile.is_verified || !techProfile.user?.is_active) {
      throw new AppError("This technician is not available for booking", 400);
    }

    const { job } = await prisma.$transaction(async (tx) => {
      const freshRequest = await tx.serviceRequest.findUnique({
        where: { request_id: requestId },
        include: {
          job: true,
          offers: true,
        },
      });

      if (!freshRequest || freshRequest.deleted_at) {
        throw new AppError("Service request not found", 404);
      }
      if (freshRequest.job?.deleted_at) {
        await tx.job.delete({
          where: { job_id: freshRequest.job.job_id },
        });
        freshRequest.job = null;
      }

      if (freshRequest.job) {
        throw new AppError("This request is already assigned to a job.", 400);
      }
      if (!["created", "pending_offers"].includes(freshRequest.status)) {
        throw new AppError(
          `Cannot book a technician when request status is '${freshRequest.status}'`,
          400
        );
      }

      const competingAcceptedOffer = freshRequest.offers.find(
        (offer) =>
          offer.status === "accepted" && offer.technician_id !== technician_id
      );
      if (competingAcceptedOffer) {
        throw new AppError(
          "Another technician has already been selected for this request.",
          400
        );
      }

      let targetOffer = freshRequest.offers.find(
        (offer) => offer.technician_id === technician_id
      );

      if (!targetOffer) {
        targetOffer = await tx.technicianOffer.create({
          data: {
            request_id: requestId,
            technician_id,
            repair_mode: "onsite",
            estimated_cost: 0,
            estimated_time: 30,
            message:
              "User selected you directly. Please confirm this assignment from your dashboard.",
            status: "accepted",
          },
        });
      } else {
        targetOffer = await tx.technicianOffer.update({
          where: { offer_id: targetOffer.offer_id },
          data: {
            status: "accepted",
            message:
              targetOffer.message ||
              "User selected you directly. Please confirm this assignment from your dashboard.",
          },
        });
      }

      const createdJob = await tx.job.create({
        data: {
          request_id: requestId,
          technician_id,
          offer_id: targetOffer.offer_id,
          status: "assigned",
        },
      });

      await tx.serviceRequest.update({
        where: { request_id: requestId },
        data: { status: "offer_accepted" },
      });

      await tx.technicianOffer.updateMany({
        where: {
          request_id: requestId,
          offer_id: { not: targetOffer.offer_id },
          status: "pending",
        },
        data: { status: "rejected" },
      });

      return { job: createdJob };
    });

    await pushNotification({
      userId: techProfile.user_id,
      type: "job_assigned",
      title: "New Booking Request",
      message:
        "A user selected you directly for a service request. Please confirm or reject it from Pending Assignments.",
      data: { job_id: job.job_id, request_id: requestId },
    });

    emitAdminDashboardRefresh({
      source: "user",
      entity: "job",
      action: "booked",
      job_id: job.job_id,
      request_id: requestId,
    });

    emitUserEvent(req.userId, "user:requests_refresh", {
      reason: "technician_booked",
      request_id: requestId,
      job_id: job.job_id,
    });
    emitUserEvent(req.userId, "user:jobs_refresh", {
      reason: "technician_booked",
      request_id: requestId,
      job_id: job.job_id,
    });
    emitUserEvent(techProfile.user_id, "technician:assignments_refresh", {
      reason: "job_booked",
      request_id: requestId,
      job_id: job.job_id,
    });
    emitUserEvent(techProfile.user_id, "technician:jobs_refresh", {
      reason: "job_booked",
      request_id: requestId,
      job_id: job.job_id,
    });
    emitUserEvent(techProfile.user_id, "technician:dashboard_refresh", {
      reason: "job_booked",
      request_id: requestId,
      job_id: job.job_id,
    });
    emitRoleEvent("technician", "technician:discover_refresh", {
      reason: "request_booked",
      request_id: requestId,
      job_id: job.job_id,
    });

    res.status(201).json({
      message:
        "Booking request sent successfully. Waiting for technician confirmation.",
      job,
    });
  })
);
