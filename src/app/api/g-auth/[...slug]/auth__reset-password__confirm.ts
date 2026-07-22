import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyOtp, type OtpPurpose } from '@/lib/otp';
import { hashPassword } from '@/lib/password';
import { db } from '@/lib/db';

// ── Owner-only access: only these emails can reset password ──
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || 'shanker001@gmail.com')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

const schema = z.object({
  email: z.string().email('Invalid email address'),
  token: z.string().length(6, 'Token must be a 6-digit OTP code'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password must be at most 128 characters'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || 'Validation failed';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { email, token, newPassword } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    // ── BLOCK any email not in the allowlist ──
    if (!ALLOWED_EMAILS.includes(normalizedEmail)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Verify the OTP token against the database (purpose: change_password)
    const otpResult = await verifyOtp(
      normalizedEmail,
      token,
      'change_password' as OtpPurpose,
    );

    if (!otpResult.success || !otpResult.userId) {
      return NextResponse.json(
        { error: otpResult.error || 'Invalid or expired token' },
        { status: 401 },
      );
    }

    // Hash the new password using PBKDF2
    const passwordHash = await hashPassword(newPassword);

    // Update the user's password hash
    await db.user.update({
      where: { id: otpResult.userId },
      data: {
        passwordHash,
        hasPassword: true,
      },
    });

    // Invalidate all existing sessions to force re-login
    await db.session.deleteMany({
      where: { userId: otpResult.userId },
    });

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully. Please log in again.',
    });
  } catch (error) {
    console.error('[auth/reset-password-confirm] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}