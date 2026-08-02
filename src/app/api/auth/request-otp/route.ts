import { NextRequest, NextResponse } from 'next/server';
import { otpRateLimit } from '@/lib/auth-helpers';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════
// Single-User OTP Login — DeepMindQ Enterprise
//
// 1. Generate 6-digit code
// 2. Send code via Resend email
// 3. Store SHA256(code) in httpOnly cookie (survives across serverless)
// 4. Verify by hashing user input and comparing to cookie
//
// Authorized email configured via AUTHORIZED_EMAIL env var
// ═══════════════════════════════════════════════════════════════

const AUTHORIZED_EMAIL = process.env.AUTHORIZED_EMAIL || 'shanker001@gmail.com';

async function hashOtp(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`dmq:${code}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function generateOtpCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const num = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
  return (Math.abs(num) % 1_000_000).toString().padStart(6, '0');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email || '').trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    // Rate limit OTP requests
    const rateLimitResult = otpRateLimit(email);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many OTP requests. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)) } }
      );
    }

    if (email !== AUTHORIZED_EMAIL) {
      return NextResponse.json(
        { error: 'This workspace is restricted to authorized personnel only.' },
        { status: 403 }
      );
    }

    const code = generateOtpCode();
    const codeHash = await hashOtp(code);

    // === STEP 1: Send email via Resend ===
    let emailSent = false;
    const apiKey = process.env.EMAIL_API_KEY;
    const fromAddr = process.env.EMAIL_FROM || 'noreply@deepmindq.com';

    if (apiKey) {
      try {
        const res = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromAddr,
            to: [email],
            subject: 'DeepMindQ - Login Verification',
            html: `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:#f9fafb;font-family:system-ui,-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:40px 20px;"><tr><td align="center">
<table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,0.1);overflow:hidden;">
<tr><td style="background:linear-gradient(135deg,#B8860B,#D4A843);padding:32px 40px;text-align:center;">
<h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:700;">DeepMindQ</h1></td></tr>
<tr><td style="padding:40px;">
<h2 style="margin:0 0 8px;color:#111827;font-size:20px;">Login Verification</h2>
<p style="margin:0 0 24px;color:#6b7280;font-size:15px;line-height:1.5;">Use the following code to sign in. This code expires in 10 minutes.</p>
<div style="background:#f3f4f6;border-radius:8px;padding:20px;text-align:center;margin:0 0 24px;">
<span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#B8860B;font-family:monospace;">${code}</span></div>
<p style="margin:0;color:#9ca3af;font-size:13px;line-height:1.5;">If you did not request this code, please ignore this email.</p>
</td></tr>
<tr><td style="padding:20px 40px;border-top:1px solid #f3f4f6;text-align:center;">
<p style="margin:0;color:#9ca3af;font-size:12px;">&copy; ${new Date().getFullYear()} DeepMindQ. All rights reserved.</p>
</td></tr></table></td></tr></table></body></html>`,
          }),
        });

        if (res.ok) {
          emailSent = true;
          logger.info('[auth/request-otp] Email sent via Resend');
        } else {
          const errData = await res.json().catch(() => ({}));
          logger.error('[auth/request-otp] Resend error:', { res: res.status, errData: errData });
        }
      } catch (emailErr) {
        logger.error('[auth/request-otp] Email failed:', { error: emailErr instanceof Error ? emailErr.message : emailErr });
      }
    } else {
      logger.error('[auth/request-otp] No EMAIL_API_KEY!');
    }

    if (!emailSent) {
      return NextResponse.json(
        { error: 'Failed to send verification email. Please try again later.' },
        { status: 503 }
      );
    }

    // === STEP 2: Store OTP hash in httpOnly cookie ===
    const cookieStore = await cookies();
    cookieStore.set('dmq_otp_hash', codeHash, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60,
    });
    // Reset attempt counter
    cookieStore.delete('dmq_otp_attempts');

    // Also try DB storage (best effort)
    try {
      const { db } = await import('@/lib/db');
      await db.otpCode.updateMany({
        where: { email, purpose: 'login', verified: false, expiresAt: { gt: new Date() } },
        data: { verified: true },
      });
      const user = await db.user.findUnique({ where: { email } });
      if (!user) {
        await db.user.create({ data: { email, name: 'Shanker', role: 'admin', isActive: true } });
      }
      await db.otpCode.create({
        data: { email, code, purpose: 'login', expiresAt: new Date(Date.now() + 10 * 60 * 1000) },
      });
    } catch (dbErr) {
      logger.warn('[auth/request-otp] DB failed (cookie is primary):', { error: dbErr instanceof Error ? dbErr.message : dbErr });
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent to your email',
    });
  } catch (error) {
    logger.error('[auth/request-otp] Error:', { error: error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
