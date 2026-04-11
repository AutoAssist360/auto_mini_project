import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../../../lib/prisma.js";
import { asyncWrapper } from "../../../utils/asyncWrapper.js";
import { AppError } from "../../../utils/AppError.js";
import { setAuthCookies, clearAuthCookies } from "../../../utils/cookieHelper.js";
import {
  generateAccessToken,
  generateRefreshToken,
  generateOtpToken,
  verifyRefreshToken,
  generateResetToken,
  verifyResetToken,
  verifyOtpToken,
} from "../../../utils/tokenHelper.js";
import { validate } from "../../../middleware/validate.js";
import {
  vendorSigninSchema,
  vendorForgotPasswordSchema,
  vendorResetPasswordSchema,
  vendorChangePasswordSchema,
  vendorSendOtpSchema,
  vendorSignupWithOtpSchema,
} from "../vendor.schemas.js";
import { sendPasswordResetEmail, sendOtpEmail } from "../../../utils/emailService.js";
import { FRONTEND_URL_VENDOR } from "../../../../config.js";
import { userAuth } from "../../../middleware/auth.js";
import { emitAdminDashboardRefresh, pushNotification } from "../../../socket.js";
import crypto from "crypto";

export const vendorAuthRouter = Router();

const SALT_ROUNDS = 10;

vendorAuthRouter.post(
  "/send-otp",
  validate(vendorSendOtpSchema),
  asyncWrapper(async (req, res) => {
    const { email } = req.body;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throw new AppError("An account with this email already exists", 409);
    }

    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const otpToken = generateOtpToken({
      email,
      otp_hash: otpHash,
      purpose: "vendor-signup-otp",
    });

    try {
      await sendOtpEmail(email, otp);
    } catch (emailErr) {
      console.error("Failed to send vendor OTP email:", emailErr.message);
    }

    res.json({
      message: "Verification code sent to your email",
      otp_token: otpToken,
    });
  })
);

// ─── POST /vendor/auth/signup ────────────────────────────────
vendorAuthRouter.post(
  "/signup",
  validate(vendorSignupWithOtpSchema),
  asyncWrapper(async (req, res) => {
    const { email, password, full_name, phone_number, upi_id, otp_token, otp } = req.body;

    let decoded;
    try {
      decoded = verifyOtpToken(otp_token);
    } catch {
      throw new AppError("Verification code expired. Please request a new one.", 400);
    }

    if (decoded.purpose !== "vendor-signup-otp" || decoded.email !== email) {
      throw new AppError("Invalid verification token", 400);
    }

    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    if (otpHash !== decoded.otp_hash) {
      throw new AppError("Invalid verification code", 400);
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone_number }] },
    });

    if (existing) {
      const field = existing.email === email ? "email" : "phone number";
      throw new AppError(`An account with this ${field} already exists`, 409);
    }

    const hashed = await bcrypt.hash(password, SALT_ROUNDS);

    const vendor = await prisma.user.create({
      data: {
        email,
        password: hashed,
        full_name,
        phone_number,
        upi_id,
        role: "vendor",
        is_verified: false,
      },
    });

    emitAdminDashboardRefresh({
      source: "vendor",
      entity: "vendor",
      action: "signup",
      user_id: vendor.user_id,
    });

    res.status(201).json({
      message: "Vendor account created successfully. Please sign in.",
    });
  })
);

// ─── POST /vendor/auth/signin ────────────────────────────────
vendorAuthRouter.post(
  "/signin",
  validate(vendorSigninSchema),
  asyncWrapper(async (req, res) => {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError("Invalid email or password", 401);
    if (user.deleted_at) throw new AppError("Account has been deleted", 403);
    if (user.role !== "vendor")
      throw new AppError("Invalid email or password", 401);
    if (!user.is_active)
      throw new AppError("Account has been suspended", 403);

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) throw new AppError("Invalid email or password", 401);

    const payload = { userId: user.user_id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    setAuthCookies(res, accessToken, refreshToken);

    await pushNotification({
      userId: user.user_id,
      type: "system",
      title: "Sign-in successful",
      message: "You signed in to your vendor dashboard successfully.",
      data: { user_id: user.user_id },
      sendOfflineEmail: false,
    }).catch(() => {});

    emitAdminDashboardRefresh({
      source: "vendor",
      entity: "vendor",
      action: "login",
      user_id: user.user_id,
      email: user.email,
    });

    res.json({ message: "Signed in successfully", accessToken });
  })
);

// ─── POST /vendor/auth/logout ────────────────────────────────
vendorAuthRouter.post(
  "/logout",
  asyncWrapper(async (_req, res) => {
    clearAuthCookies(res);
    res.json({ message: "Logged out successfully" });
  })
);

// ─── POST /vendor/auth/refresh ───────────────────────────────
vendorAuthRouter.post(
  "/refresh",
  asyncWrapper(async (req, res) => {
    const token =
      req?.cookies?.refreshToken ||
      req?.headers?.authorization?.split(" ")[1];

    if (!token) throw new AppError("Refresh token missing", 401);

    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch (e) {
      throw new AppError("Invalid or expired refresh token", 401);
    }

    const user = await prisma.user.findUnique({
      where: { user_id: decoded.userId },
      select: { user_id: true, role: true, deleted_at: true, is_active: true },
    });

    if (!user) throw new AppError("User not found", 401);
    if (user.deleted_at) throw new AppError("Account has been deleted", 403);
    if (user.role !== "vendor")
      throw new AppError("Invalid refresh token", 401);
    if (!user.is_active)
      throw new AppError("Account has been suspended", 403);

    const payload = { userId: user.user_id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    setAuthCookies(res, accessToken, refreshToken);

    res.json({ message: "Tokens refreshed", accessToken });
  })
);

// ─── POST /vendor/auth/forgot-password ───────────────────────
vendorAuthRouter.post(
  "/forgot-password",
  validate(vendorForgotPasswordSchema),
  asyncWrapper(async (req, res) => {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || user.deleted_at || !user.is_active || user.role !== "vendor") {
      return res.json({ message: "If an account with that email exists, a password reset link has been sent" });
    }

    const resetToken = generateResetToken({ userId: user.user_id });
    const resetUrl = `${FRONTEND_URL_VENDOR}/auth/vendor/reset-password?token=${resetToken}`;

    try {
      await sendPasswordResetEmail(user.email, resetUrl, "Vendor");
    } catch (emailErr) {
      console.error("Failed to send vendor reset email:", emailErr.message);
    }

    res.json({ message: "If an account with that email exists, a password reset link has been sent" });
  })
);

// ─── POST /vendor/auth/reset-password ────────────────────────
vendorAuthRouter.post(
  "/reset-password",
  validate(vendorResetPasswordSchema),
  asyncWrapper(async (req, res) => {
    const { token, new_password } = req.body;

    let decoded;
    try {
      decoded = verifyResetToken(token);
    } catch {
      throw new AppError("Invalid or expired reset token", 400);
    }

    const user = await prisma.user.findUnique({ where: { user_id: decoded.userId } });
    if (!user || user.deleted_at) throw new AppError("User not found", 404);
    if (user.role !== "vendor") throw new AppError("Invalid reset token", 400);
    if (!user.is_active) throw new AppError("Account has been suspended", 403);

    const hashedPassword = await bcrypt.hash(new_password, SALT_ROUNDS);
    await prisma.user.update({ where: { user_id: decoded.userId }, data: { password: hashedPassword } });

    res.json({ message: "Password reset successfully. Please sign in with your new password." });
  })
);

// ─── POST /vendor/auth/change-password (authenticated) ────────
vendorAuthRouter.post(
  "/change-password",
  userAuth,
  validate(vendorChangePasswordSchema),
  asyncWrapper(async (req, res) => {
    const { current_password, new_password } = req.body;

    const user = await prisma.user.findUnique({ where: { user_id: req.userId } });
    if (!user || user.deleted_at) throw new AppError("User not found", 404);
    if (user.role !== "vendor") throw new AppError("Access denied", 403);

    const isMatch = await bcrypt.compare(current_password, user.password);
    if (!isMatch) throw new AppError("Current password is incorrect", 401);

    const hashedPassword = await bcrypt.hash(new_password, SALT_ROUNDS);
    await prisma.user.update({ where: { user_id: req.userId }, data: { password: hashedPassword } });

    clearAuthCookies(res);
    res.json({ message: "Password changed successfully. Please sign in again." });
  })
);
