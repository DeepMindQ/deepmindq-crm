import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requestOtp } from '@/lib/otp';
import { generalApiRateLimit } from '@/lib/auth-helpers';
import { logger } from '@/lib/logger';

const schema = z.object({
  email: z.string().email('Invalid email address'),
});

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateLimitResult = generalApiRateLimit(ip, 'forgot-password');
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)),
          },
        },
      );
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Validation failed' },
        { status: 400 },
      );
    }

    const email = parsed.data.email.trim().toLowerCase();

    // Always return success to prevent email enumeration
    await requestOtp(email, 'change_password');

    const devOtpAllowed =
      process.env.NODE_ENV === 'development' && process.env.ALLOW_DEV_OTP === 'true';

    return NextResponse.json({
      success: true,
      message: devOtpAllowed
        ? 'Password reset OTP generated (dev mode).'
        : 'If an account exists with this email, a reset OTP has been sent.',
    });
  } catch (error) {
    logger.error('[auth/forgot-password] Error:', { error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
