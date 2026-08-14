/**
 * CSRF Protection — Higher-Order Route Wrapper
 *
 * Wraps a Next.js route handler to enforce CSRF validation
 * on state-changing methods (POST, PUT, PATCH, DELETE).
 *
 * Uses the real csrfMiddleware from csrf.ts — NOT a stub.
 */

import { csrfMiddleware } from '@/lib/csrf';
import { logger } from '@/lib/logger';

type RouteHandler = (...args: any[]) => Promise<Response>;

/**
 * withCsrf — Wraps a route handler with CSRF validation.
 * GET/HEAD/OPTIONS pass through (safe methods).
 * POST/PUT/PATCH/DELETE require valid CSRF token.
 */
export function withCsrf<T extends RouteHandler>(handler: T): T {
  return (async (...args: any[]) => {
    const request = args[0] as Request;

    const result = csrfMiddleware(request);
    if (!result.valid) {
      logger.warn('[CSRF] Validation failed', {
        method: request.method,
        path: new URL(request.url).pathname,
      });
      return result.response as Response;
    }

    return handler(...args);
  }) as T;
}
