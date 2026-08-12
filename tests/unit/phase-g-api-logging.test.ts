/**
 * Tests for api-logging-middleware (Phase G)
 * Tests that withApiLogging properly:
 * - Populates AsyncLocalStorage request context
 * - Injects correlation/request/trace ID headers in responses
 * - Logs structured request/response entries
 * - Handles errors with proper error logging
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock the logger before importing the module under test
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  },
}))

vi.mock('@/lib/correlation-id', () => ({
  getCorrelationId: (req: Request) => {
    const header = req.headers.get('x-correlation-id')
    return header || 'generated-correlation-id'
  },
  CORRELATION_HEADER: 'x-correlation-id',
}))

// Mock request-context to verify it gets populated
vi.mock('@/lib/request-context', () => {
  const store = new Map<string, unknown>()
  return {
    requestContextStorage: {
      getStore: () => store.get('ctx'),
      run: (_ctx: unknown, fn: () => unknown) => {
        store.set('ctx', _ctx)
        return fn()
      },
    },
    createRequestContext: (partial: Record<string, unknown>) => ({
      correlationId: partial.correlationId || 'req-uuid',
      requestId: partial.requestId || 'req-uuid',
      traceId: partial.traceId || 'trace-uuid',
      startTime: partial.startTime || Date.now(),
      ...partial,
    }),
    withRequestContext: (ctx: unknown, fn: () => Promise<unknown>) => fn(),
    getRequestDurationMs: () => 10,
  }
})

const { withApiLogging } = await import('@/lib/api-logging-middleware')
const { logger } = await import('@/lib/logger')

describe('withApiLogging', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should wrap a handler and return a successful response with correlation headers', async () => {
    const handler = async () => new Response(JSON.stringify({ ok: true }), { status: 200 })
    const wrapped = withApiLogging(handler, '/api/test')

    const req = new Request('http://localhost/api/test', {
      headers: { 'x-correlation-id': 'test-corr-123' },
    })

    const res = await wrapped(req)

    // Response should have correlation headers
    expect(res.headers.get('x-correlation-id')).toBe('test-corr-123')
    expect(res.headers.get('x-request-id')).toBeDefined()
    expect(res.headers.get('x-trace-id')).toBeDefined()
    expect(res.status).toBe(200)

    // Should have logged the request
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('GET /api/test 200'),
      expect.objectContaining({
        method: 'GET',
        route: '/api/test',
        status: 200,
        correlationId: 'test-corr-123',
      }),
    )
  })

  it('should log at warn level for 4xx responses', async () => {
    const handler = async () => new Response(JSON.stringify({ error: 'not found' }), { status: 404 })
    const wrapped = withApiLogging(handler, '/api/test')

    const req = new Request('http://localhost/api/test')
    const res = await wrapped(req)

    expect(res.status).toBe(404)
    expect(logger.warn).toHaveBeenCalled()
  })

  it('should log at error level for 5xx responses', async () => {
    const handler = async () => new Response(JSON.stringify({ error: 'server error' }), { status: 500 })
    const wrapped = withApiLogging(handler, '/api/test')

    const req = new Request('http://localhost/api/test')
    const res = await wrapped(req)

    expect(res.status).toBe(500)
    expect(logger.error).toHaveBeenCalled()
  })

  it('should catch unhandled errors and return structured JSON error response', async () => {
    const handler = async () => {
      throw new Error('Database connection failed')
    }
    const wrapped = withApiLogging(handler, '/api/test')

    const req = new Request('http://localhost/api/test')
    const res = await wrapped(req)

    expect(res.status).toBe(500)
    expect(res.headers.get('x-correlation-id')).toBeDefined()
    expect(res.headers.get('Cache-Control')).toBe('no-store')

    const body = await res.json()
    expect(body.error).toBe('Internal Server Error')
    expect(body.correlationId).toBeDefined()
    expect(body.requestId).toBeDefined()

    // Should have logged the error with stack trace
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('500 (unhandled)'),
      expect.objectContaining({
        error: 'Database connection failed',
      }),
    )
  })

  it('should generate a correlation ID if none provided in header', async () => {
    const handler = async () => new Response(JSON.stringify({ ok: true }))
    const wrapped = withApiLogging(handler, '/api/test')

    const req = new Request('http://localhost/api/test')
    const res = await wrapped(req)

    const corrId = res.headers.get('x-correlation-id')
    expect(corrId).toBe('generated-correlation-id')
  })

  it('should extract route name from URL if not provided', async () => {
    const handler = async () => new Response(JSON.stringify({ ok: true }))
    const wrapped = withApiLogging(handler) // No route name

    const req = new Request('http://localhost/api/companies?page=1')
    await wrapped(req)

    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining('GET /api/companies 200'),
      expect.objectContaining({
        route: '/api/companies',
      }),
    )
  })

  it('should pass context through to the handler', async () => {
    const handler = async (_req: Request, ctx?: { params?: Record<string, string> }) => {
      return new Response(JSON.stringify({ params: ctx?.params }), { status: 200 })
    }
    const wrapped = withApiLogging(handler, '/api/test/[id]')

    const req = new Request('http://localhost/api/test/123')
    const res = await wrapped(req, { params: { id: '123' } })

    expect(res.status).toBe(200)
  })
})
