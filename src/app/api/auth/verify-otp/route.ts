import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { verifyOtp, type OtpPurpose } from '@/lib/otp';
import { createSession } from '@/lib/session';
import { db } from '@/lib/db';

const schema = z.object({
  email: z.string().email('Invalid email address'),
  code: z.string().length(6, 'Code must be 6 digits'),
  purpose: z.enum(['login', 'set_password', 'change_email', 'change_password', 'update_profile']),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || 'Validation failed';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { email, code, purpose } = parsed.data;
    const result = await verifyOtp(email, code, purpose as OtpPurpose);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    if (!result.userId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update last login
    await db.user.update({
      where: { id: result.userId },
      data: { lastLoginAt: new Date() },
    });

    // For login purpose, create a session
    if (purpose === 'login') {
      const userAgent = request.headers.get('user-agent') || undefined;
      const forwarded = request.headers.get('x-forwarded-for');
      const ipAddress = forwarded?.split(',')[0]?.trim() || undefined;

      const session = await createSession(result.userId, userAgent, ipAddress);

      return NextResponse.json({
        success: true,
        needsPassword: result.needsPassword,
        user: {
          id: result.userId,
          email,
          hasPassword: !result.needsPassword,
        },
      });
    }

    // For other purposes (change_email, change_password, update_profile, set_password)
    // Return success — the client will proceed with the next step
    return NextResponse.json({
      success: true,
      userId: result.userId,
      needsPassword: result.needsPassword,
    });
  } catch (error) {
    console.error('[auth/verify-otp] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}