/**
 * Tests for request-context (Phase G)
 * Tests that AsyncLocalStorage properly propagates request context
 * through the async call chain.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { requestContextStorage, createRequestContext, withRequestContext, getRequestContext, getRequestDurationMs } = await import('@/lib/request-context')

describe('request-context', () => {
  // No need to manually reset AsyncLocalStorage — each test runs in isolation
  // as vitest uses separate execution contexts per test file

  it('should return undefined when no context is set', () => {
    expect(getRequestContext()).toBeUndefined()
  })

  it('should create a request context with defaults', () => {
    const ctx = createRequestContext()
    expect(ctx.correlationId).toBeDefined()
    expect(ctx.requestId).toBeDefined()
    expect(ctx.traceId).toBeDefined()
    expect(ctx.startTime).toBeGreaterThan(0)
  })

  it('should create a request context with partial overrides', () => {
    const ctx = createRequestContext({
      correlationId: 'my-corr-id',
      route: '/api/test',
    })
    expect(ctx.correlationId).toBe('my-corr-id')
    expect(ctx.route).toBe('/api/test')
    expect(ctx.requestId).toBeDefined() // Auto-generated
  })

  it('should propagate context via withRequestContext', async () => {
    const ctx = createRequestContext({ correlationId: 'test-123' })

    const result = await withRequestContext(ctx, async () => {
      const inner = getRequestContext()
      return inner
    })

    expect(result).toBeDefined()
    expect(result!.correlationId).toBe('test-123')
  })

  it('should propagate context through nested async calls', async () => {
    const ctx = createRequestContext({ correlationId: 'outer-456' })

    await withRequestContext(ctx, async () => {
      // First level
      expect(getRequestContext()!.correlationId).toBe('outer-456')

      // Nested async call
      await delay(0)
      expect(getRequestContext()!.correlationId).toBe('outer-456')

      // Deeply nested
      await deeplyNested()
    })
  })

  it('should not leak context between requests', async () => {
    const ctx1 = createRequestContext({ correlationId: 'req-1' })
    const ctx2 = createRequestContext({ correlationId: 'req-2' })

    const p1 = withRequestContext(ctx1, async () => {
      await delay(5)
      return getRequestContext()!.correlationId
    })

    const p2 = withRequestContext(ctx2, async () => {
      await delay(0)
      return getRequestContext()!.correlationId
    })

    const [r1, r2] = await Promise.all([p1, p2])
    expect(r1).toBe('req-1')
    expect(r2).toBe('req-2')
  })

  it('should calculate duration via getRequestDurationMs', async () => {
    const ctx = createRequestContext({ startTime: Date.now() - 100 })
    await withRequestContext(ctx, async () => {
      const duration = getRequestDurationMs()
      expect(duration).toBeGreaterThanOrEqual(90)
      expect(duration).toBeLessThan(500)
    })
  })

  it('should return 0 when no context is set for getRequestDurationMs', () => {
    expect(getRequestDurationMs()).toBe(0)
  })
})

async function deeplyNested() {
  await delay(0)
  expect(getRequestContext()!.correlationId).toBe('outer-456')

  await anotherLevel()
}

async function anotherLevel() {
  await delay(0)
  expect(getRequestContext()!.correlationId).toBe('outer-456')
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
