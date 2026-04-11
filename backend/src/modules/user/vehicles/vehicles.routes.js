import { Router } from "express";
import { randomUUID } from "node:crypto";
import { prisma } from "../../../lib/prisma.js";
import { userAuth } from "../../../middleware/auth.js";
import { roleGuard } from "../../../middleware/roleGuard.js";
import { asyncWrapper } from "../../../utils/asyncWrapper.js";
import { AppError } from "../../../utils/AppError.js";
import { validate } from "../../../middleware/validate.js";
import { addVehicleSchema, updateVehicleSchema } from "./vehicles.schemas.js";
import {
  vehicleDetailSelect,
  vehicleSummarySelect,
} from "../../shared/vehicle.select.js";
import { createRequestVehicleSnapshotData } from "../../shared/requestVehicleSnapshot.js";

export const vehicleRouter = Router();

vehicleRouter.use(userAuth, roleGuard("user", "admin"));

function normalizeRegistrationNumber(value) {
  return value.trim().toUpperCase();
}

// ─── GET /vehicles/companies ─────────────────────────────────
vehicleRouter.get(
  "/companies",
  asyncWrapper(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    const where = q
      ? { company_name: { contains: q, mode: "insensitive" } }
      : undefined;

    const companies = await prisma.carCompany.findMany({
      where,
      orderBy: { company_name: "asc" },
      select: { company_id: true, company_name: true },
    });

    res.json({ companies });
  })
);

// ─── GET /vehicles/companies/:companyId/models ───────────────
vehicleRouter.get(
  "/companies/:companyId/models",
  asyncWrapper(async (req, res) => {
    const companyId = Number(req.params.companyId);
    if (Number.isNaN(companyId) || companyId <= 0) {
      return res.status(400).json({ message: "Invalid company ID" });
    }

    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";

    const where = { company_id: companyId };
    if (q) {
      where.model_name = { contains: q, mode: "insensitive" };
    }

    const models = await prisma.carModel.findMany({
      where,
      orderBy: { model_name: "asc" },
      select: { model_id: true, model_name: true, company_id: true },
    });

    res.json({ models });
  })
);

// ─── GET /vehicles/models/:modelId/variants ──────────────────
vehicleRouter.get(
  "/models/:modelId/variants",
  asyncWrapper(async (req, res) => {
    const modelId = Number(req.params.modelId);
    if (Number.isNaN(modelId) || modelId <= 0) {
      return res.status(400).json({ message: "Invalid model ID" });
    }

    const variants = await prisma.carVariant.findMany({
      where: { model_id: modelId },
      orderBy: [{ variant_name: "asc" }, { year: "desc" }],
      select: {
        variant_id: true,
        variant_name: true,
        year: true,
        fuel_type: true,
        transmission: true,
      },
    });

    res.json({ variants });
  })
);

// ─── GET /vehicles/variants ──────────────────────────────────
vehicleRouter.get(
  "/variants",
  asyncWrapper(async (req, res) => {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const limitRaw = Number.parseInt(String(req.query.limit ?? "50"), 10);
    const limit = Number.isNaN(limitRaw) ? 50 : Math.min(Math.max(limitRaw, 1), 200);

    const where = q
      ? {
          OR: [
            { variant_name: { contains: q, mode: "insensitive" } },
            { model: { model_name: { contains: q, mode: "insensitive" } } },
            {
              model: {
                company: {
                  company_name: { contains: q, mode: "insensitive" },
                },
              },
            },
          ],
        }
      : undefined;

    const variants = await prisma.carVariant.findMany({
      where,
      include: {
        model: {
          include: {
            company: true,
          },
        },
      },
      orderBy: [{ model: { company: { company_name: "asc" } } }, { model: { model_name: "asc" } }, { variant_name: "asc" }],
      take: limit,
    });

    res.json({ variants, total: variants.length, limit, query: q || null });
  })
);

// ─── POST /vehicles ──────────────────────────────────────────
vehicleRouter.post(
  "/",
  validate(addVehicleSchema),
  asyncWrapper(async (req, res) => {
    const { variant_id, registration_number, vin_number } = req.body;
    const normalizedRegistration = normalizeRegistrationNumber(registration_number);
    const normalizedVin = vin_number?.trim() ? vin_number.trim().toUpperCase() : null;

    const variant = await prisma.carVariant.findUnique({
      where: { variant_id },
    });
    if (!variant) {
      throw new AppError("Car variant not found", 404);
    }

    // Build OR conditions — only add vin_number filter when it was actually provided
    const duplicateOrConditions = [{ registration_number }];
    if (vin_number) duplicateOrConditions.push({ vin_number });

    const duplicate = await prisma.userVehicle.findFirst({
      where: {
        deleted_at: null,
        OR: duplicateOrConditions.map((condition) =>
          condition.registration_number
            ? { registration_number: normalizedRegistration }
            : { vin_number: normalizedVin }
        ),
      },
      select: vehicleSummarySelect,
    });
    if (duplicate) {
      throw new AppError("Vehicle with this registration number or VIN already exists", 409);
    }

    const vehicle = await prisma.userVehicle.create({
      data: {
        user_id: req.userId,
        variant_id,
        registration_number: normalizedRegistration,
        ...(normalizedVin ? { vin_number: normalizedVin } : {}),
      },
      include: {
        variant: {
          include: { model: { include: { company: true } } },
        },
      },
    });

    res.status(201).json({
      message: "Vehicle added successfully",
      vehicle,
    });
  })
);

// ─── GET /vehicles ───────────────────────────────────────────
vehicleRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const vehicles = await prisma.userVehicle.findMany({
      where: { user_id: req.userId, deleted_at: null },
      select: vehicleDetailSelect,
    });

    res.json({ vehicles });
  })
);

// ─── PUT /vehicles/:vehicleId ────────────────────────────────
vehicleRouter.put(
  "/:vehicleId",
  validate(updateVehicleSchema),
  asyncWrapper(async (req, res) => {
    const vehicleId = req.params.vehicleId;

    const vehicle = await prisma.userVehicle.findUnique({
      where: { vehicle_id: vehicleId },
      select: vehicleDetailSelect,
    });

    if (!vehicle) {
      throw new AppError("Vehicle not found", 404);
    }

    if (vehicle.deleted_at) {
      throw new AppError("Vehicle not found", 404);
    }

    if (vehicle.user_id !== req.userId) {
      throw new AppError("You do not have access to this vehicle", 403);
    }

    const { variant_id, registration_number, vin_number } = req.body;
    const normalizedRegistration =
      registration_number !== undefined
        ? normalizeRegistrationNumber(registration_number)
        : undefined;
    const normalizedVin =
      vin_number !== undefined
        ? vin_number.trim()
          ? vin_number.trim().toUpperCase()
          : null
        : undefined;

    if (normalizedRegistration || normalizedVin !== undefined) {
      const duplicate = await prisma.userVehicle.findFirst({
        where: {
          deleted_at: null,
          vehicle_id: { not: vehicleId },
          OR: [
            ...(normalizedRegistration
              ? [{ registration_number: normalizedRegistration }]
              : []),
            ...(normalizedVin ? [{ vin_number: normalizedVin }] : []),
          ],
        },
        select: vehicleSummarySelect,
      });
      if (duplicate) {
        throw new AppError("Vehicle with this registration number or VIN already exists", 409);
      }
    }

    const updated = await prisma.userVehicle.update({
      where: { vehicle_id: vehicleId },
      data: {
        ...(variant_id !== undefined && { variant_id }),
        ...(normalizedRegistration !== undefined && {
          registration_number: normalizedRegistration,
        }),
        ...(normalizedVin !== undefined && { vin_number: normalizedVin }),
      },
      select: vehicleDetailSelect,
    });

    res.json({
      message: "Vehicle updated successfully",
      vehicle: updated,
    });
  })
);

// ─── DELETE /vehicles/:vehicleId ─────────────────────────────
vehicleRouter.delete(
  "/:vehicleId",
  asyncWrapper(async (req, res) => {
    const vehicleId = req.params.vehicleId;

    const vehicle = await prisma.userVehicle.findUnique({
      where: { vehicle_id: vehicleId },
      select: vehicleSummarySelect,
    });

    if (!vehicle) {
      throw new AppError("Vehicle not found", 404);
    }

    if (vehicle.user_id !== req.userId) {
      throw new AppError("You do not have access to this vehicle", 403);
    }

    if (vehicle.deleted_at) {
      throw new AppError("Vehicle not found", 404);
    }

    const linkedRequestCount = await prisma.serviceRequest.count({
      where: { vehicle_id: vehicleId },
    });

    if (linkedRequestCount === 0) {
      await prisma.userVehicle.delete({
        where: { vehicle_id: vehicleId },
        select: { vehicle_id: true },
      });

      return res.json({ message: "Vehicle deleted successfully" });
    }

    const archiveRegistration = `ARCHIVED-${randomUUID()}`;
    const snapshotData = createRequestVehicleSnapshotData(vehicle);

    await prisma.$transaction(async (tx) => {
      await tx.serviceRequest.updateMany({
        where: {
          vehicle_id: vehicleId,
          vehicle_registration_snapshot: null,
        },
        data: snapshotData,
      });

      await tx.userVehicle.update({
        where: { vehicle_id: vehicleId },
        data: {
          registration_number: archiveRegistration,
          vin_number: null,
          deleted_at: new Date(),
        },
      });
    });

    res.json({
      message: "Vehicle removed from your fleet. Existing request history has been preserved.",
    });
  })
);
