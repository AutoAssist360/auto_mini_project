import { Router } from "express";
import { prisma } from "../../../lib/prisma.js";
import { asyncWrapper } from "../../../utils/asyncWrapper.js";
import { AppError } from "../../../utils/AppError.js";
import { userAuth } from "../../../middleware/auth.js";
import { roleGuard } from "../../../middleware/roleGuard.js";
import { validate } from "../../../middleware/validate.js";
import { updateProfileSchema, addCertificationSchema, addCarSupportSchema, addPartSkillSchema, addResourceSchema } from "../technician.schemas.js";

export const techProfileRouter = Router();

techProfileRouter.use(userAuth, roleGuard("technician"));

/** Helper: get technicianProfile or throw */
async function getTechProfile(userId) {
  const profile = await prisma.technicianProfile.findUnique({
    where: { user_id: userId },
  });
  if (!profile) throw new AppError("Technician profile not found", 404);
  return profile;
}

// ─── GET /tech/profile ──────────────────────────────────────────
techProfileRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const profile = await prisma.technicianProfile.findUnique({
      where: { user_id: req.userId },
      include: {
        user: {
          select: {
            user_id: true,
            full_name: true,
            email: true,
            phone_number: true,
            role: true,
            created_at: true,
            upi_id: true,
            bank_account_number: true,
            bank_ifsc: true,
            bank_holder_name: true,
          },
        },
        carSupports: {
          include: { company: true, variant: true },
        },
        partSkills: {
          include: { part: true },
        },
        certifications: true,
        resources: true,
      },
    });

    if (!profile) throw new AppError("Technician profile not found", 404);

    res.json({ profile });
  })
);

// ─── PUT /tech/profile ──────────────────────────────────────────
techProfileRouter.put(
  "/",
  validate(updateProfileSchema),
  asyncWrapper(async (req, res) => {
    await getTechProfile(req.userId);

    // Separate user-level fields (UPI/bank) from technician-profile fields
    const { upi_id, bank_account_number, bank_ifsc, bank_holder_name, ...techFields } = req.body;

    const userPaymentData = {};
    if (upi_id !== undefined) userPaymentData.upi_id = (upi_id && upi_id.trim()) ? upi_id.trim() : null;
    if (bank_account_number !== undefined) userPaymentData.bank_account_number = (bank_account_number && bank_account_number.trim()) ? bank_account_number.trim() : null;
    if (bank_ifsc !== undefined) userPaymentData.bank_ifsc = (bank_ifsc && bank_ifsc.trim()) ? bank_ifsc.trim() : null;
    if (bank_holder_name !== undefined) userPaymentData.bank_holder_name = (bank_holder_name && bank_holder_name.trim()) ? bank_holder_name.trim() : null;

    // Update user payment details if any were provided
    if (Object.keys(userPaymentData).length > 0) {
      await prisma.user.update({ where: { user_id: req.userId }, data: userPaymentData });
    }

    // Update technician profile fields if any were provided
    if (Object.keys(techFields).length > 0) {
      await prisma.technicianProfile.update({
        where: { user_id: req.userId },
        data: techFields,
      });
    }

    // Always return the full profile including refreshed user payment details
    const freshProfile = await prisma.technicianProfile.findUnique({
      where: { user_id: req.userId },
      include: {
        user: {
          select: {
            user_id: true,
            full_name: true,
            email: true,
            phone_number: true,
            role: true,
            created_at: true,
            upi_id: true,
            bank_account_number: true,
            bank_ifsc: true,
            bank_holder_name: true,
          },
        },
        carSupports: { include: { company: true, variant: true } },
        partSkills: { include: { part: true } },
        certifications: true,
        resources: true,
      },
    });

    res.json({ message: "Profile updated", profile: freshProfile });
  })
);

// ─── POST /tech/profile/certifications ──────────────────────────
techProfileRouter.post(
  "/certifications",
  validate(addCertificationSchema),
  asyncWrapper(async (req, res) => {
    const profile = await getTechProfile(req.userId);

    const cert = await prisma.technicianCertification.create({
      data: {
        technician_id: profile.technician_id,
        certification: req.body.certification,
        issued_by: req.body.issued_by,
        issue_date: new Date(req.body.issue_date),
        expiry_date: req.body.expiry_date
          ? new Date(req.body.expiry_date)
          : null,
      },
    });

    res.status(201).json({ message: "Certification added", certification: cert });
  })
);

// ─── DELETE /tech/profile/certifications/:certId ────────────────
techProfileRouter.delete(
  "/certifications/:certId",
  asyncWrapper(async (req, res) => {
    const profile = await getTechProfile(req.userId);

    const certId = req.params.certId ;

    const cert = await prisma.technicianCertification.findUnique({
      where: { certification_id: certId },
    });

    if (!cert) throw new AppError("Certification not found", 404);
    if (cert.technician_id !== profile.technician_id) {
      throw new AppError("Not authorized to delete this certification", 403);
    }

    await prisma.technicianCertification.delete({
      where: { certification_id: certId },
    });

    res.json({ message: "Certification deleted" });
  })
);

// ═════════════════════════════════════════════════════════════════
//  CAR SUPPORTS
// ═════════════════════════════════════════════════════════════════

// POST /tech/profile/car-supports
techProfileRouter.post(
  "/car-supports",
  validate(addCarSupportSchema),
  asyncWrapper(async (req, res) => {
    const profile = await getTechProfile(req.userId);
    const { company_id, variant_id } = req.body;

    // Validate company exists
    const company = await prisma.carCompany.findUnique({ where: { company_id } });
    if (!company) throw new AppError("Company not found", 404);

    // Validate variant if provided
    if (variant_id) {
      const variant = await prisma.carVariant.findUnique({ where: { variant_id } });
      if (!variant) throw new AppError("Variant not found", 404);
    }

    const support = await prisma.technicianCarSupport.create({
      data: {
        technician_id: profile.technician_id,
        company_id,
        variant_id: variant_id || null,
      },
      include: { company: true, variant: true },
    });

    res.status(201).json({ message: "Car support added", support });
  })
);

// DELETE /tech/profile/car-supports/:supportId
techProfileRouter.delete(
  "/car-supports/:supportId",
  asyncWrapper(async (req, res) => {
    const profile = await getTechProfile(req.userId);
    const supportId = req.params.supportId;

    const support = await prisma.technicianCarSupport.findUnique({ where: { support_id: supportId } });
    if (!support) throw new AppError("Car support not found", 404);
    if (support.technician_id !== profile.technician_id) throw new AppError("Not authorized", 403);

    await prisma.technicianCarSupport.delete({ where: { support_id: supportId } });

    res.json({ message: "Car support removed" });
  })
);

// ═════════════════════════════════════════════════════════════════
//  PART SKILLS
// ═════════════════════════════════════════════════════════════════

// POST /tech/profile/part-skills
techProfileRouter.post(
  "/part-skills",
  validate(addPartSkillSchema),
  asyncWrapper(async (req, res) => {
    const profile = await getTechProfile(req.userId);
    const { part_id } = req.body;

    const part = await prisma.carPart.findUnique({ where: { part_id } });
    if (!part) throw new AppError("Part not found", 404);

    const skill = await prisma.technicianPartSkill.create({
      data: {
        technician_id: profile.technician_id,
        part_id,
      },
      include: { part: true },
    });

    res.status(201).json({ message: "Part skill added", skill });
  })
);

// DELETE /tech/profile/part-skills/:skillId
techProfileRouter.delete(
  "/part-skills/:skillId",
  asyncWrapper(async (req, res) => {
    const profile = await getTechProfile(req.userId);
    const skillId = req.params.skillId;

    const skill = await prisma.technicianPartSkill.findUnique({ where: { skill_id: skillId } });
    if (!skill) throw new AppError("Part skill not found", 404);
    if (skill.technician_id !== profile.technician_id) throw new AppError("Not authorized", 403);

    await prisma.technicianPartSkill.delete({ where: { skill_id: skillId } });

    res.json({ message: "Part skill removed" });
  })
);

// ═════════════════════════════════════════════════════════════════
//  RESOURCES
// ═════════════════════════════════════════════════════════════════

// POST /tech/profile/resources
techProfileRouter.post(
  "/resources",
  validate(addResourceSchema),
  asyncWrapper(async (req, res) => {
    const profile = await getTechProfile(req.userId);

    const resource = await prisma.technicianResource.create({
      data: {
        technician_id: profile.technician_id,
        resource_type: req.body.resource_type,
        description: req.body.description,
      },
    });

    res.status(201).json({ message: "Resource added", resource });
  })
);

// DELETE /tech/profile/resources/:resourceId
techProfileRouter.delete(
  "/resources/:resourceId",
  asyncWrapper(async (req, res) => {
    const profile = await getTechProfile(req.userId);
    const resourceId = req.params.resourceId;

    const resource = await prisma.technicianResource.findUnique({ where: { resource_id: resourceId } });
    if (!resource) throw new AppError("Resource not found", 404);
    if (resource.technician_id !== profile.technician_id) throw new AppError("Not authorized", 403);

    await prisma.technicianResource.delete({ where: { resource_id: resourceId } });

    res.json({ message: "Resource removed" });
  })
);

// ═════════════════════════════════════════════════════════════════
//  CATALOG LOOKUPS (read-only, for dropdown population)
// ═════════════════════════════════════════════════════════════════

// GET /tech/profile/catalog/companies
techProfileRouter.get(
  "/catalog/companies",
  asyncWrapper(async (_req, res) => {
    const companies = await prisma.carCompany.findMany({
      orderBy: { company_name: "asc" },
      select: { company_id: true, company_name: true },
    });
    res.json({ companies });
  })
);

// GET /tech/profile/catalog/variants?company_id=X
techProfileRouter.get(
  "/catalog/variants",
  asyncWrapper(async (req, res) => {
    const companyId = Number(req.query.company_id);
    const where = {};
    if (!Number.isNaN(companyId) && companyId > 0) {
      where.model = { company_id: companyId };
    }
    const variants = await prisma.carVariant.findMany({
      where,
      orderBy: { variant_name: "asc" },
      select: {
        variant_id: true,
        variant_name: true,
        year: true,
        model: {
          select: { model_name: true, company: { select: { company_name: true } } },
        },
      },
    });
    res.json({ variants });
  })
);

// GET /tech/profile/catalog/parts
techProfileRouter.get(
  "/catalog/parts",
  asyncWrapper(async (_req, res) => {
    const parts = await prisma.carPart.findMany({
      orderBy: { part_name: "asc" },
      select: {
        part_id: true,
        part_name: true,
        category: { select: { category_name: true } },
      },
    });
    res.json({ parts });
  })
);

// GET /tech/profile/catalog/parts-with-inventory
// Returns all CarParts with cheapest available vendor price from active warehouses.
// Used by the Suggest Parts form so technicians can see part names AND current prices.
techProfileRouter.get(
  "/catalog/parts-with-inventory",
  asyncWrapper(async (_req, res) => {
    const parts = await prisma.carPart.findMany({
      orderBy: { part_name: "asc" },
      select: {
        part_id: true,
        part_name: true,
        category: { select: { category_name: true } },
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
              select: { warehouse_id: true, name: true, city: true },
            },
          },
          orderBy: { unit_cost: "asc" },
        },
      },
    });

    // For each part, compute: best_price (cheapest), total_available stock
    const enriched = parts.map((p) => {
      const availableInventories = p.inventories.filter(
        (inv) => inv.quantity_available - inv.quantity_reserved > 0
      );
      const bestPrice = availableInventories.length > 0
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
          warehouse_id: inv.warehouse.warehouse_id,
          warehouse_name: inv.warehouse.name,
          city: inv.warehouse.city,
          unit_cost: Number(inv.unit_cost),
          available: inv.quantity_available - inv.quantity_reserved,
        })),
      };
    });

    res.json({ parts: enriched });
  })
);