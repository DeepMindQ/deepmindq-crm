/**
 * P5.5 — Intelligence Caching Layer
 *
 * Redis-backed (with in-memory fallback) cache for company intelligence data.
 * Uses evidence fingerprints for automatic cache invalidation.
 *
 * Architecture:
 *   Cache Key: intel:{companyId}:{fingerprint}
 *   TTL: 1 hour (or until next signal invalidates)
 *   Fingerprint: SHA-256 hash of (lastSignalAt + lastResearchAt + evidenceCount)
 *   Storage: Redis (primary) → In-memory LRU (fallback)
 */

import { logger } from '@/lib/logger';
import { createHash } from 'crypto';

// ── Types ──

export interface IntelligenceCacheEntry<T = unknown> {
  data: T;
  companyId: string;
  fingerprint: string;
  cachedAt: number; // epoch ms
  ttl: number;       // seconds
}

export interface IntelligenceCacheOptions {
  ttl?: number;       // Override default TTL (seconds)
  skipCache?: boolean; // Force bypass
}

// ── Fingerprint Generation ──

/**
 * Generate a cache fingerprint from company intelligence freshness indicators.
 * If any of these change, the cache is invalidated.
 */
export function generateIntelligenceFingerprint(params: {
  companyId: string;
  lastSignalAt?: Date | null;
  lastResearchAt?: Date | null;
  evidenceCount?: number;
  lastEnrichedAt?: Date | null;
  scoreVersion?: number;
}): string {
  const components = [
    params.companyId,
    params.lastSignalAt?.getTime() ?? 0,
    params.lastResearchAt?.getTime() ?? 0,
    params.evidenceCount ?? 0,
    params.lastEnrichedAt?.getTime() ?? 0,
    params.scoreVersion ?? 0,
  ];
  return createHash('sha256').update(components.join(':')).digest('hex').substring(0, 16);
}

// ── Cache Key ──

function buildCacheKey(companyId: string, fingerprint: string): string {
  return `intel:${companyId}:${fingerprint}`;
}

// ── In-Memory LRU Fallback ──

const CACHE_MAX_ENTRIES = 500;
const CACHE_DEFAULT_TTL = 3600; // 1 hour
const memoryCache = new Map<string, { entry: IntelligenceCacheEntry; expiresAt: number }>();

function setMemoryCache(key: string, entry: IntelligenceCacheEntry): void {
  // Evict oldest entries if at capacity
  if (memoryCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = memoryCache.keys().next().value;
    if (oldest) memoryCache.delete(oldest);
  }
  memoryCache.set(key, { entry, expiresAt: Date.now() + entry.ttl * 1000 });
}

function getMemoryCache<T>(key: string): IntelligenceCacheEntry<T> | null {
  const cached = memoryCache.get(key);
  if (!cached) return null;
  if (Date.now() > cached.expiresAt) {
    memoryCache.delete(key);
    return null;
  }
  return cached.entry as IntelligenceCacheEntry<T>;
}

// ── Redis Client (lazy-loaded) ──

let redisClient: any = null;
let redisAvailable = false;

async function getRedis(): Promise<any | null> {
  if (!redisClient) {
    try {
      const Redis = (await import('ioredis')).default;
      const url = process.env.REDIS_URL;
      if (!url) return null;
      redisClient = new Redis(url, {
        maxRetriesPerRequest: 3,
        retryStrategy: (times: number) => Math.min(times * 200, 2000),
        lazyConnect: true,
      });
      redisClient.on('error', () => { redisAvailable = false; });
      redisClient.on('connect', () => { redisAvailable = true; });
      await redisClient.connect();
      redisAvailable = true;
    } catch {
      redisAvailable = false;
      return null;
    }
  }
  return redisAvailable ? redisClient : null;
}

// ── Core Cache Operations ──

/**
 * Get cached intelligence for a company.
 * Checks Redis first, falls back to in-memory LRU.
 */
export async function getIntelligenceCache<T>(
  companyId: string,
  fingerprint: string,
): Promise<T | null> {
  const key = buildCacheKey(companyId, fingerprint);

  // Try Redis first
  try {
    const redis = await getRedis();
    if (redis) {
      const raw = await redis.get(key);
      if (raw) {
        const entry: IntelligenceCacheEntry<T> = JSON.parse(raw);
        return entry.data;
      }
    }
  } catch {
    // Redis failed — fall through to memory
  }

  // Try memory cache
  const memCached = getMemoryCache<T>(key);
  return memCached?.data ?? null;
}

/**
 * Set intelligence cache for a company.
 * Writes to both Redis and in-memory LRU.
 */
export async function setIntelligenceCache<T>(
  companyId: string,
  fingerprint: string,
  data: T,
  options?: IntelligenceCacheOptions,
): Promise<void> {
  const key = buildCacheKey(companyId, fingerprint);
  const ttl = options?.ttl ?? CACHE_DEFAULT_TTL;

  const entry: IntelligenceCacheEntry<T> = {
    data,
    companyId,
    fingerprint,
    cachedAt: Date.now(),
    ttl,
  };

  // Write to Redis (fire-and-forget)
  if (!options?.skipCache) {
    (async () => {
      try {
        const redis = await getRedis();
        if (redis) {
          await redis.setex(key, ttl, JSON.stringify(entry));
        } else {
          setMemoryCache(key, entry);
        }
      } catch {
        setMemoryCache(key, entry);
      }
    })();
  }
}

/**
 * Invalidate all cached intelligence for a company.
 * Called when new signals arrive or research is updated.
 */
export async function invalidateIntelligenceCache(companyId: string): Promise<number> {
  let invalidated = 0;

  // Invalidate memory cache
  for (const key of memoryCache.keys()) {
    if (key.startsWith(`intel:${companyId}:`)) {
      memoryCache.delete(key);
      invalidated++;
    }
  }

  // Invalidate Redis (fire-and-forget)
  (async () => {
    try {
      const redis = await getRedis();
      if (redis) {
        const stream = redis.scanStream({ match: `intel:${companyId}:*`, count: 100 });
        const keys: string[] = [];
        stream.on('data', (resultKeys: string[]) => keys.push(...resultKeys));
        await new Promise<void>((resolve) => {
          stream.on('end', resolve);
        });
        if (keys.length > 0) {
          await redis.del(...keys);
          invalidated = keys.length;
        }
      }
    } catch {
      // Redis unavailable — memory cache already invalidated
    }
  })();

  if (invalidated > 0) {
    logger.info(`[intel-cache] Invalidated ${invalidated} entries for company ${companyId}`);
  }

  return invalidated;
}

/**
 * Get cache statistics for monitoring.
 */
export function getCacheStats(): {
  memoryEntries: number;
  memoryMaxEntries: number;
  redisAvailable: boolean;
} {
  return {
    memoryEntries: memoryCache.size,
    memoryMaxEntries: CACHE_MAX_ENTRIES,
    redisAvailable,
  };
}
