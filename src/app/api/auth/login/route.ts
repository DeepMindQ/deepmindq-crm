import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyPassword } from '@/lib/password';
import { requestOtp } from '@/lib/otp';
import { db } from '@/lib/db';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || 'Validation failed';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { email, password } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Find user
    const user = await db.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      // Don't reveal user existence — but also don't send OTP to non-existent user
      // Wait a fixed time to prevent timing attacks
      await new Promise((r) => setTimeout(r, 1000));
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (!user.hasPassword || !user.passwordHash) {
      return NextResponse.json({
        error: 'No password set. Please use OTP-only login to set your password first.',
        needsOtpLogin: true,
      }, { status: 403 });
    }

    // Verify password
    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      await new Promise((r) => setTimeout(r, 1000));
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    // Password verified — now send OTP to email for second factor
    const otpResult = await requestOtp(normalizedEmail, 'login');

    if (!otpResult.success) {
      return NextResponse.json({ error: otpResult.error || 'Failed to send OTP' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: otpResult.devCode ? 'Password verified. OTP generated (email not configured).' : 'Password verified. OTP sent to your email.',
      ...(otpResult.devCode ? { devCode: otpResult.devCode } : {}),
    });
  } catch (error) {
    console.error('[auth/login] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}