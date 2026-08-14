/**
 * CSRF Protection — Higher-Order Route Wrapper
 *
 * Wraps a Next.js route handler to enforce CSRF validation
 * on state-changing methods (POST, PUT, PATCH, DELETE).
 *
 * Uses the real csrfMiddleware from csrf.ts — NOT a stub.
 *
 * NOTE: Uses a generic constraint to accept both `Request` and `NextRequest`
 * since different route handlers may require Next.js-specific properties.
 */

import { csrfMiddleware } from '@/lib/csrf';
import { logger } from '@/lib/logger';
import type { NextRequest } from 'next/server';

type RouteRequest = Request | NextRequest;

/**
 * withCsrf — Wraps a route handler with CSRF validation.
 * GET/HEAD/OPTIONS pass through (safe methods).
 * POST/PUT/PATCH/DELETE require valid CSRF token.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withCsrf<T extends (request: any, context?: any) => Promise<Response>>(
  handler: T,
): T {
  return (async (request: RouteRequest, context?: { params?: Record<string, string> }) => {
    const result = csrfMiddleware(request as Request);
    if (!result.valid) {
      logger.warn('[CSRF] Validation failed', {
        method: request.method,
        path: new URL(request.url).pathname,
      });
      return result.response as Response;
    }

    return handler(request, context);
  }) as T;
}
