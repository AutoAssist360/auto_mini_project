import { Router } from "express";
import { prisma } from "../../../lib/prisma.js";
import { userAuth } from "../../../middleware/auth.js";
import { roleGuard } from "../../../middleware/roleGuard.js";
import { asyncWrapper } from "../../../utils/asyncWrapper.js";
import { AppError } from "../../../utils/AppError.js";
import { validate } from "../../../middleware/validate.js";
import { updateVendorProfileSchema } from "../vendor.schemas.js";

export const vendorProfileRouter = Router();

vendorProfileRouter.use(userAuth, roleGuard("vendor"));

// ─── GET /vendor/profile ─────────────────────────────────────
vendorProfileRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const user = await prisma.user.findUnique({
      where: { user_id: req.userId },
      select: {
        user_id: true,
        full_name: true,
        email: true,
        phone_number: true,
        role: true,
        is_verified: true,
        is_active: true,
        created_at: true,
        upi_id: true,
        bank_account_number: true,
        bank_ifsc: true,
        bank_holder_name: true,
      },
    });

    if (!user) {
      throw new AppError("Vendor not found", 404);
    }

    // Also get summary stats
    const warehouses = await prisma.warehouse.count({
      where: { vendor_id: req.userId },
    });

    res.json({ vendor: { ...user, warehouse_count: warehouses } });
  })
);

// ─── PUT /vendor/profile ─────────────────────────────────────
vendorProfileRouter.put(
  "/",
  validate(updateVendorProfileSchema),
  asyncWrapper(async (req, res) => {
    const { full_name, phone_number, upi_id, bank_account_number, bank_ifsc, bank_holder_name } = req.body;

    if (phone_number) {
      const phoneExists = await prisma.user.findFirst({
        where: {
          phone_number,
          user_id: { not: req.userId },
        },
      });
      if (phoneExists) {
        throw new AppError("Phone number already in use", 409);
      }
    }

    const updatedUser = await prisma.user.update({
      where: { user_id: req.userId },
      data: {
        ...(full_name !== undefined && { full_name }),
        ...(phone_number !== undefined && { phone_number }),
        ...(upi_id !== undefined && { upi_id: upi_id || null }),
        ...(bank_account_number !== undefined && { bank_account_number: bank_account_number || null }),
        ...(bank_ifsc !== undefined && { bank_ifsc: bank_ifsc || null }),
        ...(bank_holder_name !== undefined && { bank_holder_name: bank_holder_name || null }),
      },
      select: {
        user_id: true,
        full_name: true,
        email: true,
        phone_number: true,
        role: true,
        is_verified: true,
        upi_id: true,
        bank_account_number: true,
        bank_ifsc: true,
        bank_holder_name: true,
      },
    });

    res.json({
      message: "Profile updated successfully",
      vendor: updatedUser,
    });
  })
);
