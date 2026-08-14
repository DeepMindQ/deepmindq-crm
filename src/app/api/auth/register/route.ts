import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/password';
import { requestOtp } from '@/lib/otp';
import { logger } from '@/lib/logger';
import { generalApiRateLimit } from '@/lib/auth-helpers';
import { encryptUserFields } from '@/lib/encryption';

const schema = z
  .object({
    name: z.string().min(1, 'Name is required').max(100),
    email: z.string().email('Invalid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

/**
 * POST /api/auth/register
 * Creates a new user with hashed password, then sends OTP for email verification.
 * The user must verify the OTP before they can log in.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limit registration attempts by IP
    const ip = request.headers?.get?.('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const rateLimitResult = generalApiRateLimit(ip, 'register');
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many registration attempts. Please try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)),
          },
        },
      );
    }

    const body = await request.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      const msg = parsed.error.issues[0]?.message || 'Validation failed';
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    const { name, email, password } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Single-user enforcement: reject registration for unauthorized emails
    const AUTHORIZED_EMAIL = process.env.AUTHORIZED_EMAIL;
    if (!AUTHORIZED_EMAIL) {
      return NextResponse.json(
        { error: 'Registration is not configured. AUTHORIZED_EMAIL must be set.' },
        { status: 503 },
      );
    }
    if (normalizedEmail !== AUTHORIZED_EMAIL) {
      return NextResponse.json(
        { error: 'Registration is restricted to authorized personnel only.' },
        { status: 403 },
      );
    }

    // Check if user already exists
    const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 },
      );
    }

    // Hash the password
    const passwordHash = await hashPassword(password);

    // Encrypt PII before storing
    const encryptedData = await encryptUserFields({ email: normalizedEmail });

    // Create the user
    const user = await db.user.create({
      data: {
        email: encryptedData.email as string,
        name: name.trim(),
        passwordHash,
        role: 'admin', // First user is always admin; can be changed later
      },
    });

    // Send OTP for email verification
    const otpResult = await requestOtp(normalizedEmail, 'login');

    // Milestone 1 H-05: Dev OTP only in development, never staging
    const devOtpAllowed =
      process.env.NODE_ENV === 'development' && process.env.ALLOW_DEV_OTP === 'true';
    return NextResponse.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
      message:
        devOtpAllowed && otpResult.devCode
          ? 'Account created. OTP generated (dev mode).'
          : 'Account created. Please verify your email with the OTP sent.',
      ...(devOtpAllowed && otpResult.devCode ? { devCode: otpResult.devCode } : {}),
    });
  } catch (error) {
    logger.error('[auth/register] Error:', { error: error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
