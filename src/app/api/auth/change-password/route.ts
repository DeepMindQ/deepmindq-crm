import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyOtp } from '@/lib/otp';
import { hashPassword } from '@/lib/password';
import { requireAuth, AuthError, hashToken } from '@/lib/session';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { generalApiRateLimit } from '@/lib/auth-helpers';
import { withCsrf } from '@/lib/with-csrf';

const schema = z.object({
  email: z.string().email(),
  otpCode: z.string().length(6, 'Code must be 6 digits'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export const POST = withCsrf(async function POST(request: NextRequest) {
  try {
    const ip = request.headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rl = generalApiRateLimit(ip, 'change-password');
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Too many attempts. Please try again later.' },
        { status: 429 },
      );
    }

    const user = await requireAuth();

    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || 'Validation failed';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { email, otpCode, newPassword } = parsed.data;

    // Verify OTP sent to user's email
    const otpResult = await verifyOtp(email, otpCode, 'change_password');

    if (!otpResult.success) {
      return NextResponse.json(
        { error: otpResult.error || 'OTP verification failed' },
        { status: 401 },
      );
    }

    if (otpResult.userId !== user.id) {
      return NextResponse.json({ error: 'OTP does not match current user' }, { status: 403 });
    }

    // Hash new password and update
    const passwordHash = await hashPassword(newPassword);

    await db.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
      },
    });

    // Destroy all OTHER sessions (force re-login on other devices)
    // P0.4 BUG FIX: DB stores SHA-256 hashes, not plaintext tokens.
    // We must hash the current token before comparing against DB values.
    const cookieStore = await (await import('next/headers')).cookies();
    const currentToken = cookieStore.get('dmq_session')?.value || null;
    if (currentToken) {
      const currentTokenHash = await hashToken(currentToken);
      await db.session.deleteMany({
        where: {
          userId: user.id,
          token: { not: currentTokenHash },
        },
      });
    } else {
      // No current token — destroy all sessions
      await db.session.deleteMany({ where: { userId: user.id } });
    }

    return NextResponse.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    logger.error('[auth/change-password] Error:', { error: error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
});
