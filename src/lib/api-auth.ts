/* ═══════════════════════════════════════════════════
   API Authentication Guard
   
   Used by catch-all route dispatchers to enforce
   authentication on all endpoints except those
   explicitly marked as public.
   ═══════════════════════════════════════════════════ */

import { getCurrentSession, type SessionUser } from './session';
import { NextResponse } from 'next/server';

/**
 * Check if the current request has a valid session.
 * Returns { session, response? } — if response is set,
 * the caller should return it immediately (auth failed).
 */
export async function checkApiAuth(): Promise<{
  session: SessionUser | null;
  errorResponse?: Response;
}> {
  try {
    const session = await getCurrentSession();
    if (!session) {
      return {
        session: null,
        errorResponse: NextResponse.json(
          { success: false, error: 'Authentication required', timestamp: new Date().toISOString() },
          { status: 401 }
        ),
      };
    }
    return { session };
  } catch {
    return {
      session: null,
      errorResponse: NextResponse.json(
        { success: false, error: 'Authentication required', timestamp: new Date().toISOString() },
        { status: 401 }
      ),
    };
  }
}

/**
 * Require admin role. Call after checkApiAuth succeeds.
 */
export function requireAdminRole(session: SessionUser): Response | null {
  if (session.role !== 'ADMIN') {
    return NextResponse.json(
      { success: false, error: 'Forbidden: Admin access required', timestamp: new Date().toISOString() },
      { status: 403 }
    );
  }
  return null;
}
