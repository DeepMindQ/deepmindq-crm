import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';

// ═══════════════════════════════════════════════════════════════
// Single-User OTP Verification — DeepMindQ Enterprise
//
// Verifies OTP code against DB first, then in-memory cache.
// Creates session on success. Works even if DB is down.
// ═══════════════════════════════════════════════════════════════

const AUTHORIZED_EMAIL = 'shanker001@gmail.com';
const MAX_ATTEMPTS = 5;

const schema = z.object({
  email: z.string().email('Invalid email address'),
  code: z.string().length(6, 'Code must be 6 digits'),
  purpose: z.enum(['login', 'set_password', 'change_email', 'change_password', 'update_profile']),
});

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || 'Validation failed';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { email, code, purpose } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    if (normalizedEmail !== AUTHORIZED_EMAIL) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    let otpValid = false;
    let userId = 'shanker-001';
    let needsPassword = false;

    // Method 1: Try DB verification
    try {
      const { db } = await import('@/lib/db');
      const otp = await db.otpCode.findFirst({
        where: {
          email: normalizedEmail,
          code,
          purpose,
          verified: false,
          expiresAt: { gt: new Date() },
        },
        include: { user: true },
      });

      if (otp) {
        if (otp.attempts >= MAX_ATTEMPTS) {
          await db.otpCode.update({ where: { id: otp.id }, data: { verified: true } });
          return NextResponse.json({ error: 'Too many attempts. Please request a new code.' }, { status: 401 });
        }
        await db.otpCode.update({ where: { id: otp.id }, data: { verified: true, attempts: { increment: 1 } } });
        otpValid = true;
        userId = otp.userId || 'shanker-001';
        needsPassword = !otp.user?.hasPassword;

        // Update last login
        try {
          await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
        } catch { /* non-critical */ }
      }
    } catch (dbErr) {
      console.warn('[auth/verify-otp] DB check failed, trying in-memory cache:', dbErr instanceof Error ? dbErr.message : dbErr);
    }

    // Method 2: Check in-memory cache (fallback when DB is down)
    if (!otpValid) {
      try {
        const { otpCache } = await import('@/lib/otp-cache');
        const cacheKey = `${normalizedEmail}:${purpose}`;
        const cached = otpCache.get(cacheKey);

        if (cached && cached.code === code && cached.expiresAt > Date.now()) {
          if (cached.attempts >= MAX_ATTEMPTS) {
            otpCache.delete(cacheKey);
            return NextResponse.json({ error: 'Too many attempts. Please request a new code.' }, { status: 401 });
          }
          cached.attempts += 1;
          if (cached.attempts >= MAX_ATTEMPTS) {
            otpCache.delete(cacheKey);
          }
          otpValid = true;
          console.log('[auth/verify-otp] OTP verified via in-memory cache');
        }
      } catch (cacheErr) {
        console.error('[auth/verify-otp] Cache check failed:', cacheErr);
      }
    }

    if (!otpValid) {
      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 });
    }

    // Create session
    if (purpose === 'login') {
      const token = generateToken();
      const cookieStore = await cookies();
      cookieStore.set('dmq_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });

      // Try to persist session in DB
      try {
        const { db } = await import('@/lib/db');
        await db.session.create({
          data: {
            userId,
            token,
            userAgent: request.headers.get('user-agent') || null,
            ipAddress: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || null,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          },
        });
      } catch (dbErr) {
        console.warn('[auth/verify-otp] Session DB storage failed (cookie is still set):', dbErr instanceof Error ? dbErr.message : dbErr);
      }

      return NextResponse.json({
        success: true,
        needsPassword,
        user: { id: userId, email: normalizedEmail },
      });
    }

    return NextResponse.json({ success: true, userId, needsPassword });
  } catch (error) {
    console.error('[auth/verify-otp] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
