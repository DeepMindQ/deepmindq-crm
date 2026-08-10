/* ═══════════════════════════════════════════════════
   Edge Middleware — Auth Gate + Security Layer
   
   Fully Edge Runtime compatible.
   
   NO Prisma (uses @neondatabase/serverless HTTP driver).
   NO Node.js APIs (Buffer, fs, crypto.randomBytes).
   NO cookies() from next/headers (raw cookie parsing only).
   
   Chain trace (Edge-compatible):
     middleware.ts
       -> session-edge.ts (neon() HTTP queries)
         -> @neondatabase/serverless (HTTP to Neon)
       -> auth-helpers.ts (pure JS — Map, regex, Date)
         -> csrf.ts (validateCsrf, generateCsrfToken — single source)
       -> csrf.ts (generateCsrfToken imported directly)
   
   Execution order:
     1. /app/* — validate session, inject CSRF cookie, redirect to /login if unauthenticated
     2. Public paths — rate-limit OTP endpoints, inject CSRF cookie
     3. /api/* — CSRF enforcement, session validation, RBAC headers
     4. All responses get security headers
   
   NOTE: src/proxy.ts provides a parallel Next.js 16 proxy with similar
   logic. In Next.js 16, proxy() takes precedence over middleware().
   Both share the same underlying security modules (csrf.ts, auth-helpers.ts).
   ═══════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from 'next/server'
import {
  getSessionToken,
  isPublicPath,
  isRateLimitedPublicApi,
  validateCsrf,
  applySecurityHeaders,
  unauthorizedResponse,
  forbiddenResponse,
  rateLimitedResponse,
  otpRateLimit,
  CSRF_COOKIE_NAME,
} from '@/lib/auth-helpers'
import { validateSessionEdge } from '@/lib/session-edge'
import { generateCsrfToken } from '@/lib/csrf'
import { extractTraceContext, injectTraceContext } from '@/lib/tracing'
import type { TraceContext } from '@/lib/tracing'
import { recordRouteLatency } from '@/lib/sla-monitor'
import { metrics } from '@/lib/monitoring'

/**
 * Inject distributed tracing headers onto a response.
 * Sets x-trace-id, traceparent (W3C), and propagates x-correlation-id if present.
 */
function withTraceHeaders(response: NextResponse, traceCtx: TraceContext, request: NextRequest): NextResponse {
  const traceHeaders: Record<string, string> = {}
  injectTraceContext(traceHeaders, traceCtx)
  response.headers.set('x-trace-id', traceHeaders['x-trace-id'])
  response.headers.set('traceparent', traceHeaders['traceparent'])

  // Propagate existing x-correlation-id if present
  const correlationId = request.headers.get('x-correlation-id')
  if (correlationId) {
    response.headers.set('x-correlation-id', correlationId)
  }

  return response
}

/**
 * Add response-time headers and record SLA latency.
 * Uses performance.now() for sub-millisecond precision (Edge compatible).
 */
function withResponseTiming(response: NextResponse, pathname: string, startTime: number): NextResponse {
  const durationMs = Math.round(performance.now() - startTime)
  recordRouteLatency(pathname, durationMs)
  response.headers.set('Server-Timing', `total;dur=${durationMs}`)
  response.headers.set('X-Response-Time', `${durationMs}ms`)
  return response
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const startTime = performance.now()

  // ── 0. Extract distributed trace context (before any auth) ──
  const traceCtx = extractTraceContext(request.headers)

  // ── Pre-extract session token (shared across all auth blocks) ──
  const token = getSessionToken(request)

  // ── 1. Protect /app/* pages — session required ─────────
  if (pathname.startsWith('/app') || pathname === '/') {
    let session = null

    if (token) {
      session = await validateSessionEdge(token)
    }

    // Unauthenticated — redirect to /login
    if (!session) {
      // Record auth failure metric for alerting (Phase A.5)
      try { metrics.record('auth.failure.count', 1, { route: pathname, reason: 'no_session' }) } catch { /* non-blocking */ }
      const redirect = NextResponse.redirect(new URL('/login', request.url))
      return withResponseTiming(withTraceHeaders(applySecurityHeaders(redirect), traceCtx, request), pathname, startTime)
    }

    // Authenticated — inject CSRF cookie and allow through
    const response = NextResponse.next()
    const csrfToken = generateCsrfToken()
    response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: false,  // Must be readable by JS client
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 86400,
    })
    return withResponseTiming(withTraceHeaders(applySecurityHeaders(response), traceCtx, request), pathname, startTime)
  }

  // ── 2. Allow public paths (no auth required) ──────────
  if (isPublicPath(pathname)) {
    // Rate-limit public auth endpoints (OTP flood prevention)
    if (isRateLimitedPublicApi(pathname)) {
      const body = await tryParseBody(request)
      const email = typeof body.email === 'string' ? body.email : ''
      if (email) {
        const rl = otpRateLimit(email)
        if (!rl.success) {
          return withResponseTiming(withTraceHeaders(rateLimitedResponse(Math.ceil((rl.resetAt - Date.now()) / 1000)), traceCtx, request), pathname, startTime)
        }
      }
    }

    // Set CSRF cookie on public auth pages (login, signup) too
    const response = NextResponse.next()
    const csrfToken = generateCsrfToken()
    response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 86400,
    })
    return withResponseTiming(withTraceHeaders(applySecurityHeaders(response), traceCtx, request), pathname, startTime)
  }

  // ── 3. Protect all /api/* routes ───────────────────────
  if (pathname.startsWith('/api/')) {
    // CSRF validation for state-changing methods
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      if (!validateCsrf(request)) {
        return withResponseTiming(withTraceHeaders(forbiddenResponse('CSRF validation failed'), traceCtx, request), pathname, startTime)
      }
    }

    // Session validation — Edge-compatible (no Prisma)
    if (!token) {
      try { metrics.record('auth.failure.count', 1, { route: pathname, reason: 'no_token' }) } catch { /* non-blocking */ }
      return withResponseTiming(withTraceHeaders(unauthorizedResponse(), traceCtx, request), pathname, startTime)
    }

    const session = await validateSessionEdge(token)
    if (!session) {
      try { metrics.record('auth.failure.count', 1, { route: pathname, reason: 'invalid_session' }) } catch { /* non-blocking */ }
      return withResponseTiming(withTraceHeaders(unauthorizedResponse(), traceCtx, request), pathname, startTime)
    }

    const response = NextResponse.next()
    response.headers.set('x-user-id', session.id)
    response.headers.set('x-user-role', session.role)
    return withResponseTiming(withTraceHeaders(applySecurityHeaders(response), traceCtx, request), pathname, startTime)
  }

  // ── 4. Default: allow through with security headers ──
  const response = NextResponse.next()
  return withResponseTiming(withTraceHeaders(applySecurityHeaders(response), traceCtx, request), pathname, startTime)
}

async function tryParseBody(request: NextRequest): Promise<Record<string, string | number | boolean | object | null>> {
  try {
    const clone = request.clone()
    const contentType = clone.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      return await clone.json()
    }
    return {}
  } catch {
    return {}
  }
}

export const config = {
  matcher: [
    '/api/:path*',
    '/app/:path*',
    '/',
  ],
}
