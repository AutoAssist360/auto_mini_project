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
} from "../../../utils/tokenHelper.js";
import { validate } from "../../../middleware/validate.js";
import { adminSigninSchema, adminForgotPasswordSchema, adminResetPasswordSchema, adminChangePasswordSchema } from "../admin.schemas.js";
import { userAuth } from "../../../middleware/auth.js";
import { sendPasswordResetEmail } from "../../../utils/emailService.js";
import { FRONTEND_URL_ADMIN } from "../../../../config.js";
import { emitAdminDashboardRefresh, pushNotification } from "../../../socket.js";

export const adminAuthRouter = Router();

// ─── POST /admin/auth/signin ─────────────────────────────────
adminAuthRouter.post(
  "/signin",
  validate(adminSigninSchema),
  asyncWrapper(async (req, res) => {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw new AppError("Invalid email or password", 401);
    if (user.deleted_at) throw new AppError("Invalid email or password", 401);
    if (user.role !== "admin") throw new AppError("Invalid email or password", 401);
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
      message: "You signed in to the admin dashboard successfully.",
      data: { user_id: user.user_id },
      sendOfflineEmail: false,
    }).catch(() => {});

    emitAdminDashboardRefresh({
      source: "admin",
      entity: "admin",
      action: "login",
      actor_user_id: user.user_id,
      user_id: user.user_id,
      email: user.email,
    });

    res.json({ message: "Signed in successfully", accessToken });
  })
);

// ─── POST /admin/auth/logout ─────────────────────────────────
adminAuthRouter.post("/logout", (_req, res) => {
  clearAuthCookies(res);
  res.json({ message: "Logged out successfully" });
});

// ─── POST /admin/auth/refresh ────────────────────────────────
adminAuthRouter.post(
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
    if (user.role !== "admin") throw new AppError("Access denied", 403);
    if (!user.is_active) throw new AppError("Account has been suspended", 403);

    const payload = { userId: user.user_id, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    setAuthCookies(res, accessToken, refreshToken);

    res.json({ message: "Tokens refreshed", accessToken });
  })
);

const SALT_ROUNDS = 10;

// ─── POST /admin/auth/forgot-password ────────────────────────
adminAuthRouter.post(
  "/forgot-password",
  validate(adminForgotPasswordSchema),
  asyncWrapper(async (req, res) => {
    const { email } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });

    // Always respond with success to prevent email enumeration
    if (!user || user.deleted_at || !user.is_active || user.role !== "admin") {
      return res.json({ message: "If an account with that email exists, a password reset link has been sent" });
    }

    const resetToken = generateResetToken({ userId: user.user_id });
    const resetUrl = `${FRONTEND_URL_ADMIN}/admin/reset-password?token=${resetToken}`;

    try {
      await sendPasswordResetEmail(user.email, resetUrl, "Admin");
    } catch (emailErr) {
      console.error("Failed to send admin reset email:", emailErr.message);
    }

    res.json({ message: "If an account with that email exists, a password reset link has been sent" });
  })
);

// ─── POST /admin/auth/reset-password ─────────────────────────
adminAuthRouter.post(
  "/reset-password",
  validate(adminResetPasswordSchema),
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
    if (user.role !== "admin") throw new AppError("Invalid reset token", 400);
    if (!user.is_active) throw new AppError("Account has been suspended", 403);

    const hashedPassword = await bcrypt.hash(new_password, SALT_ROUNDS);
    await prisma.user.update({ where: { user_id: decoded.userId }, data: { password: hashedPassword } });

    res.json({ message: "Password reset successfully. Please sign in with your new password." });
  })
);

// ─── POST /admin/auth/change-password (authenticated) ────────
adminAuthRouter.post(
  "/change-password",
  userAuth,
  validate(adminChangePasswordSchema),
  asyncWrapper(async (req, res) => {
    const { current_password, new_password } = req.body;

    const user = await prisma.user.findUnique({ where: { user_id: req.userId } });
    if (!user || user.deleted_at) throw new AppError("User not found", 404);
    if (user.role !== "admin") throw new AppError("Access denied", 403);

    const isMatch = await bcrypt.compare(current_password, user.password);
    if (!isMatch) throw new AppError("Current password is incorrect", 401);

    const hashedPassword = await bcrypt.hash(new_password, SALT_ROUNDS);
    await prisma.user.update({ where: { user_id: req.userId }, data: { password: hashedPassword } });

    clearAuthCookies(res);
    res.json({ message: "Password changed successfully. Please sign in again." });
  })
);
