import { Router } from "express";
import { prisma } from "../../../lib/prisma.js";
import { asyncWrapper } from "../../../utils/asyncWrapper.js";
import { AppError } from "../../../utils/AppError.js";
import { userAuth } from "../../../middleware/auth.js";
import { roleGuard } from "../../../middleware/roleGuard.js";
import { logAudit, paginate } from "../admin.helpers.js";
import {
  createCompanySchema,
  updateCompanySchema,
  createModelSchema,
  updateModelSchema,
  createVariantSchema,
  updateVariantSchema,
  createCategorySchema,
  updateCategorySchema,
  createPartSchema,
  updatePartSchema,
  createPartPriceSchema,
  updatePartPriceSchema,
  catalogPaginationQuery,
} from "./catalog.schemas.js";

export const adminCatalogRouter = Router();

adminCatalogRouter.use(userAuth, roleGuard("admin"));

// ═══════════════════════════════════════════════════════════════
//  CAR COMPANIES
// ═══════════════════════════════════════════════════════════════

// GET /admin/catalog/companies
adminCatalogRouter.get(
  "/companies",
  asyncWrapper(async (req, res) => {
    const q = catalogPaginationQuery.parse(req.query);
    const { skip, take } = paginate(q.page, q.limit);

    const where = {};
    if (q.search) {
      where.company_name = { contains: q.search, mode: "insensitive" };
    }

    const [companies, total] = await Promise.all([
      prisma.carCompany.findMany({
        where,
        skip,
        take,
        include: { _count: { select: { models: true } } },
        orderBy: { company_name: "asc" },
      }),
      prisma.carCompany.count({ where }),
    ]);

    res.json({
      companies: companies.map((c) => ({
        company_id: c.company_id,
        company_name: c.company_name,
        model_count: c._count.models,
      })),
      total,
      page: q.page,
      limit: q.limit,
    });
  })
);

// POST /admin/catalog/companies
adminCatalogRouter.post(
  "/companies",
  asyncWrapper(async (req, res) => {
    const data = createCompanySchema.parse(req.body);

    const existing = await prisma.carCompany.findUnique({ where: { company_name: data.company_name } });
    if (existing) throw new AppError("Company already exists", 409);

    const company = await prisma.carCompany.create({ data });

    await logAudit({
      entityType: "car_company",
      entityId: String(company.company_id),
      action: "CREATE",
      performedBy: req.userId,
      newValue: company,
    });

    res.status(201).json({ message: "Company created", company });
  })
);

// PUT /admin/catalog/companies/:id
adminCatalogRouter.put(
  "/companies/:id",
  asyncWrapper(async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) throw new AppError("Invalid company ID", 400);

    const data = updateCompanySchema.parse(req.body);

    const old = await prisma.carCompany.findUnique({ where: { company_id: id } });
    if (!old) throw new AppError("Company not found", 404);

    const company = await prisma.carCompany.update({ where: { company_id: id }, data });

    await logAudit({
      entityType: "car_company",
      entityId: String(id),
      action: "UPDATE",
      performedBy: req.userId,
      oldValue: old,
      newValue: company,
    });

    res.json({ message: "Company updated", company });
  })
);

// DELETE /admin/catalog/companies/:id
adminCatalogRouter.delete(
  "/companies/:id",
  asyncWrapper(async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) throw new AppError("Invalid company ID", 400);

    const old = await prisma.carCompany.findUnique({
      where: { company_id: id },
      include: { _count: { select: { models: true, technicianSupports: true } } },
    });
    if (!old) throw new AppError("Company not found", 404);
    if (old._count.models > 0) throw new AppError("Cannot delete company with existing models", 409);

    await prisma.carCompany.delete({ where: { company_id: id } });

    await logAudit({
      entityType: "car_company",
      entityId: String(id),
      action: "DELETE",
      performedBy: req.userId,
      oldValue: old,
    });

    res.json({ message: "Company deleted" });
  })
);

// ═══════════════════════════════════════════════════════════════
//  CAR MODELS
// ═══════════════════════════════════════════════════════════════

// GET /admin/catalog/models
adminCatalogRouter.get(
  "/models",
  asyncWrapper(async (req, res) => {
    const q = catalogPaginationQuery.parse(req.query);
    const { skip, take } = paginate(q.page, q.limit);

    const where = {};
    if (q.search) {
      where.model_name = { contains: q.search, mode: "insensitive" };
    }
    if (q.company_id) where.company_id = Number(q.company_id);

    const [models, total] = await Promise.all([
      prisma.carModel.findMany({
        where,
        skip,
        take,
        include: {
          company: { select: { company_id: true, company_name: true } },
          _count: { select: { variants: true } },
        },
        orderBy: { model_name: "asc" },
      }),
      prisma.carModel.count({ where }),
    ]);

    res.json({
      models: models.map((m) => ({
        model_id: m.model_id,
        model_name: m.model_name,
        company: m.company,
        variant_count: m._count.variants,
      })),
      total,
      page: q.page,
      limit: q.limit,
    });
  })
);

// POST /admin/catalog/models
adminCatalogRouter.post(
  "/models",
  asyncWrapper(async (req, res) => {
    const data = createModelSchema.parse(req.body);

    const company = await prisma.carCompany.findUnique({ where: { company_id: data.company_id } });
    if (!company) throw new AppError("Company not found", 404);

    const model = await prisma.carModel.create({ data });

    await logAudit({
      entityType: "car_model",
      entityId: String(model.model_id),
      action: "CREATE",
      performedBy: req.userId,
      newValue: model,
    });

    res.status(201).json({ message: "Model created", model });
  })
);

// PUT /admin/catalog/models/:id
adminCatalogRouter.put(
  "/models/:id",
  asyncWrapper(async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) throw new AppError("Invalid model ID", 400);

    const data = updateModelSchema.parse(req.body);
    const old = await prisma.carModel.findUnique({ where: { model_id: id } });
    if (!old) throw new AppError("Model not found", 404);

    if (data.company_id) {
      const company = await prisma.carCompany.findUnique({ where: { company_id: data.company_id } });
      if (!company) throw new AppError("Company not found", 404);
    }

    const model = await prisma.carModel.update({ where: { model_id: id }, data });

    await logAudit({
      entityType: "car_model",
      entityId: String(id),
      action: "UPDATE",
      performedBy: req.userId,
      oldValue: old,
      newValue: model,
    });

    res.json({ message: "Model updated", model });
  })
);

// DELETE /admin/catalog/models/:id
adminCatalogRouter.delete(
  "/models/:id",
  asyncWrapper(async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) throw new AppError("Invalid model ID", 400);

    const old = await prisma.carModel.findUnique({
      where: { model_id: id },
      include: { _count: { select: { variants: true } } },
    });
    if (!old) throw new AppError("Model not found", 404);
    if (old._count.variants > 0) throw new AppError("Cannot delete model with existing variants", 409);

    await prisma.carModel.delete({ where: { model_id: id } });

    await logAudit({
      entityType: "car_model",
      entityId: String(id),
      action: "DELETE",
      performedBy: req.userId,
      oldValue: old,
    });

    res.json({ message: "Model deleted" });
  })
);

// ═══════════════════════════════════════════════════════════════
//  CAR VARIANTS
// ═══════════════════════════════════════════════════════════════

// GET /admin/catalog/variants
adminCatalogRouter.get(
  "/variants",
  asyncWrapper(async (req, res) => {
    const q = catalogPaginationQuery.parse(req.query);
    const { skip, take } = paginate(q.page, q.limit);

    const where = {};
    if (q.search) {
      where.variant_name = { contains: q.search, mode: "insensitive" };
    }
    if (q.model_id) where.model_id = Number(q.model_id);

    const [variants, total] = await Promise.all([
      prisma.carVariant.findMany({
        where,
        skip,
        take,
        include: {
          model: {
            select: {
              model_id: true,
              model_name: true,
              company: { select: { company_id: true, company_name: true } },
            },
          },
        },
        orderBy: { variant_name: "asc" },
      }),
      prisma.carVariant.count({ where }),
    ]);

    res.json({ variants, total, page: q.page, limit: q.limit });
  })
);

// POST /admin/catalog/variants
adminCatalogRouter.post(
  "/variants",
  asyncWrapper(async (req, res) => {
    const data = createVariantSchema.parse(req.body);

    const model = await prisma.carModel.findUnique({ where: { model_id: data.model_id } });
    if (!model) throw new AppError("Model not found", 404);

    const variant = await prisma.carVariant.create({ data });

    await logAudit({
      entityType: "car_variant",
      entityId: String(variant.variant_id),
      action: "CREATE",
      performedBy: req.userId,
      newValue: variant,
    });

    res.status(201).json({ message: "Variant created", variant });
  })
);

// PUT /admin/catalog/variants/:id
adminCatalogRouter.put(
  "/variants/:id",
  asyncWrapper(async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) throw new AppError("Invalid variant ID", 400);

    const data = updateVariantSchema.parse(req.body);
    const old = await prisma.carVariant.findUnique({ where: { variant_id: id } });
    if (!old) throw new AppError("Variant not found", 404);

    const variant = await prisma.carVariant.update({ where: { variant_id: id }, data });

    await logAudit({
      entityType: "car_variant",
      entityId: String(id),
      action: "UPDATE",
      performedBy: req.userId,
      oldValue: old,
      newValue: variant,
    });

    res.json({ message: "Variant updated", variant });
  })
);

// DELETE /admin/catalog/variants/:id
adminCatalogRouter.delete(
  "/variants/:id",
  asyncWrapper(async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) throw new AppError("Invalid variant ID", 400);

    const old = await prisma.carVariant.findUnique({
      where: { variant_id: id },
      include: { _count: { select: { partPrices: true, userVehicles: true } } },
    });
    if (!old) throw new AppError("Variant not found", 404);
    if (old._count.partPrices > 0 || old._count.userVehicles > 0)
      throw new AppError("Cannot delete variant with existing price entries or vehicles", 409);

    await prisma.carVariant.delete({ where: { variant_id: id } });

    await logAudit({
      entityType: "car_variant",
      entityId: String(id),
      action: "DELETE",
      performedBy: req.userId,
      oldValue: old,
    });

    res.json({ message: "Variant deleted" });
  })
);

// ═══════════════════════════════════════════════════════════════
//  PART CATEGORIES
// ═══════════════════════════════════════════════════════════════

// GET /admin/catalog/categories
adminCatalogRouter.get(
  "/categories",
  asyncWrapper(async (req, res) => {
    const q = catalogPaginationQuery.parse(req.query);
    const { skip, take } = paginate(q.page, q.limit);

    const where = {};
    if (q.search) {
      where.category_name = { contains: q.search, mode: "insensitive" };
    }

    const [categories, total] = await Promise.all([
      prisma.carPartCategory.findMany({
        where,
        skip,
        take,
        include: { _count: { select: { parts: true } } },
        orderBy: { category_name: "asc" },
      }),
      prisma.carPartCategory.count({ where }),
    ]);

    res.json({
      categories: categories.map((c) => ({
        category_id: c.category_id,
        category_name: c.category_name,
        part_count: c._count.parts,
      })),
      total,
      page: q.page,
      limit: q.limit,
    });
  })
);

// POST /admin/catalog/categories
adminCatalogRouter.post(
  "/categories",
  asyncWrapper(async (req, res) => {
    const data = createCategorySchema.parse(req.body);

    const existing = await prisma.carPartCategory.findUnique({ where: { category_name: data.category_name } });
    if (existing) throw new AppError("Category already exists", 409);

    const category = await prisma.carPartCategory.create({ data });

    await logAudit({
      entityType: "car_part_category",
      entityId: String(category.category_id),
      action: "CREATE",
      performedBy: req.userId,
      newValue: category,
    });

    res.status(201).json({ message: "Category created", category });
  })
);

// PUT /admin/catalog/categories/:id
adminCatalogRouter.put(
  "/categories/:id",
  asyncWrapper(async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) throw new AppError("Invalid category ID", 400);

    const data = updateCategorySchema.parse(req.body);
    const old = await prisma.carPartCategory.findUnique({ where: { category_id: id } });
    if (!old) throw new AppError("Category not found", 404);

    const category = await prisma.carPartCategory.update({ where: { category_id: id }, data });

    await logAudit({
      entityType: "car_part_category",
      entityId: String(id),
      action: "UPDATE",
      performedBy: req.userId,
      oldValue: old,
      newValue: category,
    });

    res.json({ message: "Category updated", category });
  })
);

// DELETE /admin/catalog/categories/:id
adminCatalogRouter.delete(
  "/categories/:id",
  asyncWrapper(async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) throw new AppError("Invalid category ID", 400);

    const old = await prisma.carPartCategory.findUnique({
      where: { category_id: id },
      include: { _count: { select: { parts: true } } },
    });
    if (!old) throw new AppError("Category not found", 404);
    if (old._count.parts > 0) throw new AppError("Cannot delete category with existing parts", 409);

    await prisma.carPartCategory.delete({ where: { category_id: id } });

    await logAudit({
      entityType: "car_part_category",
      entityId: String(id),
      action: "DELETE",
      performedBy: req.userId,
      oldValue: old,
    });

    res.json({ message: "Category deleted" });
  })
);

// ═══════════════════════════════════════════════════════════════
//  CAR PARTS
// ═══════════════════════════════════════════════════════════════

// GET /admin/catalog/parts
adminCatalogRouter.get(
  "/parts",
  asyncWrapper(async (req, res) => {
    const q = catalogPaginationQuery.parse(req.query);
    const { skip, take } = paginate(q.page, q.limit);

    const where = {};
    if (q.search) {
      where.part_name = { contains: q.search, mode: "insensitive" };
    }
    if (q.category_id) where.category_id = Number(q.category_id);

    const [parts, total] = await Promise.all([
      prisma.carPart.findMany({
        where,
        skip,
        take,
        include: {
          category: { select: { category_id: true, category_name: true } },
          _count: { select: { prices: true } },
        },
        orderBy: { part_name: "asc" },
      }),
      prisma.carPart.count({ where }),
    ]);

    res.json({
      parts: parts.map((p) => ({
        part_id: p.part_id,
        part_name: p.part_name,
        category: p.category,
        price_count: p._count.prices,
      })),
      total,
      page: q.page,
      limit: q.limit,
    });
  })
);

// POST /admin/catalog/parts
adminCatalogRouter.post(
  "/parts",
  asyncWrapper(async (req, res) => {
    const data = createPartSchema.parse(req.body);

    const category = await prisma.carPartCategory.findUnique({ where: { category_id: data.category_id } });
    if (!category) throw new AppError("Category not found", 404);

    const part = await prisma.carPart.create({ data });

    await logAudit({
      entityType: "car_part",
      entityId: String(part.part_id),
      action: "CREATE",
      performedBy: req.userId,
      newValue: part,
    });

    res.status(201).json({ message: "Part created", part });
  })
);

// PUT /admin/catalog/parts/:id
adminCatalogRouter.put(
  "/parts/:id",
  asyncWrapper(async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) throw new AppError("Invalid part ID", 400);

    const data = updatePartSchema.parse(req.body);
    const old = await prisma.carPart.findUnique({ where: { part_id: id } });
    if (!old) throw new AppError("Part not found", 404);

    if (data.category_id) {
      const category = await prisma.carPartCategory.findUnique({ where: { category_id: data.category_id } });
      if (!category) throw new AppError("Category not found", 404);
    }

    const part = await prisma.carPart.update({ where: { part_id: id }, data });

    await logAudit({
      entityType: "car_part",
      entityId: String(id),
      action: "UPDATE",
      performedBy: req.userId,
      oldValue: old,
      newValue: part,
    });

    res.json({ message: "Part updated", part });
  })
);

// DELETE /admin/catalog/parts/:id
adminCatalogRouter.delete(
  "/parts/:id",
  asyncWrapper(async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) throw new AppError("Invalid part ID", 400);

    const old = await prisma.carPart.findUnique({
      where: { part_id: id },
      include: { _count: { select: { prices: true, inventories: true, orderItems: true } } },
    });
    if (!old) throw new AppError("Part not found", 404);
    if (old._count.prices > 0 || old._count.inventories > 0 || old._count.orderItems > 0)
      throw new AppError("Cannot delete part with existing price entries, inventory, or orders", 409);

    await prisma.carPart.delete({ where: { part_id: id } });

    await logAudit({
      entityType: "car_part",
      entityId: String(id),
      action: "DELETE",
      performedBy: req.userId,
      oldValue: old,
    });

    res.json({ message: "Part deleted" });
  })
);

// ═══════════════════════════════════════════════════════════════
//  PART PRICES
// ═══════════════════════════════════════════════════════════════

// GET /admin/catalog/prices
adminCatalogRouter.get(
  "/prices",
  asyncWrapper(async (req, res) => {
    const q = catalogPaginationQuery.parse(req.query);
    const { skip, take } = paginate(q.page, q.limit);

    const where = {};
    if (q.part_id) where.part_id = Number(q.part_id);
    if (q.variant_id) where.variant_id = Number(q.variant_id);

    const [prices, total] = await Promise.all([
      prisma.partPrice.findMany({
        where,
        skip,
        take,
        include: {
          part: { select: { part_id: true, part_name: true } },
          variant: {
            select: {
              variant_id: true,
              variant_name: true,
              year: true,
              model: {
                select: {
                  model_name: true,
                  company: { select: { company_name: true } },
                },
              },
            },
          },
        },
        orderBy: { price_id: "desc" },
      }),
      prisma.partPrice.count({ where }),
    ]);

    res.json({ prices, total, page: q.page, limit: q.limit });
  })
);

// POST /admin/catalog/prices
adminCatalogRouter.post(
  "/prices",
  asyncWrapper(async (req, res) => {
    const data = createPartPriceSchema.parse(req.body);

    const [part, variant] = await Promise.all([
      prisma.carPart.findUnique({ where: { part_id: data.part_id } }),
      prisma.carVariant.findUnique({ where: { variant_id: data.variant_id } }),
    ]);
    if (!part) throw new AppError("Part not found", 404);
    if (!variant) throw new AppError("Variant not found", 404);

    const existing = await prisma.partPrice.findUnique({
      where: { part_id_variant_id: { part_id: data.part_id, variant_id: data.variant_id } },
    });
    if (existing) throw new AppError("Price for this part–variant combination already exists", 409);

    const price = await prisma.partPrice.create({ data });

    await logAudit({
      entityType: "part_price",
      entityId: String(price.price_id),
      action: "CREATE",
      performedBy: req.userId,
      newValue: price,
    });

    res.status(201).json({ message: "Price created", price });
  })
);

// PUT /admin/catalog/prices/:id
adminCatalogRouter.put(
  "/prices/:id",
  asyncWrapper(async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) throw new AppError("Invalid price ID", 400);

    const data = updatePartPriceSchema.parse(req.body);
    const old = await prisma.partPrice.findUnique({ where: { price_id: id } });
    if (!old) throw new AppError("Price entry not found", 404);

    const price = await prisma.partPrice.update({ where: { price_id: id }, data });

    await logAudit({
      entityType: "part_price",
      entityId: String(id),
      action: "UPDATE",
      performedBy: req.userId,
      oldValue: old,
      newValue: price,
    });

    res.json({ message: "Price updated", price });
  })
);

// DELETE /admin/catalog/prices/:id
adminCatalogRouter.delete(
  "/prices/:id",
  asyncWrapper(async (req, res) => {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) throw new AppError("Invalid price ID", 400);

    const old = await prisma.partPrice.findUnique({ where: { price_id: id } });
    if (!old) throw new AppError("Price entry not found", 404);

    await prisma.partPrice.delete({ where: { price_id: id } });

    await logAudit({
      entityType: "part_price",
      entityId: String(id),
      action: "DELETE",
      performedBy: req.userId,
      oldValue: old,
    });

    res.json({ message: "Price deleted" });
  })
);
