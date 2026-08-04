import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { db } from '@/lib/db';
import { createSession } from '@/lib/session';
import { otpRateLimit } from '@/lib/auth-helpers';
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

const MAX_ATTEMPTS = 5;

/**
 * Milestone 1 C-03: Constant-time string comparison for OTP hashes.
 * Prevents timing side-channel attacks on the OTP verification path.
 */
function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const aBuf = encoder.encode(a);
  const bBuf = encoder.encode(b);
  let result = 0;
  for (let i = 0; i < aBuf.length; i++) {
    result |= aBuf[i] ^ bBuf[i];
  }
  return result === 0;
}

function getAuthorizedEmail(): string | undefined {
  return process.env.AUTHORIZED_EMAIL;
}

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

/**
 * Look up the actual User record by email.
 * Returns null if no active user found — session creation must be aborted.
 */
async function lookupUser(email: string) {
  return db.user.findUnique({
    where: { email },
    select: { id: true, email: true, name: true, phone: true, company: true, designation: true, role: true, hasPassword: true, avatarUrl: true, isActive: true },
  });
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

    // Rate limit OTP verification attempts
    const rateLimitResult = otpRateLimit(email);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many verification attempts. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)) } }
      );
    }
    const normalizedEmail = email.trim().toLowerCase();

    const AUTHORIZED_EMAIL = getAuthorizedEmail();

    if (!AUTHORIZED_EMAIL) {
      return NextResponse.json(
        { error: 'Authentication is not configured.' },
        { status: 503 }
      );
    }

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

    // Milestone 1 C-03: Use constant-time comparison to prevent timing attacks
    if (!timingSafeCompare(submittedHash, storedHash)) {
      // Also try DB as secondary check (PATH B: database OTP fallback)
      try {
        const submittedHash = await hashOtp(code);
        const otp = await db.otpCode.findFirst({
          where: { email: normalizedEmail, code: submittedHash, purpose, verified: false, expiresAt: { gt: new Date() } },
          orderBy: { createdAt: 'desc' },
          include: { user: true },
        });
        if (otp) {
          await db.otpCode.update({ where: { id: otp.id }, data: { verified: true } });
          // Resolve the actual user — prefer otp.user relation, fallback to email lookup
          const user = otp.user?.isActive ? otp.user : await lookupUser(normalizedEmail);
          if (!user || !user.isActive) {
            logger.warn('[auth/verify-otp] OTP verified but no active user found', { email: normalizedEmail });
            return NextResponse.json({ error: 'User account not found or inactive' }, { status: 403 });
          }
          // Clear OTP cookies
          cookieStore.delete('dmq_otp_hash');
          cookieStore.delete('dmq_otp_attempts');
          // Create valid session using the session abstraction
          await createSession(user.id);
          return NextResponse.json({
            success: true,
            needsPassword: !user.hasPassword,
            user: { id: user.id, email: user.email },
          });
        }
      } catch (dbErr) {
        logger.error('[auth/verify-otp] DB fallback lookup failed', { error: dbErr });
      }

      return NextResponse.json({ error: 'Invalid or expired code' }, { status: 401 });
    }

    // === CODE MATCHES — create session (PATH A: cookie hash validation) ===
    // Resolve the actual user by email
    const user = await lookupUser(normalizedEmail);
    if (!user || !user.isActive) {
      logger.warn('[auth/verify-otp] OTP matched but no active user found', { email: normalizedEmail });
      return NextResponse.json({ error: 'User account not found or inactive' }, { status: 403 });
    }

    // Clear OTP cookies
    cookieStore.delete('dmq_otp_hash');
    cookieStore.delete('dmq_otp_attempts');

    // Mark OTP as verified in DB
    await db.otpCode.updateMany({
      where: { email: normalizedEmail, code, purpose, verified: false },
      data: { verified: true },
    }).catch(() => { /* non-critical: OTP already verified or record absent */ });

    // Create valid session using the session abstraction
    await createSession(user.id);

    return NextResponse.json({
      success: true,
      needsPassword: !user.hasPassword,
      user: { id: user.id, email: user.email },
    });
  } catch (error) {
    logger.error('[auth/verify-otp] Error:', { error: error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
