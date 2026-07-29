import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════
// Single-User OTP Verification — DeepMindQ Enterprise
//
// 1. Read OTP hash from httpOnly cookie (set by request-otp)
// 2. Hash the user-submitted code
// 3. Compare hashes — if match, create session
//
// Works 100% with zero DB dependency. Cookie survives across
// all serverless instances. OTP only ever goes to email.
// ═══════════════════════════════════════════════════════════════

const AUTHORIZED_EMAIL = 'shanker001@gmail.com';
const MAX_ATTEMPTS = 5;

const schema = z.object({
  email: z.string().email('Invalid email address'),
  code: z.string().length(6, 'Code must be 6 digits'),
  purpose: z.enum(['login', 'set_password', 'change_email', 'change_password', 'update_profile']),
});

async function hashOtp(code: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(`dmq:${code}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

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

    // === Read OTP hash from cookie ===
    const cookieStore = await cookies();
    const storedHash = cookieStore.get('dmq_otp_hash')?.value;
    const attemptsStr = cookieStore.get('dmq_otp_attempts')?.value;
    const attempts = attemptsStr ? parseInt(attemptsStr, 10) : 0;

    if (!storedHash) {
      return NextResponse.json({ error: 'No verification code found. Please request a new one.' }, { status: 401 });
    }

    // Check attempts
    if (attempts >= MAX_ATTEMPTS) {
      cookieStore.delete('dmq_otp_hash');
      cookieStore.delete('dmq_otp_attempts');
      return NextResponse.json({ error: 'Too many attempts. Please request a new code.' }, { status: 401 });
    }

    // Increment attempts
    cookieStore.set('dmq_otp_attempts', String(attempts + 1), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60,
    });

    // === Hash submitted code and compare ===
    const submittedHash = await hashOtp(code);

    if (submittedHash !== storedHash) {
      // Also try DB as secondary check
      try {
        const { db } = await import('@/lib/db');
        const otp = await db.otpCode.findFirst({
          where: { email: normalizedEmail, code, purpose, verified: false, expiresAt: { gt: new Date() } },
          include: { user: true },
        });
        if (otp) {
          await db.otpCode.update({ where: { id: otp.id }, data: { verified: true } });
          // Clear OTP cookies and create session
          cookieStore.delete('dmq_otp_hash');
          cookieStore.delete('dmq_otp_attempts');
          const token = generateToken();
          cookieStore.set('dmq_session', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            path: '/',
            maxAge: 30 * 24 * 60 * 60,
          });
          return NextResponse.json({
            success: true,
            needsPassword: !otp.user?.hasPassword,
            user: { id: otp.userId || 'shanker-001', email: normalizedEmail },
          });
        }
      } catch { /* DB failed */ }

      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 });
    }

    // === CODE MATCHES — create session ===
    cookieStore.delete('dmq_otp_hash');
    cookieStore.delete('dmq_otp_attempts');

    const token = generateToken();
    cookieStore.set('dmq_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60,
    });

    // Also mark in DB (best effort)
    try {
      const { db } = await import('@/lib/db');
      await db.otpCode.updateMany({
        where: { email: normalizedEmail, code, purpose, verified: false },
        data: { verified: true },
      });
      await db.session.create({
        data: {
          userId: 'shanker-001',
          token,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    } catch { /* non-critical */ }

    return NextResponse.json({
      success: true,
      needsPassword: false,
      user: { id: 'shanker-001', email: normalizedEmail },
    });
  } catch (error) {
    logger.error('[auth/verify-otp] Error:', { error: error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
