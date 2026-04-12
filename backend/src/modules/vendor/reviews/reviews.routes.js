import { Router } from "express";
import { prisma } from "../../../lib/prisma.js";
import { userAuth } from "../../../middleware/auth.js";
import { roleGuard } from "../../../middleware/roleGuard.js";
import { asyncWrapper } from "../../../utils/asyncWrapper.js";
import { paginate, paginationQuery } from "../../../utils/paginate.js";

export const vendorReviewRouter = Router();

vendorReviewRouter.use(userAuth, roleGuard("vendor"));

// ─── GET /vendor/reviews ───────────────────────────────────────────
vendorReviewRouter.get(
  "/",
  asyncWrapper(async (req, res) => {
    const { page, limit } = paginationQuery.parse(req.query);
    const { skip, take } = paginate(page, limit);

    const where = { vendor_id: req.userId };

    const [reviews, total] = await Promise.all([
      prisma.vendorReview.findMany({
        where,
        orderBy: { created_at: "desc" },
        skip,
        take,
        include: {
          user: {
            select: { full_name: true, email: true }
          },
          order: {
            select: { order_number: true }
          }
        }
      }),
      prisma.vendorReview.count({ where }),
    ]);

    res.json({ reviews, total, page, limit });
  })
);
