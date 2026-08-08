/* ═══════════════════════════════════════════════════
   Edge Middleware — CSRF Enforcement & Security Headers

   Single point of entry for all security concerns at the
   Edge layer. Runs before every request (except static
   assets handled by the matcher).

   CSRF: Double-submit cookie pattern with constant-time
   comparison. Token generated via Web Crypto API
   (Edge-compatible, no Node.js `crypto`).

   Security headers: Mirrors src/lib/auth-helpers.ts
   getSecurityHeaders() — the single source of truth is
   now enforced here at the Edge. next.config.ts returns
   an empty headers array to avoid duplication.
   ═══════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from 'next/server';

// ── Constants (must match src/lib/csrf.ts & auth-helpers.ts) ────
const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_TOKEN_HEADER = 'x-csrf-token';

/** HTTP methods that mutate state and require CSRF validation */
const CSRF_UNSAFE_METHODS = new Set(['POST', 'PUT', 'DELETE', 'PATCH']);

/** HTTP methods that are safe and never need CSRF checks */
const CSRF_SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Path prefixes that are completely exempt from CSRF checks.
 * Auth endpoints have their own protection (OTP flow, etc.).
 * Webhook receivers are called by external services with
 * signature verification, not browser-based CSRF tokens.
 */
const CSRF_SKIP_PREFIXES = [
  '/api/auth/',
  '/api/webhooks/',
  '/api/tracking/',
  '/api/cron/',
  '/api/unsubscribe',
];

// ── Timing-Safe Comparison ─────────────────────────────
/**
 * Constant-time string comparison to prevent timing attacks.
 * Mirrors the implementation in src/lib/csrf.ts and
 * src/lib/auth-helpers.ts — must stay in sync.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ── CSRF Token Operations ──────────────────────────────

/**
 * Generate a cryptographically random CSRF token.
 * Uses Web Crypto API (Edge-compatible) instead of
 * Node.js `crypto.randomBytes`.
 * Produces a 64-char hex string (32 bytes), matching the
 * output of `randomBytes(32).toString('hex')` in src/lib/csrf.ts.
 */
function generateCsrfToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extract the csrf-token cookie value from a request.
 */
function getCsrfCookie(request: NextRequest): string | null {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

// ── Security Headers ───────────────────────────────────
/**
 * Build the standard security headers for every response.
 * This is the canonical definition — mirrors
 * src/lib/auth-helpers.ts getSecurityHeaders().
 * Keep both in sync if you change values here.
 */
function getSecurityHeaders(): Record<string, string> {
  const isDev = process.env.NODE_ENV !== 'production';

  const csp = [
    "default-src 'self'",
    // Production: strict script-src. Dev: allow eval for HMR.
    isDev
      ? "script-src 'self' 'unsafe-eval'"
      : "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://*.googleusercontent.com",
    "connect-src 'self' https://*.googleapis.com https://api.tavily.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  return {
    'Content-Security-Policy': csp,
    'X-Frame-Options': 'DENY',
    'X-Content-Type-Options': 'nosniff',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  };
}

/**
 * Apply all security headers to a NextResponse instance.
 */
function applySecurityHeaders(response: NextResponse): NextResponse {
  const headers = getSecurityHeaders();
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

// ── Path Helpers ───────────────────────────────────────

/**
 * Check if a path starts with any of the given prefixes.
 * Matches both exact prefix and prefix + '/'.
 */
function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some(
    (prefix) =>
      pathname === prefix || pathname.startsWith(prefix + '/')
  );
}

// ── Middleware ──────────────────────────────────────────

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const method = request.method.toUpperCase();

  // ── 1. Create base response ────────────────────────────
  const response = NextResponse.next();

  // ── 2. Apply security headers to ALL responses ─────────
  applySecurityHeaders(response);

  // ── 3. CSRF: Only relevant for API routes ───────────────
  if (!pathname.startsWith('/api/')) {
    // For page requests, ensure CSRF cookie exists so the
    // client can read it on the next API call.
    if (!getCsrfCookie(request)) {
      const token = generateCsrfToken();
      response.cookies.set(CSRF_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24, // 24 hours
      });
    }
    return response;
  }

  // ── 4. API route: safe methods ─────────────────────────
  if (CSRF_SAFE_METHODS.has(method)) {
    // Ensure the CSRF cookie + response header exist so the
    // client can pick up the token for subsequent mutations.
    let csrfToken = getCsrfCookie(request);

    if (!csrfToken) {
      csrfToken = generateCsrfToken();
      response.cookies.set(CSRF_COOKIE_NAME, csrfToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24, // 24 hours
      });
    }

    // Expose the token in a response header so the frontend
    // can store it and send it as x-csrf-token on mutations.
    response.headers.set(CSRF_TOKEN_HEADER, csrfToken);

    return response;
  }

  // ── 5. API route: unsafe method — enforce CSRF ─────────

  // Skip CSRF for endpoints that have their own protection
  if (matchesPrefix(pathname, CSRF_SKIP_PREFIXES)) {
    return response;
  }

  // Validate double-submit cookie pattern
  const headerToken = request.headers.get(CSRF_TOKEN_HEADER);
  const cookieToken = getCsrfCookie(request);

  if (!headerToken || !cookieToken || !timingSafeEqual(headerToken, cookieToken)) {
    // CSRF validation failed — reject with 403
    return applySecurityHeaders(
      NextResponse.json(
        { success: false, error: 'CSRF validation failed' },
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    );
  }

  // CSRF passed — also refresh the response header so the
  // client always has the latest token.
  response.headers.set(CSRF_TOKEN_HEADER, cookieToken);

  return response;
}

// ── Matcher Configuration ──────────────────────────────
//
// Run middleware on all paths EXCEPT:
//  - _next/static (bundled static assets)
//  - _next/image (Next.js image optimization)
//  - favicon.ico, robots.txt, sitemap.xml (static files)
//
// Static files don't need security headers or CSRF.
// The regex negative lookahead keeps the middleware bundle
// lean by excluding these paths at the routing level.

export const config = {
  matcher: [
    // Match all paths except static assets and Next.js internals
    '/((?!_next/static|_next/image|favicon\.ico|robots\.txt|sitemap\.xml).*)',
  ],
};
