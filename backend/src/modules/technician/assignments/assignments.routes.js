import { Router } from "express";
import { prisma } from "../../../lib/prisma.js";
import { asyncWrapper } from "../../../utils/asyncWrapper.js";
import { AppError } from "../../../utils/AppError.js";
import { userAuth } from "../../../middleware/auth.js";
import { roleGuard } from "../../../middleware/roleGuard.js";
import {
  emitAdminDashboardRefresh,
  emitRoleEvent,
  emitUserEvent,
  pushNotification,
} from "../../../socket.js";
import {
  attachAssignmentWindow,
  isAssignmentExpired,
} from "../../shared/assignmentWindow.js";

export const techAssignmentsRouter = Router();

techAssignmentsRouter.use(userAuth, roleGuard("technician"));

/** Helper: get technicianProfile or throw */
async function getTechProfile(userId) {
  const profile = await prisma.technicianProfile.findUnique({
    where: { user_id: userId },
  });
  if (!profile) throw new AppError("Technician profile not found", 404);
  return profile;
}

// ─── GET /tech/assignments/pending ──────────────────────────────
// Lists all accepted offers that resulted in jobs in "assigned" state
techAssignmentsRouter.get(
  "/pending",
  asyncWrapper(async (req, res) => {
    const profile = await getTechProfile(req.userId);

    const pendingJobs = await prisma.job.findMany({
      where: {
        technician_id: profile.technician_id,
        status: "assigned",
        deleted_at: null,
      },
      include: {
        request: {
          select: {
            request_id: true,
            issue_description: true,
            issue_type: true,
            service_location_type: true,
            breakdown_latitude: true,
            breakdown_longitude: true,
            status: true,
          },
        },
        offer: {
          select: {
            offer_id: true,
            repair_mode: true,
            estimated_cost: true,
            estimated_time: true,
            created_at: true,
            updated_at: true,
          },
        },
      },
      orderBy: { started_at: "desc" },
    });

    const activePendingJobs = pendingJobs.filter(
      (job) => !isAssignmentExpired(job)
    );

    res.json({ assignments: activePendingJobs.map(attachAssignmentWindow) });
  })
);

// ─── POST /tech/assignments/:attemptId/accept ───────────────────
techAssignmentsRouter.post(
  "/:attemptId/accept",
  asyncWrapper(async (req, res) => {
    const profile = await getTechProfile(req.userId);
    const attemptId = req.params.attemptId ;

    const job = await prisma.job.findUnique({
      where: { job_id: attemptId },
      include: {
        request: true,
        offer: {
          select: {
            created_at: true,
            updated_at: true,
          },
        },
      },
    });

    if (!job) throw new AppError("Assignment not found", 404);
    if (job.deleted_at) throw new AppError("Assignment has been deleted", 404);
    if (job.technician_id !== profile.technician_id) {
      throw new AppError("Not authorized for this assignment", 403);
    }
    if (job.status !== "assigned") {
      throw new AppError("Assignment is no longer in 'assigned' state", 400);
    }
    if (isAssignmentExpired(job)) {
      throw new AppError(
        "Assignment expired. Ask the customer to resend the request.",
        400
      );
    }

    // Use transaction to prevent TOCTOU race on active job check
    const updated = await prisma.$transaction(async (tx) => {
      // Re-check job status inside transaction
      const freshJob = await tx.job.findUnique({
        where: { job_id: job.job_id },
        include: {
          offer: {
            select: {
              created_at: true,
              updated_at: true,
            },
          },
        },
      });
      if (!freshJob || freshJob.status !== "assigned") {
        throw new AppError("Assignment is no longer in 'assigned' state", 400);
      }
      if (isAssignmentExpired(freshJob)) {
        throw new AppError(
          "Assignment expired. Ask the customer to resend the request.",
          400
        );
      }

      // Prevent technician from having multiple active jobs
      const existingActive = await tx.job.findFirst({
        where: {
          technician_id: profile.technician_id,
          status: "in_progress",
          deleted_at: null,
          job_id: { not: job.job_id },
        },
      });
      if (existingActive) {
        throw new AppError("You already have an active job in progress", 400);
      }

      const updatedJob = await tx.job.update({
        where: { job_id: job.job_id },
        data: { status: "in_progress", started_at: new Date() },
      });

      await tx.serviceRequest.update({
        where: { request_id: job.request_id },
        data: { status: "in_progress" },
      });

      return updatedJob;
    });

    await pushNotification({
      userId: job.request.user_id,
      type: "job_started",
      title: "Technician Confirmed",
      message:
        "Your selected technician accepted the assignment and the job is now in progress.",
      data: {
        request_id: job.request_id,
        job_id: job.job_id,
      },
    });

    emitAdminDashboardRefresh({
      source: "technician",
      entity: "job",
      action: "accepted",
      job_id: job.job_id,
      request_id: job.request_id,
    });

    emitUserEvent(req.userId, "technician:assignments_refresh", {
      reason: "assignment_accepted",
      request_id: job.request_id,
      job_id: job.job_id,
    });
    emitUserEvent(req.userId, "technician:jobs_refresh", {
      reason: "assignment_accepted",
      request_id: job.request_id,
      job_id: job.job_id,
    });
    emitUserEvent(req.userId, "technician:dashboard_refresh", {
      reason: "assignment_accepted",
      request_id: job.request_id,
      job_id: job.job_id,
    });
    emitUserEvent(job.request.user_id, "user:requests_refresh", {
      reason: "assignment_accepted",
      request_id: job.request_id,
      job_id: job.job_id,
    });
    emitUserEvent(job.request.user_id, "user:jobs_refresh", {
      reason: "assignment_accepted",
      request_id: job.request_id,
      job_id: job.job_id,
    });

    res.json({ message: "Assignment accepted", job: updated });
  })
);

// ─── POST /tech/assignments/:attemptId/reject ───────────────────
techAssignmentsRouter.post(
  "/:attemptId/reject",
  asyncWrapper(async (req, res) => {
    const profile = await getTechProfile(req.userId);
    const attemptId = req.params.attemptId ;

    const job = await prisma.job.findUnique({
      where: { job_id: attemptId },
      include: { request: true },
    });

    if (!job) throw new AppError("Assignment not found", 404);
    if (job.deleted_at) throw new AppError("Assignment has been deleted", 404);
    if (job.technician_id !== profile.technician_id) {
      throw new AppError("Not authorized for this assignment", 403);
    }
    if (job.status !== "assigned") {
      throw new AppError("Assignment is no longer in 'assigned' state", 400);
    }

    await prisma.$transaction(async (tx) => {
      // Remove the pending assignment entirely so the request can be booked again.
      await tx.job.delete({
        where: { job_id: job.job_id },
      });

      // Revert the offer so another tech can be matched
      await tx.technicianOffer.update({
        where: { offer_id: job.offer_id },
        data: { status: "rejected" },
      });

      // Check if there are remaining pending/accepted offers
      const remainingOffers = await tx.technicianOffer.count({
        where: {
          request_id: job.request_id,
          status: { in: ["pending", "accepted"] },
        },
      });

      // Revert request status depending on remaining offers
      await tx.serviceRequest.update({
        where: { request_id: job.request_id },
        data: {
          status: remainingOffers > 0 ? "pending_offers" : "created",
        },
      });
    });

    await pushNotification({
      userId: job.request.user_id,
      type: "offer_rejected",
      title: "Technician Declined",
      message:
        "The selected technician could not accept your request. Please choose another technician or wait for more offers.",
      data: {
        request_id: job.request_id,
      },
    });

    emitAdminDashboardRefresh({
      source: "technician",
      entity: "job",
      action: "rejected",
      job_id: job.job_id,
      request_id: job.request_id,
    });

    emitUserEvent(req.userId, "technician:assignments_refresh", {
      reason: "assignment_rejected",
      request_id: job.request_id,
      job_id: job.job_id,
    });
    emitUserEvent(req.userId, "technician:jobs_refresh", {
      reason: "assignment_rejected",
      request_id: job.request_id,
      job_id: job.job_id,
    });
    emitUserEvent(req.userId, "technician:dashboard_refresh", {
      reason: "assignment_rejected",
      request_id: job.request_id,
      job_id: job.job_id,
    });
    emitUserEvent(job.request.user_id, "user:requests_refresh", {
      reason: "assignment_rejected",
      request_id: job.request_id,
      job_id: job.job_id,
    });
    emitRoleEvent("technician", "technician:discover_refresh", {
      reason: "assignment_rejected",
      request_id: job.request_id,
      job_id: job.job_id,
    });

    res.json({ message: "Assignment rejected" });
  })
);
