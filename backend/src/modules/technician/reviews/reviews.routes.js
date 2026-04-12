import { Router } from "express";
import { prisma } from "../../../lib/prisma.js";
import { userAuth } from "../../../middleware/auth.js";
import { roleGuard } from "../../../middleware/roleGuard.js";
import { asyncWrapper } from "../../../utils/asyncWrapper.js";
import { paginate, paginationQuery } from "../../../utils/paginate.js";

export const technicianReviewRouter = Router();

technicianReviewRouter.use(userAuth, roleGuard("technician"));

// ─── GET /technician/reviews ───────────────────────────────────────────
technicianReviewRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const { page, limit } = paginationQuery.parse(req.query);
    const { skip, take } = paginate(page, limit);

    // Find the technician profile for the logged in user
    const techProfile = await prisma.technicianProfile.findUnique({
      where: { user_id: req.userId },
      select: { technician_id: true }
    });

    if (!techProfile) {
      return res.json({ reviews: [], total: 0, page, limit });
    }

    const where = { technician_id: techProfile.technician_id };

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take,
        include: {
          user: {
            select: { full_name: true, email: true }
          },
          job: {
            select: { request: { select: { issue_type: true } } }
          }
        }
      }),
      prisma.review.count({ where }),
    ]);

    res.json({ reviews, total, page, limit });
  })
);
