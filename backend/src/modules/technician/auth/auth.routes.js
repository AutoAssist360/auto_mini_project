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
  techSigninSchema,
  techForgotPasswordSchema,
  techResetPasswordSchema,
  techChangePasswordSchema,
  techSendOtpSchema,
  techSignupWithOtpSchema,
} from "../technician.schemas.js";
import { userAuth } from "../../../middleware/auth.js";
import { sendPasswordResetEmail, sendOtpEmail } from "../../../utils/emailService.js";
import { FRONTEND_URL_TECH } from "../../../../config.js";
import { emitAdminDashboardRefresh, pushNotification } from "../../../socket.js";
import crypto from "crypto";

export const techAuthRouter = Router();

const SALT_ROUNDS = 10;

techAuthRouter.post(
  "/send-otp",
  validate(techSendOtpSchema),
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
      purpose: "technician-signup-otp",
    });

    try {
      await sendOtpEmail(email, otp);
    } catch (emailErr) {
      console.error("Failed to send technician OTP email:", emailErr.message);
    }

    res.json({
      message: "Verification code sent to your email",
      otp_token: otpToken,
    });
  })
);

// ─── POST /tech/auth/signup ──────────────────────────────────────
techAuthRouter.post(
  "/signup",
  validate(techSignupWithOtpSchema),
  asyncWrapper(async (req, res) => {
    const {
      email,
      password,
      full_name,
      phone_number,
      business_name,
      technician_type,
      location,
      latitude,
      longitude,
      service_radius,
      otp_token,
      otp,
    } = req.body;

    let decoded;
    try {
      decoded = verifyOtpToken(otp_token);
    } catch {
      throw new AppError("Verification code expired. Please request a new one.", 400);
    }

    if (decoded.purpose !== "technician-signup-otp" || decoded.email !== email) {
      throw new AppError("Invalid verification token", 400);
    }

    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    if (otpHash !== decoded.otp_hash) {
      throw new AppError("Invalid verification code", 400);
    }

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone_number }] },
    });

    if (existingUser) {
      const field = existingUser.email === email ? "email" : "phone number";
      throw new AppError(`An account with this ${field} already exists`, 409);
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    const createdUser = await prisma.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          full_name,
          phone_number,
          role: "technician",
        },
      });

      await tx.technicianProfile.create({
        data: {
          user_id: newUser.user_id,
          business_name: business_name || null,
          technician_type,
          location,
          latitude,
          longitude,
          service_radius,
        },
      });

      return newUser;
    });

    emitAdminDashboardRefresh({
      source: "technician",
      entity: "technician",
      action: "signup",
      user_id: createdUser.user_id,
    });

    res.status(201).json({
      message: "Technician account created successfully. Please sign in.",
    });
  })
);

// ─── POST /tech/auth/signin ─────────────────────────────────────
techAuthRouter.post(
  "/signin",
  validate(techSigninSchema),
  asyncWrapper(async (req, res) => {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError("Invalid email or password", 401);
    if (user.deleted_at) throw new AppError("Account has been deleted", 403);
    if (user.role !== "technician") throw new AppError("Invalid email or password", 401);
    if (!user.is_active) throw new AppError("Account has been suspended", 403);

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
      message: "You signed in to your technician dashboard successfully.",
      data: { user_id: user.user_id },
      sendOfflineEmail: false,
    }).catch(() => {});

    emitAdminDashboardRefresh({
      source: "technician",
      entity: "technician",
      action: "login",
      user_id: user.user_id,
      email: user.email,
    });

    res.json({ message: "Signed in successfully", accessToken });
  })
);

// ─── POST /tech/auth/logout ─────────────────────────────────────
techAuthRouter.post("/logout", (_req, res) => {
  clearAuthCookies(res);
  res.json({ message: "Logged out successfully" });
});

// ─── POST /tech/auth/refresh ────────────────────────────────────
techAuthRouter.post(
  "/refresh",
  asyncWrapper(async (req, res) => {
    const token = req?.cookies?.refreshToken || req?.body?.refreshToken;
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

    if (!user || user.deleted_at) throw new AppError("Account not found", 401);
    if (user.role !== "technician") throw new AppError("Access denied", 403);
    if (!user.is_active) throw new AppError("Account has been suspended", 403);

    const payload = { userId: user.user_id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    setAuthCookies(res, accessToken, refreshToken);

    res.json({ message: "Tokens refreshed", accessToken });
  })
);

// ─── POST /tech/auth/forgot-password ────────────────────────────
techAuthRouter.post(
  "/forgot-password",
  validate(techForgotPasswordSchema),
  asyncWrapper(async (req, res) => {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    // Always respond with success to prevent email enumeration
    if (!user || user.deleted_at || !user.is_active || user.role !== "technician") {
      return res.json({ message: "If an account with that email exists, a password reset link has been sent" });
    }

    const resetToken = generateResetToken({ userId: user.user_id });
    const resetUrl = `${FRONTEND_URL_TECH}/auth/technician/reset-password?token=${resetToken}`;

    try {
      await sendPasswordResetEmail(user.email, resetUrl, "Technician");
    } catch (emailErr) {
      console.error("Failed to send tech reset email:", emailErr.message);
    }

    res.json({ message: "If an account with that email exists, a password reset link has been sent" });
  })
);

// ─── POST /tech/auth/reset-password ─────────────────────────────
techAuthRouter.post(
  "/reset-password",
  validate(techResetPasswordSchema),
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
    if (user.role !== "technician") throw new AppError("Invalid reset token", 400);
    if (!user.is_active) throw new AppError("Account has been suspended", 403);

    const hashedPassword = await bcrypt.hash(new_password, SALT_ROUNDS);
    await prisma.user.update({ where: { user_id: decoded.userId }, data: { password: hashedPassword } });

    res.json({ message: "Password reset successfully. Please sign in with your new password." });
  })
);

// ─── POST /tech/auth/change-password (authenticated) ────────────
techAuthRouter.post(
  "/change-password",
  userAuth,
  validate(techChangePasswordSchema),
  asyncWrapper(async (req, res) => {
    const { current_password, new_password } = req.body;

    const user = await prisma.user.findUnique({ where: { user_id: req.userId } });
    if (!user || user.deleted_at) throw new AppError("User not found", 404);
    if (user.role !== "technician") throw new AppError("Access denied", 403);

    const isMatch = await bcrypt.compare(current_password, user.password);
    if (!isMatch) throw new AppError("Current password is incorrect", 401);

    const hashedPassword = await bcrypt.hash(new_password, SALT_ROUNDS);
    await prisma.user.update({ where: { user_id: req.userId }, data: { password: hashedPassword } });

    clearAuthCookies(res);
    res.json({ message: "Password changed successfully. Please sign in again." });
  })
);
