import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { hashPassword } from '@/lib/password';
import { createSession } from '@/lib/session';
import { verifyOtp } from '@/lib/otp';
import { db } from '@/lib/db';
import { AuthError, requireAuth } from '@/lib/session';

const schema = z.object({
  email: z.string().email(),
  otpCode: z.string().length(6),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(request: NextRequest) {
  try {
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
      return NextResponse.json({ error: otpResult.error || 'OTP verification failed' }, { status: 401 });
    }

    // Hash and store the password
    const passwordHash = await hashPassword(password);

    await db.user.update({
      where: { id: otpResult.userId },
      data: {
        passwordHash,
        hasPassword: true,
      },
    });

    // Create a session
    const userAgent = request.headers.get('user-agent') || undefined;
    const forwarded = request.headers.get('x-forwarded-for');
    const ipAddress = forwarded?.split(',')[0]?.trim() || undefined;

    const session = await createSession(otpResult.userId, userAgent, ipAddress);

    return NextResponse.json({
      success: true,
      message: 'Password set successfully',
    });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[auth/set-password] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}