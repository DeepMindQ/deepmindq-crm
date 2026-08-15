/**
 * Intelligence Cache — Cache expensive intelligence computation results.
 *
 * Caches the output of intelligence engines (knowledge graph, signal detection,
 * reasoning) to avoid recomputation for recently-analyzed organizations.
 *
 * Features:
 *   - Per-organization caching (keyed by orgId + engine type)
 *   - TTL-based expiration (shorter than LLM cache — intelligence becomes stale)
 *   - Cache invalidation on data changes (new signals, new evidence)
 *   - Stats for monitoring
 */

import { logger } from '@/lib/logger';

// ─── Cache Entry ───────────────────────────────────────────────────────

interface IntelligenceCacheEntry<T = unknown> {
  data: T;
  createdAt: number;
  expiresAt: number;
  orgId: string;
  engineType: string;
}

// ─── Cache Configuration ──────────────────────────────────────────────

const MAX_MEMORY_ENTRIES = 500;
const DEFAULT_INTELLIGENCE_TTL_MS = 30 * 60 * 1000; // 30 minutes (intelligence becomes stale quickly)

// TTL per engine type — shorter for more dynamic engines
const ENGINE_TTL_MS: Record<string, number> = {
  signals: 15 * 60 * 1000, // 15 minutes — signals can change rapidly
  reasoning: 60 * 60 * 1000, // 1 hour — reasoning based on signals, less volatile
  knowledge_graph: 30 * 60 * 1000, // 30 minutes — graph changes on new data
  briefing: 60 * 60 * 1000, // 1 hour — briefings are snapshots
  ingestion: 24 * 60 * 60 * 1000, // 24 hours — ingestion results don't change
};

// ─── LRU Cache Store ──────────────────────────────────────────────────

const memoryCache = new Map<string, IntelligenceCacheEntry>();

// ─── Key Generation ────────────────────────────────────────────────────

function generateKey(orgId: string, engineType: string, subKey?: string): string {
  return subKey ? `${orgId}:${engineType}:${subKey}` : `${orgId}:${engineType}`;
}

// ─── Cache Operations ─────────────────────────────────────────────────

/**
 * Get a cached intelligence result if it exists and hasn't expired.
 */
export function getIntelligence<T = unknown>(
  orgId: string,
  engineType: string,
  subKey?: string,
): T | null {
  const key = generateKey(orgId, engineType, subKey);
  const entry = memoryCache.get(key);

  if (!entry) return null;

  if (Date.now() > entry.expiresAt) {
    memoryCache.delete(key);
    return null;
  }

  // LRU: move to end
  memoryCache.delete(key);
  memoryCache.set(key, entry);

  return entry.data as T;
}

/**
 * Store an intelligence computation result.
 */
export function setIntelligence<T = unknown>(
  orgId: string,
  engineType: string,
  data: T,
  subKey?: string,
  ttlMs?: number,
): void {
  const key = generateKey(orgId, engineType, subKey);

  // Evict LRU entries if at capacity
  while (memoryCache.size >= MAX_MEMORY_ENTRIES) {
    const firstKey = memoryCache.keys().next().value;
    if (firstKey) {
      memoryCache.delete(firstKey);
    } else {
      break;
    }
  }

  const ttl = ttlMs ?? ENGINE_TTL_MS[engineType] ?? DEFAULT_INTELLIGENCE_TTL_MS;
  const now = Date.now();

  memoryCache.set(key, {
    data,
    createdAt: now,
    expiresAt: now + ttl,
    orgId,
    engineType,
  });
}

/**
 * Invalidate all cached intelligence for a specific organization.
 * Call this when organization data changes (new signals, people, etc.)
 */
export function invalidateOrganization(orgId: string): number {
  let invalidated = 0;
  for (const [key, entry] of memoryCache) {
    if (entry.orgId === orgId) {
      memoryCache.delete(key);
      invalidated++;
    }
  }
  if (invalidated > 0) {
    logger.debug(`[INTEL-CACHE] Invalidated ${invalidated} entries for org ${orgId}`);
  }
  return invalidated;
}

/**
 * Invalidate all cached intelligence of a specific engine type.
 */
export function invalidateEngineType(engineType: string): number {
  let invalidated = 0;
  for (const [key, entry] of memoryCache) {
    if (entry.engineType === engineType) {
      memoryCache.delete(key);
      invalidated++;
    }
  }
  return invalidated;
}

/**
 * Clear the entire intelligence cache.
 */
export function clearAll(): number {
  const count = memoryCache.size;
  memoryCache.clear();
  logger.info(`[INTEL-CACHE] Full cache cleared (${count} entries)`);
  return count;
}

// ─── Stats ────────────────────────────────────────────────────────────

/**
 * Get cache statistics.
 */
export function getCacheStats() {
  // Clean expired entries
  const now = Date.now();
  let expired = 0;
  for (const [key, entry] of memoryCache) {
    if (now > entry.expiresAt) {
      memoryCache.delete(key);
      expired++;
    }
  }

  return {
    memoryEntries: memoryCache.size,
    memoryMaxEntries: MAX_MEMORY_ENTRIES,
    redisAvailable: false, // Redis not yet implemented; future enhancement
    expiredCleaned: expired,
  };
}

// ─── Periodic Cleanup ────────────────────────────────────────────────

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000; // Every 10 minutes

if (typeof globalThis !== 'undefined') {
  setInterval(() => {
    const stats = getCacheStats();
    if (stats.expiredCleaned > 0) {
      logger.debug(
        `[INTEL-CACHE] Periodic cleanup: removed ${stats.expiredCleaned} expired entries`,
      );
    }
  }, CLEANUP_INTERVAL_MS).unref();
}
