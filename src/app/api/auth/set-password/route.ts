import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hashPassword } from '@/lib/password';
import { createSession } from '@/lib/session';
import { verifyOtp } from '@/lib/otp';
import { db } from '@/lib/db';
import { AuthError, requireAuth } from '@/lib/session';
import { logger } from '@/lib/logger';
import { generalApiRateLimit } from '@/lib/auth-helpers';
import { withCsrf } from '@/lib/with-csrf';

const schema = z.object({
  email: z.string().email(),
  otpCode: z.string().length(6),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

// P0.4: Wrapped with withCsrf — CSRF protection is required on all
// state-changing auth endpoints, even those that don't yet have a session
// (the CSRF cookie is set on the login page as a non-httpOnly cookie).
export const POST = withCsrf(async function POST(request: NextRequest) {
  try {
    const ip = request.headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = generalApiRateLimit(ip, 'set-password');
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429 },
      );
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || 'Validation failed';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { email, otpCode, password } = parsed.data;

    // First verify the OTP for set_password purpose
    const otpResult = await verifyOtp(email, otpCode, 'set_password');
    if (!otpResult.success || !otpResult.userId) {
      return NextResponse.json(
        { error: otpResult.error || 'OTP verification failed' },
        { status: 401 },
      );
    }

    // Hash and store the password
    const passwordHash = await hashPassword(password);

    await db.user.update({
      where: { id: otpResult.userId },
      data: {
        passwordHash,
      },
    });

    // Create a session (userAgent/ipAddress are logged via audit, not stored in session)
    const session = await createSession(otpResult.userId);

    return NextResponse.json({
      success: true,
      message: 'Password set successfully',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('[auth/set-password] Error:', { error: error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
