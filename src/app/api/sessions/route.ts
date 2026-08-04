/**
 * GET /api/sessions — List active sessions for current user
 * DELETE /api/sessions/:id — Revoke a specific session
 * DELETE /api/sessions — Revoke all other sessions (except current)
 *
 * Phase 5: Enterprise session management API.
 */
import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, destroyCurrentSession } from '@/lib/session';
import { getUserSessions, revokeSession, revokeAllUserSessions } from '@/lib/session-manager';
import { cookies } from 'next/headers';
import { audit, AuditCategory } from '@/lib/audit-logger';
import { apiError, apiSuccess } from '@/lib/apiHelpers';

export const dynamic = 'force-dynamic';

/**
 * GET /api/sessions — List all active sessions for the current user.
 */
export async function GET() {
  try {
    const user = await requireAuth();
    const cookieStore = await cookies();
    const currentToken = cookieStore.get('dmq_session')?.value;
    const sessions = await getUserSessions(user.id, currentToken);
    return apiSuccess({ sessions });
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) {
      return apiError('Authentication required', 401);
    }
    return apiError('Failed to list sessions', 500);
  }
}

/**
 * DELETE /api/sessions — Revoke all other sessions (keep current).
 * Query param: ?all=true to revoke ALL sessions (forces full logout).
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const revokeAll = searchParams.get('all') === 'true';

    if (revokeAll) {
      const count = await revokeAllUserSessions(user.id, 'User-initiated full revocation');
      await audit({
        action: 'All sessions revoked by user',
        category: 'auth',
        severity: 'info',
        actor: user.id,
        details: { sessionsRevoked: count },
      });
      return apiSuccess({ revoked: count, message: 'All sessions revoked. Please log in again.' });
    } else {
      // Revoke all except current
      const cookieStore = await cookies();
      const currentToken = cookieStore.get('dmq_session')?.value;
      const sessions = await getUserSessions(user.id, currentToken);
      const otherSessions = sessions.filter(s => !s.isCurrent);
      let revoked = 0;
      for (const s of otherSessions) {
        const ok = await revokeSession(s.id, user.id, 'User revoked other sessions');
        if (ok) revoked++;
      }
      return apiSuccess({ revoked, message: `${revoked} other sessions revoked.` });
    }
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) {
      return apiError('Authentication required', 401);
    }
    return apiError('Failed to revoke sessions', 500);
  }
}
