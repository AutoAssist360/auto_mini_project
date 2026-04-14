import { BREVO_API_KEY, EMAIL_FROM } from "../../config.js";

// ─── Send helpers ───────────────────────────────────────────

/**
 * Generic send function using Brevo Transactional Email API
 */
export async function sendEmail({ to, subject, text, html }) {
  if (!BREVO_API_KEY) {
    // Dev fallback — logs to console
    console.log("───── EMAIL (dev-mode – no Brevo API Key configured) ─────");
    console.log("To:     ", to);
    console.log("Subject:", subject);
    console.log("Body:\n", text || html);
    console.log("──────────────────────────────────────────────────────────");
    return { messageId: "dev-mode" };
  }

  try {
    const response = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: {
        "accept": "application/json",
        "api-key": BREVO_API_KEY,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        sender: { name: "Quick Auto Assist", email: EMAIL_FROM },
        to: [{ email: to }],
        subject: subject,
        htmlContent: html,
        textContent: text,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error("Brevo Email API Error:", errorData);
      throw new Error("Failed to send email via Brevo.");
    }

    const data = await response.json();
    return data; // contains messageId
  } catch (error) {
    console.error("Error sending email:", error);
    throw error;
  }
}

/**
 * Send a password-reset link.
 * @param {string} to        — recipient email
 * @param {string} resetUrl  — fully-qualified link e.g. http://localhost:5174/auth/user/reset-password?token=xyz
 * @param {string} roleName  — "User" | "Technician" | "Vendor" (for display)
 */
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
