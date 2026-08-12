/**
 * Tests for SWR Cache (Phase F)
 * Tests stale-while-revalidate behavior with:
 * - Fresh data returned directly
 * - Stale data served with background revalidation
 * - Expired data blocks until revalidated
 * - Cache invalidation
 * - Redis fallback
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock Redis client
vi.mock('@/lib/redis-client', () => ({
  getRedisClient: vi.fn().mockResolvedValue(null),
  getClientType: vi.fn().mockReturnValue('none'),
}))

const { swrGet, swrInvalidate, swrPrefetch, getSWRCacheStats } = await import('@/lib/swr-cache')

describe('swr-cache', () => {
  let fetchCallCount: number

  beforeEach(() => {
    fetchCallCount = 0
    // Clear cache between tests
    swrInvalidate('test:key')
    swrInvalidate('test:slow')
    swrInvalidate('test:failing')
  })

  it('should fetch and cache data on cold cache', async () => {
    const fetcher = vi.fn().mockResolvedValue({ items: [1, 2, 3] })

    const result = await swrGet({
      key: 'test:key',
      fetcher,
      staleTtlMs: 60_000,
      maxTtlMs: 300_000,
    })

    expect(result.data).toEqual({ items: [1, 2, 3] })
    expect(result.stale).toBe(false)
    expect(result.revalidated).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })

  it('should return fresh cached data without re-fetching', async () => {
    const fetcher = vi.fn().mockResolvedValue({ value: 'hello' })

    // First call — populates cache
    await swrGet({ key: 'test:key', fetcher, staleTtlMs: 60_000, maxTtlMs: 300_000 })

    // Second call — should use cache
    const result = await swrGet({ key: 'test:key', fetcher, staleTtlMs: 60_000, maxTtlMs: 300_000 })

    expect(result.data).toEqual({ value: 'hello' })
    expect(result.stale).toBe(false)
    expect(result.revalidated).toBe(false)
    expect(fetcher).toHaveBeenCalledTimes(1) // Only called once
  })

  it('should serve stale data and trigger background revalidation', async () => {
    // Use very short TTLs for testing
    const fetcher = vi.fn().mockResolvedValue({ version: 1 })

    // Populate cache
    await swrGet({ key: 'test:key', fetcher, staleTtlMs: 1, maxTtlMs: 100_000 })

    // Wait for stale threshold
    await new Promise(r => setTimeout(r, 5))

    // Should get stale data with background revalidation
    const result = await swrGet({ key: 'test:key', fetcher, staleTtlMs: 1, maxTtlMs: 100_000 })

    expect(result.data).toEqual({ version: 1 })
    expect(result.stale).toBe(true)
    expect(result.revalidated).toBe(false)
  })

  it('should return null when fetcher fails on cold cache', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('Network error'))

    const result = await swrGet({
      key: 'test:failing',
      fetcher,
      staleTtlMs: 60_000,
      maxTtlMs: 300_000,
    })

    expect(result.data).toBeNull()
    expect(result.stale).toBe(false)
  })

  it('should invalidate cache entry', async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: 'cached' })

    // Populate cache
    await swrGet({ key: 'test:key', fetcher, staleTtlMs: 60_000, maxTtlMs: 300_000 })

    // Invalidate
    swrInvalidate('test:key')

    // Should re-fetch
    const result = await swrGet({ key: 'test:key', fetcher, staleTtlMs: 60_000, maxTtlMs: 300_000 })
    expect(result.revalidated).toBe(true)
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('should report cache stats', () => {
    const stats = getSWRCacheStats()
    expect(stats).toHaveProperty('size')
    expect(stats).toHaveProperty('revalidating')
    expect(typeof stats.size).toBe('number')
  })

  it('should prefetch data into cache', async () => {
    const fetcher = vi.fn().mockResolvedValue({ prefetched: true })

    await swrPrefetch({
      key: 'test:key',
      fetcher,
      staleTtlMs: 60_000,
      maxTtlMs: 300_000,
    })

    expect(fetcher).toHaveBeenCalledTimes(1)

    // Should be in cache now — fetcher should NOT be called again
    const result = await swrGet({ key: 'test:key', fetcher, staleTtlMs: 60_000, maxTtlMs: 300_000 })
    expect(result.data).toEqual({ prefetched: true })
    expect(fetcher).toHaveBeenCalledTimes(1) // Not called again
  })

  it('should skip prefetch if already cached and fresh', async () => {
    const fetcher = vi.fn().mockResolvedValue({ fresh: true })

    // Populate
    await swrGet({ key: 'test:key', fetcher, staleTtlMs: 60_000, maxTtlMs: 300_000 })

    // Prefetch should skip
    await swrPrefetch({ key: 'test:key', fetcher, staleTtlMs: 60_000, maxTtlMs: 300_000 })

    expect(fetcher).toHaveBeenCalledTimes(1) // Only the initial call
  })

  it('should deduplicate concurrent revalidations', async () => {
    const fetcher = vi.fn().mockImplementation(() => {
      return new Promise(r => setTimeout(() => r({ data: 'deduped' }), 10))
    })

    // Start multiple concurrent gets
    const p1 = swrGet({ key: 'test:key', fetcher, staleTtlMs: 60_000, maxTtlMs: 300_000 })
    const p2 = swrGet({ key: 'test:key', fetcher, staleTtlMs: 60_000, maxTtlMs: 300_000 })
    const p3 = swrGet({ key: 'test:key', fetcher, staleTtlMs: 60_000, maxTtlMs: 300_000 })

    const [r1, r2, r3] = await Promise.all([p1, p2, p3])

    // All should get the same data
    expect(r1.data).toEqual({ data: 'deduped' })
    expect(r2.data).toEqual({ data: 'deduped' })
    expect(r3.data).toEqual({ data: 'deduped' })

    // Fetcher should only be called once (deduplication)
    expect(fetcher).toHaveBeenCalledTimes(1)
  })
})
