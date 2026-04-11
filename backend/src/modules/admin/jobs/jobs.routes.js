import { Router } from "express";
import { prisma } from "../../../lib/prisma.js";
import { asyncWrapper } from "../../../utils/asyncWrapper.js";
import { AppError } from "../../../utils/AppError.js";
import { userAuth } from "../../../middleware/auth.js";
import { roleGuard } from "../../../middleware/roleGuard.js";
import { listJobsQuery } from "../admin.schemas.js";
import { dateFilter, paginate, logAudit } from "../admin.helpers.js";
import { vehicleDetailSelect } from "../../shared/vehicle.select.js";
import { attachJobRequestVehicleSnapshot } from "../../shared/requestVehicleSnapshot.js";

export const adminJobsRouter = Router();

adminJobsRouter.use(userAuth, roleGuard("admin"));

// ─── GET /admin/jobs ─────────────────────────────────────────
adminJobsRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const q = listJobsQuery.parse(req.query);
    const { skip, take } = paginate(q.page, q.limit);

    const where = { deleted_at: null };
    if (q.status) where.status = q.status;
    if (q.from || q.to) where.started_at = dateFilter(q.from, q.to);

    const [jobs, total] = await Promise.all([
      prisma.job.findMany({
        where,
        skip,
        take,
        include: {
          request: {
            select: { request_id: true, issue_type: true, status: true },
          },
          technician: {
            include: {
              user: { select: { full_name: true, email: true } },
            },
          },
          invoice: {
            select: { invoice_id: true, total: true, payment_status: true },
          },
        },
        orderBy: { started_at: "desc" },
      }),
      prisma.job.count({ where }),
    ]);

    res.json({
      jobs,
      pagination: {
        page: q.page,
        limit: q.limit,
        total,
        totalPages: Math.ceil(total / q.limit),
      },
    });
  })
);

// ─── GET /admin/jobs/:jobId ──────────────────────────────────
adminJobsRouter.get(
  "/:jobId",
  asyncWrapper(async (req, res) => {
    const jobId = req.params.jobId ;

    const job = await prisma.job.findUnique({
      where: { job_id: jobId },
      include: {
        request: {
          include: {
            user: { select: { user_id: true, full_name: true, email: true } },
            vehicle: {
              select: vehicleDetailSelect,
            },
            parts: { include: { part: true } },
          },
        },
        technician: {
          include: {
            user: { select: { full_name: true, email: true, phone_number: true } },
          },
        },
        offer: true,
        invoice: { include: { items: true } },
      },
    });

    if (!job) throw new AppError("Job not found", 404);
    if (job.deleted_at) throw new AppError("Job has been deleted", 404);

    res.json({ job: attachJobRequestVehicleSnapshot(job) });
  })
);

// ─── Admin allowed transitions ───────────────────────────────
const ADMIN_JOB_TRANSITIONS = {
  assigned: ["cancelled"],
  in_progress: ["completed", "cancelled"],
  completed: ["verified"],
};

// ─── PATCH /admin/jobs/:jobId/status ─────────────────────────
// Admin can: verify completed jobs, force-complete, or cancel
adminJobsRouter.patch(
  "/:jobId/status",
  asyncWrapper(async (req, res) => {
    const jobId = req.params.jobId;
    const { status, reason } = req.body;

    if (!status) throw new AppError("Status is required", 400);

    const job = await prisma.job.findUnique({
      where: { job_id: jobId },
      include: {
        request: { select: { request_id: true, status: true } },
      },
    });

    if (!job || job.deleted_at) throw new AppError("Job not found", 404);

    const allowed = ADMIN_JOB_TRANSITIONS[job.status];
    if (!allowed || !allowed.includes(status)) {
      throw new AppError(
        `Cannot transition job from '${job.status}' to '${status}'`,
        400
      );
    }

    const data = { status };
    if (status === "completed") data.completed_at = new Date();
    if (status === "cancelled") data.deleted_at = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const updatedJob = await tx.job.update({
        where: { job_id: job.job_id },
        data,
      });

      // Sync parent request status
      if (status === "completed" || status === "verified") {
        await tx.serviceRequest.update({
          where: { request_id: job.request_id },
          data: { status: "completed" },
        });
      }

      if (status === "cancelled") {
        await tx.serviceRequest.update({
          where: { request_id: job.request_id },
          data: { status: "cancelled" },
        });
      }

      // Audit log
      await logAudit({
        tx,
        entityType: "job",
        entityId: job.job_id,
        action: `admin_${status}`,
        performedBy: req.userId,
        oldValue: { status: job.status },
        newValue: { status, reason: reason || undefined },
      });

      return updatedJob;
    });

    res.json({ message: `Job ${status}`, job: updated });
  })
);
