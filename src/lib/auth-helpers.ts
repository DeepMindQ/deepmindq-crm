/* ═══════════════════════════════════════════════════
   Auth Helpers — Centralized Security Utilities

   Provides session extraction from Edge-compatible requests,
   admin role checks, and security header injection for use
   in both middleware.ts and API routes.

   CSRF Re-architecture (P0 Deep Audit #3):
     validateCsrf, CSRF_COOKIE_NAME, CSRF_TOKEN_HEADER are
     now re-exported from @/lib/csrf (single source of truth).
     This eliminates the previous duplication where auth-helpers.ts
     and csrf.ts had independent implementations.
   ═══════════════════════════════════════════════════ */

import { NextRequest, NextResponse } from 'next/server';
import { registerTimer } from '@/lib/timer-registry';
import { validateCsrf as csrfValidateCsrf, CSRF_COOKIE_NAME, CSRF_TOKEN_HEADER } from '@/lib/csrf';

// ── Constants ───────────────────────────────────────────
export const SESSION_COOKIE_NAME = 'dmq_session';
// Re-exported from csrf.ts — single source of truth
export { CSRF_COOKIE_NAME, CSRF_TOKEN_HEADER };

// ── Public Route Patterns (exempt from auth) ────────────
// These path prefixes are always accessible without authentication.
// NOTE: /api/setup-db is now token-gated (Phase 0).
// NOTE: /api/seed should NOT be public — seed data is a destructive operation.
// NOTE: /api/intelligence/* requires auth — intelligence is premium data.
export const PUBLIC_PATH_PREFIXES: string[] = [
  '/api/auth/',
  '/api/webhooks/crm/', // Inbound CRM webhooks (HubSpot, Salesforce) — verified via HMAC signatures
  '/api/webhooks/bounce', // Inbound email bounce notifications — verified via provider signatures
  '/api/webhooks/reply', // Inbound email reply webhooks — verified via provider signatures
  '/api/tracking/',
  '/api/unsubscribe',
  '/api/cron/',
  '/api/health/',
  '/api/health', // Health endpoint (exact match, no trailing slash)
  '/api/ping',
  '/api/ready',
  '/api/version',
  '/api/verify-email',
  '/api/verify-queue',
  '/api/brand', // Public brand config endpoint
  '/api/docs', // Public API documentation
  '/api/integrations/slack', // Webhook endpoint (Slack events, verified via webhook secret)
  '/api/integrations/zapier', // Webhook endpoint (Zapier events, verified via webhook secret)
  // '/api/monitoring' — REMOVED (P0.2): Requires auth. Exposes process internals.
  '/api/v1', // Public API v1 proxy and index
  '/login',
  '/demo',
  '/marketing',
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
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE_NAME}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

// ── Path Matching ──────────────────────────────────────
/**
 * Check if a request path matches any of the given prefixes.
 */
export function isPublicPath(pathname: string): boolean {
  return (
    PUBLIC_PATH_PREFIXES.some(
      (prefix) => pathname === prefix || pathname.startsWith(prefix) || pathname === prefix + '/',
    ) || pathname === '/'
  );
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
    (prefix) => pathname === prefix || pathname.startsWith(prefix) || pathname === prefix + '/',
  );
}

// ── CSRF Validation ─────────────────────────────────────
// P0 Deep Audit #3 FIX: Eliminated duplicate implementation.
// Now delegates to the canonical validateCsrf in csrf.ts.
// This ensures middleware.ts, proxy.ts, and with-csrf.ts all
// use the SAME validation logic and constant-time comparison.

/**
 * Validate CSRF token from request.
 * Re-exported from csrf.ts (single source of truth).
 * Accepts NextRequest (middleware) or plain Request (API routes).
 */
export function validateCsrf(request: NextRequest): boolean {
  return csrfValidateCsrf(request);
}

/**
 * Middleware-style CSRF check returning a result object.
 */
export function csrfCheck(request: NextRequest): { valid: boolean; response?: NextResponse } {
  const valid = csrfValidateCsrf(request);
  return {
    valid,
    response: valid
      ? undefined
      : NextResponse.json(
          { success: false, error: 'CSRF validation failed' },
          { status: 403, headers: { 'Content-Type': 'application/json' } },
        ),
  };
}

// ── CSP Nonce Generation (Edge-compatible) ─────────────
/**
 * Generate a cryptographic random nonce for Content Security Policy.
 * Edge-compatible: uses crypto.getRandomValues (no Node.js APIs).
 * 16 bytes → 24 base64 characters — sufficient entropy for per-request nonce.
 */
export function generateCspNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  // Base64url encoding using btoa (Edge-compatible via globalThis.btoa)
  // 16 bytes → 24 base64 characters (no padding)
  const binary = Array.from(bytes)
    .map((b) => String.fromCharCode(b))
    .join('');
  return globalThis
    .btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
    .slice(0, 24);
}

// ── Security Headers ───────────────────────────────────
/**
 * Standard security headers applied to all responses.
 * @param nonce - Optional CSP nonce. When provided, added to script-src as 'nonce-<value>'.
 */
export function getSecurityHeaders(nonce?: string): Record<string, string> {
  const nonceDirective = nonce ? ` 'nonce-${nonce}'` : '';
  const csp = [
    "default-src 'self'",
    // Level 5 — Nonce-based CSP for scripts.
    //   Production: 'self' + nonce (no eval, no inline)
    //   Development: 'self' + nonce + 'unsafe-eval' (required by Next.js hot-reload / Fast Refresh)
    //   INTENTIONAL: 'unsafe-eval' is ONLY enabled in development mode. It is never
    //   present in production CSP. Do NOT add 'unsafe-inline' to the script policy in any environment.
    process.env.NODE_ENV === 'production'
      ? `script-src 'self'${nonceDirective}`
      : `script-src 'self'${nonceDirective} 'unsafe-eval'`,
    // style-src allows inline styles (industry standard).
    // script-src is fully locked down with nonce.
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob: https://*.googleusercontent.com",
    "connect-src 'self' https://*.googleapis.com https://api.tavily.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');

  return {
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'X-XSS-Protection': '1; mode=block',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    'Content-Security-Policy': csp,
  };
}

/**
 * Apply security headers to a NextResponse.
 * Generates a per-request CSP nonce and sets it as x-csp-nonce header
 * so the layout/page can read it for inline script tags.
 */
export function applySecurityHeaders(response: NextResponse): NextResponse {
  const nonce = generateCspNonce();
  response.headers.set('x-csp-nonce', nonce);
  const headers = getSecurityHeaders(nonce);
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

const AUTH_RATE_LIMIT_MAX = 50_000;

const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  registerTimer(
    setInterval(
      () => {
        const now = Date.now();
        for (const [key, entry] of rateLimitStore.entries()) {
          if (entry.resetAt <= now) rateLimitStore.delete(key);
        }
      },
      5 * 60 * 1000,
    ),
  );
}

/** Evict oldest entries when store exceeds max size */
function evictAuthRateLimitEntries(): void {
  if (rateLimitStore.size <= AUTH_RATE_LIMIT_MAX) return;
  const excess = rateLimitStore.size - AUTH_RATE_LIMIT_MAX;
  let evicted = 0;
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= Date.now()) {
      rateLimitStore.delete(key);
      if (++evicted >= excess) break;
    }
  }
  // If still over limit, delete oldest by resetAt
  if (rateLimitStore.size > AUTH_RATE_LIMIT_MAX) {
    const entries = Array.from(rateLimitStore.entries()).sort(
      (a, b) => a[1].resetAt - b[1].resetAt,
    );
    const remaining = rateLimitStore.size - AUTH_RATE_LIMIT_MAX;
    for (let i = 0; i < remaining; i++) {
      rateLimitStore.delete(entries[i][0]);
    }
  }
}

/**
 * Edge-compatible rate limiter.
 * @returns { success, remaining, resetAt }
 */
export function edgeRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { success: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  let entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    rateLimitStore.set(key, entry);
  }

  entry.count++;

  // Evict if store exceeds max size (botnet protection)
  evictAuthRateLimitEntries();

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
export function otpRateLimit(email: string): {
  success: boolean;
  remaining: number;
  resetAt: number;
} {
  return edgeRateLimit(`otp:${email.toLowerCase()}`, 5, 60_000);
}

/**
 * General API rate limit per IP (Edge-compatible, in-memory).
 * Used by proxy.ts (Edge Runtime) for per-request rate limiting.
 * For distributed rate limiting in Node.js API routes, use distributedApiRateLimit().
 */
export function generalApiRateLimit(
  ip: string,
  path: string,
): { success: boolean; remaining: number; resetAt: number } {
  return edgeRateLimit(`api:${ip}:${path}`, 100, 60_000);
}

/**
 * Distributed API rate limit per IP (Node.js only).
 *
 * Uses Redis-backed distributed rate limiting for multi-instance deployments.
 * Falls back to in-memory limiting when Redis is unavailable.
 *
 * IMPORTANT: This function is async and uses dynamic imports (ioredis/upstash).
 * Do NOT use in Edge Runtime (proxy.ts). Use in Node.js API routes only.
 *
 * @param ip - Client IP address
 * @param path - API path for key construction
 * @param limit - Max requests in window (default: 100)
 * @param windowMs - Time window in milliseconds (default: 60_000)
 * @returns Rate limit result with success status and metadata
 *
 * @example
 *   // In a Node.js API route:
 *   const result = await distributedApiRateLimit(ip, '/api/companies');
 *   if (!result.success) return rateLimitedResponse();
 */
export async function distributedApiRateLimit(
  ip: string,
  path: string,
  limit = 100,
  windowMs = 60_000,
): Promise<{ success: boolean; remaining: number; resetAt: number; backend: string }> {
  try {
    const { distributedRateLimit } = await import('@/lib/distributed-rate-limit');
    const result = await distributedRateLimit({
      key: `api:${path}`,
      limit,
      windowMs,
      identifier: ip,
    });
    return {
      success: result.success,
      remaining: result.remaining,
      resetAt: result.resetAt,
      backend: result.backend,
    };
  } catch {
    // Fallback to in-memory if distributed rate limit module fails to load
    return { ...generalApiRateLimit(ip, path), backend: 'memory-fallback' };
  }
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
      { status: 401 },
    ),
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
      { status: 429, headers },
    ),
  );
}

/**
 * Create a forbidden response.
 */
export function forbiddenResponse(message = 'Forbidden'): NextResponse {
  return applySecurityHeaders(
    NextResponse.json(
      { success: false, error: message, timestamp: new Date().toISOString() },
      { status: 403 },
    ),
  );
}

// ── Edge-Safe Audit Helpers ────────────────────────────
// P0 Deep Audit #4 FIX:
//   proxy.ts previously imported auditAuthFailure/auditCsrfFailure from
//   @/lib/audit-logger, which imports @/lib/db → @prisma/client.
//   Prisma uses TCP sockets + native Rust bindings → CRASHES Edge Runtime
//   at module load time (not even at function call time).
//
//   These Edge-safe alternatives use console.log/console.warn only
//   (identical to what logger.ts does). No DB writes.
//   The persistent audit trail is handled at the API route level
//   (Node.js runtime) where Prisma IS available.

/**
 * Edge-safe auth failure audit log (no DB write, logger only).
 */
export function edgeAuditAuthFailure(
  action: string,
  ip: string,
  extras?: Record<string, unknown>,
): void {
  const meta: Record<string, unknown> = { ip, action, ...(extras || {}) };
  console.warn(`[AUDIT:AUTH] ${action}`, meta);
}

/**
 * Edge-safe CSRF failure audit log (no DB write, logger only).
 */
export function edgeAuditCsrfFailure(ip: string, path: string, method: string): void {
  console.warn(`[AUDIT:CSRF] CSRF validation failed`, { ip, path, method });
}
