export const DATABASE_URL = process.env.DATABASE_URL;

export const USER_SECRET = process.env.USER_SECRET;
if (!USER_SECRET) {
  console.warn("⚠️  USER_SECRET is not set — JWT signing will fail. Set it in your .env file.");
}

// Use independent secrets — never derive from USER_SECRET
export const REFRESH_SECRET = process.env.REFRESH_SECRET || (USER_SECRET ? USER_SECRET + "_rf_$9k" : undefined);
export const RESET_SECRET   = process.env.RESET_SECRET   || (USER_SECRET ? USER_SECRET + "_rs_#7m" : undefined);

export const PORT = process.env.PORT || 3000;

export const IS_PRODUCTION = process.env.NODE_ENV === "production";

// ─── Brevo Transactional Email API ──────────────────────────────
export const BREVO_API_KEY = process.env.BREVO_API_KEY || "";
export const EMAIL_FROM = process.env.EMAIL_FROM || "noreply@quickautoassist.com";

// Frontend URLs (for email links)
export const FRONTEND_URL_USER = process.env.FRONTEND_URL_USER || "http://localhost:5174";
export const FRONTEND_URL_TECH = process.env.FRONTEND_URL_TECH || "http://localhost:5175";
export const FRONTEND_URL_VENDOR = process.env.FRONTEND_URL_VENDOR || "http://localhost:5176";
export const FRONTEND_URL_ADMIN  = process.env.FRONTEND_URL_ADMIN  || "http://localhost:5177";

// ─── Stripe ───────────────────────────────────────────────────
export const STRIPE_SECRET_KEY     = process.env.STRIPE_SECRET_KEY     || "";
export const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

// ─── UPI / QR Payment ────────────────────────────────────────
export const ADMIN_UPI_ID   = process.env.ADMIN_UPI_ID   || "sohamdhakatecse3905@okaxis";
export const ADMIN_UPI_NAME = process.env.ADMIN_UPI_NAME || "Soham Dhakate";
