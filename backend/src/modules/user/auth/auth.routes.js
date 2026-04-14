import { Router } from "express";
import bcrypt from "bcrypt";
import { prisma } from "../../../lib/prisma.js";
import { asyncWrapper } from "../../../utils/asyncWrapper.js";
import { AppError } from "../../../utils/AppError.js";
import { setAuthCookies, clearAuthCookies } from "../../../utils/cookieHelper.js";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateResetToken,
  verifyResetToken,
  generateOtpToken,
  verifyOtpToken,
} from "../../../utils/tokenHelper.js";
import { validate } from "../../../middleware/validate.js";
import {
  signupSchema,
  signinSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  sendOtpSchema,
  signupWithOtpSchema,
} from "./auth.schemas.js";
import { userAuth } from "../../../middleware/auth.js";
import { sendPasswordResetEmail, sendOtpEmail } from "../../../utils/emailService.js";
import { FRONTEND_URL_USER } from "../../../../config.js";
import crypto from "crypto";
import { emitAdminDashboardRefresh, pushNotification } from "../../../socket.js";

export const authRouter = Router();

const SALT_ROUNDS = 10;

// ─── POST /auth/send-otp ────────────────────────────────────────
authRouter.post(
  "/send-otp",
  validate(sendOtpSchema),
  asyncWrapper(async (req, res) => {
    const { email } = req.body;

    // Check if email is already taken
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser && !existingUser.deleted_at) {
      throw new AppError("An account with this email already exists", 409);
    }

    // Generate 6-digit OTP
    const otp = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");

    // Sign a JWT containing the email + hashed OTP (expires in 10 min)
    const otpToken = generateOtpToken({
      email,
      otp_hash: otpHash,
      purpose: "signup-otp",
    });

    // Send OTP via email (fire-and-forget in dev)
    try {
      await sendOtpEmail(email, otp);
    } catch (emailErr) {
      console.error("Failed to send OTP email:", emailErr);
      throw new AppError(
        "Unable to send the verification code right now. Please check the email service configuration and try again.",
        502
      );
    }

    res.json({
      message: "Verification code sent to your email",
      otp_token: otpToken,
    });
  })
);

// ─── POST /auth/signup (with OTP verification) ─────────────────
authRouter.post(
  "/signup",
  validate(signupWithOtpSchema),
  asyncWrapper(async (req, res) => {
    const { email, password, full_name, phone_number, otp_token, otp } = req.body;

    // Verify OTP token
    let decoded;
    try {
      decoded = verifyOtpToken(otp_token);
    } catch {
      throw new AppError("Verification code expired. Please request a new one.", 400);
    }

    if (decoded.purpose !== "signup-otp" || decoded.email !== email) {
      throw new AppError("Invalid verification token", 400);
    }

    // Verify OTP matches
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    if (otpHash !== decoded.otp_hash) {
      throw new AppError("Invalid verification code", 400);
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser && !existingUser.deleted_at) {
      throw new AppError("User already exists with this email", 409);
    }

    if (phone_number) {
      const phoneExists = await prisma.user.findUnique({
        where: { phone_number },
      });
      if (phoneExists && !phoneExists.deleted_at) {
        throw new AppError("Phone number already in use", 409);
      }
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // If user was soft-deleted, reactivate with new data; otherwise create new
    if (existingUser && existingUser.deleted_at) {
      await prisma.user.update({
        where: { user_id: existingUser.user_id },
        data: {
          password: hashedPassword,
          full_name: full_name || "",
          phone_number: phone_number || "",
          role: "user",
          is_active: true,
          deleted_at: null,
        },
      });
    } else {
      await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          full_name: full_name || "",
          phone_number: phone_number || "",
          role: "user",
        },
      });
    }

    emitAdminDashboardRefresh({
      source: "user",
      entity: "user",
      action: "signup",
      email,
    });

    res.status(201).json({
      message: "User created successfully. Please sign in.",
    });
  })
);

// ─── POST /auth/signin ──────────────────────────────────────────
authRouter.post(
  "/signin",
  validate(signinSchema),
  asyncWrapper(async (req, res) => {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      throw new AppError("Invalid email or password", 401);
    }

    if (user.deleted_at) {
      throw new AppError("Account has been deleted", 403);
    }

    if (!user.is_active) {
      throw new AppError("Account has been suspended", 403);
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      throw new AppError("Invalid email or password", 401);
    }

    const payload = { userId: user.user_id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    setAuthCookies(res, accessToken, refreshToken);

    await pushNotification({
      userId: user.user_id,
      type: "system",
      title: "Sign-in successful",
      message: "You signed in to your account successfully.",
      data: { user_id: user.user_id },
      sendOfflineEmail: false,
    }).catch(() => {});

    emitAdminDashboardRefresh({
      source: "user",
      entity: "user",
      action: "login",
      user_id: user.user_id,
      email: user.email,
    });

    res.json({
      message: "Signed in successfully",
      accessToken,
    });
  })
);

// ─── POST /auth/logout ──────────────────────────────────────────
authRouter.post("/logout", (_req, res) => {
  clearAuthCookies(res);
  res.json({ message: "Logged out successfully" });
});

// ─── POST /auth/refresh ─────────────────────────────────────────
authRouter.post(
  "/refresh",
  asyncWrapper(async (req, res) => {
    const token = req?.cookies?.refreshToken || req?.body?.refreshToken;

    if (!token) {
      throw new AppError("Refresh token missing", 401);
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch (e) {
      throw new AppError(
        "Invalid or expired refresh token. Please login again.",
        401
      );
    }

    const user = await prisma.user.findUnique({
      where: { user_id: decoded.userId },
      select: { user_id: true, role: true, deleted_at: true, is_active: true },
    });

    if (!user || user.deleted_at) {
      throw new AppError("User not found or account deleted", 401);
    }

    if (!user.is_active) {
      throw new AppError("Account has been suspended", 403);
    }

    const payload = { userId: user.user_id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    setAuthCookies(res, accessToken, refreshToken);

    res.json({
      message: "Token refreshed successfully",
      accessToken,
    });
  })
);

// ─── POST /auth/forgot-password ─────────────────────────────────
authRouter.post(
  "/forgot-password",
  validate(forgotPasswordSchema),
  asyncWrapper(async (req, res) => {
    const { email } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success to prevent email enumeration
    if (!user || user.deleted_at || !user.is_active) {
      res.json({
        message:
          "If an account with that email exists, a password reset link has been sent",
      });
      return;
    }

    const resetToken = generateResetToken({ userId: user.user_id });

    // Send reset link via email
    const resetUrl = `${FRONTEND_URL_USER}/auth/user/reset-password?token=${resetToken}`;
    try {
      await sendPasswordResetEmail(user.email, resetUrl, "User");
    } catch (emailErr) {
      console.error("Failed to send password reset email:", emailErr);
    }

    res.json({
      message:
        "If an account with that email exists, a password reset link has been sent",
    });
  })
);

// ─── POST /auth/reset-password ──────────────────────────────────
authRouter.post(
  "/reset-password",
  validate(resetPasswordSchema),
  asyncWrapper(async (req, res) => {
    const { token, new_password } = req.body;

    let decoded;
    try {
      decoded = verifyResetToken(token);
    } catch (e2) {
      throw new AppError("Invalid or expired reset token", 400);
    }

    const user = await prisma.user.findUnique({
      where: { user_id: decoded.userId },
    });

    if (!user || user.deleted_at) {
      throw new AppError("User not found", 404);
    }

    if (!user.is_active) {
      throw new AppError("Account has been suspended", 403);
    }

    const hashedPassword = await bcrypt.hash(new_password, SALT_ROUNDS);

    await prisma.user.update({
      where: { user_id: decoded.userId },
      data: { password: hashedPassword },
    });

    res.json({ message: "Password reset successfully" });
  })
);

// ─── POST /auth/change-password (authenticated) ─────────────────
authRouter.post(
  "/change-password",
  userAuth,
  validate(changePasswordSchema),
  asyncWrapper(async (req, res) => {
    const { current_password, new_password } = req.body;
    const userId = req.userId;

    const user = await prisma.user.findUnique({
      where: { user_id: userId },
    });

    if (!user || user.deleted_at) {
      throw new AppError("User not found", 404);
    }

    const isMatch = await bcrypt.compare(current_password, user.password);
    if (!isMatch) {
      throw new AppError("Current password is incorrect", 401);
    }

    const hashedPassword = await bcrypt.hash(new_password, SALT_ROUNDS);

    await prisma.user.update({
      where: { user_id: userId },
      data: { password: hashedPassword },
    });

    // Clear cookies to force re-login with new password
    clearAuthCookies(res);

    res.json({ message: "Password changed successfully. Please sign in again." });
  })
);
