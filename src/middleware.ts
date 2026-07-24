/* ═══════════════════════════════════════════════════
   Next.js Edge Middleware
   
   Runs on every request BEFORE it reaches any route handler
   or page. Responsible for:
   
   1. Authentication enforcement — all /api/* routes require
      a valid session token except explicitly public paths
   2. Security headers — CSP, HSTS, X-Frame-Options, etc.
   3. Rate limiting — OTP endpoints throttled to 5/min/email
   4. CSRF protection — state-changing requests validated
   5. CORS / Preflight handling
   
   ⚠️  Edge Runtime constraints:
   - No Node.js APIs (fs, path, etc.)
   - No direct Prisma DB access (uses JWT-like token check
     or forwards to API-level validation)
   - Uses raw cookie parsing, not `cookies()` from next/headers
   ═══════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from 'next/server';
import {
  getSessionToken,
  isPublicPath,
  isApiRoute,
  isRateLimitedPublicApi,
  validateCsrf,
  getSecurityHeaders,
  applySecurityHeaders,
  unauthorizedResponse,
  rateLimitedResponse,
  otpRateLimit,
  generalApiRateLimit,
  SESSION_COOKIE_NAME,
} from '@/lib/auth-helpers';

export const config = {
  // Run middleware on ALL routes except Next.js internals and static assets
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - _next/webpack (HMR)
     * - favicon.ico
     * - public assets (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|_next/webpack|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf|eot)$).*)',
  ],
};

/**
 * Main middleware entry point.
 * Called on every matched request.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // ── 0. DEV AUTH BYPASS — only when explicitly enabled ──
  // ⚠️  SECURITY: This bypass is DISABLED by default.
  // To enable in local development, set ENABLE_DEV_AUTH_BYPASS=true in .env.local
  // NEVER set this in production. NODE_ENV alone is NOT sufficient.
  const devBypassEnabled = process.env.ENABLE_DEV_AUTH_BYPASS === 'true';
  if (devBypassEnabled) {
    console.warn('[Middleware] ⚠️  DEV AUTH BYPASS ACTIVE — all auth checks skipped');
    applySecurityHeaders(response);
    return response;
  }

  // ── 1. Apply security headers to ALL responses ──────────
  applySecurityHeaders(response);

  // ── 2. Skip auth for public paths ──────────────────────
  if (isPublicPath(pathname)) {
    // Still apply rate limiting to public auth APIs
    if (isRateLimitedPublicApi(pathname)) {
      return applyRateLimiting(request, response, pathname);
    }
    return response;
  }

  // ── 3. API Routes — require authentication ─────────────
  if (isApiRoute(pathname)) {
    return handleApiRoute(request, response, pathname);
  }

  // ── 4. Page Routes — redirect to login if no session ──
  return handlePageRoute(request, response, pathname);
}

/* ═══════════════════════════════════════════════════════
   API Route Handler
   ═══════════════════════════════════════════════════════ */
function handleApiRoute(
  request: NextRequest,
  _response: NextResponse,
  pathname: string
): NextResponse {
  // Check session token
  const token = getSessionToken(request);

  if (!token) {
    console.warn(`[Middleware] No session token for ${request.method} ${pathname}`);
    return unauthorizedResponse();
  }

  // CSRF validation for state-changing methods
  const method = request.method.toUpperCase();
  if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    if (!validateCsrf(request)) {
      return applySecurityHeaders(
        NextResponse.json(
          { success: false, error: 'CSRF validation failed' },
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        )
      );
    }
  }

  // General API rate limiting per IP + endpoint
  const ip = getClientIp(request);
  const rl = generalApiRateLimit(ip, pathname);
  if (!rl.success) {
    const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
    return rateLimitedResponse(retryAfter);
  }

  // Set rate limit headers on the response
  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', '100');
  response.headers.set('X-RateLimit-Remaining', String(rl.remaining));
  response.headers.set('X-RateLimit-Reset', String(rl.resetAt));
  applySecurityHeaders(response);
  return response;
}

/* ═══════════════════════════════════════════════════════
   Page Route Handler
   ═══════════════════════════════════════════════════════ */
function handlePageRoute(
  request: NextRequest,
  _response: NextResponse,
  pathname: string
): NextResponse {
  const token = getSessionToken(request);

  if (!token) {
    // Redirect to login page
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // User has a session token — allow through
  // (actual validation happens in the page/API route with DB access)
  const response = NextResponse.next();
  applySecurityHeaders(response);
  return response;
}

/* ═══════════════════════════════════════════════════════
   Rate Limiting for Public Auth APIs
   ═══════════════════════════════════════════════════════ */
function applyRateLimiting(
  request: NextRequest,
  _response: NextResponse,
  pathname: string
): NextResponse {
  const method = request.method.toUpperCase();

  // Only rate-limit POST requests (the actual OTP send)
  if (method !== 'POST') {
    const response = NextResponse.next();
    applySecurityHeaders(response);
    return response;
  }

  // Try to extract email from request body for OTP-specific limiting
  // Since Edge can't easily parse body without consuming it,
  // we use IP-based rate limiting as a fallback
  const ip = getClientIp(request);

  // For OTP request endpoint, also try email-based limiting
  if (pathname.includes('request-otp')) {
    // We can clone the request to read the body for email extraction
    // but to keep middleware fast, we'll use IP + endpoint limiting
    const rl = otpRateLimit(ip);
    if (!rl.success) {
      const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
      return rateLimitedResponse(retryAfter);
    }
  }

  // General rate limit for other auth endpoints
  const rl = generalApiRateLimit(ip, pathname);
  if (!rl.success) {
    const retryAfter = Math.ceil((rl.resetAt - Date.now()) / 1000);
    return rateLimitedResponse(retryAfter);
  }

  const response = NextResponse.next();
  response.headers.set('X-RateLimit-Limit', pathname.includes('request-otp') ? '5' : '100');
  response.headers.set('X-RateLimit-Remaining', String(rl.remaining));
  response.headers.set('X-RateLimit-Reset', String(rl.resetAt));
  applySecurityHeaders(response);
  return response;
}

/* ═══════════════════════════════════════════════════════
   Utility Helpers
   ═══════════════════════════════════════════════════════ */

/**
 * Extract client IP from request headers.
 */
function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}
