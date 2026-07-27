import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

// ═══════════════════════════════════════════════════════════════
// Current User — DeepMindQ Enterprise
//
// Returns current user if valid session exists.
// Production: DB failure = service unavailable (no bypass).
// Dev: Falls back to cookie-only auth for convenience.
// ═══════════════════════════════════════════════════════════════

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('dmq_session')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Validate token format (basic check)
    if (token.length < 16) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    try {
      // Try full DB-based session validation
      const { getCurrentSession } = await import('@/lib/session');
      const user = await getCurrentSession();

      if (user) {
        return NextResponse.json({ user });
      }

      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    } catch (dbError) {
      console.error('[auth/me] DB error:', dbError instanceof Error ? dbError.message : dbError);

      // In production, DB failure = auth unavailable
      if (process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Service temporarily unavailable' }, { status: 503 });
      }

      // Local dev fallback: if cookie exists, treat as authenticated
      return NextResponse.json({
        user: {
          id: 'shanker-001',
          email: 'shanker001@gmail.com',
          name: 'Shanker',
          phone: null,
          company: null,
          designation: null,
          role: 'admin',
          hasPassword: false,
          avatarUrl: null,
        },
      });
    }
  } catch (error) {
    console.error('[auth/me] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
