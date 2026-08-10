/**
 * P1.2 — Knowledge Graph Database Persistence Layer
 *
 * P1 Phase 1: DATA INTEGRITY & PERSISTENCE
 *
 * Converts between the in-memory GraphNode/GraphEdge interfaces and the
 * Prisma KnowledgeGraphNode / KnowledgeGraphEdge models.
 * Provides DB-first read/write operations with an LRU cache for performance.
 *
 * Architecture (Cache-Aside):
 *   WRITE: db.upsert() → cache.set()
 *   READ:  cache.get() → db.findUnique() → cache.set()
 *   DELETE: db.delete() → cache.delete()
 *
 * The in-memory Maps in ai-knowledge-graph.ts remain as the HOT CACHE.
 * On cold start, they are populated from DB via warmCacheFromDb().
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import type {
  GraphNode,
  GraphEdge,
  GraphEntityType,
  RelationshipType,
} from '@/lib/ai-knowledge-graph';

// ── LRU Cache ─────────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const CACHE_MAX_ENTRIES = 2000;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Simple LRU cache. Entries auto-expire after CACHE_TTL_MS.
 * When full, oldest entries are evicted.
 */
class KnowledgeGraphLRUCache {
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
    // Move to end (most recently used)
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
      // Move to end
      const idx = this.accessOrder.indexOf(key);
      if (idx >= 0) {
        this.accessOrder.splice(idx, 1);
        this.accessOrder.push(key);
      }
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

// ── Singletons ─────────────────────────────────────────────────────

const nodeCache = new KnowledgeGraphLRUCache();
const edgeCache = new KnowledgeGraphLRUCache();

// ── Type Mappers ───────────────────────────────────────────────────

/** In-memory GraphNode → Prisma-compatible DB record. */
export function nodeToDb(node: GraphNode): Record<string, unknown> {
  return {
    id: node.id,
    type: node.type,
    label: node.label,
    aliases: JSON.stringify(node.aliases || []),
    properties: node.properties || {},
    source: node.source || null,
    confidence: node.confidence ?? 0.7,
    isGlobal: true,
    createdAtMs: node.createdAt || Date.now(),
    updatedAtMs: node.updatedAt || Date.now(),
  };
}

/** Prisma DB row → in-memory GraphNode. */
export function nodeFromDb(row: Record<string, unknown>): GraphNode {
  const aliases = typeof row.aliases === 'string'
    ? JSON.parse(row.aliases || '[]')
    : (row.aliases as string[]) || [];

  return {
    id: row.id as string,
    label: row.label as string,
    type: row.type as GraphEntityType,
    aliases,
    properties: (row.properties as Record<string, unknown>) || {},
    source: (row.source as string) || undefined,
    confidence: (row.confidence as number) ?? 0.7,
    createdAt: (row.createdAtMs as number) || Date.now(),
    updatedAt: (row.updatedAtMs as number) || Date.now(),
  };
}

/** In-memory GraphEdge → Prisma-compatible DB record. */
export function edgeToDb(edge: GraphEdge): Record<string, unknown> {
  return {
    id: edge.id,
    sourceId: edge.sourceId,
    targetId: edge.targetId,
    relationship: edge.relationship,
    weight: edge.weight,
    confidence: edge.confidence ?? 0.7,
    observedAt: edge.observedAt || null,
    expiresAt: edge.expiresAt || null,
    reason: edge.reason || '',
    source: edge.source || null,
    evidenceIds: JSON.stringify(edge.evidenceIds || []),
    isGlobal: true,
    createdAtMs: edge.createdAt || Date.now(),
    updatedAtMs: Date.now(),
  };
}

/** Prisma DB row → in-memory GraphEdge. */
export function edgeFromDb(row: Record<string, unknown>): GraphEdge {
  const evidenceIds = typeof row.evidenceIds === 'string'
    ? JSON.parse(row.evidenceIds || '[]')
    : (row.evidenceIds as string[]) || [];

  return {
    id: row.id as string,
    sourceId: row.sourceId as string,
    targetId: row.targetId as string,
    relationship: row.relationship as RelationshipType,
    weight: (row.weight as number) ?? 0.5,
    confidence: (row.confidence as number) ?? 0.7,
    observedAt: (row.observedAt as string) || undefined,
    expiresAt: (row.expiresAt as string) || undefined,
    reason: (row.reason as string) || '',
    source: (row.source as string) || undefined,
    evidenceIds,
    createdAt: (row.createdAtMs as number) || Date.now(),
  };
}

// ── Public API: Node Operations ────────────────────────────────────

/** Write a node to DB (upsert). Returns DB data for caching. */
export async function writeNode(
  node: GraphNode,
): Promise<Record<string, unknown>> {
  const dbData = nodeToDb(node);
  try {
    await db.knowledgeGraphNode.upsert({
      where: { id: dbData.id as string },
      create: dbData as any,
      update: dbData as any,
    });
    nodeCache.set(node.id, dbData);
  } catch (err) {
    logger.error('[ai-kg-db] writeNode failed', {
      id: String(dbData.id).slice(0, 12),
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
  return dbData;
}

/** Batch write nodes to DB. */
export async function writeNodeBatch(
  nodes: GraphNode[],
): Promise<void> {
  if (nodes.length === 0) return;
  try {
    await Promise.all(
      nodes.map(node => {
        const dbData = nodeToDb(node);
        return db.knowledgeGraphNode.upsert({
          where: { id: dbData.id as string },
          create: dbData as any,
          update: dbData as any,
        });
      })
    );
    for (const node of nodes) {
      nodeCache.set(node.id, nodeToDb(node));
    }
  } catch (err) {
    logger.error(`[ai-kg-db] writeNodeBatch failed (${nodes.length} nodes)`, {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/** Read a single node from DB by ID. */
export async function readNode(
  id: string,
): Promise<Record<string, unknown> | null> {
  // Check cache first
  const cached = nodeCache.get<Record<string, unknown>>(id);
  if (cached) return cached;

  try {
    const row = await db.knowledgeGraphNode.findUnique({ where: { id } });
    if (!row) return null;
    const data = row as unknown as Record<string, unknown>;
    nodeCache.set(id, data);
    return data;
  } catch (err) {
    logger.error('[ai-kg-db] readNode failed', {
      id: id.slice(0, 12),
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Delete a node from DB (and cascade its edges). */
export async function deleteNode(id: string): Promise<boolean> {
  try {
    // Delete connected edges first (Prisma doesn't have cascade defined)
    await db.knowledgeGraphEdge.deleteMany({
      where: {
        OR: [
          { sourceId: id },
          { targetId: id },
        ],
      },
    });
    await db.knowledgeGraphNode.delete({ where: { id } });
    nodeCache.delete(id);
    return true;
  } catch (err) {
    logger.error('[ai-kg-db] deleteNode failed', {
      id: id.slice(0, 12),
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/** Find nodes by type. */
export async function getNodesByType(
  type: string,
): Promise<Record<string, unknown>[]> {
  try {
    const rows = await db.knowledgeGraphNode.findMany({
      where: { type: type as any },
      orderBy: { updatedAtMs: 'desc' },
    });
    return rows.map(r => r as unknown as Record<string, unknown>);
  } catch (err) {
    logger.error('[ai-kg-db] getNodesByType failed', {
      type,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/** Find nodes by label (case-insensitive). */
export async function getNodesByLabel(
  label: string,
): Promise<Record<string, unknown>[]> {
  try {
    const rows = await db.knowledgeGraphNode.findMany({
      where: { label: { contains: label, mode: 'insensitive' } },
      orderBy: { updatedAtMs: 'desc' },
    });
    return rows.map(r => r as unknown as Record<string, unknown>);
  } catch (err) {
    logger.error('[ai-kg-db] getNodesByLabel failed', {
      label: label.slice(0, 50),
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/** Search nodes by label substring (case-insensitive). */
export async function searchNodes(
  query: string,
  limit: number = 50,
): Promise<Record<string, unknown>[]> {
  try {
    const rows = await db.knowledgeGraphNode.findMany({
      where: { label: { contains: query, mode: 'insensitive' } },
      orderBy: { updatedAtMs: 'desc' },
      take: limit,
    });
    return rows.map(r => r as unknown as Record<string, unknown>);
  } catch (err) {
    logger.error('[ai-kg-db] searchNodes failed', {
      query: query.slice(0, 50),
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ── Public API: Edge Operations ────────────────────────────────────

/** Write an edge to DB (upsert). Returns DB data for caching. */
export async function writeEdge(
  edge: GraphEdge,
): Promise<Record<string, unknown>> {
  const dbData = edgeToDb(edge);
  try {
    await db.knowledgeGraphEdge.upsert({
      where: { id: dbData.id as string },
      create: dbData as any,
      update: dbData as any,
    });
    edgeCache.set(edge.id, dbData);
  } catch (err) {
    logger.error('[ai-kg-db] writeEdge failed', {
      id: String(dbData.id).slice(0, 12),
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
  return dbData;
}

/** Batch write edges to DB. */
export async function writeEdgeBatch(
  edges: GraphEdge[],
): Promise<void> {
  if (edges.length === 0) return;
  try {
    await Promise.all(
      edges.map(edge => {
        const dbData = edgeToDb(edge);
        return db.knowledgeGraphEdge.upsert({
          where: { id: dbData.id as string },
          create: dbData as any,
          update: dbData as any,
        });
      })
    );
    for (const edge of edges) {
      edgeCache.set(edge.id, edgeToDb(edge));
    }
  } catch (err) {
    logger.error(`[ai-kg-db] writeEdgeBatch failed (${edges.length} edges)`, {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

/** Read a single edge from DB by ID. */
export async function readEdge(
  id: string,
): Promise<Record<string, unknown> | null> {
  // Check cache first
  const cached = edgeCache.get<Record<string, unknown>>(id);
  if (cached) return cached;

  try {
    const row = await db.knowledgeGraphEdge.findUnique({ where: { id } });
    if (!row) return null;
    const data = row as unknown as Record<string, unknown>;
    edgeCache.set(id, data);
    return data;
  } catch (err) {
    logger.error('[ai-kg-db] readEdge failed', {
      id: id.slice(0, 12),
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Delete an edge from DB. */
export async function deleteEdge(id: string): Promise<boolean> {
  try {
    await db.knowledgeGraphEdge.delete({ where: { id } });
    edgeCache.delete(id);
    return true;
  } catch (err) {
    logger.error('[ai-kg-db] deleteEdge failed', {
      id: id.slice(0, 12),
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/** Find edges by source node ID. */
export async function getEdgesBySource(
  sourceId: string,
): Promise<Record<string, unknown>[]> {
  try {
    const rows = await db.knowledgeGraphEdge.findMany({
      where: { sourceId },
      orderBy: { createdAtMs: 'desc' },
    });
    return rows.map(r => r as unknown as Record<string, unknown>);
  } catch (err) {
    logger.error('[ai-kg-db] getEdgesBySource failed', {
      sourceId: sourceId.slice(0, 12),
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/** Find edges by target node ID. */
export async function getEdgesByTarget(
  targetId: string,
): Promise<Record<string, unknown>[]> {
  try {
    const rows = await db.knowledgeGraphEdge.findMany({
      where: { targetId },
      orderBy: { createdAtMs: 'desc' },
    });
    return rows.map(r => r as unknown as Record<string, unknown>);
  } catch (err) {
    logger.error('[ai-kg-db] getEdgesByTarget failed', {
      targetId: targetId.slice(0, 12),
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

/** Find edges by relationship type. */
export async function getEdgesByRelationship(
  relationship: string,
): Promise<Record<string, unknown>[]> {
  try {
    const rows = await db.knowledgeGraphEdge.findMany({
      where: { relationship: relationship as any },
      orderBy: { createdAtMs: 'desc' },
    });
    return rows.map(r => r as unknown as Record<string, unknown>);
  } catch (err) {
    logger.error('[ai-kg-db] getEdgesByRelationship failed', {
      relationship,
      error: err instanceof Error ? err.message : String(err),
    });
    return [];
  }
}

// ── Cold Start / Stats ─────────────────────────────────────────────

/**
 * Cold start: load recent nodes + edges from DB for in-memory cache warming.
 * Call once on module initialization (e.g. from ensureGraphLoaded).
 * Returns raw DB rows — caller is responsible for building in-memory indices.
 */
export async function warmCacheFromDb(
  limit: number = CACHE_MAX_ENTRIES,
): Promise<{ nodes: Record<string, unknown>[]; edges: Record<string, unknown>[] }> {
  try {
    const [nodeRows, edgeRows] = await Promise.all([
      db.knowledgeGraphNode.findMany({
        orderBy: { updatedAtMs: 'desc' },
        take: limit,
      }),
      db.knowledgeGraphEdge.findMany({
        orderBy: { createdAtMs: 'desc' },
        take: limit,
      }),
    ]);

    const nodes = nodeRows.map(r => r as unknown as Record<string, unknown>);
    const edges = edgeRows.map(r => r as unknown as Record<string, unknown>);

    // Populate LRU caches
    for (const n of nodes) nodeCache.set(n.id as string, n);
    for (const e of edges) edgeCache.set(e.id as string, e);

    logger.info('[P1.2] KG cache warmed from DB', {
      nodes: nodes.length,
      edges: edges.length,
    });

    return { nodes, edges };
  } catch (err) {
    logger.warn('[P1.2] KG cache warm-up failed (starting empty)', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { nodes: [], edges: [] };
  }
}

/** Get aggregate stats from DB. */
export async function getGraphStats(): Promise<{
  totalNodes: number;
  totalEdges: number;
}> {
  try {
    const [totalNodes, totalEdges] = await Promise.all([
      db.knowledgeGraphNode.count(),
      db.knowledgeGraphEdge.count(),
    ]);
    return { totalNodes, totalEdges };
  } catch (err) {
    logger.error('[ai-kg-db] getGraphStats failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { totalNodes: 0, totalEdges: 0 };
  }
}
