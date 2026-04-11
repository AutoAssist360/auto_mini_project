const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const INTEGER_ID_REGEX = /^\d+$/;

export const UUID_PARAM_NAMES = [
  "attemptId",
  "certId",
  "companyId",
  "fulfillmentId",
  "id",
  "inventoryId",
  "invoiceId",
  "jobId",
  "modelId",
  "offerId",
  "orderId",
  "partId",
  "requestId",
  "reservationId",
  "resourceId",
  "skillId",
  "supportId",
  "techId",
  "userId",
  "vehicleId",
  "vendorId",
  "warehouseId",
];

/**
 * Validate that the specified route params are valid UUIDs.
 * Usage: router.get("/:orderId", validateUUID("orderId"), handler)
 */
export const validateUUID = (...paramNames) => {
  return (req, res, next) => {
    for (const name of paramNames) {
      const value = req.params[name];
      if (value && !UUID_REGEX.test(value )) {
        return res.status(400).json({
          message: `Invalid UUID format for parameter '${name}'`,
        });
      }
    }
    next();
  };
};

export const validateUUIDParam = (
  req,
  res,
  next,
  value,
  name
) => {
  if (!value || INTEGER_ID_REGEX.test(value) || UUID_REGEX.test(value)) {
    return next();
  }

  return res.status(400).json({
    message: `Invalid UUID format for parameter '${name}'`,
  });
};

/**
 * Auto-validate ALL route params whose names end with "Id" or "id"
 * against UUID format. Apply once at the app level.
 */
export const validateUUIDParams = (
  req,
  res,
  next
) => {
  for (const [name, value] of Object.entries(req.params)) {
    if (!value || INTEGER_ID_REGEX.test(value)) {
      continue;
    }

    // Only validate params that look like UUID identifiers
    if (
      (name.endsWith("Id") || name === "attemptId") &&
      !UUID_REGEX.test(value )
    ) {
      return res.status(400).json({
        message: `Invalid UUID format for parameter '${name}'`,
      });
    }
  }
  next();
};
