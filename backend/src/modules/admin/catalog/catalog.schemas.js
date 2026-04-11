import { z } from "zod";

// ─── Shared pagination with optional filter params ───────────
export const catalogPaginationQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
  search: z.string().optional(),
  company_id: z.coerce.number().int().positive().optional(),
  model_id: z.coerce.number().int().positive().optional(),
  category_id: z.coerce.number().int().positive().optional(),
  part_id: z.coerce.number().int().positive().optional(),
  variant_id: z.coerce.number().int().positive().optional(),
});

// ─── Company ─────────────────────────────────────────────────
export const createCompanySchema = z.object({
  company_name: z.string().min(1, "Company name is required").max(100),
});

export const updateCompanySchema = z.object({
  company_name: z.string().min(1).max(100).optional(),
});

// ─── Model ───────────────────────────────────────────────────
export const createModelSchema = z.object({
  company_id: z.number().int().positive("Company is required"),
  model_name: z.string().min(1, "Model name is required").max(100),
});

export const updateModelSchema = z.object({
  company_id: z.number().int().positive().optional(),
  model_name: z.string().min(1).max(100).optional(),
});

// ─── Variant ─────────────────────────────────────────────────
export const createVariantSchema = z.object({
  model_id: z.number().int().positive("Model is required"),
  variant_name: z.string().min(1, "Variant name is required").max(100),
  year: z.number().int().min(1900).max(2100),
  fuel_type: z.enum(["petrol", "diesel", "electric", "hybrid", "cng"]),
  transmission: z.enum(["manual", "automatic", "semi_automatic"]),
});

export const updateVariantSchema = z.object({
  model_id: z.number().int().positive().optional(),
  variant_name: z.string().min(1).max(100).optional(),
  year: z.number().int().min(1900).max(2100).optional(),
  fuel_type: z.enum(["petrol", "diesel", "electric", "hybrid", "cng"]).optional(),
  transmission: z.enum(["manual", "automatic", "semi_automatic"]).optional(),
});

// ─── Part Category ───────────────────────────────────────────
export const createCategorySchema = z.object({
  category_name: z.string().min(1, "Category name is required").max(100),
});

export const updateCategorySchema = z.object({
  category_name: z.string().min(1).max(100).optional(),
});

// ─── Part ────────────────────────────────────────────────────
export const createPartSchema = z.object({
  part_name: z.string().min(1, "Part name is required").max(200),
  category_id: z.number().int().positive("Category is required"),
});

export const updatePartSchema = z.object({
  part_name: z.string().min(1).max(200).optional(),
  category_id: z.number().int().positive().optional(),
});

// ─── Part Price ──────────────────────────────────────────────
export const createPartPriceSchema = z.object({
  part_id: z.number().int().positive("Part is required"),
  variant_id: z.number().int().positive("Variant is required"),
  price: z.number().positive("Price must be positive").multipleOf(0.01),
});

export const updatePartPriceSchema = z.object({
  price: z.number().positive("Price must be positive").multipleOf(0.01),
});
