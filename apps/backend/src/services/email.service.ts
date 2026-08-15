/**
 * email.service.ts
 *
 * Nodemailer-based email service using Gmail SMTP.
 * Configure via .env:
 *   SMTP_USER   — your Gmail address
 *   SMTP_PASS   — your 16-char Google App Password
 *   EMAIL_FROM  — display name + address
 *   APP_URL     — frontend base URL (for links in emails)
 */

import nodemailer from 'nodemailer';

// ── Transporter ───────────────────────────────────────────────────────────────
const createTransporter = () => {
  const host = process.env.SMTP_HOST || 'smtp.gmail.com';
  const port = parseInt(process.env.SMTP_PORT || '587', 10);
  const secure = process.env.SMTP_SECURE === 'true'; // true = 465, false = STARTTLS

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn('[Email] SMTP_USER or SMTP_PASS not set — emails will NOT be sent.');
    return null;
  }

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false },
  });
};

const transporter = createTransporter();
const FROM = process.env.EMAIL_FROM || `AI Platform <${process.env.SMTP_USER}>`;
// Lazy getter — read env at call time, not at module load time.
// This guarantees dotenv has already run before the value is consumed.
const getAppUrl = () => process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:5174';

// ── Helpers ───────────────────────────────────────────────────────────────────
async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  if (!transporter) {
    console.warn(`[Email] Skipping email to ${to} — no SMTP transporter configured.`);
    return false;
  }
  // Prevent sending real emails to dummy testing domains to avoid bounce backs
  if (process.env.TEST_MODE === 'true' && (to.endsWith('@example.com') || to.endsWith('@test.com'))) {
    console.log(`[Email] Skipping email to ${to} — test domain detected in TEST_MODE.`);
    return true;
  }
  try {
    const info = await transporter.sendMail({ from: FROM, to, subject, html });
    console.info(`[Email] Sent "${subject}" to ${to} — messageId: ${info.messageId}`);
    return true;
  } catch (err) {
    console.error(`[Email] Failed to send "${subject}" to ${to}:`, err);
    return false;
  }
}

// ── Templates ─────────────────────────────────────────────────────────────────
const baseTemplate = (content: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>AI Enterprise Platform</title>
</head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="padding:0 0 24px 0;" align="center">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:linear-gradient(135deg,#3b82f6,#7c3aed);border-radius:14px;padding:12px 16px;" align="center">
                  <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:-0.5px;">⚡ AI Platform</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Card -->
        <tr>
          <td style="background:#18181b;border:1px solid #27272a;border-radius:20px;padding:40px 36px;">
            ${content}
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:24px 0 0 0;" align="center">
            <p style="color:#52525b;font-size:12px;margin:0;">
              AI Enterprise Automation Platform · If you didn't request this, you can safely ignore this email.
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>
`;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Send a password reset email with a secure reset link.
 */
export async function sendPasswordResetEmail(
  to: string,
  resetToken: string,
  firstName?: string | null
): Promise<boolean> {
  const resetUrl = `${getAppUrl()}/reset-password?token=${resetToken}`;
  const name = firstName || to.split('@')[0];

  const html = baseTemplate(`
    <h2 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 8px 0;">Reset your password</h2>
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 28px 0;">
      Hi <strong style="color:#e4e4e7;">${name}</strong>, we received a request to reset the password
      for your AI Platform account. Click the button below to choose a new password.
    </p>

    <!-- CTA Button -->
    <table cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center" style="padding:0 0 28px 0;">
          <a href="${resetUrl}"
             style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#6d28d9);color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:12px;letter-spacing:0.2px;">
            Reset Password
          </a>
        </td>
      </tr>
    </table>

    <!-- Info boxes -->
    <table cellpadding="0" cellspacing="0" width="100%" style="background:#09090b;border:1px solid #27272a;border-radius:12px;margin:0 0 20px 0;">
      <tr>
        <td style="padding:16px 20px;">
          <p style="color:#71717a;font-size:13px;margin:0 0 4px 0;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">⏱ Expires in</p>
          <p style="color:#e4e4e7;font-size:14px;margin:0;">1 hour from when this email was sent</p>
        </td>
      </tr>
    </table>

    <p style="color:#71717a;font-size:13px;line-height:1.6;margin:0 0 8px 0;">
      If the button doesn't work, copy and paste this link into your browser:
    </p>
    <p style="margin:0;">
      <a href="${resetUrl}" style="color:#3b82f6;font-size:12px;word-break:break-all;">${resetUrl}</a>
    </p>

    <hr style="border:none;border-top:1px solid #27272a;margin:28px 0 20px 0;" />
    <p style="color:#52525b;font-size:13px;margin:0;">
      🔒 This link is single-use and will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password won't change.
    </p>
  `);

  return sendMail(to, 'Reset your AI Platform password', html);
}

/**
 * Send a 6-digit OTP email for password reset.
 */
export async function sendOtpEmail(
  to: string,
  otp: string,
  firstName?: string | null
): Promise<boolean> {
  const name = firstName || to.split('@')[0];
  const digits = otp.split('');

  const digitBox = (d: string) =>
    `<td style="padding:0 6px;"><div style="width:52px;height:64px;background:#09090b;border:2px solid #3b82f6;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:32px;font-weight:800;color:#fff;text-align:center;line-height:64px;">${d}</div></td>`;

  const html = baseTemplate(`
    <h2 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 8px 0;">Password Reset Code</h2>
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 28px 0;">
      Hi <strong style="color:#e4e4e7;">${name}</strong>, use the verification code below to reset your AI Platform password.
    </p>

    <!-- OTP Box -->
    <table cellpadding="0" cellspacing="0" width="100%" style="margin:0 0 28px 0;">
      <tr>
        <td align="center">
          <table cellpadding="0" cellspacing="0">
            <tr>
              ${digits.map(digitBox).join('')}
            </tr>
          </table>
        </td>
      </tr>
    </table>

    <!-- Info boxes -->
    <table cellpadding="0" cellspacing="0" width="100%" style="background:#09090b;border:1px solid #27272a;border-radius:12px;margin:0 0 16px 0;">
      <tr><td style="padding:14px 20px;">
        <p style="color:#71717a;font-size:12px;margin:0 0 2px 0;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">⏱ Expires in</p>
        <p style="color:#e4e4e7;font-size:14px;margin:0;">10 minutes from when this email was sent</p>
      </td></tr>
    </table>

    <table cellpadding="0" cellspacing="0" width="100%" style="background:#09090b;border:1px solid #ef4444;border-radius:12px;margin:0 0 20px 0;">
      <tr><td style="padding:14px 20px;">
        <p style="color:#ef4444;font-size:13px;margin:0;font-weight:600;">⚠️ Never share this code with anyone — AI Platform staff will never ask for it.</p>
      </td></tr>
    </table>

    <hr style="border:none;border-top:1px solid #27272a;margin:20px 0;" />
    <p style="color:#52525b;font-size:13px;margin:0;">
      🔒 This code is single-use and expires in 10 minutes. If you didn't request a password reset, ignore this email — your password remains unchanged.
    </p>
  `);

  return sendMail(to, 'Password Reset Verification Code — AI Platform', html);
}


/**
 * Send a welcome email after registration.
 */
export async function sendWelcomeEmail(to: string, firstName?: string | null): Promise<boolean> {
  const name = firstName || to.split('@')[0];
  const loginUrl = `${getAppUrl()}/login`;

  const html = baseTemplate(`
    <h2 style="color:#fff;font-size:22px;font-weight:700;margin:0 0 8px 0;">Welcome aboard, ${name}! 🎉</h2>
    <p style="color:#a1a1aa;font-size:15px;line-height:1.6;margin:0 0 24px 0;">
      Your AI Enterprise Automation Platform account has been created. You're all set to start automating workflows, building AI integrations, and collaborating with your team.
    </p>

    <table cellpadding="0" cellspacing="0" width="100%" style="background:#09090b;border:1px solid #27272a;border-radius:12px;margin:0 0 28px 0;">
      <tr><td style="padding:20px 24px;">
        <p style="color:#71717a;font-size:12px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 12px 0;">What you can do now</p>
        <table cellpadding="0" cellspacing="0">
          <tr><td style="padding:4px 0;color:#a1a1aa;font-size:14px;">⚡ &nbsp;Build visual automation workflows</td></tr>
          <tr><td style="padding:4px 0;color:#a1a1aa;font-size:14px;">🤖 &nbsp;Chat with GPT-4o, Gemini, and Ollama</td></tr>
          <tr><td style="padding:4px 0;color:#a1a1aa;font-size:14px;">📊 &nbsp;Monitor AI usage and analytics</td></tr>
          <tr><td style="padding:4px 0;color:#a1a1aa;font-size:14px;">👥 &nbsp;Invite your team and assign roles</td></tr>
        </table>
      </td></tr>
    </table>

    <table cellpadding="0" cellspacing="0" width="100%">
      <tr>
        <td align="center">
          <a href="${loginUrl}"
             style="display:inline-block;background:linear-gradient(135deg,#3b82f6,#6d28d9);color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:12px;">
            Go to Dashboard →
          </a>
        </td>
      </tr>
    </table>
  `);

  return sendMail(to, `Welcome to AI Platform, ${name}!`, html);
}

export { sendMail };
