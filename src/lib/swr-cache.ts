/**
 * Stale-While-Revalidate cache.
 *
 * Strategy:
 *   1. Return cached data immediately (even if stale)
 *   2. Trigger async background revalidation
 *   3. Update cache with fresh data when available
 *   4. Optionally use Redis for cross-instance cache sharing
 *
 * TTL structure: staleTTL < maxTTL
 *   - Within staleTTL: data is fresh, return directly
 *   - Between staleTTL and maxTTL: data is stale, return + revalidate
 *   - Beyond maxTTL: data is expired, block until revalidated
 *
 * USAGE:
 *   const result = await swrGet({
 *     key: 'scoring-config',
 *     fetcher: () => getScoringConfig(),
 *     staleTtlMs: 60_000,    // Serve stale for up to 1 minute
 *     maxTtlMs: 300_000,     // Hard expire at 5 minutes
 *   });
 */

import { logger } from '@/lib/logger';

// ─── Types ────────────────────────────────────────────────────────────────

export interface SWRCacheOptions<T> {
  /** Unique cache key. */
  key: string;
  /** Async function that fetches fresh data. */
  fetcher: () => Promise<T>;
  /** Serve stale data up to this point after initial fetch. */
  staleTtlMs: number;
  /** Hard expiration — beyond this, block until revalidated. */
  maxTtlMs: number;
  /** Optional Redis backing TTL (cross-instance sharing). */
  redisTtlMs?: number;
}

export interface SWRResult<T> {
  data: T | null;
  stale: boolean;
  revalidated: boolean;
  age: number;
}

interface CacheEntry<T> {
  data: T;
  cachedAt: number;
  revalidating: boolean;
}

// ─── In-Memory Store ──────────────────────────────────────────────────────

const store = new Map<string, CacheEntry<unknown>>();
const REVALIDATION_DEDUP = new Map<string, Promise<unknown>>();
const MAX_STORE_SIZE = 500;

// ─── Redis helpers (lazy) ────────────────────────────────────────────────

const REDIS_PREFIX = 'dmq:swr:';

async function redisGet<T>(key: string): Promise<T | null> {
  try {
    const { getRedisClient } = await import('@/lib/redis-client');
    const client = await getRedisClient();
    if (!client) return null;
    const raw = await client.get(`${REDIS_PREFIX}${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function redisSet<T>(key: string, data: T, ttlMs: number): Promise<void> {
  try {
    const { getRedisClient } = await import('@/lib/redis-client');
    const client = await getRedisClient();
    if (!client) return;
    await client.set(`${REDIS_PREFIX}${key}`, JSON.stringify(data), ttlMs);
  } catch {
    // Non-fatal
  }
}

/**
 * Helper to get fresh data, with deduplication of concurrent fetches.
 */
async function revalidate<T>(options: SWRCacheOptions<T>): Promise<T> {
  const { key, fetcher } = options;

  // Deduplicate: if a revalidation is already in-flight, reuse its promise
  const existing = REVALIDATION_DEDUP.get(key);
  if (existing) return existing as Promise<T>;

  const fetchPromise = (async () => {
    try {
      const freshData = await fetcher();

      // Update in-memory store
      store.set(key, {
        data: freshData,
        cachedAt: Date.now(),
        revalidating: false,
      });

      // Update Redis if configured
      const redisTtl = options.redisTtlMs || options.maxTtlMs;
      await redisSet(key, freshData, redisTtl);

      return freshData;
    } catch (err) {
      logger.warn(`[swr-cache] Revalidation failed for "${key}"`, {
        error: err instanceof Error ? err.message : String(err),
      });
      throw err;
    } finally {
      REVALIDATION_DEDUP.delete(key);
    }
  })();

  REVALIDATION_DEDUP.set(key, fetchPromise);
  return fetchPromise;
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Get data using stale-while-revalidate strategy.
 *
 * @returns Cached data (possibly stale) immediately, with background revalidation.
 */
export async function swrGet<T>(options: SWRCacheOptions<T>): Promise<SWRResult<T>> {
  const { key, staleTtlMs, maxTtlMs } = options;
  const now = Date.now();

  // ── Check in-memory cache ──
  const entry = store.get(key) as CacheEntry<T> | undefined;

  if (entry) {
    const age = now - entry.cachedAt;

    if (age < staleTtlMs) {
      // Fresh — return directly, no revalidation needed
      return { data: entry.data, stale: false, revalidated: false, age };
    }

    if (age < maxTtlMs) {
      // Stale but within max TTL — return stale data, trigger background revalidation
      if (!entry.revalidating) {
        (store.get(key) as CacheEntry<T>).revalidating = true;
        revalidate(options).catch(() => {
          // Background revalidation failed — stale data remains in cache
          const e = store.get(key);
          if (e) e.revalidating = false;
        });
      }
      return { data: entry.data, stale: true, revalidated: false, age };
    }

    // Beyond max TTL — must revalidate and block
    try {
      const freshData = await revalidate(options);
      return { data: freshData, stale: false, revalidated: true, age: 0 };
    } catch {
      // Revalidation failed — return stale data as last resort
      return { data: entry.data, stale: true, revalidated: false, age };
    }
  }

  // ── Check Redis cache ──
  const redisData = await redisGet<T>(key);
  if (redisData) {
    // Populate in-memory store from Redis
    store.set(key, {
      data: redisData,
      cachedAt: now, // Treat as just-fetched since we don't track Redis timestamps
      revalidating: false,
    });

    // Evict oldest if over max size
    if (store.size > MAX_STORE_SIZE) {
      let oldestKey = '';
      let oldestTime = Infinity;
      store.forEach((e, k) => {
        if (e.cachedAt < oldestTime) {
          oldestTime = e.cachedAt;
          oldestKey = k;
        }
      });
      if (oldestKey) store.delete(oldestKey);
    }

    // Trigger background revalidation (Redis data might be from another instance)
    revalidate(options).catch(() => {});

    return { data: redisData, stale: true, revalidated: false, age: 0 };
  }

  // ── Cold cache — must fetch and block ──
  try {
    const freshData = await revalidate(options);
    return { data: freshData, stale: false, revalidated: true, age: 0 };
  } catch (err) {
    logger.error(`[swr-cache] Initial fetch failed for "${key}"`, {
      error: err instanceof Error ? err.message : String(err),
    });
    return { data: null, stale: false, revalidated: false, age: 0 };
  }
}

/**
 * Invalidate a specific SWR cache entry.
 * Removes from both in-memory store and Redis.
 */
export function swrInvalidate(key: string): void {
  store.delete(key);
  REVALIDATION_DEDUP.delete(key);

  // Fire-and-forget Redis deletion
  (async () => {
    try {
      const { getRedisClient } = await import('@/lib/redis-client');
      const client = await getRedisClient();
      if (client) {
        await client.del(`${REDIS_PREFIX}${key}`);
      }
    } catch {
      // Non-fatal
    }
  })();
}

/**
 * Prefetch data into the SWR cache (non-blocking).
 * Useful for cache warming during cold start.
 */
export async function swrPrefetch<T>(options: SWRCacheOptions<T>): Promise<void> {
  const { key } = options;

  // Skip if already cached and fresh
  const entry = store.get(key);
  if (entry && Date.now() - entry.cachedAt < options.staleTtlMs) {
    return;
  }

  try {
    await revalidate(options);
    logger.debug(`[swr-cache] Prefetched "${key}"`);
  } catch (err) {
    logger.warn(`[swr-cache] Prefetch failed for "${key}"`, {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Get cache statistics for monitoring.
 */
export function getSWRCacheStats(): { size: number; revalidating: number } {
  let revalidating = 0;
  store.forEach((entry) => {
    if (entry.revalidating) revalidating++;
  });
  return { size: store.size, revalidating };
}

// Cleanup stale entries periodically
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    store.forEach((entry, key) => {
      // We don't know the maxTtlMs here, so we use a generous 10-minute cleanup window
      if (now - entry.cachedAt > 600_000) {
        store.delete(key);
      }
    });
  }, 60_000).unref?.();
}
