import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requestOtp, type OtpPurpose } from '@/lib/otp';

const schema = z.object({
  email: z.string().email('Invalid email address'),
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

    const { email, purpose } = parsed.data;
    const result = await requestOtp(email, purpose as OtpPurpose);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 429 });
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent to your email',
      // Include dev code in development only
      ...(result.devCode && process.env.NODE_ENV === 'development' ? { devCode: result.devCode } : {}),
    });
  } catch (error) {
    console.error('[auth/request-otp] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}