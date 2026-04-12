import { z } from "zod";

export const createReviewSchema = z.object({
  job_id: z.string().uuid("Invalid job ID"),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000, "Comment must be at most 2000 characters").optional(),
});

export const createVendorReviewSchema = z.object({
  order_id: z.string().uuid("Invalid order ID"),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000, "Comment must be at most 2000 characters").optional(),
});
