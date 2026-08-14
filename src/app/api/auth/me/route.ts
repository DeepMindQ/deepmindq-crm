import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { logger } from '@/lib/logger';

// ═══════════════════════════════════════════════════════════════
// Current User — DeepMindQ Enterprise
//
// Checks session via cookie. Validates against DB.
// Returns 401 if session cannot be validated — no hardcoded fallbacks.
// ═══════════════════════════════════════════════════════════════

export async function GET() {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get('dmq_session')?.value;

    if (!token) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    if (token.length < 16) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Try DB-based session validation
    try {
      const { getCurrentSession } = await import('@/lib/session');
      const user = await getCurrentSession();

      if (user) {
        return NextResponse.json({ user });
      }
    } catch (dbErr) {
      logger.warn('[auth/me] DB session check failed, using cookie-based auth:', {
        error: dbErr instanceof Error ? dbErr.message : dbErr,
      });
    }

    // If DB session lookup fails, we cannot authenticate the user.
    // Previously this returned a hardcoded admin identity — a P0 security hole.
    // Now we return 401 (not authenticated) when DB validation is unavailable.
    return NextResponse.json(
      { error: 'Session validation unavailable', code: 'SESSION_DB_ERROR' },
      { status: 401 },
    );
  } catch (error) {
    logger.error('[auth/me] Error:', { error: error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
