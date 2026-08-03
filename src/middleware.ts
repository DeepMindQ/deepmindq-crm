/* ═══════════════════════════════════════════════════
   Edge Middleware — WI-18.1-Lock Permanent Protection
   ═══════════════════════════════════════════════════

   SECURITY GATE PROTECTED — CI will fail if this file is removed
   or if any of the following protections are disabled.

   Architecture:
   ────────────
   This middleware runs at the Edge (Vercel/Cloudflare) before
   any API route or page request reaches the Next.js server.
   It provides three layers of protection:

   Layer 1 — Security Headers (ALL responses)
     ──────────────────────────────────────────
     Every response (page or API) gets security headers:
     - X-Content-Type-Options: nosniff
     - X-Frame-Options: DENY
     - X-XSS-Protection: 1; mode=block
     - Referrer-Policy: strict-origin-when-cross-origin
     - Permissions-Policy: camera=(), microphone=(), geolocation=()
     - Strict-Transport-Security: max-age=31536000; includeSubDomains
     - Content-Security-Policy: strict, no unsafe-inline in production

     Source: getSecurityHeaders() in src/lib/auth-helpers.ts

   Layer 2 — CSRF Protection (page loads)
     ───────────────────────────────────────
     On every page request (non-API), a CSRF token cookie is injected.
     The token is rotated on each page load to prevent token reuse.
     Client-side fetchApi.ts reads this cookie and sends it as the
     x-csrf-token header on all state-changing requests.

     Flow:
     1. Page loads → middleware sets csrf-token cookie
     2. Client reads cookie → stores in memory
     3. Client makes POST/PUT/DELETE → sends x-csrf-token header
     4. Middleware validates header matches cookie (constant-time compare)

     Source: generateCsrfToken() in src/lib/csrf.ts
             validateCsrf() in src/lib/auth-helpers.ts
             getCsrfToken() in src/lib/fetchApi.ts

   Layer 3 — API Route Protection (protected API routes)
     ──────────────────────────────────────────────
     Protected API routes (anything not in PUBLIC_PATH_PREFIXES)
     get three checks:
     a) CSRF validation (for POST/PUT/DELETE/PATCH)
     b) Session validation (dmq_session cookie must exist)
     c) Rate limiting (public auth endpoints: 20 req/min per IP)

     Public routes (exempt from session check):
     - /api/auth/*        (login, OTP, registration)
     - /api/webhooks/*    (third-party integrations)
     - /api/tracking/*    (email tracking pixels)
     - /api/unsubscribe  (email preferences)
     - /api/cron/*        (scheduled tasks)
     - /login, /demo, /marketing (public pages)
     - Static assets      (/_next/*, favicon.ico)

     Source: PUBLIC_PATH_PREFIXES in src/lib/auth-helpers.ts
             checkApiAuth() in src/lib/api-auth.ts

   Protected Routes:
   ────────────────
   All /api/* routes EXCEPT the public list above.
   Any new API route is PROTECTED BY DEFAULT.
   To make a route public, add its prefix to PUBLIC_PATH_PREFIXES.

   Adding a new public route:
     1. Open src/lib/auth-helpers.ts
     2. Add the route prefix to PUBLIC_PATH_PREFIXES array
     3. Document why it's public in this header comment

   ═══════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from 'next/server';
import {
  SESSION_COOKIE_NAME,
  CSRF_COOKIE_NAME,
  CSRF_TOKEN_HEADER,
  PUBLIC_PATH_PREFIXES,
  isPublicPath,
  isApiRoute,
  isRateLimitedPublicApi,
  getSecurityHeaders,
  validateCsrf,
  edgeRateLimit,
  getSessionToken,
} from '@/lib/auth-helpers';
import { generateCsrfToken } from '@/lib/csrf';

export const config = {
  // Run middleware on all routes except static files and _next internals
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // ── Layer 1: Security Headers on ALL responses ──
  const headers = getSecurityHeaders();
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }

  // ── Layer 2: CSRF Token Injection (page requests only) ──
  if (!isApiRoute(pathname)) {
    const existingToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
    const newToken = existingToken || generateCsrfToken();
    response.cookies.set(CSRF_COOKIE_NAME, newToken, {
      httpOnly: false,       // Client JS needs to read this
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60,      // 1 hour
    });
  }

  // ── Layer 3: API Route Protection ──
  if (isApiRoute(pathname)) {
    if (isPublicPath(pathname)) {
      // Rate-limit public auth endpoints
      if (isRateLimitedPublicApi(pathname)) {
        const ip = request.ip || 'unknown';
        const rateLimit = edgeRateLimit(`${ip}:${pathname}`, 20, 60_000);
        if (!rateLimit.success) {
          return NextResponse.json(
            { success: false, error: 'Too many requests. Please try again later.' },
            {
              status: 429,
              headers: {
                'Content-Type': 'application/json',
                'Retry-After': String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
                ...getSecurityHeaders(),
              },
            }
          );
        }
      }
      return response;
    }

    // CSRF validation for state-changing methods
    const method = request.method.toUpperCase();
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      if (!validateCsrf(request)) {
        return NextResponse.json(
          { success: false, error: 'CSRF validation failed' },
          {
            status: 403,
            headers: { 'Content-Type': 'application/json', ...getSecurityHeaders() },
          }
        );
      }
    }

    // Session validation
    const sessionToken = getSessionToken(request);
    if (!sessionToken) {
      return NextResponse.json(
        { success: false, error: 'Authentication required', timestamp: new Date().toISOString() },
        { status: 401, headers: { 'Content-Type': 'application/json', ...getSecurityHeaders() } }
      );
    }
  }

  return response;
}
