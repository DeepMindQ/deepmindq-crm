/**
 * API Logging Middleware — Wraps route handlers with structured request/response logging.
 *
 * Logs method, path, status code, duration, and error details.
 * Uses the structured logger for observability and correlation ID tracking.
 */

import { logger } from '@/lib/logger';
import type { NextRequest } from 'next/server';

type RouteRequest = Request | NextRequest;

/**
 * Wraps a route handler with structured API logging.
 * Logs request method, path, response status, and duration.
 * Unhandled errors are logged with full context before re-throwing.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function withApiLogging<T extends (request: any, context?: any) => Promise<Response>>(
  handler: T,
  route?: string,
): T {
  return (async (request: RouteRequest, context?: { params?: Record<string, string> }) => {
    const startTime = performance.now();
    const path = new URL(request.url).pathname;
    const routeLabel = route || path;

    try {
      const response = await handler(request, context);
      const durationMs = Math.round(performance.now() - startTime);
      const status = response.status;

      if (status >= 500) {
        logger.error('[API] Server error', {
          route: routeLabel,
          method: request.method,
          status,
          durationMs,
        });
      } else if (status >= 400) {
        logger.warn('[API] Client error', {
          route: routeLabel,
          method: request.method,
          status,
          durationMs,
        });
      } else {
        logger.debug('[API] Request completed', {
          route: routeLabel,
          method: request.method,
          status,
          durationMs,
        });
      }

      return response;
    } catch (error) {
      const durationMs = Math.round(performance.now() - startTime);
      logger.error('[API] Unhandled error in route handler', {
        route: routeLabel,
        method: request.method,
        durationMs,
        error,
      });
      throw error;
    }
  }) as T;
}
