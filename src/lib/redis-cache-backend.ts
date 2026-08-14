/**
 * Redis Cache Backend — Persistent cache backed by Redis.
 *
 * Provides a Redis-backed alternative to the in-memory LRU cache in
 * ai-cache-layer.ts. When Redis is available, cache entries survive
 * server restarts and can be shared across instances.
 *
 * Features:
 *   - Transparent fallback to in-memory when Redis is unavailable
 *   - JSON serialization of cache entries
 *   - TTL support via Redis PX (millisecond expiry)
 *   - Key namespacing to avoid collisions with other Redis keys
 *   - Cache stats (hits, misses) tracked locally
 *
 * Integration:
 *   The ai-cache-layer.ts and intelligence-cache.ts modules
 *   auto-detect Redis and use this backend when available.
 */

import { getRedisClient, getClientType } from '@/lib/redis-client';
import { logger } from '@/lib/logger';

// ─── Configuration ─────────────────────────────────────────────────────

const KEY_PREFIX = 'dmq:cache:';
const INTELLIGENCE_KEY_PREFIX = 'dmq:intel:';

// ─── Types ──────────────────────────────────────────────────────────────

interface CacheEntry<T = unknown> {
  data: T;
  createdAt: number;
}

// ─── Stats ─────────────────────────────────────────────────────────────

let redisHits = 0;
let redisMisses = 0;

// ─── Redis Availability ────────────────────────────────────────────────

let _redisAvailable: boolean | null = null;

export async function isRedisAvailable(): Promise<boolean> {
  if (_redisAvailable !== null) return _redisAvailable;

  try {
    const client = await getRedisClient();
    if (client) {
      await client.ping();
      _redisAvailable = true;
      logger.info(`[REDIS-CACHE] Connected via ${getClientType()}`);
    } else {
      _redisAvailable = false;
      logger.info('[REDIS-CACHE] No Redis configured — using in-memory fallback');
    }
  } catch {
    _redisAvailable = false;
  }

  return _redisAvailable;
}

/**
 * Reset availability check (useful after reconnection).
 */
export function resetAvailability(): void {
  _redisAvailable = null;
}

// ─── AI Cache Operations ─────────────────────────────────────────────

/**
 * Get a cached AI response from Redis.
 * Returns null on miss or Redis unavailable.
 */
export async function redisCacheGet(feature: string, key: string): Promise<CacheEntry | null> {
  const client = await getRedisClient();
  if (!client) return null;

  try {
    const redisKey = `${KEY_PREFIX}${feature}:${key}`;
    const raw = await client.get(redisKey);

    if (raw) {
      redisHits++;
      try {
        return JSON.parse(raw) as CacheEntry;
      } catch {
        return null;
      }
    }

    redisMisses++;
    return null;
  } catch (err) {
    logger.debug('[REDIS-CACHE] Get failed:', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Store an AI cache entry in Redis with TTL.
 */
export async function redisCacheSet(
  feature: string,
  key: string,
  data: unknown,
  ttlMs: number,
): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;

  try {
    const redisKey = `${KEY_PREFIX}${feature}:${key}`;
    const entry: CacheEntry = {
      data,
      createdAt: Date.now(),
    };

    await client.set(redisKey, JSON.stringify(entry), ttlMs);
  } catch (err) {
    logger.debug('[REDIS-CACHE] Set failed:', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Delete an AI cache entry from Redis.
 */
export async function redisCacheDel(feature: string, key: string): Promise<boolean> {
  const client = await getRedisClient();
  if (!client) return false;

  try {
    const redisKey = `${KEY_PREFIX}${feature}:${key}`;
    const result = await client.del(redisKey);
    return result > 0;
  } catch {
    return false;
  }
}

// ─── Intelligence Cache Operations ─────────────────────────────────────

/**
 * Get a cached intelligence result from Redis.
 */
export async function redisIntelGet<T = unknown>(
  orgId: string,
  engineType: string,
  subKey?: string,
): Promise<T | null> {
  const client = await getRedisClient();
  if (!client) return null;

  try {
    const redisKey = subKey
      ? `${INTELLIGENCE_KEY_PREFIX}${orgId}:${engineType}:${subKey}`
      : `${INTELLIGENCE_KEY_PREFIX}${orgId}:${engineType}`;
    const raw = await client.get(redisKey);

    if (raw) {
      try {
        const entry = JSON.parse(raw) as CacheEntry<T>;
        return entry.data;
      } catch {
        return null;
      }
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Store an intelligence result in Redis with TTL.
 */
export async function redisIntelSet<T = unknown>(
  orgId: string,
  engineType: string,
  data: T,
  ttlMs: number,
  subKey?: string,
): Promise<void> {
  const client = await getRedisClient();
  if (!client) return;

  try {
    const redisKey = subKey
      ? `${INTELLIGENCE_KEY_PREFIX}${orgId}:${engineType}:${subKey}`
      : `${INTELLIGENCE_KEY_PREFIX}${orgId}:${engineType}`;
    const entry: CacheEntry<T> = {
      data,
      createdAt: Date.now(),
    };

    await client.set(redisKey, JSON.stringify(entry), ttlMs);
  } catch {
    // Best-effort
  }
}

/**
 * Invalidate all intelligence cache entries for an organization.
 */
export async function redisIntelInvalidate(orgId: string): Promise<number> {
  const client = await getRedisClient();
  if (!client) return 0;

  try {
    const pattern = `${INTELLIGENCE_KEY_PREFIX}${orgId}:*`;
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
    }
    return keys.length;
  } catch {
    return 0;
  }
}

/**
 * Invalidate all cache entries for a specific AI feature.
 */
export async function redisCacheInvalidateFeature(feature: string): Promise<number> {
  const client = await getRedisClient();
  if (!client) return 0;

  try {
    const pattern = `${KEY_PREFIX}${feature}:*`;
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
    }
    return keys.length;
  } catch {
    return 0;
  }
}

// ─── Stats ─────────────────────────────────────────────────────────────

export function getRedisCacheStats() {
  return {
    redisAvailable: _redisAvailable,
    redisHits,
    redisMisses,
    hitRate: redisHits + redisMisses > 0 ? redisHits / (redisHits + redisMisses) : 0,
    backend: getClientType(),
  };
}
