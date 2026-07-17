import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyOtp } from '@/lib/otp';
import { hashPassword } from '@/lib/password';
import { requireAuth, AuthError } from '@/lib/session';
import { db } from '@/lib/db';

const schema = z.object({
  email: z.string().email(),
  otpCode: z.string().length(6, 'Code must be 6 digits'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

export async function POST(request: NextRequest) {
  try {
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
      return NextResponse.json({ error: otpResult.error || 'OTP verification failed' }, { status: 401 });
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
        hasPassword: true,
      },
    });

    // Destroy all other sessions (force re-login on other devices)
    await db.session.deleteMany({
      where: {
        userId: user.id,
        // Don't delete current session — it'll be refreshed
      },
    });

    return NextResponse.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[auth/change-password] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}