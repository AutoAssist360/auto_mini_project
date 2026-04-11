import { Router } from "express";
import { prisma } from "../../../lib/prisma.js";
import { asyncWrapper } from "../../../utils/asyncWrapper.js";
import { AppError } from "../../../utils/AppError.js";
import { userAuth } from "../../../middleware/auth.js";
import { roleGuard } from "../../../middleware/roleGuard.js";
import { validate } from "../../../middleware/validate.js";
import { updateLocationSchema } from "../technician.schemas.js";
import { updateTechnicianLocation } from "../../../utils/geo.js";

export const techLocationRouter = Router();

techLocationRouter.use(userAuth, roleGuard("technician"));

// ─── POST /tech/location ────────────────────────────────────────
techLocationRouter.post(
  "/",
  validate(updateLocationSchema),
  asyncWrapper(async (req, res) => {
    const { latitude, longitude } = req.body;

    const profile = await prisma.technicianProfile.findUnique({
      where: { user_id: req.userId },
    });
    if (!profile) throw new AppError("Technician profile not found", 404);

    const updated = await prisma.technicianProfile.update({
      where: { technician_id: profile.technician_id },
      data: { latitude, longitude },
      select: { technician_id: true, latitude: true, longitude: true },
    });

    const redisSynced = await updateTechnicianLocation(
      updated.technician_id,
      updated.longitude,
      updated.latitude
    );

    if (!redisSynced) {
      console.warn(
        `[Geo] Technician ${updated.technician_id} location saved to PostgreSQL but not synced to Redis`
      );
    }

    res.json({ message: "Location updated", location: updated });
  })
);
