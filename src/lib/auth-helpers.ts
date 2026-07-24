/* ═══════════════════════════════════════════════════
   Auth Helpers — Centralized Security Utilities

   Provides session extraction from Edge-compatible requests,
   CSRF middleware, admin role checks, and security header
   injection for use in both middleware.ts and API routes.
   ═══════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from 'next/server';

// ── Constants ───────────────────────────────────────────
export const SESSION_COOKIE_NAME = 'dmq_session';
export const CSRF_COOKIE_NAME = 'csrf-token';
export const CSRF_TOKEN_HEADER = 'x-csrf-token';

// ── Public Route Patterns (exempt from auth) ────────────
// These path prefixes are always accessible without authentication.
export const PUBLIC_PATH_PREFIXES: string[] = [
  '/api/auth/',
  '/api/setup-db',         // DB schema setup (initial deployment)
  '/api/webhooks/',       // Incoming webhooks (Stripe, etc.)
  '/login',
  '/signup',
  '/favicon.ico',
  '/_next/static',
  '/_next/image',
  '/_next/webpack',
  '/_next/data',
];

// ── Public API paths that require rate limiting but not auth ──
export const RATE_LIMITED_PUBLIC_APIS: string[] = [
  '/api/auth/request-otp',
  '/api/auth/verify-otp',
  '/api/auth/login',
  '/api/auth/register',
];

// ── Session Extraction (Edge-compatible) ───────────────
/**
 * Extract session token from request cookies.
 * Uses raw cookie parsing (Edge Runtime compatible, no `cookies()` from next/headers).
 */
export function getSessionToken(request: NextRequest): string | null {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

// ── Path Matching ──────────────────────────────────────
/**
 * Check if a request path matches any of the given prefixes.
 */
export function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix) || pathname === prefix + '/'
  ) || pathname === '/';
}

/**
 * Check if a path is an API route.
 */
export function isApiRoute(pathname: string): boolean {
  return pathname.startsWith('/api/');
}

/**
 * Check if a path is a rate-limited public API.
 */
export function isRateLimitedPublicApi(pathname: string): boolean {
  return RATE_LIMITED_PUBLIC_APIS.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix) || pathname === prefix + '/'
  );
}

// ── CSRF Validation ─────────────────────────────────────
/**
 * Validate CSRF token from request.
 * Safe methods (GET, HEAD, OPTIONS) always pass.
 * For state-changing methods, the x-csrf-token header must
 * match the csrf-token cookie.
 */
export function validateCsrf(request: NextRequest): boolean {
  const method = request.method.toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return true;

  const headerToken = request.headers.get(CSRF_TOKEN_HEADER);
  if (!headerToken) return false;

  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(
    new RegExp(`(?:^|;\\s*)${CSRF_COOKIE_NAME}=([^;]*)`)
  );
  const cookieToken = match ? decodeURIComponent(match[1]) : null;

  if (!cookieToken) return false;

  // Constant-time comparison
  return timingSafeEqual(headerToken, cookieToken);
}

/**
 * Middleware-style CSRF check returning a result object.
 */
export function csrfCheck(request: NextRequest): { valid: boolean; response?: NextResponse } {
  const valid = validateCsrf(request);
  return {
    valid,
    response: valid
      ? undefined
      : NextResponse.json(
          { success: false, error: 'CSRF validation failed' },
          { status: 403, headers: { 'Content-Type': 'application/json' } }
        ),
  };
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

// ── Admin Role Check ───────────────────────────────────
/**
 * Check if a session token's user has admin role.
 * Note: In Edge middleware, we cannot do DB lookups.
 * This is a placeholder for API-level admin checks.
 * The actual admin check happens in api-auth.ts using the full session.
 */
export const ADMIN_ROLES = ['admin', 'ADMIN'];

// ── Security Headers ───────────────────────────────────
/**
 * Standard security headers applied to all responses.
 */
export function getSecurityHeaders(): Record<string, string> {
  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  };
}

/**
 * Apply security headers to a NextResponse.
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  const headers = getSecurityHeaders();
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

// ── Rate Limiting Helpers (Edge-compatible) ─────────────
// In-memory rate limit store for Edge middleware.
// Note: In production with multiple instances, use Redis.
interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of rateLimitStore.entries()) {
      if (entry.resetAt <= now) rateLimitStore.delete(key);
    }
  }, 5 * 60 * 1000);
}

/**
 * Edge-compatible rate limiter.
 * @returns { success, remaining, resetAt }
 */
export function edgeRateLimit(
  key: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitStore.set(key, entry);
  }

  entry.count++;

  return {
    success: entry.count <= limit,
    remaining: Math.max(0, limit - entry.count),
    resetAt: entry.resetAt,
  };
}

/**
 * Rate limit configuration for OTP endpoints.
 * 5 OTP requests per email per minute.
 */
export function otpRateLimit(email: string): { success: boolean; remaining: number; resetAt: number } {
  return edgeRateLimit(`otp:${email.toLowerCase()}`, 5, 60_000);
}

/**
 * General API rate limit per IP.
 */
export function generalApiRateLimit(ip: string, path: string): { success: boolean; remaining: number; resetAt: number } {
  return edgeRateLimit(`api:${ip}:${path}`, 100, 60_000);
}

// ── Response Helpers ────────────────────────────────────
/**
 * Create a JSON response with security headers.
 */
export function secureJsonResponse(data: unknown, status = 200): NextResponse {
  const response = NextResponse.json(data, { status });
  return applySecurityHeaders(response);
}

/**
 * Create an unauthorized response.
 */
export function unauthorizedResponse(): NextResponse {
  return applySecurityHeaders(
    NextResponse.json(
      { success: false, error: 'Authentication required', timestamp: new Date().toISOString() },
      { status: 401 }
    )
  );
}

/**
 * Create a rate-limited response.
 */
export function rateLimitedResponse(retryAfter?: number): NextResponse {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Retry-After': String(retryAfter || 60),
  };
  return applySecurityHeaders(
    new NextResponse(
      JSON.stringify({ success: false, error: 'Too many requests. Please try again later.' }),
      { status: 429, headers }
    )
  );
}

/**
 * Create a forbidden response.
 */
export function forbiddenResponse(message = 'Forbidden'): NextResponse {
  return applySecurityHeaders(
    NextResponse.json(
      { success: false, error: message, timestamp: new Date().toISOString() },
      { status: 403 }
    )
  );
}
