/* ═══════════════════════════════════════════════════
   API Authentication + RBAC Authorization Guard
   
   Used by catch-all route dispatchers to enforce
   authentication AND role-based authorization on all
   endpoints except those explicitly marked as public.
   
   GAP FIX (B-01): authorizeRoute() is now called after
   successful authentication, wiring RBAC into the
   request pipeline for all 250+ API routes that use
   checkApiAuth().
   ═══════════════════════════════════════════════════ */

import { getCurrentSession, type SessionUser } from './session';
import { authorizeRoute } from './rbac';
import { filterObjectByRole, filterArrayByRole } from './rbac-enforcement';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * Check if the current request has a valid session AND
 * the user's role is authorized for this route+method.
 *
 * Returns { session, response? } — if response is set,
 * the caller should return it immediately (auth or
 * RBAC failed).
 *
 * Flow:
 *   1. Validate session (authentication)
 *   2. Call authorizeRoute() from rbac.ts (authorization)
 *   3. If either fails, return appropriate error response
 */
export async function checkApiAuth(request?: Request): Promise<{
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
          { status: 401 },
        ),
      };
    }

    // ── RBAC Authorization (GAP FIX B-01) ──
    // After confirming the user is authenticated, check if their
    // role is authorized for this specific route and HTTP method.
    // This wires the 50+ entry ROUTE_AUTHORIZATION_MATRIX into the
    // request pipeline without changes to individual route handlers.
    if (request) {
      const url = new URL(request.url);
      const pathname = url.pathname;
      const method = request.method;

      const authResult = authorizeRoute(pathname, method, session.role);
      if (!authResult.authorized) {
        logger.warn(
          `[RBAC] Access denied: role=${session.role} method=${method} path=${pathname} reason=${authResult.reason}`,
        );
        return {
          session: null,
          errorResponse: NextResponse.json(
            {
              success: false,
              error: 'Forbidden: Insufficient permissions',
              details: authResult.reason,
              requiredPermissions: authResult.requiredPermissions,
              timestamp: new Date().toISOString(),
            },
            { status: 403 },
          ),
        };
      }
    }

    return { session };
  } catch {
    return {
      session: null,
      errorResponse: NextResponse.json(
        { success: false, error: 'Authentication required', timestamp: new Date().toISOString() },
        { status: 401 },
      ),
    };
  }
}

/**
 * Require admin role. Call after checkApiAuth succeeds.
 */
export function requireAdminRole(session: SessionUser): Response | null {
  if (session.role !== 'admin') {
    return NextResponse.json(
      {
        success: false,
        error: 'Forbidden: Admin access required',
        timestamp: new Date().toISOString(),
      },
      { status: 403 },
    );
  }
  return null;
}

/**
 * Filter a single object's fields based on the session user's role.
 * Used to enforce field-level permissions (5.3) on API responses.
 *
 * Usage in route handlers:
 *   const { session, errorResponse } = await checkApiAuth(request);
 *   if (errorResponse) return errorResponse;
 *   // ... fetch data ...
 *   const filtered = filterResponseByRole(data, session, 'Company');
 *   return NextResponse.json({ success: true, data: filtered });
 */
export function filterResponseByRole<T extends Record<string, unknown>>(
  data: T,
  session: SessionUser,
  model: string,
): T {
  return filterObjectByRole(data, session.role, model);
}

/**
 * Filter an array of objects' fields based on the session user's role.
 * Used to enforce field-level permissions (5.3) on list API responses.
 *
 * Usage in route handlers:
 *   const { session, errorResponse } = await checkApiAuth(request);
 *   if (errorResponse) return errorResponse;
 *   // ... fetch data ...
 *   const filtered = filterResponseArrayByRole(companies, session, 'Company');
 *   return NextResponse.json({ success: true, data: filtered });
 */
export function filterResponseArrayByRole<T extends Record<string, unknown>>(
  items: T[],
  session: SessionUser,
  model: string,
): T[] {
  return filterArrayByRole(items, session.role, model);
}
