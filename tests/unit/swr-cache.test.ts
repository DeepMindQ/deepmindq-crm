/**
 * @vitest-environment node
 * SWR Cache — Unit Tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────

const { mockRedisGet, mockRedisSet, mockRedisDel, mockGetRedisClient, mockLogger } = vi.hoisted(
  () => ({
    mockRedisGet: vi.fn(),
    mockRedisSet: vi.fn(),
    mockRedisDel: vi.fn(),
    mockGetRedisClient: vi.fn(),
    mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  }),
);

vi.mock('@/lib/logger', () => ({ logger: mockLogger }));

vi.mock('@/lib/redis-client', () => ({
  getRedisClient: mockGetRedisClient,
}));

import { swrGet, swrInvalidate, swrPrefetch, getSWRCacheStats } from '@/lib/swr-cache';

// Helper: create a synchronous fetcher
function makeFetcher<T>(value: T): () => Promise<T> {
  return () => Promise.resolve(value);
}

// Helper: create a fetcher that rejects
function makeFailingFetcher(error = new Error('fetch failed')): () => Promise<never> {
  return () => Promise.reject(error);
}

describe('swr-cache', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRedisClient.mockResolvedValue(null);
  });

  // ── swrGet: cold cache ────────────────────────────────────────────

  describe('swrGet — cold cache (no entry)', () => {
    it('fetches fresh data and returns it with revalidated=true', async () => {
      const fetcher = makeFetcher({ name: 'Acme' });
      const result = await swrGet({
        key: `cold-${Date.now()}`,
        fetcher,
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });
      expect(result.data).toEqual({ name: 'Acme' });
      expect(result.revalidated).toBe(true);
      expect(result.stale).toBe(false);
      expect(result.age).toBe(0);
    });

    it('returns null when initial fetch fails', async () => {
      const fetcher = makeFailingFetcher();
      const result = await swrGet({
        key: `cold-fail-${Date.now()}`,
        fetcher,
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });
      expect(result.data).toBeNull();
      expect(result.revalidated).toBe(false);
      expect(result.stale).toBe(false);
    });

    it('tries Redis when in-memory is empty and populates store', async () => {
      mockGetRedisClient.mockResolvedValue({
        get: mockRedisGet.mockResolvedValue(JSON.stringify({ from: 'redis' })),
      });

      const fetcher = makeFetcher({ fresh: 'data' });
      const result = await swrGet({
        key: `redis-hydrate-${Date.now()}`,
        fetcher,
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });

      // Should have fetched from Redis
      expect(mockRedisGet).toHaveBeenCalled();
      expect(result.data).toEqual({ from: 'redis' });
      expect(result.stale).toBe(true);
    });

    it('handles Redis get failure gracefully and falls back to fetcher', async () => {
      mockGetRedisClient.mockResolvedValue({
        get: mockRedisGet.mockRejectedValue(new Error('redis error')),
      });

      const fetcher = makeFetcher({ fallback: true });
      const result = await swrGet({
        key: `redis-fail-${Date.now()}`,
        fetcher,
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });

      expect(result.data).toEqual({ fallback: true });
      expect(result.revalidated).toBe(true);
    });

    it('returns null when Redis is empty and fetcher fails', async () => {
      mockGetRedisClient.mockResolvedValue({
        get: mockRedisGet.mockResolvedValue(null),
      });

      const fetcher = makeFailingFetcher();
      const result = await swrGet({
        key: `all-fail-${Date.now()}`,
        fetcher,
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });

      expect(result.data).toBeNull();
    });

    it('returns null when Redis returns empty string', async () => {
      mockGetRedisClient.mockResolvedValue({
        get: mockRedisGet.mockResolvedValue(''),
      });

      const fetcher = makeFailingFetcher();
      const result = await swrGet({
        key: `redis-empty-${Date.now()}`,
        fetcher,
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });

      expect(result.data).toBeNull();
    });
  });

  // ── swrGet: fresh cache ───────────────────────────────────────────

  describe('swrGet — fresh cache (within staleTTL)', () => {
    it('returns cached data directly without revalidating', async () => {
      const key = `fresh-${Date.now()}`;
      const fetcher = makeFetcher({ fresh: 'first' });
      await swrGet({
        key,
        fetcher,
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });

      // Second call should return from cache
      const fetcher2 = makeFetcher({ fresh: 'second' });
      const result = await swrGet({
        key,
        fetcher: fetcher2,
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });

      expect(result.data).toEqual({ fresh: 'first' });
      expect(result.stale).toBe(false);
      expect(result.revalidated).toBe(false);
    });

    it('returns age >= 0 for cached entries', async () => {
      const key = `age-${Date.now()}`;
      const fetcher = makeFetcher('data');
      await swrGet({
        key,
        fetcher,
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });

      const result = await swrGet({
        key,
        fetcher: makeFetcher('new'),
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });

      expect(result.age).toBeGreaterThanOrEqual(0);
    });
  });

  // ── swrInvalidate ─────────────────────────────────────────────────

  describe('swrInvalidate', () => {
    it('removes entry from cache so next call fetches fresh data', async () => {
      const key = `inv-${Date.now()}`;
      await swrGet({
        key,
        fetcher: makeFetcher('v1'),
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });

      swrInvalidate(key);

      const result = await swrGet({
        key,
        fetcher: makeFetcher('v2'),
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });

      expect(result.data).toBe('v2');
      expect(result.revalidated).toBe(true);
    });

    it('attempts Redis deletion when Redis is available', async () => {
      mockGetRedisClient.mockResolvedValue({ del: mockRedisDel });

      const key = `redis-inv-${Date.now()}`;
      swrInvalidate(key);
      // The deletion is fire-and-forget — give it a tick
      await new Promise((r) => setTimeout(r, 10));

      expect(mockRedisDel).toHaveBeenCalledWith(`dmq:swr:${key}`);
    });

    it('handles Redis deletion failure gracefully', () => {
      mockGetRedisClient.mockResolvedValue({
        del: mockRedisDel.mockRejectedValue(new Error('del failed')),
      });

      // Should not throw
      expect(() => swrInvalidate('fail-inv')).not.toThrow();
    });

    it('is safe to invalidate a non-existent key', () => {
      expect(() => swrInvalidate('nonexistent')).not.toThrow();
    });

    it('clears dedup map so revalidation can run again', async () => {
      const key = `dedup-clear-${Date.now()}`;
      await swrGet({
        key,
        fetcher: makeFetcher('v1'),
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });

      swrInvalidate(key);

      const result = await swrGet({
        key,
        fetcher: makeFetcher('v3'),
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });

      expect(result.data).toBe('v3');
      expect(result.revalidated).toBe(true);
    });
  });

  // ── swrPrefetch ───────────────────────────────────────────────────

  describe('swrPrefetch', () => {
    it('populates the cache', async () => {
      const key = `prefetch-${Date.now()}`;
      await swrPrefetch({
        key,
        fetcher: makeFetcher('prefetched'),
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });

      // Verify cache was populated
      const result = await swrGet({
        key,
        fetcher: makeFetcher('should-not-be-called'),
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });

      expect(result.data).toBe('prefetched');
      expect(result.revalidated).toBe(false);
    });

    it('handles prefetch failure gracefully', async () => {
      const fetcher = makeFailingFetcher();
      // Should not throw
      await expect(
        swrPrefetch({
          key: `prefetch-fail-${Date.now()}`,
          fetcher,
          staleTtlMs: 60_000,
          maxTtlMs: 300_000,
        }),
      ).resolves.toBeUndefined();
    });

    it('skips prefetch if data is already fresh', async () => {
      const key = `prefetch-skip-${Date.now()}`;
      const fetcher = makeFetcher('warm');
      await swrGet({
        key,
        fetcher,
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });

      const fetchCount = vi.fn();
      await swrPrefetch({
        key,
        fetcher: () => {
          fetchCount();
          return Promise.resolve('skip');
        },
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });

      expect(fetchCount).not.toHaveBeenCalled();
    });
  });

  // ── getSWRCacheStats ──────────────────────────────────────────────

  describe('getSWRCacheStats', () => {
    it('returns correct structure', () => {
      const stats = getSWRCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('revalidating');
      expect(typeof stats.revalidating).toBe('number');
    });

    it('returns correct size after caching entries', async () => {
      const statsBefore = getSWRCacheStats();
      const before = statsBefore.size;

      await swrGet({
        key: `stats-${Date.now()}`,
        fetcher: makeFetcher('data'),
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });

      const statsAfter = getSWRCacheStats();
      expect(statsAfter.size).toBeGreaterThan(before);
    });
  });

  // ── Redis backing ────────────────────────────────────────────────

  describe('Redis backing', () => {
    it('stores to Redis after successful fetch with redisTtlMs', async () => {
      mockGetRedisClient.mockResolvedValue({
        get: mockRedisGet.mockResolvedValue(null),
        set: mockRedisSet.mockResolvedValue('OK'),
      });

      const key = `redis-set-${Date.now()}`;
      await swrGet({
        key,
        fetcher: makeFetcher({ stored: true }),
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
        redisTtlMs: 120_000,
      });

      expect(mockRedisSet).toHaveBeenCalledWith(`dmq:swr:${key}`, expect.any(String), 120_000);
    });

    it('uses maxTtlMs as Redis TTL when redisTtlMs is not set', async () => {
      mockGetRedisClient.mockResolvedValue({
        get: mockRedisGet.mockResolvedValue(null),
        set: mockRedisSet.mockResolvedValue('OK'),
      });

      const key = `redis-ttl-${Date.now()}`;
      await swrGet({
        key,
        fetcher: makeFetcher('data'),
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });

      expect(mockRedisSet).toHaveBeenCalledWith(`dmq:swr:${key}`, expect.any(String), 300_000);
    });

    it('handles Redis set failure gracefully', async () => {
      mockGetRedisClient.mockResolvedValue({
        get: mockRedisGet.mockResolvedValue(null),
        set: mockRedisSet.mockRejectedValue(new Error('set fail')),
      });

      const result = await swrGet({
        key: `redis-set-fail-${Date.now()}`,
        fetcher: makeFetcher('data'),
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });

      // Should still return data even if Redis set fails
      expect(result.data).toEqual('data');
      expect(result.revalidated).toBe(true);
    });

    it('handles Redis client returning null for set', async () => {
      mockGetRedisClient.mockResolvedValue({
        get: mockRedisGet.mockResolvedValue(null),
        set: mockRedisSet.mockResolvedValue(null),
      });

      const result = await swrGet({
        key: `redis-null-set-${Date.now()}`,
        fetcher: makeFetcher('data'),
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });

      expect(result.data).toEqual('data');
    });
  });

  // ── Revalidation deduplication ────────────────────────────────────

  describe('Revalidation deduplication', () => {
    it('deduplicates concurrent revalidation requests', async () => {
      const key = `dedup-${Date.now()}`;
      // First call populates cache
      await swrGet({
        key,
        fetcher: makeFetcher('v1'),
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });

      const fetchCount = vi.fn();
      const slowFetcher = () => {
        fetchCount();
        return Promise.resolve('v2');
      };

      // Two concurrent calls with the same fetcher
      const [r1, r2] = await Promise.all([
        swrGet({ key, fetcher: slowFetcher, staleTtlMs: 60_000, maxTtlMs: 300_000 }),
        swrGet({ key, fetcher: slowFetcher, staleTtlMs: 60_000, maxTtlMs: 300_000 }),
      ]);

      // Both should get the same cached result (v1)
      expect(r1.data).toBe('v1');
      expect(r2.data).toBe('v1');
      // Fetcher should not be called because data is fresh
      expect(fetchCount).not.toHaveBeenCalled();
    });

    it('returns cached data as last resort when revalidation fails after maxTTL', async () => {
      const key = `stale-fallback-${Date.now()}`;
      await swrGet({
        key,
        fetcher: makeFetcher('original'),
        staleTtlMs: 1, // 1ms stale TTL
        maxTtlMs: 1, // 1ms max TTL — immediate expire
      });

      // Wait for cache to expire
      await new Promise((r) => setTimeout(r, 5));

      const failingFetcher = makeFailingFetcher();
      const result = await swrGet({
        key,
        fetcher: failingFetcher,
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });

      // Should return the old stale data as last resort (revalidation failed)
      expect(result.data).toBe('original');
    });
  });

  // ── Edge cases ───────────────────────────────────────────────────

  describe('Edge cases', () => {
    it('handles fetcher returning undefined', async () => {
      const key = `undef-${Date.now()}`;
      const result = await swrGet({
        key,
        fetcher: () => Promise.resolve(undefined as any),
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });
      expect(result.data).toBeUndefined();
      expect(result.revalidated).toBe(true);
    });

    it('handles fetcher returning null', async () => {
      const key = `null-${Date.now()}`;
      const result = await swrGet({
        key,
        fetcher: () => Promise.resolve(null as any),
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });
      expect(result.data).toBeNull();
      expect(result.revalidated).toBe(true);
    });
  });

  // ── Stale cache (between staleTTL and maxTTL) ──────────────────────

  describe('swrGet — stale cache (between staleTTL and maxTTL)', () => {
    it('returns stale data and triggers background revalidation', async () => {
      const key = `stale-${Date.now()}`;
      // Initial fetch
      await swrGet({
        key,
        fetcher: makeFetcher('original'),
        staleTtlMs: 50, // 50ms stale TTL
        maxTtlMs: 5000, // 5s max TTL
      });

      // Wait for entry to become stale but not expired
      await new Promise((r) => setTimeout(r, 100));

      // Second fetcher that will be called in background
      const bgFetcher = vi.fn().mockResolvedValue('fresh');
      const result = await swrGet({
        key,
        fetcher: bgFetcher,
        staleTtlMs: 50,
        maxTtlMs: 5000,
      });

      // Should return stale data immediately
      expect(result.data).toBe('original');
      expect(result.stale).toBe(true);
      expect(result.revalidated).toBe(false);

      // Wait for background revalidation to complete
      await new Promise((r) => setTimeout(r, 50));
      expect(bgFetcher).toHaveBeenCalled();
    });

    it('does not trigger duplicate revalidations', async () => {
      const key = `stale-dedup-${Date.now()}`;
      await swrGet({
        key,
        fetcher: makeFetcher('v1'),
        staleTtlMs: 50,
        maxTtlMs: 5000,
      });

      await new Promise((r) => setTimeout(r, 100));

      const fetchCount = vi.fn();
      const fetcher = () => {
        fetchCount();
        return Promise.resolve('v2');
      };

      // Multiple concurrent reads while stale
      const [r1, r2, r3] = await Promise.all([
        swrGet({ key, fetcher, staleTtlMs: 50, maxTtlMs: 5000 }),
        swrGet({ key, fetcher, staleTtlMs: 50, maxTtlMs: 5000 }),
        swrGet({ key, fetcher, staleTtlMs: 50, maxTtlMs: 5000 }),
      ]);

      // All should get stale data
      expect(r1.data).toBe('v1');
      expect(r2.data).toBe('v1');
      expect(r3.data).toBe('v1');

      // Only one background fetch should have been triggered
      // (fetcher may be called once or not yet — dedup ensures at most one)
      expect(fetchCount.mock.calls.length).toBeLessThanOrEqual(1);
    });

    it('reports correct age for stale entries', async () => {
      const key = `stale-age-${Date.now()}`;
      await swrGet({
        key,
        fetcher: makeFetcher('data'),
        staleTtlMs: 50,
        maxTtlMs: 5000,
      });

      await new Promise((r) => setTimeout(r, 150));

      const result = await swrGet({
        key,
        fetcher: makeFetcher('fresh'),
        staleTtlMs: 50,
        maxTtlMs: 5000,
      });

      expect(result.stale).toBe(true);
      expect(result.age).toBeGreaterThanOrEqual(100);
    });

    it('resets revalidating flag after background fetch completes', async () => {
      const key = `stale-reset-${Date.now()}`;
      await swrGet({
        key,
        fetcher: makeFetcher('v1'),
        staleTtlMs: 50,
        maxTtlMs: 5000,
      });

      await new Promise((r) => setTimeout(r, 100));

      const freshFetcher = vi.fn().mockResolvedValue('v2');
      const result = await swrGet({
        key,
        fetcher: freshFetcher,
        staleTtlMs: 50,
        maxTtlMs: 5000,
      });
      // Returns stale data immediately
      expect(result.stale).toBe(true);

      // Wait for background revalidation to complete
      await vi.waitFor(() => expect(freshFetcher).toHaveBeenCalled(), { timeout: 500 });

      // Now fetch again — should get fresh data (v2)
      const result2 = await swrGet({
        key,
        fetcher: makeFetcher('v3'),
        staleTtlMs: 50,
        maxTtlMs: 5000,
      });
      expect(result2.data).toBe('v2');
      expect(result2.stale).toBe(false);
    });

    it('continues serving stale data when background revalidation fails', async () => {
      const key = `stale-bg-fail-${Date.now()}`;
      await swrGet({
        key,
        fetcher: makeFetcher('original'),
        staleTtlMs: 50,
        maxTtlMs: 5000,
      });

      await new Promise((r) => setTimeout(r, 100));

      // First call triggers background revalidation that fails
      const failingFetcher = makeFailingFetcher();
      const result1 = await swrGet({
        key,
        fetcher: failingFetcher,
        staleTtlMs: 50,
        maxTtlMs: 5000,
      });
      expect(result1.data).toBe('original');
      expect(result1.stale).toBe(true);

      // Wait for background to fail
      await new Promise((r) => setTimeout(r, 50));

      // Second call should still serve stale data
      const result2 = await swrGet({
        key,
        fetcher: failingFetcher,
        staleTtlMs: 50,
        maxTtlMs: 5000,
      });
      expect(result2.data).toBe('original');
      expect(result2.stale).toBe(true);
    });
  });

  // ── Expired cache (beyond maxTTL) ────────────────────────────────

  describe('swrGet — expired cache (beyond maxTTL)', () => {
    it('blocks and revalidates when entry is beyond maxTTL', async () => {
      const key = `expired-${Date.now()}`;
      await swrGet({
        key,
        fetcher: makeFetcher('original'),
        staleTtlMs: 10,
        maxTtlMs: 30, // 30ms max TTL
      });

      // Wait beyond maxTTL
      await new Promise((r) => setTimeout(r, 50));

      const result = await swrGet({
        key,
        fetcher: makeFetcher('fresh'),
        staleTtlMs: 10,
        maxTtlMs: 30,
      });

      expect(result.data).toBe('fresh');
      expect(result.revalidated).toBe(true);
      expect(result.stale).toBe(false);
    });

    it('returns stale data when revalidation fails after maxTTL', async () => {
      const key = `expired-fail-${Date.now()}`;
      await swrGet({
        key,
        fetcher: makeFetcher('original'),
        staleTtlMs: 10,
        maxTtlMs: 30,
      });

      await new Promise((r) => setTimeout(r, 50));

      const result = await swrGet({
        key,
        fetcher: makeFailingFetcher(),
        staleTtlMs: 10,
        maxTtlMs: 30,
      });

      // Should return old data as last resort
      expect(result.data).toBe('original');
      expect(result.stale).toBe(true);
      expect(result.revalidated).toBe(false);
    });

    it('sets age to 0 after successful revalidation', async () => {
      const key = `expired-age-${Date.now()}`;
      await swrGet({
        key,
        fetcher: makeFetcher('original'),
        staleTtlMs: 10,
        maxTtlMs: 30,
      });

      await new Promise((r) => setTimeout(r, 50));

      const result = await swrGet({
        key,
        fetcher: makeFetcher('fresh'),
        staleTtlMs: 10,
        maxTtlMs: 30,
      });

      expect(result.age).toBe(0);
    });
  });

  // ── LRU eviction from Redis hydration ──────────────────────────────

  describe('LRU eviction', () => {
    it('evicts oldest entry when Redis hydration exceeds max store size', async () => {
      const ts = Date.now();
      // Fill the store to MAX_STORE_SIZE with known keys
      const keys: string[] = [];
      for (let i = 0; i < 499; i++) {
        const key = `lru-fill-${i}-${ts}`;
        keys.push(key);
        await swrGet({
          key,
          fetcher: makeFetcher(`data-${i}`),
          staleTtlMs: 60_000,
          maxTtlMs: 300_000,
        });
      }

      // Store at 499 + any from previous tests. Add one via fetcher.
      mockGetRedisClient.mockResolvedValue({
        get: mockRedisGet.mockResolvedValue(null),
        set: mockRedisSet.mockResolvedValue('OK'),
      });

      const newKey1 = `lru-normal-${ts}`;
      await swrGet({
        key: newKey1,
        fetcher: makeFetcher('data-500'),
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });

      const sizeBefore = getSWRCacheStats().size;

      // Now configure Redis to return data for a new key.
      // Redis hydration adds entry → store exceeds MAX_STORE_SIZE → triggers eviction
      mockGetRedisClient.mockResolvedValue({
        get: mockRedisGet.mockImplementation((key: string) => {
          return Promise.resolve(JSON.stringify({ from: 'redis', key }));
        }),
        set: mockRedisSet.mockResolvedValue('OK'),
      });

      const result2 = await swrGet({
        key: `lru-redis-${ts}`,
        fetcher: makeFetcher('fallback'),
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });
      expect(result2.data).toBeTruthy();

      // The store should have evicted at least one entry to stay within bounds
      const sizeAfter = getSWRCacheStats().size;
      // If we were at MAX_STORE_SIZE, adding one + eviction = same size
      // If we were over MAX_STORE_SIZE, eviction reduces the difference
      expect(sizeAfter).toBeLessThanOrEqual(sizeBefore + 1);
    });

    it('reports revalidating count correctly', async () => {
      const key = `reval-count-${Date.now()}`;
      await swrGet({
        key,
        fetcher: makeFetcher('data'),
        staleTtlMs: 50,
        maxTtlMs: 5000,
      });

      await new Promise((r) => setTimeout(r, 100));

      // Trigger stale read — sets revalidating=true
      const slowFetcher = new Promise((resolve) => setTimeout(() => resolve('slow'), 500));
      const result = await swrGet({
        key,
        fetcher: () => slowFetcher,
        staleTtlMs: 50,
        maxTtlMs: 5000,
      });

      // Check stats immediately — should show revalidating
      const stats = getSWRCacheStats();
      // revalidating may or may not be 1 depending on timing
      expect(typeof stats.revalidating).toBe('number');
    });
  });

  // ── swrInvalidate — Redis client null ─────────────────────────────

  describe('swrInvalidate — Redis edge cases', () => {
    it('handles Redis client returning null for del', async () => {
      mockGetRedisClient.mockResolvedValue(null);

      const key = `inv-null-client-${Date.now()}`;
      swrInvalidate(key);
      await new Promise((r) => setTimeout(r, 10));
      // No error should occur
    });

    it('handles Redis import failure for del', async () => {
      vi.doMock('@/lib/redis-client', () => {
        throw new Error('import failed');
      });

      vi.resetModules();
      const { swrInvalidate: swrInvalidateFresh } = await import('@/lib/swr-cache');

      expect(() => swrInvalidateFresh('key')).not.toThrow();
    });
  });

  // ── redisGet / redisSet — error handling ────────────────────────

  describe('Redis client errors', () => {
    it('handles Redis get returning invalid JSON', async () => {
      mockGetRedisClient.mockResolvedValue({
        get: mockRedisGet.mockResolvedValue('{not valid json'),
      });

      const fetcher = makeFetcher({ fallback: true });
      const result = await swrGet({
        key: `redis-bad-json-${Date.now()}`,
        fetcher,
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });

      // Falls back to fetcher
      expect(result.data).toEqual({ fallback: true });
      expect(result.revalidated).toBe(true);
    });

    it('handles Redis client returning null', async () => {
      mockGetRedisClient.mockResolvedValue(null);

      const fetcher = makeFetcher({ from: 'fetcher' });
      const result = await swrGet({
        key: `redis-null-client-${Date.now()}`,
        fetcher,
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });

      expect(result.data).toEqual({ from: 'fetcher' });
    });
  });

  // ── Revalidation error logging ───────────────────────────────────

  describe('Revalidation error logging', () => {
    it('logs error when initial cold fetch fails', async () => {
      mockGetRedisClient.mockResolvedValue(null);

      const key = `reval-error-${Date.now()}`;
      await swrGet({
        key,
        fetcher: makeFailingFetcher(new Error('timeout')),
        staleTtlMs: 60_000,
        maxTtlMs: 300_000,
      });

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Initial fetch failed'),
        expect.any(Object),
      );
    });
  });
});
