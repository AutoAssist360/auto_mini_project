import { Router } from "express";
import { prisma } from "../../../lib/prisma.js";
import { asyncWrapper } from "../../../utils/asyncWrapper.js";
import { AppError } from "../../../utils/AppError.js";
import { userAuth } from "../../../middleware/auth.js";
import { roleGuard } from "../../../middleware/roleGuard.js";
import { requireVendorVerification } from "../../../middleware/vendorVerification.js";
import { validate } from "../../../middleware/validate.js";
import {
  createWarehouseSchema,
  updateWarehouseSchema,
  listWarehousesQuery,
} from "../vendor.schemas.js";
import { paginate } from "../vendor.helpers.js";
import { emitAdminDashboardRefresh } from "../../../socket.js";

export const vendorWarehousesRouter = Router();
vendorWarehousesRouter.use(userAuth, roleGuard("vendor"), requireVendorVerification);

// ─── POST /vendor/warehouses ─────────────────────────────────
vendorWarehousesRouter.post(
  "/",
  validate(createWarehouseSchema),
  asyncWrapper(async (req, res) => {
    const warehouse = await prisma.warehouse.create({
      data: { ...req.body, vendor_id: req.userId },
    });

    emitAdminDashboardRefresh({
      source: "vendor",
      entity: "warehouse",
      action: "created",
      warehouse_id: warehouse.warehouse_id,
    });

    res.status(201).json({ message: "Warehouse created", warehouse });
  })
);

// ─── GET /vendor/warehouses ──────────────────────────────────
vendorWarehousesRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const { page, limit, is_active } = listWarehousesQuery.parse(req.query);
    const { skip, take } = paginate(page, limit);

    const where = { vendor_id: req.userId };
    if (is_active !== undefined) where.is_active = is_active;

    const [warehouses, total] = await Promise.all([
      prisma.warehouse.findMany({
        where,
        skip,
        take,
        orderBy: { created_at: "desc" },
        include: {
          _count: { select: { inventories: true, orders: true } },
        },
      }),
      prisma.warehouse.count({ where }),
    ]);

    res.json({ warehouses, total, page, limit });
  })
);

// ─── GET /vendor/warehouses/:warehouseId ─────────────────────
vendorWarehousesRouter.get(
  "/:warehouseId",
  asyncWrapper(async (req, res) => {
    const { warehouseId } = req.params;

    const warehouse = await prisma.warehouse.findUnique({
      where: { warehouse_id: warehouseId  },
      include: {
        _count: { select: { inventories: true, orders: true } },
      },
    });

    if (!warehouse || warehouse.vendor_id !== req.userId)
      throw new AppError("Warehouse not found", 404);

    res.json({ warehouse });
  })
);

// ─── PUT /vendor/warehouses/:warehouseId ─────────────────────
vendorWarehousesRouter.put(
  "/:warehouseId",
  validate(updateWarehouseSchema),
  asyncWrapper(async (req, res) => {
    const { warehouseId } = req.params;

    const existing = await prisma.warehouse.findUnique({
      where: { warehouse_id: warehouseId  },
    });
    if (!existing || existing.vendor_id !== req.userId)
      throw new AppError("Warehouse not found", 404);

    const warehouse = await prisma.warehouse.update({
      where: { warehouse_id: warehouseId  },
      data: req.body,
    });

    emitAdminDashboardRefresh({
      source: "vendor",
      entity: "warehouse",
      action: "updated",
      warehouse_id: warehouse.warehouse_id,
    });

    res.json({ message: "Warehouse updated", warehouse });
  })
);

// ─── DELETE /vendor/warehouses/:warehouseId (soft-deactivate) ─
vendorWarehousesRouter.delete(
  "/:warehouseId",
  asyncWrapper(async (req, res) => {
    const { warehouseId } = req.params;

    const existing = await prisma.warehouse.findUnique({
      where: { warehouse_id: warehouseId  },
    });
    if (!existing || existing.vendor_id !== req.userId)
      throw new AppError("Warehouse not found", 404);

    await prisma.warehouse.update({
      where: { warehouse_id: warehouseId  },
      data: { is_active: false },
    });

    emitAdminDashboardRefresh({
      source: "vendor",
      entity: "warehouse",
      action: "deactivated",
      warehouse_id: warehouseId,
    });

    res.json({ message: "Warehouse deactivated" });
  })
);
