import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * DeepMindQ Root Middleware
 *
 * Enforces authentication on all /api/* routes except an explicit public whitelist.
 * Non-API routes (pages, static assets, landing page) are always public.
 *
 * Auth enforcement strategy:
 * - Edge middleware checks for the presence of a valid session cookie
 * - Full session validation (DB lookup, expiry check) still happens inside API routes
 *   via getCurrentSession() / withApiMiddleware()
 * - This middleware is a GATE — it rejects requests that clearly have no session
 * - Routes in the whitelist bypass this check entirely
 */

const SESSION_COOKIE = 'dmq_session';

// ── Public API paths (no auth required) ──
// Everything else under /api/* requires authentication
const PUBLIC_API_PATHS: string[] = [
  '/api/auth/',              // Login, OTP, password management
  '/api/webhooks/',         // Incoming webhooks (bounce, reply, etc.)
  '/api/tracking/',         // Email tracking pixels (open, click)
  '/api/unsubscribe',       // Email unsubscribe link
  '/api/cron/',             // Cron job processor (uses CRON_SECRET)
];

// ── Liveness/health endpoints (no auth, no rate limit) ──
const HEALTH_PATHS = [
  '/api/health',
  '/api/ping',
  '/api/',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip non-API routes entirely — pages, static assets, etc.
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Health/liveness endpoints — always public
  if (HEALTH_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  // Public API whitelist — check prefixes
  for (const publicPath of PUBLIC_API_PATHS) {
    if (pathname === publicPath || pathname.startsWith(publicPath)) {
      return NextResponse.next();
    }
  }

  // All other /api/* routes require authentication
  // Check for session cookie presence
  const cookieHeader = request.headers.get('cookie') || '';
  const hasSessionCookie = cookieHeader
    .split(';')
    .some((c) => c.trim().startsWith(`${SESSION_COOKIE}=`));

  if (!hasSessionCookie) {
    return NextResponse.json(
      { success: false, error: 'Authentication required' },
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all API routes
    '/api/:path*',
  ],
};
