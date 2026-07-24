/* ═══════════════════════════════════════════════════
   OTP Service
   
   Generates 6-digit OTP codes, sends them via email,
   and verifies them against the database.
   ═══════════════════════════════════════════════════ */

import { db } from './db';
import { sendEmail } from './email-provider';

export type OtpPurpose =
  | 'login'
  | 'set_password'
  | 'change_email'
  | 'change_password'
  | 'update_profile';

const OTP_EXPIRY_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute between OTPs

/**
 * Generate a cryptographically random 6-digit OTP.
 */
function generateOtpCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const num = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
  return (Math.abs(num) % 1_000_000).toString().padStart(6, '0');
}

/**
 * Get human-readable purpose label for email content.
 */
function purposeLabel(purpose: OtpPurpose): string {
  const labels: Record<OtpPurpose, string> = {
    login: 'Login Verification',
    set_password: 'Set Your Password',
    change_email: 'Change Email Verification',
    change_password: 'Change Password Verification',
    update_profile: 'Profile Update Verification',
  };
  return labels[purpose] || 'Verification';
}

/**
 * Build HTML email template for OTP.
 */
function buildOtpEmailHtml(code: string, purpose: OtpPurpose, appName = 'DeepMindQ'): string {
  const label = purposeLabel(purpose);
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);overflow:hidden;">
        <tr>
          <td style="background:linear-gradient(135deg,#B8860B,#D4A843);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">${appName}</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:40px;">
            <h2 style="margin:0 0 8px;color:#111827;font-size:20px;">${label}</h2>
            <p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.5;">
              Use the following code to complete your request. This code expires in ${OTP_EXPIRY_MINUTES} minutes.
            </p>
            <div style="background:#f3f4f6;border-radius:8px;padding:20px;text-align:center;margin:0 0 24px;">
              <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#B8860B;font-family:monospace;">${code}</span>
            </div>
            <p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">
              If you did not request this code, please ignore this email. Do not share this code with anyone.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #f3f4f6;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;">&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export interface RequestOtpResult {
  success: boolean;
  error?: string;
  // For dev/fallback: if email fails, return the code so UI can show it
  devCode?: string;
}

/**
 * Request an OTP for a given email and purpose.
 * - Creates or finds the user
 * - Rate-limits OTP sending
 * - Sends OTP via configured email provider
 * - Falls back to logging the code if email fails
 */
export async function requestOtp(
  email: string,
  purpose: OtpPurpose
): Promise<RequestOtpResult> {
  const normalizedEmail = email.trim().toLowerCase();

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { success: false, error: 'Invalid email format' };
  }

  // Upsert user (create if not exists)
  let user = await db.user.findUnique({ where: { email: normalizedEmail } });

  if (!user) {
    // For 'change_email' purpose, don't create a new user
    if (purpose === 'change_email') {
      return { success: false, error: 'User not found' };
    }
    user = await db.user.create({
      data: {
        email: normalizedEmail,
        name: normalizedEmail.split('@')[0],
      },
    });
  }

  if (!user.isActive) {
    return { success: false, error: 'Account is deactivated' };
  }

  // Rate limit: check last OTP for this email + purpose
  const recentOtp = await db.otpCode.findFirst({
    where: {
      email: normalizedEmail,
      purpose,
      createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) },
    },
    orderBy: { createdAt: 'desc' },
  });

  if (recentOtp) {
    const remaining = Math.ceil(
      (RATE_LIMIT_WINDOW_MS - (Date.now() - recentOtp.createdAt.getTime())) / 1000
    );
    return {
      success: false,
      error: `Please wait ${remaining} seconds before requesting another code`,
    };
  }

  // Invalidate all previous unverified OTPs for this email + purpose
  await db.otpCode.updateMany({
    where: {
      email: normalizedEmail,
      purpose,
      verified: false,
      expiresAt: { gt: new Date() },
    },
    data: { verified: true }, // mark old ones as "consumed"
  });

  // Generate and store new OTP
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

  await db.otpCode.create({
    data: {
      userId: user.id,
      email: normalizedEmail,
      code,
      purpose,
      expiresAt,
    },
  });

  // Send email
  const htmlContent = buildOtpEmailHtml(code, purpose);
  let emailSent = false;

  const config = {
    provider: process.env.EMAIL_PROVIDER || 'resend',
    hasKey: !!process.env.EMAIL_API_KEY,
  };

  if (config.hasKey) {
    const emailResult = await sendEmail({
      to: normalizedEmail,
      subject: `DeepMindQ - ${purposeLabel(purpose)}`,
      html: htmlContent,
      from: process.env.EMAIL_FROM || 'noreply@deepmindq.com',
    });

    if (emailResult.success) {
      emailSent = true;
      console.log(`[OTP] Code sent to ${normalizedEmail} via ${emailResult.provider}`);
    } else {
      console.error(`[OTP] Email send failed (${emailResult.provider}): ${emailResult.error}`);
    }
  } else {
    console.warn(`[OTP] No EMAIL_API_KEY configured (provider: ${config.provider}). OTP will be returned in response.`);
  }

  // Log the code when dev bypass is explicitly enabled
  const devBypassEnabled = process.env.ENABLE_DEV_AUTH_BYPASS === 'true';
  if (devBypassEnabled) {
    console.log(`[OTP] DEV — Code for ${normalizedEmail}: ${code}`);
  }

  // If email was NOT sent
  if (!emailSent) {
    if (devBypassEnabled) {
      console.log(`[OTP] FALLBACK — Code for ${normalizedEmail}: ${code}`);
      return { success: true, devCode: code };
    }
    console.error(`[OTP] Email service not configured and not in dev mode. Cannot send OTP to ${normalizedEmail}.`);
    return { success: false, error: 'Email service not configured. Please contact support.' };
  }

  return { success: true };
}

export interface VerifyOtpResult {
  success: boolean;
  error?: string;
  userId?: string;
  otpId?: string;
  needsPassword: boolean; // true if user hasn't set password yet
}

/**
 * Verify an OTP code.
 */
export async function verifyOtp(
  email: string,
  code: string,
  purpose: OtpPurpose
): Promise<VerifyOtpResult> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!code || code.length !== 6) {
    return { success: false, error: 'Invalid code format', needsPassword: false };
  }

  const otp = await db.otpCode.findFirst({
    where: {
      email: normalizedEmail,
      code,
      purpose,
      verified: false,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });

  if (!otp) {
    return { success: false, error: 'Invalid or expired code', needsPassword: false };
  }

  // Check attempts
  if (otp.attempts >= MAX_ATTEMPTS) {
    await db.otpCode.update({
      where: { id: otp.id },
      data: { verified: true }, // invalidate
    });
    return { success: false, error: 'Too many attempts. Please request a new code.', needsPassword: false };
  }

  // Increment attempts
  await db.otpCode.update({
    where: { id: otp.id },
    data: { attempts: { increment: 1 } },
  });

  // Verify
  await db.otpCode.update({
    where: { id: otp.id },
    data: { verified: true },
  });

  return {
    success: true,
    userId: otp.userId ?? undefined,
    otpId: otp.id,
    needsPassword: !otp.user?.hasPassword,
  };
}