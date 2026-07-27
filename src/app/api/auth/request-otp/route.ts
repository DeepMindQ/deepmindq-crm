import { NextRequest, NextResponse } from 'next/server';

// ═══════════════════════════════════════════════════════════════
// Single-User OTP Login — DeepMindQ Enterprise
//
// Only ONE authorized email: shanker001@gmail.com
// OTP ALWAYS goes to email (Resend). Never exposed in response.
// If DB fails, uses in-memory cache + email as fallback.
// ═══════════════════════════════════════════════════════════════

const AUTHORIZED_EMAIL = 'shanker001@gmail.com';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email || '').trim().toLowerCase();

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    if (email !== AUTHORIZED_EMAIL) {
      return NextResponse.json(
        { error: 'This workspace is restricted to authorized personnel only.' },
        { status: 403 }
      );
    }

    // Import shared utilities
    const { otpCache, generateOtpCode, cleanupExpired } = await import('@/lib/otp-cache');

    // Generate OTP code
    const code = generateOtpCode();

    // Step 1: Send email via Resend (the ONLY way user gets the code)
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
          console.log('[auth/request-otp] Email sent successfully via Resend');
        } else {
          const errData = await res.json().catch(() => ({}));
          console.error('[auth/request-otp] Resend error:', res.status, errData);
        }
      } catch (emailErr) {
        console.error('[auth/request-otp] Email send failed:', emailErr instanceof Error ? emailErr.message : emailErr);
      }
    } else {
      console.error('[auth/request-otp] No EMAIL_API_KEY configured!');
    }

    if (!emailSent) {
      return NextResponse.json(
        { error: 'Failed to send verification email. Please ensure email service is configured.' },
        { status: 503 }
      );
    }

    // Step 2: Store OTP for verification
    const cacheKey = `${email}:login`;
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    // Rate limit check
    const existing = otpCache.get(cacheKey);
    if (existing && (expiresAt - 600_000) > Date.now() - 60_000) {
      return NextResponse.json({ error: 'Please wait 60 seconds before requesting another code' }, { status: 429 });
    }

    // Store in memory cache (reliable fallback for serverless)
    otpCache.set(cacheKey, { code, expiresAt, attempts: 0 });

    // Also try DB storage
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
        data: { email, code, purpose: 'login', expiresAt: new Date(expiresAt) },
      });
      console.log('[auth/request-otp] OTP also stored in DB');
    } catch (dbErr) {
      console.warn('[auth/request-otp] DB storage failed, in-memory cache active:', dbErr instanceof Error ? dbErr.message : dbErr);
    }

    // Cleanup
    cleanupExpired();

    return NextResponse.json({
      success: true,
      message: 'OTP sent to your email',
    });
  } catch (error) {
    console.error('[auth/request-otp] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
