/**
 * DeepMindQ Middleware — Authentication + Security
 *
 * Phase 1.1: Enforce auth on all /api/* routes except whitelist.
 *
 * Defense-in-depth approach:
 *   Layer 1 (this middleware): Block requests without session cookie on protected API routes.
 *     - Fast: no DB calls, Edge-compatible.
 *     - Catches obviously unauthenticated requests before they hit any route handler.
 *   Layer 2 (route-level requireAuth): Full DB session validation in individual routes.
 *     - Used by engine routes, auth-protected routes.
 *     - Validates token against DB, checks expiry, user isActive.
 *
 * Whitelist (no auth required):
 *   - /api/auth/*          — login, register, OTP, password reset
 *   - /api/webhooks/*      — bounce/reply webhooks (authenticated by signature)
 *   - /api/tracking/*      — email open/click tracking pixels
 *   - /api/unsubscribe     — public unsubscribe link
 *   - /api/cron/*          — scheduled job processor (internal)
 *   - /api/health          — liveness probe (Vercel/Render health checks)
 *   - /api/ping            — connectivity check
 *   - /api/setup-db        — token-gated separately (Phase 0)
 *   - /api/seed/*          — development seeding (will be removed in production)
 *   - /api/email-worker/*  — internal email sending processor
 *   - /api/verify-queue/*  — internal email verification processor
 *
 * All other /api/* routes require a valid session cookie (dmq_session).
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  SESSION_COOKIE_NAME,
  isPublicPath,
  isApiRoute,
  getSecurityHeaders,
  applySecurityHeaders,
} from '@/lib/auth-helpers'

// Additional public paths beyond the ones in auth-helpers.ts
// These are infrastructure/operational endpoints that bypass auth
const INFRA_PUBLIC_PATHS = [
  '/api/health',
  '/api/ping',
  '/api/setup-db',
  '/api/seed',
  '/api/email-worker',
  '/api/verify-queue',
  '/api/demo/prepare',
]

function isInfraPublic(pathname: string): boolean {
  return INFRA_PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  )
}

export const config = {
  // Run middleware on all routes except static assets
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.svg|.*\\.png).*)'],
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip non-API routes — page-level auth is handled client-side
  if (!isApiRoute(pathname)) {
    const response = NextResponse.next()
    return applySecurityHeaders(response)
  }

  // Check static whitelist (auth, webhooks, tracking, unsubscribe, cron, login page)
  if (isPublicPath(pathname)) {
    const response = NextResponse.next()
    return applySecurityHeaders(response)
  }

  // Check infrastructure whitelist (health, ping, setup-db, seed, email-worker, verify-queue, demo)
  if (isInfraPublic(pathname)) {
    const response = NextResponse.next()
    return applySecurityHeaders(response)
  }

  // ── Protected API route: require session cookie ──
  const cookieHeader = request.headers.get('cookie') || ''
  const hasSessionCookie = cookieHeader.includes(SESSION_COOKIE_NAME + '=')

  if (!hasSessionCookie) {
    // No session cookie at all — reject immediately (no DB call needed)
    return applySecurityHeaders(
      NextResponse.json(
        {
          success: false,
          error: 'Authentication required',
          code: 'NO_SESSION',
          timestamp: new Date().toISOString(),
        },
        { status: 401 }
      )
    )
  }

  // Session cookie exists — let the request through to the route handler.
  // The route handler will do full DB session validation via requireAuth().
  // This avoids DB calls in Edge middleware while still catching unauthenticated requests early.
  const response = NextResponse.next()
  return applySecurityHeaders(response)
}
