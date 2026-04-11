import { Router } from "express";
import { prisma } from "../../../lib/prisma.js";
import { asyncWrapper } from "../../../utils/asyncWrapper.js";
import { userAuth } from "../../../middleware/auth.js";
import { roleGuard } from "../../../middleware/roleGuard.js";
import { paginate, paginationQuery } from "../../../utils/paginate.js";

export const partsRouter = Router();

partsRouter.use(userAuth, roleGuard("user", "admin", "vendor", "technician"));

// ─── GET /parts ───────────────────────────────────────────────
// Browse all available car parts with vendor inventory prices.
// Supports: ?search=<name>&category_id=<id>&in_stock=true&page=&limit=
partsRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const { page, limit } = paginationQuery.parse(req.query);
    const { skip, take } = paginate(page, limit);
    const { search, category_id, in_stock } = req.query;

    const where = {};

    // Text search on part name
    if (search && typeof search === "string" && search.trim()) {
      where.part_name = { contains: search.trim(), mode: "insensitive" };
    }

    // Filter by category
    if (category_id) {
      const catId = Number(category_id);
      if (!Number.isNaN(catId) && catId > 0) {
        where.category_id = catId;
      }
    }

    const parts = await prisma.carPart.findMany({
      where,
      orderBy: { part_name: "asc" },
      skip,
      take,
      select: {
        part_id: true,
        part_name: true,
        category: { select: { category_id: true, category_name: true } },
        inventories: {
          where: {
            quantity_available: { gt: 0 },
            warehouse: { is_active: true },
          },
          select: {
            inventory_id: true,
            unit_cost: true,
            quantity_available: true,
            quantity_reserved: true,
            warehouse: {
              select: {
                warehouse_id: true,
                name: true,
                city: true,
                state: true,
                is_active: true,
              },
            },
          },
          orderBy: { unit_cost: "asc" },
        },
      },
    });

    const total = await prisma.carPart.count({ where });

    // Enrich each part with derived availability data
    let enriched = parts.map((p) => {
      const availableInventories = p.inventories.filter(
        (inv) => inv.quantity_available - inv.quantity_reserved > 0
      );
      const bestPrice =
        availableInventories.length > 0
          ? Number(availableInventories[0].unit_cost)
          : null;
      const totalAvailable = availableInventories.reduce(
        (sum, inv) => sum + (inv.quantity_available - inv.quantity_reserved),
        0
      );

      return {
        part_id: p.part_id,
        part_name: p.part_name,
        category: p.category,
        best_price: bestPrice,
        total_available: totalAvailable,
        in_stock: totalAvailable > 0,
        warehouses: availableInventories.map((inv) => ({
          inventory_id: inv.inventory_id,
          warehouse_id: inv.warehouse.warehouse_id,
          warehouse_name: inv.warehouse.name,
          city: inv.warehouse.city,
          state: inv.warehouse.state,
          unit_cost: Number(inv.unit_cost),
          available_qty: inv.quantity_available - inv.quantity_reserved,
        })),
      };
    });

    // Client-side in_stock filter (after DB query, since it's computed)
    if (in_stock === "true") {
      enriched = enriched.filter((p) => p.in_stock);
    }

    res.json({
      parts: enriched,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  })
);

// ─── GET /parts/categories ────────────────────────────────────
// List all part categories for filter dropdowns
partsRouter.get(
  "/categories",
  asyncWrapper(async (_req, res) => {
    const categories = await prisma.carPartCategory.findMany({
      orderBy: { category_name: "asc" },
      select: { category_id: true, category_name: true },
    });
    res.json({ categories });
  })
);

// ─── GET /parts/:partId ───────────────────────────────────────
// Get a single part with full inventory details
partsRouter.get(
  "/:partId",
  asyncWrapper(async (req, res) => {
    const partId = Number(req.params.partId);
    if (Number.isNaN(partId) || partId <= 0) {
      return res.status(400).json({ message: "Invalid part ID" });
    }

    const part = await prisma.carPart.findUnique({
      where: { part_id: partId },
      select: {
        part_id: true,
        part_name: true,
        category: { select: { category_id: true, category_name: true } },
        inventories: {
          where: { warehouse: { is_active: true } },
          select: {
            inventory_id: true,
            unit_cost: true,
            quantity_available: true,
            quantity_reserved: true,
            warehouse: {
              select: {
                warehouse_id: true,
                name: true,
                city: true,
                state: true,
                phone: true,
              },
            },
          },
          orderBy: { unit_cost: "asc" },
        },
      },
    });

    if (!part) {
      return res.status(404).json({ message: "Part not found" });
    }

    const enrichedInventories = part.inventories.map((inv) => ({
      inventory_id: inv.inventory_id,
      warehouse_id: inv.warehouse.warehouse_id,
      warehouse_name: inv.warehouse.name,
      city: inv.warehouse.city,
      state: inv.warehouse.state,
      phone: inv.warehouse.phone,
      unit_cost: Number(inv.unit_cost),
      available_qty: inv.quantity_available - inv.quantity_reserved,
      total_qty: inv.quantity_available,
      in_stock: inv.quantity_available - inv.quantity_reserved > 0,
    }));

    res.json({
      part: {
        part_id: part.part_id,
        part_name: part.part_name,
        category: part.category,
        inventories: enrichedInventories,
        best_price:
          enrichedInventories.length > 0 ? enrichedInventories[0].unit_cost : null,
        in_stock: enrichedInventories.some((i) => i.in_stock),
      },
    });
  })
);
