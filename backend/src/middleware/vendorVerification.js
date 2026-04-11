import { prisma } from "../lib/prisma.js";

export const requireVendorVerification = async (req, res, next) => {
  try {
    const vendor = await prisma.user.findUnique({
      where: { user_id: req.userId },
      select: {
        user_id: true,
        role: true,
        is_verified: true,
        deleted_at: true,
        is_active: true,
      },
    });

    if (!vendor) {
      return res.status(401).json({ message: "User not found" });
    }

    if (vendor.deleted_at) {
      return res.status(403).json({ message: "Account has been deleted" });
    }

    if (!vendor.is_active) {
      return res.status(403).json({ message: "Account has been suspended" });
    }

    if (vendor.role === "vendor" && !vendor.is_verified) {
      return res.status(403).json({
        message: "Vendor account is pending admin verification",
      });
    }

    next();
  } catch {
    return res.status(500).json({ message: "Failed to verify vendor account" });
  }
};
