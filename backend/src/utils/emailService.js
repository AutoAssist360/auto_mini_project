import nodemailer from "nodemailer";
import {
  IS_PRODUCTION,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
} from "../../config.js";

let transporter = null;
let transporterMode = "disabled";

if (SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  transporterMode = "smtp";
} else if (!IS_PRODUCTION) {
  transporter = {
    sendMail: async (mailOptions) => {
      console.log("----- EMAIL (dev mode, SMTP not configured) -----");
      console.log("To:     ", mailOptions.to);
      console.log("Subject:", mailOptions.subject);
      console.log("Body:\n", mailOptions.text || mailOptions.html);
      console.log("-------------------------------------------------");
      return { messageId: "dev-mode" };
    },
  };
  transporterMode = "console";
}

export async function sendEmail({ to, subject, text, html }) {
  if (!transporter) {
    throw new Error(
      "Email delivery is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM in the deployment environment."
    );
  }

  try {
    return await transporter.sendMail({
      from: SMTP_FROM || SMTP_USER || "Quick Auto Assist <noreply@quickautoassist.com>",
      to,
      subject,
      text,
      html,
    });
  } catch (error) {
    const details = error?.response || error?.message || "Unknown SMTP error";
    throw new Error(`Failed to send email via ${transporterMode}: ${details}`);
  }
}

export async function sendPasswordResetEmail(to, resetUrl, roleName = "User") {
  const subject = "Quick Auto Assist - Reset Your Password";
  const text = `Hi,\n\nYou requested a password reset for your ${roleName} account.\n\nClick the link below (valid for 15 minutes):\n${resetUrl}\n\nIf you did not request this, please ignore this email.\n\n- Quick Auto Assist`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#2563eb;">Quick Auto Assist</h2>
      <p>Hi,</p>
      <p>You requested a password reset for your <strong>${roleName}</strong> account.</p>
      <p>
        <a href="${resetUrl}"
           style="display:inline-block;padding:10px 24px;background:#2563eb;color:#fff;
                  border-radius:8px;text-decoration:none;font-weight:600;">
          Reset Password
        </a>
      </p>
      <p style="font-size:13px;color:#64748b;">This link expires in 15 minutes. If you did not request this, ignore this email.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
      <p style="font-size:12px;color:#94a3b8;">- Quick Auto Assist</p>
    </div>
  `;

  return sendEmail({ to, subject, text, html });
}

export async function sendOtpEmail(to, otp) {
  const subject = "Quick Auto Assist - Your Verification Code";
  const text = `Hi,\n\nYour verification code is: ${otp}\n\nThis code expires in 10 minutes. If you did not request this, please ignore this email.\n\n- Quick Auto Assist`;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:24px;">
      <h2 style="color:#2563eb;">Quick Auto Assist</h2>
      <p>Hi,</p>
      <p>Your verification code is:</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:6px;color:#2563eb;margin:16px 0;">${otp}</p>
      <p style="font-size:13px;color:#64748b;">This code expires in 10 minutes. If you did not request this, ignore this email.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0;"/>
      <p style="font-size:12px;color:#94a3b8;">- Quick Auto Assist</p>
    </div>
  `;

  return sendEmail({ to, subject, text, html });
}
