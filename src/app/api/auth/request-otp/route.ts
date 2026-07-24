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
      message: result.devCode ? 'OTP generated (email not configured — code shown below)' : 'OTP sent to your email',
      // Always include code when email delivery failed (no EMAIL_API_KEY configured)
      ...(result.devCode ? { devCode: result.devCode } : {}),
    });
  } catch (error) {
    console.error('[auth/request-otp] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    // Detect common issues for better user feedback
    if (message.includes('prisma') || message.includes('datasource') || message.includes('database') || message.includes('relation')) {
      return NextResponse.json({ error: 'Database not configured. Please set DATABASE_URL on Render.', detail: message }, { status: 503 });
    }
    return NextResponse.json({ error: 'Internal server error', detail: message }, { status: 500 });
  }
}