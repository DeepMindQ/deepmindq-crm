import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requestOtp, type OtpPurpose } from '@/lib/otp';

// ── Owner-only access: only these emails can request OTP ──
const ALLOWED_EMAILS = (process.env.ALLOWED_EMAILS || 'shanker001@gmail.com')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

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
    const normalizedEmail = email.trim().toLowerCase();

    // ── BLOCK any email not in the allowlist ──
    if (!ALLOWED_EMAILS.includes(normalizedEmail)) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const result = await requestOtp(email, purpose as OtpPurpose);

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 429 });
    }

    return NextResponse.json({
      success: true,
      message: result.devCode
        ? `Your verification code is: ${result.devCode} (email not configured — set EMAIL_PROVIDER and EMAIL_API_KEY env vars)`
        : 'OTP sent to your email',
      ...(result.devCode ? { devCode: result.devCode } : {}),
    });
  } catch (error) {
    console.error('[auth/request-otp] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}