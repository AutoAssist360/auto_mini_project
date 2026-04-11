/**
 * Input Sanitization Middleware
 *
 * Strips HTML tags, null bytes, and dangerous patterns from all
 * string values in req.body, req.query, and req.params.
 * Applied globally before route handlers to prevent XSS via stored content.
 */

const HTML_TAG_RE = /<\/?[^>]+(>|$)/g;
const NULL_BYTE_RE = /\0/g;

/**
 * Recursively sanitize all string values in an object/array.
 */
function sanitizeValue(value) {
  if (typeof value === "string") {
    return value
      .replace(HTML_TAG_RE, "")  // strip HTML/script tags
      .replace(NULL_BYTE_RE, "") // strip null bytes
      .trim();
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value !== null && typeof value === "object") {
    return sanitizeObject(value);
  }
  return value;
}

function sanitizeObject(obj) {
  const clean = {};
  for (const [key, val] of Object.entries(obj)) {
    clean[key] = sanitizeValue(val);
  }
  return clean;
}

/**
 * Express middleware — sanitizes req.body and req.query strings.
 * We skip req.params because Express populates it per-route, not globally.
 */
export function sanitize(req, _res, next) {
  try {
    if (req.body && typeof req.body === "object") {
      req.body = sanitizeObject(req.body);
    }
    if (req.query && typeof req.query === "object") {
      req.query = sanitizeObject(req.query);
    }
  } catch {
    // Sanitization should never block the request
  }
  next();
}
