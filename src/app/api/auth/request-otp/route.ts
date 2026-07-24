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
      // Distinguish rate limit (429) from email service errors (503)
      const status = result.error?.includes('wait') ? 429 : 503;
      return NextResponse.json({ error: result.error }, { status });
    }

    return NextResponse.json({
      success: true,
      message: result.devCode
        ? `OTP generated (email not configured). Code: ${result.devCode}`
        : 'OTP sent to your email',
      ...(result.devCode ? { devCode: result.devCode } : {}),
    });
  } catch (error) {
    console.error('[auth/request-otp] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    // Detect database connection issues for clear user guidance
    const dbKeywords = ['prisma', 'datasource', 'database', 'relation', 'connection', 'ECONNREFUSED', 'ENOTFOUND', '0x', 'P1001', 'P1002', 'P1003'];
    if (dbKeywords.some(k => message.toLowerCase().includes(k.toLowerCase()))) {
      return NextResponse.json(
        { error: 'Service unavailable: Database connection failed. Please ensure DATABASE_URL is configured on Render.', detail: message },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'Internal server error', detail: message }, { status: 500 });
  }
}