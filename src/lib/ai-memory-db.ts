/**
 * P1.1 — AI Memory Database Persistence Layer
 *
 * P1 Phase 1: DATA INTEGRITY & PERSISTENCE
 *
 * Converts between the in-memory MemoryItem interface and the Prisma
 * AIMemoryEntry model. Provides DB-first read/write operations
 * with an in-memory LRU cache for performance.
 *
 * Architecture (Cache-Aside):
 *   WRITE: db.upsert() → cache.set()
 *   READ:  cache.get() → db.findUnique() → cache.set()
 *   SEARCH: db.findMany() → filter/score → cache.set()
 *   DELETE: db.delete() → cache.delete()
 *
 * The in-memory Maps in ai-memory.ts become a CACHE, not the source of truth.
 * On cold start, cache is populated from the most recent N memories.
 *
 * INTEGRATION:
 *   Import this module in ai-memory.ts and replace:
 *   - memoryStore.set() calls → dbWriteMemory() + cache.set()
 *   - memoryStore.get() calls → cache.get() || dbReadMemory()
 *   - memoryStore.delete() calls → cache.delete() + dbDeleteMemory()
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ── LRU Cache ─────────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const CACHE_MAX_ENTRIES = 1000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Simple LRU cache. Entries auto-expire after CACHE_TTL_MS.
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
}

// ── Singleton ─────────────────────────────────────────────────────

const memoryCache = new MemoryLRUCache();

// ── Type Mappers ───────────────────────────────────────────────────

/** In-memory MemoryItem → Prisma-compatible JSON. */
function toDb(item: Record<string, unknown>): Record<string, unknown> {
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

/** Prisma DB row → in-memory MemoryItem shape. */
export function fromDb(row: Record<string, unknown>): Record<string, unknown> {
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

// ── Public API ────────────────────────────────────────────────────────

/** Write a memory to DB (upsert). Returns DB-transformed data for caching. */
export async function writeMemory(
  item: Record<string, unknown>,
): Promise<Record<string, unknown>> {
  const dbData = toDb(item);
  try {
    await db.aIMemoryEntry.upsert({
      where: { id: dbData.id as string },
      create: dbData as any,
      update: dbData as any,
    });
  } catch (err) {
    logger.error('[ai-memory-db] Write failed', {
      id: String(dbData.id).slice(0, 8),
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
  return dbData;
}

/** Batch write memories to DB. */
export async function writeMemoryBatch(
  items: Record<string, unknown>[],
): Promise<void> {
  if (items.length === 0) return;
  try {
    await db.$transaction(async (tx) => {
      for (const item of items) {
        const dbData = toDb(item);
        await tx.aIMemoryEntry.upsert({
          where: { id: dbData.id as string },
          create: dbData as any,
          update: dbData as any,
        });
      }
    }, { timeout: 30000 });
  } catch (err) {
    logger.error(`[ai-memory-db] Batch write failed (${items.length} items)`, {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/** Read a single memory from DB by ID. */
export async function readMemory(
  id: string,
): Promise<Record<string, unknown> | null> {
  try {
    const row = await db.aIMemoryEntry.findUnique({ where: { id } });
    if (!row) return null;
    return row as unknown as Record<string, unknown>;
  } catch (err) {
    logger.error('[ai-memory-db] Read failed', {
      id: id.slice(0, 8),
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Delete a memory from DB. */
export async function deleteMemory(id: string): Promise<boolean> {
  try {
    await db.aIMemoryEntry.delete({ where: { id } });
    return true;
  } catch (err) {
    logger.error('[ai-memory-db] Delete failed', {
      id: id.slice(0, 8),
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/** Search memories with filters. Returns DB rows (already in MemoryItem shape via fromDb). */
export async function searchMemories(opts: {
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
    query, layer, category, scopeEntityType, scopeEntityId,
    limit = 50, offset = 0, minConfidence = 0, excludeExpired = true,
  } = opts;

  const where: Record<string, unknown>[] = [];
  if (layer?.length) where.push({ layer: { in: layer } });
  if (category?.length) where.push({ category: { in: category } });
  if (scopeEntityType && scopeEntityId) {
    where.push({ scopeType: 'entity', scopeEntityType, scopeEntityId });
  }
  if (minConfidence > 0) where.push({ confidence: { gte: minConfidence } });
  if (excludeExpired) {
    where.push({
      OR: [
        { expiresAtMs: null },
        { expiresAtMs: { gt: Date.now() } },
      ],
    });
  }

  try {
    const rows = await db.aIMemoryEntry.findMany({
      where: where.length > 0 ? { AND: where } : undefined,
      orderBy: { updatedAtMs: 'desc' },
      take: limit,
      skip: offset,
    });
    return rows.map(r => fromDb(r as unknown as Record<string, unknown>));
  } catch (err) {
    logger.error('[ai-memory-db] Search failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/** Get aggregate stats for the memory system. */
export async function getMemoryStats(): Promise<{
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
      byLayer: Object.fromEntries(
        (byLayer as any[]).map(r => [r.layer, r._count.layer]),
      ),
      byCategory: Object.fromEntries(
        (byCategory as any[]).map(r => [r.category, r._count.category]),
      ),
      avgConfidence: agg._avg.confidence ?? 0,
      avgImportance: agg._avg.importance ?? 0,
    };
  } catch (err) {
    logger.error('[ai-memory-db] Stats failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { total: 0, byLayer: {}, byCategory: {}, avgConfidence: 0, avgImportance: 0 };
  }
}

/**
 * Cold start: load recent memories from DB into cache.
 * Call once on module initialization.
 */
export async function warmCacheFromDb(): Promise<number> {
  try {
    const rows = await db.aIMemoryEntry.findMany({
      orderBy: { updatedAtMs: 'desc' },
      take: CACHE_MAX_ENTRIES,
    });
    for (const row of rows as any[]) {
      memoryCache.set(row.id, fromDb(row));
    }
    return rows.length;
  } catch (err) {
    logger.warn('[ai-memory-db] Cache warm-up failed (cache starts empty)', {
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

/** Cleanup expired memories. Call periodically. */
export async function cleanupExpiredMemories(): Promise<number> {
  try {
    const result = await db.aIMemoryEntry.deleteMany({
      where: { expiresAtMs: { lt: Date.now() } },
    });
    return result.count;
  } catch (err) {
    logger.error('[ai-memory-db] Expired cleanup failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}

// ── Cache Operations (for ai-memory.ts to call) ────────────────────

/** Get from cache, or undefined on miss. */
export function cacheGet(id: string): Record<string, unknown> | undefined {
  return memoryCache.get(id);
}

/** Set cache entry (typically after a DB write). */
export function cacheSet(
  id: string,
  data: Record<string, unknown>,
  ttlMs?: number,
): void {
  memoryCache.set(id, data, ttlMs);
}

/** Remove from cache. */
export function cacheDelete(id: string): boolean {
  return memoryCache.delete(id);
}

/** Check if cache has a valid (non-expired) entry. */
export function cacheHas(id: string): boolean {
  return memoryCache.has(id);
}

/** Populate cache from an array of DB rows (used during search). */
export function cachePopulateBatch(
  items: Record<string, unknown>[],
): void {
  for (const item of items) {
    memoryCache.set((item as any).id, item);
  }
}

/** Clear entire cache. */
export function cacheClear(): void {
  memoryCache.clear();
}

/** Get cache size for monitoring. */
export function cacheSize(): number {
  return memoryCache.size();
}
