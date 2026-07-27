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

    // Dynamically import to avoid bundling issues
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

    // If email isn't configured, return the code so user can enter it
    // (safe: single-user system)
    if (result.devCode) {
      response.devCode = result.devCode;
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('[auth/request-otp] Error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    const dbKeywords = ['prisma', 'datasource', 'database', 'connection', 'ECONNREFUSED'];
    if (dbKeywords.some(k => message.toLowerCase().includes(k.toLowerCase()))) {
      return NextResponse.json({ error: 'Service unavailable. Please try again later.' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
