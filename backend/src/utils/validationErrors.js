export function buildValidationErrorResponse(issues = []) {
  const errors = issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));

  const uniqueMessages = [...new Set(errors.map((issue) => issue.message).filter(Boolean))];
  const message =
    uniqueMessages.length > 0
      ? uniqueMessages.slice(0, 3).join(" ")
      : "Validation failed";

  return {
    message,
    errors,
  };
}
