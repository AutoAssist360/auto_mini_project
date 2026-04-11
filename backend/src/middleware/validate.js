
import { z } from "zod";
import { buildValidationErrorResponse } from "../utils/validationErrors.js";

/**
 * Express middleware that validates req.body against a Zod schema.
 */
export const validate = (schema) => {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res
          .status(400)
          .json(buildValidationErrorResponse(error.issues));
      }
      next(error);
    }
  };
};
