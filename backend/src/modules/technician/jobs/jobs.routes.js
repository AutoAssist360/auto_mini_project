import { Router } from "express";
import Decimal from "decimal.js";
import { prisma } from "../../../lib/prisma.js";
import { asyncWrapper } from "../../../utils/asyncWrapper.js";
import { AppError } from "../../../utils/AppError.js";
import { userAuth } from "../../../middleware/auth.js";
import { roleGuard } from "../../../middleware/roleGuard.js";
import { validate } from "../../../middleware/validate.js";
import {
  updateJobStatusSchema,
  suggestPartsSchema,
  createInvoiceSchema,
} from "../technician.schemas.js";
import { paginate, paginationQuery } from "../../../utils/paginate.js";
import {
  clearTrackingLocation,
  emitUserEvent,
  getIO,
  pushNotification,
} from "../../../socket.js";
import { emitAdminDashboardRefresh } from "../../../socket.js";
import { vehicleDetailSelect } from "../../shared/vehicle.select.js";
import { attachJobRequestVehicleSnapshot } from "../../shared/requestVehicleSnapshot.js";

export const techJobsRouter = Router();

techJobsRouter.use(userAuth, roleGuard("technician"));

/** Allowed job status transitions */
const ALLOWED_TRANSITIONS = {
  assigned: ["in_progress"],
  in_progress: ["completed"],
};
const STANDARD_INVOICE_TAX_RATE = 18;

/** Helper: get technicianProfile or throw */
async function getTechProfile(userId) {
  const profile = await prisma.technicianProfile.findUnique({
    where: { user_id: userId },
  });
  if (!profile) throw new AppError("Technician profile not found", 404);
  return profile;
}

/** Helper: get job owned by this technician */
async function getOwnedJob(jobId, technicianId) {
  const job = await prisma.job.findUnique({ where: { job_id: jobId } });
  if (!job || job.deleted_at) throw new AppError("Job not found", 404);
  if (job.technician_id !== technicianId) {
    throw new AppError("Not authorized for this job", 403);
  }
  return job;
}

// ─── GET /tech/jobs ─────────────────────────────────────────────
techJobsRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const profile = await getTechProfile(req.userId);

    const status = req.query.status || undefined;
    const { page, limit } = paginationQuery.parse(req.query);
    const { skip, take } = paginate(page, limit);
    const where = {
      technician_id: profile.technician_id,
      deleted_at: null,
    };
    if (status) where.status = status;

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        include: {
          request: {
            select: {
              request_id: true,
              issue_description: true,
              issue_type: true,
              service_location_type: true,
              status: true,
            },
          },
          offer: {
            select: {
              repair_mode: true,
              estimated_cost: true,
              estimated_time: true,
            },
          },
          invoice: {
            select: { invoice_id: true, total: true, payment_status: true },
          },
        },
        orderBy: { started_at: "desc" },
        skip,
        take,
      }),
      prisma.job.count({ where }),
    ]);

    res.json({ jobs, total, page, limit });
  })
);

// ─── GET /tech/jobs/:jobId ──────────────────────────────────────
techJobsRouter.get(
  "/:jobId",
  asyncWrapper(async (req, res) => {
    const profile = await getTechProfile(req.userId);

    const jobId = req.params.jobId;

    const job = await prisma.job.findUnique({
      where: { job_id: jobId },
      include: {
        request: {
          include: {
            vehicle: {
              select: vehicleDetailSelect,
            },
            parts: { include: { part: true } },
            media: true,
          },
        },
        offer: true,
        invoice: { include: { items: true } },
      },
    });

    if (!job || job.deleted_at) throw new AppError("Job not found", 404);
    if (job.technician_id !== profile.technician_id) {
      throw new AppError("Not authorized for this job", 403);
    }

    res.json({ job: attachJobRequestVehicleSnapshot(job) });
  })
);

// ─── PATCH /tech/jobs/:jobId/status ─────────────────────────────
techJobsRouter.patch(
  "/:jobId/status",
  validate(updateJobStatusSchema),
  asyncWrapper(async (req, res) => {
    const profile = await getTechProfile(req.userId);
    const job = await getOwnedJob(req.params.jobId, profile.technician_id);

    const { status } = req.body;
    const allowed = ALLOWED_TRANSITIONS[job.status];
    if (!allowed || !allowed.includes(status)) {
      throw new AppError(
        `Cannot transition from '${job.status}' to '${status}'`,
        400
      );
    }

    const data = { status };
    if (status === "in_progress") data.started_at = new Date();
    if (status === "completed") data.completed_at = new Date();

    // Update job AND sync parent ServiceRequest status in a transaction
    const updated = await prisma.$transaction(async (tx) => {
      const updatedJob = await tx.job.update({
        where: { job_id: job.job_id },
        data,
      });

      // Sync ServiceRequest status
      const requestStatusMap = {
        in_progress: "in_progress",
        completed: "completed",
      };
      const newRequestStatus = requestStatusMap[status];
      if (newRequestStatus) {
        await tx.serviceRequest.update({
          where: { request_id: job.request_id },
          data: { status: newRequestStatus },
        });
      }

      return updatedJob;
    });

    emitAdminDashboardRefresh({
      source: "technician",
      entity: "job",
      action: "status_updated",
      job_id: updated.job_id,
      status,
    });

    emitUserEvent(req.userId, "technician:jobs_refresh", {
      reason: "job_status_updated",
      job_id: updated.job_id,
      status,
    });
    emitUserEvent(req.userId, "technician:dashboard_refresh", {
      reason: "job_status_updated",
      job_id: updated.job_id,
      status,
    });

    res.json({ message: "Job status updated", job: updated });

    // Push socket notification to user
    try {
      const request = await prisma.serviceRequest.findUnique({
        where: { request_id: job.request_id },
        select: { user_id: true },
      });
      if (request) {
        const notifType = status === "in_progress" ? "job_started" : "job_completed";
        const notifTitle = status === "in_progress" ? "Job Started" : "Job Completed";
        const notifMsg = status === "in_progress"
          ? "Your technician has started working on your request."
          : "Your technician has completed the job. Please review the work.";
        await pushNotification({
          userId: request.user_id,
          type: notifType,
          title: notifTitle,
          message: notifMsg,
          data: { jobId: job.job_id, requestId: job.request_id },
        });
        if (status === "completed") {
          clearTrackingLocation(job.job_id);
        }
        emitUserEvent(request.user_id, "user:requests_refresh", {
          reason: "job_status_updated",
          job_id: job.job_id,
          request_id: job.request_id,
          status,
        });
        emitUserEvent(request.user_id, "user:jobs_refresh", {
          reason: "job_status_updated",
          job_id: job.job_id,
          request_id: job.request_id,
          status,
        });
        const io = getIO();
        io.to(`tracking:${job.job_id}`).emit("job:status_update", { jobId: job.job_id, status });
      }
    } catch { /* socket not ready */ }
  })
);

// ─── POST /tech/jobs/:jobId/suggest-parts ───────────────────────
techJobsRouter.post(
  "/:jobId/suggest-parts",
  validate(suggestPartsSchema),
  asyncWrapper(async (req, res) => {
    const profile = await getTechProfile(req.userId);
    const job = await getOwnedJob(req.params.jobId, profile.technician_id);

    if (job.status !== "in_progress") {
      throw new AppError("Parts can only be suggested for in-progress jobs", 400);
    }

    const { parts } = req.body;

    // Validate all parts exist
    const partIds = parts.map((p) => p.part_id);
    const existingParts = await prisma.carPart.findMany({
      where: { part_id: { in: partIds } },
    });
    if (existingParts.length !== partIds.length) {
      throw new AppError("One or more part IDs are invalid", 400);
    }

    // Add parts to the service request (skip duplicates)
    const created = await prisma.serviceRequestPart.createMany({
      data: parts.map((p) => ({
        request_id: job.request_id,
        part_id: p.part_id,
        quantity: p.quantity,
      })),
      skipDuplicates: true,
    });

    emitAdminDashboardRefresh({
      source: "technician",
      entity: "service_request_parts",
      action: "suggested",
      request_id: job.request_id,
      count: created.count,
    });

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { request_id: job.request_id },
      select: { user_id: true },
    });

    if (serviceRequest?.user_id) {
      await pushNotification({
        userId: serviceRequest.user_id,
        type: "order_update",
        title: "Parts suggested",
        message: "Your technician suggested parts for this job. Please review them in your request details.",
        data: {
          job_id: job.job_id,
          request_id: job.request_id,
        },
      }).catch(() => {});

      emitUserEvent(serviceRequest.user_id, "user:requests_refresh", {
        reason: "parts_suggested",
        job_id: job.job_id,
        request_id: job.request_id,
      });
      emitUserEvent(serviceRequest.user_id, "user:jobs_refresh", {
        reason: "parts_suggested",
        job_id: job.job_id,
        request_id: job.request_id,
      });
    }

    res.status(201).json({
      message: "Parts suggested",
      count: created.count,
    });
  })
);

// ─── POST /tech/jobs/:jobId/complete ────────────────────────────
techJobsRouter.post(
  "/:jobId/complete",
  asyncWrapper(async (req, res) => {
    const profile = await getTechProfile(req.userId);
    const job = await getOwnedJob(req.params.jobId, profile.technician_id);

    if (job.status !== "in_progress") {
      throw new AppError("Only in-progress jobs can be completed", 400);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const updatedJob = await tx.job.update({
        where: { job_id: job.job_id },
        data: { status: "completed", completed_at: new Date() },
      });

      await tx.serviceRequest.update({
        where: { request_id: job.request_id },
        data: { status: "completed" },
      });

      return updatedJob;
    });

    emitAdminDashboardRefresh({
      source: "technician",
      entity: "job",
      action: "completed",
      job_id: updated.job_id,
    });

    emitUserEvent(req.userId, "technician:jobs_refresh", {
      reason: "job_completed",
      job_id: updated.job_id,
    });
    emitUserEvent(req.userId, "technician:dashboard_refresh", {
      reason: "job_completed",
      job_id: updated.job_id,
    });
    const request = await prisma.serviceRequest.findUnique({
      where: { request_id: job.request_id },
      select: { user_id: true },
    });
    if (request?.user_id) {
      emitUserEvent(request.user_id, "user:requests_refresh", {
        reason: "job_completed",
        job_id: updated.job_id,
        request_id: job.request_id,
      });
      emitUserEvent(request.user_id, "user:jobs_refresh", {
        reason: "job_completed",
        job_id: updated.job_id,
        request_id: job.request_id,
      });
    }

    clearTrackingLocation(job.job_id);

    try {
      const io = getIO();
      io.to(`tracking:${job.job_id}`).emit("job:status_update", {
        jobId: job.job_id,
        status: "completed",
      });
    } catch { /* socket not ready */ }

    res.json({ message: "Job completed", job: updated });
  })
);

// ─── POST /tech/jobs/:jobId/invoice ─────────────────────────────
techJobsRouter.post(
  "/:jobId/invoice",
  validate(createInvoiceSchema),
  asyncWrapper(async (req, res) => {
    const profile = await getTechProfile(req.userId);
    const job = await getOwnedJob(req.params.jobId, profile.technician_id);

    if (job.status !== "completed") {
      throw new AppError("Invoice can only be created for completed jobs", 400);
    }

    // Check if invoice already exists
    const existing = await prisma.invoice.findUnique({
      where: { job_id: job.job_id },
    });
    if (existing) {
      throw new AppError("Invoice has already been created for this job", 409);
    }

    const { items } = req.body;

    // Calculate totals using Decimal to avoid floating-point errors
    const invoiceItems = items.map((item) => {
      const unitPrice = new Decimal(item.unit_price);
      const totalPrice = unitPrice.times(item.quantity);
      return {
        item_type: item.item_type,
        description: item.description,
        quantity: item.quantity,
        unit_price: unitPrice,
        total_price: totalPrice,
      };
    });

    const subtotal = invoiceItems.reduce(
      (sum, item) => sum.plus(item.total_price),
      new Decimal(0)
    );
    const tax = subtotal.times(STANDARD_INVOICE_TAX_RATE).div(100);
    const total = subtotal.plus(tax);

    const invoice = await prisma.invoice.create({
      data: {
        job_id: job.job_id,
        subtotal,
        tax,
        total,
        payment_status: "pending",
        items: {
          create: invoiceItems.map((item) => ({
            item_type: item.item_type,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
          })),
        },
      },
      include: { items: true },
    });

    emitAdminDashboardRefresh({
      source: "technician",
      entity: "invoice",
      action: "created",
      invoice_id: invoice.invoice_id,
      job_id: job.job_id,
    });

    emitUserEvent(req.userId, "technician:jobs_refresh", {
      reason: "invoice_created",
      invoice_id: invoice.invoice_id,
      job_id: job.job_id,
    });
    emitUserEvent(req.userId, "technician:dashboard_refresh", {
      reason: "invoice_created",
      invoice_id: invoice.invoice_id,
      job_id: job.job_id,
    });

    const serviceRequest = await prisma.serviceRequest.findUnique({
      where: { request_id: job.request_id },
      select: { user_id: true },
    });

    if (serviceRequest?.user_id) {
      emitUserEvent(serviceRequest.user_id, "user:jobs_refresh", {
        reason: "invoice_created",
        invoice_id: invoice.invoice_id,
        job_id: job.job_id,
        request_id: job.request_id,
      });
      emitUserEvent(serviceRequest.user_id, "user:requests_refresh", {
        reason: "invoice_created",
        invoice_id: invoice.invoice_id,
        job_id: job.job_id,
        request_id: job.request_id,
      });

      await pushNotification({
        userId: serviceRequest.user_id,
        type: "invoice_created",
        title: "Invoice Created",
        message: "Your technician has generated an invoice for the completed job.",
        data: {
          invoiceId: invoice.invoice_id,
          jobId: job.job_id,
          requestId: job.request_id,
        },
      }).catch(() => {});
    }

    res.status(201).json({ message: "Invoice created", invoice });
  })
);
