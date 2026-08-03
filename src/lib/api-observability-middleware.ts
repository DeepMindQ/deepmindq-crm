/**
 * WI-18.4 Phase 4 — API Observability Middleware
 *
 * Wraps Next.js API route handlers to record latency, status code,
 * and endpoint metrics via the existing recordApiMetric() function.
 *
 * Usage:
 *   export const GET = withApiObservability(async (req) => { ... });
 */

import { recordApiMetric } from '@/lib/api-observability';

type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS';

type RouteHandler = (request: Request, context?: Record<string, unknown>) => Promise<Response>;

/**
 * Wrap an API route handler with observability — records latency and status code
 * via recordApiMetric() before returning the response. Passes through all
 * handler behavior unchanged.
 */
export function withApiObservability(handler: RouteHandler): RouteHandler {
  return async (request: Request, context?: Record<string, unknown>): Promise<Response> => {
    const startTime = Date.now();
    const method = (request.method.toUpperCase() ?? 'GET') as ApiMethod;
    const url = new URL(request.url);
    const path = url.pathname;

    try {
      const response = await handler(request, context);
      const latencyMs = Date.now() - startTime;
      const statusCode = response.status;

      recordApiMetric(method, path, statusCode, latencyMs);

      return response;
    } catch (error: unknown) {
      const latencyMs = Date.now() - startTime;

      // Record as 500 for unhandled exceptions
      recordApiMetric(method, path, 500, latencyMs);

      // Re-throw so the caller's error handling still applies
      throw error;
    }
  };
}
