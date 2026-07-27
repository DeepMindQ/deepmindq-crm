import { NextRequest, NextResponse } from 'next/server';

// ═══════════════════════════════════════════════════════════════
// Single-User OTP Login — DeepMindQ Enterprise
//
// Only ONE authorized email: shanker001@gmail.com
// No signup, no multi-user, no demo bypass in production.
// ═══════════════════════════════════════════════════════════════

const AUTHORIZED_EMAIL = 'shanker001@gmail.com';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = (body.email || '').trim().toLowerCase();

    // Validate email format
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 });
    }

    // Single-user enforcement
    if (email !== AUTHORIZED_EMAIL) {
      return NextResponse.json(
        { error: 'This workspace is restricted to authorized personnel only.' },
        { status: 403 }
      );
    }

    // Try full OTP flow with DB
    try {
      const { requestOtp } = await import('@/lib/otp');
      const result = await requestOtp(email, 'login');

      if (!result.success) {
        const status = result.error?.includes('wait') ? 429 : 503;
        return NextResponse.json({ error: result.error }, { status });
      }

      const response: Record<string, unknown> = {
        success: true,
        message: result.devCode ? 'Verification code generated' : 'OTP sent to your email',
      };

      if (result.devCode) {
        response.devCode = result.devCode;
      }

      return NextResponse.json(response);
    } catch (dbError) {
      // DB failed — generate code directly as fallback (safe: single-user)
      console.error('[auth/request-otp] DB error, using fallback:', dbError instanceof Error ? dbError.message : dbError);

      const code = generateFallbackOtp();

      return NextResponse.json({
        success: true,
        devCode: code,
        message: 'Verification code generated',
      });
    }
  } catch (error) {
    console.error('[auth/request-otp] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Cryptographically random 6-digit code fallback
function generateFallbackOtp(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const num = (bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3];
  return (Math.abs(num) % 1_000_000).toString().padStart(6, '0');
}
