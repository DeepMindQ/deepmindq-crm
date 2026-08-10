/**
 * P1.1 — AI Memory Database Persistence
 *
 * Converts between the in-memory MemoryItem interface and the Prisma
 * AIMemoryEntry model. Provides DB-first read/write operations
 * with an in-memory LRU cache for performance.
 *
 * Architecture:
 *   WRITE: db.upsert() → cache.set()
 *   READ:  cache.get() → db.findUnique() → cache.set()
 *   SEARCH: db.findMany() → filter/score → cache.set()
 *   DELETE: db.delete() → cache.delete()
 *
 * The in-memory Maps in ai-memory.ts become a CACHE, not the source of truth.
 * On cold start, cache is populated from the most recent N memories.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ── LRU Cache ─────────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // Unix ms when this entry expires from cache
}

const CACHE_MAX_ENTRIES = 1000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Simple LRU cache backed by a Map.
 * Entries auto-expire after CACHE_TTL_MS.
 * When full, oldest entries are evicted.
 */
class MemoryLRUCache {
  private cache = new Map<string, CacheEntry<any>>();
  private accessOrder: string[] = [];

  get<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      const idx = this.accessOrder.indexOf(key);
      if (idx >= 0) this.accessOrder.splice(idx, 1);
      return undefined;
    }
    // Touch — move to end of access order
    const idx = this.accessOrder.indexOf(key);
    if (idx >= 0) {
      this.accessOrder.splice(idx, 1);
      this.accessOrder.push(key);
    }
    return entry.value as T;
  }

  set(key: string, value: any, ttlMs: number = CACHE_TTL_MS): void {
    const existing = this.cache.get(key);
    if (existing) {
      existing.value = value;
      existing.expiresAt = Date.now() + ttlMs;
      return;
    }
    // Evict if at capacity
    while (this.cache.size >= CACHE_MAX_ENTRIES) {
      const oldest = this.accessOrder.shift();
      if (oldest) this.cache.delete(oldest);
      else break;
    }
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    this.accessOrder.push(key);
  }

  delete(key: string): boolean {
    const idx = this.accessOrder.indexOf(key);
    if (idx >= 0) this.accessOrder.splice(idx, 1);
    return this.cache.delete(key);
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return false;
    }
    return true;
  }

  size(): number {
    return this.cache.size;
  }

  clear(): void {
    this.cache.clear();
    this.accessOrder.length = 0;
  }

  /**
   * Populate cache from an array of items. Used on cold start.
   * Only adds items that aren't already cached.
   */
  populateBatch(items: Array<{ id: string; data: any }>): void {
    for (const item of items) {
      if (!this.has(item.id)) {
        this.set(item.id, item.data);
      }
    }
  }
}

// ── Singleton cache ──────────────────────────────────────────────────

const memoryCache = new MemoryLRUCache();

// ── Type Mappers ───────────────────────────────────────────────────

/**
 * Convert an in-memory MemoryItem to Prisma-compatible JSON for DB storage.
 */
export function memoryItemToDb(item: Record<string, unknown>): Record<string, unknown> {
  const scope = item.scope as Record<string, unknown> | undefined;
  const isGlobal = !scope || (typeof scope === 'object' && 'entityType' in scope && !scope.entityId);

  return {
    id: item.id as string,
    layer: (item.layer as string) || 'enterprise',
    category: (item.category as string) || 'company_intelligence',
    priority: (item.priority as string) || 'medium',
    scopeType: isGlobal ? 'global' : 'entity',
    scopeEntityType: isGlobal ? null : (scope?.entityType as string) || null,
    scopeEntityId: isGlobal ? null : (scope?.entityId as string) || null,
    content: (item.content as string) || '',
    summary: (item.summary as string) || null,
    tags: JSON.stringify(item.tags || []),
    referencedEntityIds: JSON.stringify(item.referencedEntityIds || []),
    sourceType: ((item.source as Record<string, unknown>)?.type as string) || 'ai_generation',
    sourceDescription: ((item.source as Record<string, unknown>)?.description as string) || '',
    sourceId: ((item.source as Record<string, unknown>)?.sourceId as string) || null,
    sourceTimestampMs: ((item.source as Record<string, unknown>)?.timestamp as number) || null,
    confidence: (item.confidence as number) ?? 0.7,
    importance: (item.importance as number) ?? 0.5,
    accessCount: (item.accessCount as number) || 0,
    lastAccessedAtMs: (item.lastAccessedAt as number) || Date.now(),
    expiresAtMs: (item.expiresAt as number) || null,
    version: (item.version as number) || 1,
    parentMemoryId: (item.parentMemoryId as string) || null,
    childMemoryIds: JSON.stringify(item.childMemoryIds || []),
    metadata: (item.metadata as Record<string, unknown>) || {},
  };
}

/**
 * Convert a Prisma DB row back to an in-memory MemoryItem.
 */
export function dbRowToMemoryItem(row: Record<string, unknown>): Record<string, unknown> {
  const scopeType = row.scopeType as string;
  const isGlobal = scopeType === 'global' || !row.scopeEntityId;

  const source = {
    type: (row.sourceType as string) || 'ai_generation',
    description: (row.sourceDescription as string) || '',
    sourceId: (row.sourceId as string) || undefined,
    timestamp: (row.sourceTimestampMs as number) || undefined,
  };

  return {
    id: row.id,
    layer: (row.layer as string) || 'enterprise',
    category: (row.category as string) || 'company_intelligence',
    priority: (row.priority as string) || 'medium',
    scope: isGlobal ? 'global' : {
      entityType: (row.scopeEntityType as string) || '',
      entityId: (row.scopeEntityId as string) || '',
    },
    content: (row.content as string) || '',
    summary: (row.summary as string) || undefined,
    tags: JSON.parse((row.tags as string) || '[]'),
    referencedEntityIds: JSON.parse((row.referencedEntityIds as string) || '[]'),
    source,
    confidence: (row.confidence as number) ?? 0.7,
    importance: (row.importance as number) ?? 0.5,
    accessCount: (row.accessCount as number) || 0,
    lastAccessedAt: (row.lastAccessedAtMs as number) || 0,
    createdAt: (row.createdAtMs as number) || 0,
    updatedAt: (row.updatedAtMs as number) || 0,
    expiresAt: (row.expiresAtMs as number) || undefined,
    version: (row.version as number) || 1,
    parentMemoryId: (row.parentMemoryId as string) || undefined,
    childMemoryIds: JSON.parse((row.childMemoryIds as string) || '[]'),
    metadata: (row.metadata as Record<string, unknown>) || {},
  };
}

// ── DB Operations (Source of Truth) ─────────────────────────────────

/**
 * Write (upsert) a memory item to the database.
 */
export async function dbWriteMemory(dbData: Record<string, unknown>): Promise<void> {
  try {
    await db.aIMemoryEntry.upsert({
      where: { id: dbData.id as string },
      create: dbData,
      update: dbData,
    });
  } catch (err) {
    logger.error('[AI Memory] DB write failed for memory', {
      id: (dbData.id as string)?.slice(0, 8),
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Write (upsert) multiple memory items in a batch.
 */
export async function dbWriteMemoryBatch(items: Record<string, unknown>[]): Promise<void> {
  if (items.length === 0) return;
  try {
    // Prisma doesn't have bulkUpsert, so we use createMany with conflict handling
    await Promise.all(
      items.map(item =>
        db.aIMemoryEntry.upsert({
          where: { id: item.id as string },
          create: item,
          update: item,
        })
      )
    );
  } catch (err) {
    logger.error(`[AI Memory] DB batch write failed (${items.length} items)`, {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/**
 * Read a memory item from the database by ID.
 */
export async function dbReadMemory(id: string): Promise<Record<string, unknown> | null> {
  try {
    const row = await db.aIMemoryEntry.findUnique({
      where: { id },
    });
    if (!row) return null;
    return row as unknown as Record<string, unknown>;
  } catch (err) {
    logger.error('[AI Memory] DB read failed for memory', {
      id: id.slice(0, 8),
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Delete a memory item from the database.
 */
export async function dbDeleteMemory(id: string): Promise<boolean> {
  try {
    await db.aIMemoryEntry.delete({ where: { id } });
    return true;
  } catch (err) {
    logger.error('[AI Memory] DB delete failed for memory', {
      id: id.slice(0, 8),
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Search memories in the database with filters.
 */
export async function dbSearchMemories(options: {
  query?: string;
  layer?: string[];
  category?: string[];
  scopeEntityType?: string;
  scopeEntityId?: string;
  tags?: string[];
  limit?: number;
  offset?: number;
  minConfidence?: number;
  excludeExpired?: boolean;
}): Promise<Record<string, unknown>[]> {
  const {
    query, layer, category, scopeEntityType, scopeEntityId, tags,
    limit = 50, offset = 0, minConfidence = 0, excludeExpired = true,
  } = options;

  const where: Record<string, unknown>[] = [];

  // Layer filter
  if (layer && layer.length > 0) {
    where.push({ layer: { in: layer } });
  }

  // Category filter
  if (category && category.length > 0) {
    where.push({ category: { in: category } });
  }

  // Scope filter
  if (scopeEntityType && scopeEntityId) {
    where.push({
      scopeType: 'entity',
      scopeEntityType,
      scopeEntityId,
    });
  }

  // Confidence filter
  if (minConfidence > 0) {
    where.push({ confidence: { gte: minConfidence } });
  }

  // Expiry filter
  if (excludeExpired) {
    where.push({
      OR: [
        { expiresAtMs: null },
        { expiresAtMs: { gt: Date.now() } },
      ],
    });
  }

  // Tag filter (JSON contains — use string search)
  // Note: For proper array containment, we'd need raw SQL or a dedicated tags table.
  // For now, tag filtering is done in-memory after the DB query.

  try {
    const rows = await db.aIMemoryEntry.findMany({
      where: where.length > 0 ? { AND: where } : undefined,
      orderBy: { updatedAtMs: 'desc' },
      take: limit,
      skip: offset,
    });

    return (rows as unknown as Record<string, unknown>[]);
  } catch (err) {
    logger.error('[AI Memory] DB search failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/**
 * Get memory count by various groupings for stats.
 */
export async function dbGetMemoryStats(): Promise<{
  total: number;
  byLayer: Record<string, number>;
  byCategory: Record<string, number>;
  avgConfidence: number;
  avgImportance: number;
}> {
  try {
    const [total, byLayer, byCategory, agg] = await Promise.all([
      db.aIMemoryEntry.count(),
      db.aIMemoryEntry.groupBy({ by: 'layer', _count: { layer: true } }),
      db.aIMemoryEntry.groupBy({ by: 'category', _count: { category: true } }),
      db.aIMemoryEntry.aggregate({
        _avg: { confidence: true, importance: true },
      }),
    ]);

    return {
      total,
      byLayer: Object.fromEntries((byLayer as any[]).map(r => [r.layer, r._count.layer])),
      byCategory: Object.fromEntries((byCategory as any[]).map(r => [r.category, r._count.category])),
      avgConfidence: agg._avg.confidence ?? 0,
      avgImportance: agg._avg.importance ?? 0,
    };
  } catch (err) {
    logger.error('[AI Memory] DB stats failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { total: 0, byLayer: {}, byCategory: {}, avgConfidence: 0, avgImportance: 0 };
  }
}

/**
 * Load recent memories from DB on cold start to populate the cache.
 * Loads the most recently updated memories (up to CACHE_MAX_ENTRIES).
 */
export async function dbLoadRecentForCache(): Promise<number> {
  try {
    const rows = await db.aIMemoryEntry.findMany({
      orderBy: { updatedAtMs: 'desc' },
      take: CACHE_MAX_ENTRIES,
    });

    for (const row of rows as any[]) {
      const memory = dbRowToMemoryItem(row);
      memoryCache.set(row.id, memory);
    }

    return rows.length;
  } catch (err) {
    logger.warn('[AI Memory] Cold-start cache population failed (cache starts empty)', {
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

/**
 * Delete expired memories from the database.
 */
export async function dbCleanupExpired(): Promise<number> {
  try {
    const result = await db.aIMemoryEntry.deleteMany({
      where: {
        expiresAtMs: { lt: Date.now() },
      },
    });
    return result.count;
  } catch (err) {
    logger.error('[AI Memory] Expired memory cleanup failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

// ── Cache-Aside Operations (for use by ai-memory.ts) ─────────────────

/**
 * Write a memory: DB first, then cache.
 * Returns the written data (DB-transformed) for cache storage.
 */
export async function persistMemoryToDb(
  item: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const dbData = memoryItemToDb(item);
  await dbWriteMemory(dbData);
  return dbData;
}

/**
 * Read a memory: cache first, DB fallback.
 * On cache miss, populates cache.
 */
export async function recallMemoryFromDb(
  id: string,
): Promise<Record<string, unknown> | null> {
  // Cache hit
  const cached = memoryCache.get(id);
  if (cached) return cached;

  // DB fallback
  const row = await dbReadMemory(id);
  if (!row) return null;

  // Populate cache
  memoryCache.set(id, row);
  return row;
}

/**
 * Search memories: search DB, populate cache with results.
 */
export async function searchMemoriesFromDb(
  options: Parameters<typeof dbSearchMemories>[0],
): Promise<Record<string, unknown>[]> {
  const rows = await dbSearchMemories(options);

  // Populate cache
  for (const row of rows) {
    memoryCache.set((row as any).id, row);
  }

  return rows;
}

/**
 * Delete a memory: cache first, then DB.
 */
export async function deleteMemoryFromDb(
  id: string,
): Promise<boolean> {
  memoryCache.delete(id);
  return dbDeleteMemory(id);
}

/**
 * Invalidate all cache entries (for testing or forced refresh).
 */
export function invalidateCache(): void {
  memoryCache.clear();
}

/**
 * Get cache stats.
 */
export function getCacheStats(): { size: number; maxSize: number } {
  return { size: memoryCache.size(), maxSize: CACHE_MAX_ENTRIES };
}
