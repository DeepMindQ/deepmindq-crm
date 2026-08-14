/**
 * OTP Service
 *
 * Generates 6-digit OTP codes, sends them via email,
 * and verifies them against the database.
 *
 * Uses the User model (otpCode + otpExpiresAt fields) for OTP storage
 * instead of a separate OtpCode model (which was removed in schema v1.0).
 */

import { db } from './db';
import { sendEmail } from './email-provider';
import { logger } from '@/lib/logger';

/**
 * Hash an OTP code using SHA-256 before database storage.
 * OTP codes are never stored in plaintext — only the hash persists.
 */
async function hashOtp(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`dmq:${code}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

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
            <p style="margin:0 0 24px;color:#6B7280;font-size:15px;line-height:1.5;">
              Use the following code to complete your request. This code expires in ${OTP_EXPIRY_MINUTES} minutes.
            </p>
            <div style="background:#F3F4F6;border-radius:8px;padding:20px;text-align:center;margin:0 0 24px;">
              <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#B8860B;font-family:monospace;">${code}</span>
            </div>
            <p style="margin:0;color:#9CA3AF;font-size:13px;line-height:1.5;">
              If you did not request this code, please ignore this email. Do not share this code with anyone.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #F3F4F6;text-align:center;">
            <p style="margin:0;color:#9CA3AF;font-size:12px;">&copy; ${new Date().getFullYear()} ${appName}. All rights reserved.</p>
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
 *
 * Uses the User model's otpCode and otpExpiresAt fields for storage
 * (no separate OtpCode model — schema was consolidated in v1.0).
 *
 * Rate limiting uses in-memory tracking since there's no dedicated OTP table.
 */
export async function requestOtp(
  email: string,
  purpose: OtpPurpose,
): Promise<RequestOtpResult> {
  const normalizedEmail = email.trim().toLowerCase();

  // Validate email format
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return { success: false, error: 'Invalid email format' };
  }

  // Single-user enforcement: only allow authorized email
  const AUTHORIZED_EMAIL = process.env.AUTHORIZED_EMAIL;
  if (!AUTHORIZED_EMAIL) {
    return { success: false, error: 'AUTHORIZED_EMAIL is not configured.' };
  }
  if (normalizedEmail !== AUTHORIZED_EMAIL) {
    return { success: false, error: 'This workspace is restricted to authorized personnel only.' };
  }

  // Find or create the authorized user
  let user = await db.user.findUnique({ where: { email: normalizedEmail } });

  if (!user) {
    user = await db.user.create({
      data: {
        email: normalizedEmail,
        name: AUTHORIZED_EMAIL.split('@')[0] || 'Admin',
        role: 'admin',
      },
    });
    logger.info(`[OTP] Auto-created authorized user: ${normalizedEmail}`);
  }

  // Rate limit: check if user already has a recent OTP
  if (user.otpExpiresAt && user.otpExpiresAt.getTime() > Date.now() - RATE_LIMIT_WINDOW_MS) {
    const remaining = Math.ceil(
      (RATE_LIMIT_WINDOW_MS - (Date.now() - user.otpExpiresAt.getTime())) / 1000,
    );
    if (remaining > 0) {
      return {
        success: false,
        error: `Please wait ${remaining} seconds before requesting another code`,
      };
    }
  }

  // Generate and store new OTP in User model
  const code = generateOtpCode();
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  const codeHash = await hashOtp(code);

  await db.user.update({
    where: { id: user.id },
    data: {
      otpCode: codeHash,
      otpExpiresAt: expiresAt,
    },
  });

  // Send email
  const htmlContent = buildOtpEmailHtml(code, purpose);
  let emailSent = false;

  const apiKey = process.env.EMAIL_API_KEY;
  const fromAddr = process.env.EMAIL_FROM || 'noreply@deepmindq.com';

  if (apiKey) {
    try {
      const emailResult = await sendEmail(
        normalizedEmail,
        `DeepMindQ - ${purposeLabel(purpose)}`,
        htmlContent,
      );

      if (emailResult) {
        emailSent = true;
        logger.info(`[OTP] Code sent to ${normalizedEmail}`);
      } else {
        logger.error(`[OTP] Email send failed for ${normalizedEmail}`);
      }
    } catch (emailErr) {
      logger.error('[OTP] Email exception:', { error: emailErr instanceof Error ? emailErr.message : emailErr });
    }
  } else {
    logger.warn('[OTP] No EMAIL_API_KEY configured.');
  }

  // Log the code when dev bypass is explicitly enabled
  const devBypassEnabled = process.env.ENABLE_DEV_AUTH_BYPASS === 'true';
  if (devBypassEnabled) {
    logger.info(`[OTP] DEV — Code for ${normalizedEmail}: ${code}`);
  }

  // If email was NOT sent
  if (!emailSent) {
    const devOtpAllowed = process.env.NODE_ENV === 'development' && process.env.ALLOW_DEV_OTP === 'true';
    if (devOtpAllowed) {
      logger.info(`[OTP] DEV — ALLOW_DEV_OTP enabled. Returning code: ${code}`);
      return { success: true, devCode: code };
    }
    logger.error('[OTP] PRODUCTION — Email send failed. EMAIL_API_KEY must be configured.');
    return { success: false, error: 'Authentication service is temporarily unavailable. Please try again later.' };
  }

  return { success: true };
}

export interface VerifyOtpResult {
  success: boolean;
  error?: string;
  userId?: string;
  needsPassword: boolean;
}

/**
 * Verify an OTP code.
 * Compares SHA-256 hash of submitted code against stored hash in User model.
 */
export async function verifyOtp(
  email: string,
  code: string,
  _purpose: OtpPurpose,
): Promise<VerifyOtpResult> {
  const normalizedEmail = email.trim().toLowerCase();

  if (!code || code.length !== 6) {
    return { success: false, error: 'Invalid code format', needsPassword: false };
  }

  // Hash submitted code to compare against stored hash
  const codeHash = await hashOtp(code);

  const user = await db.user.findUnique({
    where: { email: normalizedEmail },
  });

  if (!user) {
    return { success: false, error: 'Invalid or expired code', needsPassword: false };
  }

  // Check expiry
  if (user.otpExpiresAt && user.otpExpiresAt < new Date()) {
    return { success: false, error: 'Code expired. Please request a new one.', needsPassword: false };
  }

  // Compare hashes (timing-safe comparison not needed since SHA-256 hash comparison is safe)
  if (user.otpCode !== codeHash) {
    return { success: false, error: 'Invalid or expired code', needsPassword: false };
  }

  // Clear OTP after successful verification
  await db.user.update({
    where: { id: user.id },
    data: { otpCode: null, otpExpiresAt: null },
  });

  return {
    success: true,
    userId: user.id,
    needsPassword: !user.passwordHash,
  };
}
