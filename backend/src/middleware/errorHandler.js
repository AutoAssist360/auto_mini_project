
import { AppError } from "../utils/AppError.js";
import { z } from "zod";
import { buildValidationErrorResponse } from "../utils/validationErrors.js";

/**
 * Global error handling middleware — must be registered LAST.
 */
export const errorHandler = (
  err,
  _req,
  res,
  _next
) => {
  const driverErrorMessage =
    err?.meta?.driverAdapterError?.cause?.message ||
    err?.meta?.driverAdapterError?.message ||
    err?.message ||
    "";

  if (err?.code === "P1001") {
    return res.status(503).json({
      message: "Database unavailable. Check DATABASE_URL and network access to your PostgreSQL host.",
    });
  }

  if (err?.code === "P2007" && /invalid input syntax for type uuid/i.test(driverErrorMessage)) {
    return res.status(400).json({
      message: "Invalid UUID format",
    });
  }

  if (err?.code === "P2002") {
    return res.status(409).json({
      message: "A record with this data already exists",
    });
  }

  if (err?.code === "P2003") {
    return res.status(409).json({
      message: "This record cannot be deleted because other data still depends on it.",
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({
      message: err.message,
    });
  }

  // Handle Zod validation errors (e.g. from inline query parsing)
  if (err instanceof z.ZodError) {
    return res.status(400).json(buildValidationErrorResponse(err.issues));
  }

  console.error("Unhandled Error:", err);

  return res.status(500).json({
    message: "Internal server error",
  });
};
