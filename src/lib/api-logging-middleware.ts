/**
 * API logging middleware helper.
 * Wraps API route handlers to add structured logging with:
 *   - Correlation ID
 *   - Request timing
 *   - Response status
 *   - Error details
 *
 * Usage:
 * ```ts
 * // In any Next.js API route handler:
 * export const GET = withApiLogging(async (req) => {
 *   return NextResponse.json({ data: 'hello' })
 * }, '/api/example')
 * ```
 */

import { logger } from '@/lib/logger'
import { getCorrelationId, CORRELATION_HEADER } from '@/lib/correlation-id'
import { createRequestContext, withRequestContext, getRequestDurationMs } from '@/lib/request-context'
import { NextResponse, NextRequest } from 'next/server'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiHandler = (request: any, context?: { params?: Record<string, string> }) => Promise<Response>

/**
 * Wraps a Next.js API route handler (GET, POST, etc.) with:
 * 1. Request context initialization (correlationId, requestId, traceId)
 * 2. AsyncLocalStorage propagation
 * 3. Structured request/response logging
 * 4. Error logging with stack traces
 * 5. Correlation ID in response headers
 */
export function withApiLogging<T extends ApiHandler>(
  handler: T,
  routeName?: string
): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (async (request: any, context?: { params?: Record<string, string> }) => {
    const correlationId = getCorrelationId(request)
    const url = new URL(request.url)
    const route = routeName || url.pathname
    const startTime = Date.now()

    // Build request context for AsyncLocalStorage
    const reqCtx = createRequestContext({
      correlationId,
      route,
      startTime,
    })

    try {
      // Execute handler within request context
      const response = await withRequestContext(reqCtx, () => handler(request, context))

      const durationMs = Date.now() - startTime
      const status = response.status
      const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'

      logger[level](`${request.method} ${route} ${status}`, {
        method: request.method,
        route,
        status,
        durationMs,
        correlationId,
        requestId: reqCtx.requestId,
        traceId: reqCtx.traceId,
        url: url.pathname,
      })

      // Inject correlation ID into response headers
      const headers = new Headers(response.headers)
      headers.set(CORRELATION_HEADER, correlationId)
      headers.set('x-request-id', reqCtx.requestId)
      headers.set('x-trace-id', reqCtx.traceId)

      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      })
    } catch (error) {
      const durationMs = Date.now() - startTime

      logger.error(`${request.method} ${route} 500 (unhandled)`, {
        method: request.method,
        route,
        status: 500,
        durationMs,
        correlationId,
        requestId: reqCtx.requestId,
        traceId: reqCtx.traceId,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      })

      // Return structured JSON error response
      return NextResponse.json(
        {
          error: 'Internal Server Error',
          correlationId,
          requestId: reqCtx.requestId,
        },
        {
          status: 500,
          headers: {
            [CORRELATION_HEADER]: correlationId,
            'x-request-id': reqCtx.requestId,
            'Cache-Control': 'no-store',
          },
        }
      )
    }
  }) as T
}

/**
 * Re-exported for convenience — allows routes to do:
 * import { withRequestContext } from '@/lib/api-logging-middleware'
 */
export { withRequestContext, getRequestDurationMs, createRequestContext } from '@/lib/request-context'
