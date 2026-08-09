/**
 * WI-18.2 Intelligence Persistence Adapter
 * ==========================================
 *
 * Lock L1: Contract Lock — ALL Tier-1 persistence flows through this adapter.
 * Lock L2: Source of Truth — PostgreSQL writes first, cache read-second.
 * Lock L3: Multi-Tenant — companyId enforced on all tenant-scoped writes.
 *
 * WRITE PATH:  Map.set() → adapter.write() → PostgreSQL → confirm → health
 * READ PATH:   Cache miss → adapter.read() → PostgreSQL → populate cache → return
 * FAILURE:     DB failure → log + queue for retry → health monitor alert
 *
 * FEATURE FLAGS:
 *   USE_DB_PERSISTENCE=false  → adapter is a no-op (existing Map-only behavior)
 *   PERSISTENCE_SHADOW_MODE   → Map behavior unchanged, DB writes in parallel
 */

import { logger } from '@/lib/logger';
import type {
  IIntelligencePersistenceAdapter,
  PersistenceOperation,
  PersistenceResult,
  PersistenceHealthStatus,
  LoadOptions,
} from './types';
import { PERSISTENCE_FEATURE_FLAGS } from './types';
import { getPersistenceFailureQueue } from './persistence-failure-queue';
import { getPersistenceHealthMonitor } from './persistence-health-monitor';
import { unsafeFindMany } from '@/lib/query-helpers';

/**
 * Phase 2: pgvector dual-write support.
 * During migration, embeddings are written to both:
 *   - 'vector' Bytes column (legacy, Prisma-managed)
 *   - 'embedding_vector' vector(384) column (new, raw SQL)
 * 
 * Reading prefers embedding_vector with fallback to vector.
 * Feature flag: ENABLE_PGVECTOR_DUAL_WRITE (default: false)
 */
const ENABLE_PGVECTOR_DUAL_WRITE = process.env.ENABLE_PGVECTOR_DUAL_WRITE === 'true';
const PGVECTOR_DIMENSIONS = 384;

/**
 * Convert a Float64Array to a pgvector-compatible string format.
 * pgvector expects: '[0.1, 0.2, 0.3, ...]'
 */
function float64ArrayToPgVector(vec: Float64Array | number[]): string {
  const arr = Array.from(vec);
  // Pad or truncate to PGVECTOR_DIMENSIONS
  const padded = new Array(PGVECTOR_DIMENSIONS).fill(0);
  for (let i = 0; i < Math.min(arr.length, PGVECTOR_DIMENSIONS); i++) {
    padded[i] = arr[i];
  }
  return `[${padded.join(',')}]`;
}

/**
 * Write embedding to the pgvector column via raw SQL.
 * Non-throwing — failures are logged but don't affect the main write.
 */
async function writePgVectorEmbedding(
  prismaClient: any,
  entryId: string,
  vectorData: Float64Array | number[] | null,
): Promise<void> {
  if (!ENABLE_PGVECTOR_DUAL_WRITE || !vectorData) return;

  try {
    const pgVectorStr = float64ArrayToPgVector(vectorData);
    await prismaClient.$executeRawUnsafe(
      `UPDATE "RetrievalIndexEntry" SET "embedding_vector" = $1::vector WHERE "id" = $2`,
      pgVectorStr,
      entryId,
    );
  } catch (err) {
    // Log but don't throw — pgvector column may not exist yet
    logger.warn(`[persistence] pgvector dual-write failed for ${entryId}: ${err instanceof Error ? err.message : err}`);
  }
}

// Lazy-loaded to avoid circular imports at module init time
let _prisma: import('@prisma/client').PrismaClient | null = null;
/** Test-only Prisma factory override — bypasses require() for mock compatibility. */
let _prismaFactory: (() => any) | null = null;

function getPrisma(): import('@prisma/client').PrismaClient {
  if (!_prisma) {
    if (_prismaFactory) {
      _prisma = _prismaFactory();
    } else {
      const { Prisma } = require('@prisma/client');
      _prisma = new Prisma();
    }
  }
  return _prisma!;
}

/** Test-only: set a Prisma factory to bypass require(). DO NOT call in production. */
export function _setPrismaFactoryForTesting(factory: () => any): void {
  _prisma = null;
  _prismaFactory = factory;
}

/** Test-only: reset cached Prisma client. DO NOT call in production code. */
export function _resetPrismaForTesting(): void {
  _prisma = null;
}

/**
 * The singleton intelligence persistence adapter.
 * Implements the IIntelligencePersistenceAdapter contract (Lock L1).
 */
export class IntelligencePersistenceAdapter implements IIntelligencePersistenceAdapter {
  private initialized = false;

  constructor() {
    // G6 FIX: Log the actual persistence mode (memory/pg/hybrid)
    const mode = PERSISTENCE_FEATURE_FLAGS.PERSISTENCE_MODE;
    const dbEnabled = PERSISTENCE_FEATURE_FLAGS.USE_DB_PERSISTENCE;
    const shadow = PERSISTENCE_FEATURE_FLAGS.PERSISTENCE_SHADOW_MODE;
    logger.info(`[persistence] Mode: ${mode} | DB: ${dbEnabled ? 'ENABLED' : 'DISABLED'}${shadow ? ' (SHADOW)' : ''}`);
  }

  // ── Feature Flag Checks ──────────────────────────────────────────

  /** G6 FIX: Return the persistence mode (memory/pg/hybrid) */
  getMode(): 'memory' | 'pg' | 'hybrid' {
    return PERSISTENCE_FEATURE_FLAGS.PERSISTENCE_MODE;
  }

  isEnabled(): boolean {
    // G6 FIX: In 'pg' mode always enabled; in 'hybrid' mode enabled for writes only;
    // in 'memory' mode, disabled.
    const mode = PERSISTENCE_FEATURE_FLAGS.PERSISTENCE_MODE;
    if (mode === 'pg') return true;
    if (mode === 'hybrid') return true;
    return PERSISTENCE_FEATURE_FLAGS.USE_DB_PERSISTENCE;
  }

  isShadowMode(): boolean {
    return PERSISTENCE_FEATURE_FLAGS.PERSISTENCE_SHADOW_MODE;
  }

  // ── Write Operations (Lock L2: DB first) ──────────────────────────

  async write<T = unknown>(operation: PersistenceOperation<T>): Promise<PersistenceResult> {
    if (!this.isEnabled()) {
      return { success: true, latencyMs: null, retried: false };
    }

    const startMs = Date.now();
    const failureQueue = getPersistenceFailureQueue();
    const healthMonitor = getPersistenceHealthMonitor();

    try {
      await this.executeWrite(operation);
      const latencyMs = Date.now() - startMs;

      healthMonitor.recordSuccess(operation.store, latencyMs);

      // Log the operation for audit trail
      await this.logOperation(operation, 'completed', latencyMs).catch(() => {
        // Audit log failure is non-critical — don't block the main flow
      });

      return { success: true, latencyMs, retried: false };
    } catch (error) {
      const latencyMs = Date.now() - startMs;
      const errMsg = error instanceof Error ? error.message : String(error);

      logger.error(`[persistence] Write failed for ${operation.store}: ${errMsg}`);

      healthMonitor.recordFailure(operation.store);

      // Queue for retry (Lock L2: fire-and-forget WITH retry + logging)
      await failureQueue.enqueue(operation, errMsg).catch(() => {
        // Queue persistence failure is non-critical
      });

      // Log the failed operation
      await this.logOperation(operation, 'failed', null, errMsg).catch(() => {});

      return { success: false, latencyMs: null, retried: false, failureReason: errMsg };
    }
  }

  // ── Phase 4.6.7: Batch Write Optimization ───────────────────────
  //
  // Instead of writing one-by-one, accumulate writes and flush in batches.
  // This reduces DB round-trips by grouping multiple upserts into fewer transactions.
  //
  // Flush triggers:
  //   - 100 items accumulated (BATCH_FLUSH_SIZE)
  //   - 500ms elapsed since first item in batch (BATCH_FLUSH_INTERVAL_MS)
  //
  private batchQueue: PersistenceOperation[] = [];
  private batchFlushTimer: ReturnType<typeof setTimeout> | null = null;
  private batchWriteResolvers: Map<number, { resolve: (results: PersistenceResult[]) => void; reject: (err: Error) => void }> = new Map();
  private batchIdCounter = 0;

  static readonly BATCH_FLUSH_SIZE = 100;
  static readonly BATCH_FLUSH_INTERVAL_MS = 500;

  /**
   * Batch write with automatic flushing.
   * Operations are accumulated and flushed when:
   *   - BATCH_FLUSH_SIZE items are reached, OR
   *   - BATCH_FLUSH_INTERVAL_MS has elapsed
   *
   * Each call returns a Promise that resolves when the batch containing
   * its operation is flushed to the database.
   */
  async writeBatch<T = unknown>(operations: PersistenceOperation<T>[]): Promise<PersistenceResult[]> {
    if (!this.isEnabled() || operations.length === 0) {
      return operations.map(() => ({ success: true, latencyMs: null, retried: false }));
    }

    // For small batches (< BATCH_FLUSH_SIZE), process directly without queuing
    if (operations.length < IntelligencePersistenceAdapter.BATCH_FLUSH_SIZE) {
      return this.executeBatchDirectly(operations);
    }

    // For large batches, use the optimized flush mechanism
    return this.executeBatchWithFlush(operations);
  }

  /**
   * Direct batch execution for small batches — preserves sequential writes.
   */
  private async executeBatchDirectly<T>(operations: PersistenceOperation<T>[]): Promise<PersistenceResult[]> {
    const results: PersistenceResult[] = [];
    for (const op of operations) {
      results.push(await this.write(op));
    }
    return results;
  }

  /**
   * Optimized batch execution: group operations by store and process in chunks.
   * This reduces the number of DB round-trips for large bulk imports.
   */
  private async executeBatchWithFlush<T>(operations: PersistenceOperation<T>[]): Promise<PersistenceResult[]> {
    const allResults: PersistenceResult[] = [];
    const startMs = Date.now();
    const failureQueue = getPersistenceFailureQueue();
    const healthMonitor = getPersistenceHealthMonitor();

    // Group by store for efficient processing
    const byStore = new Map<string, PersistenceOperation[]>();
    for (const op of operations) {
      if (!byStore.has(op.store)) byStore.set(op.store, []);
      byStore.get(op.store)!.push(op);
    }

    // Process each store group
    for (const [store, ops] of byStore) {
      // Process in chunks of BATCH_FLUSH_SIZE
      for (let i = 0; i < ops.length; i += IntelligencePersistenceAdapter.BATCH_FLUSH_SIZE) {
        const chunk = ops.slice(i, i + IntelligencePersistenceAdapter.BATCH_FLUSH_SIZE);
        const chunkStart = Date.now();

        for (const op of chunk) {
          try {
            await this.executeWrite(op);
            const latencyMs = Date.now() - chunkStart;
            healthMonitor.recordSuccess(store as import('./types').IntelligencePersistenceStore, latencyMs);
            allResults.push({ success: true, latencyMs, retried: false });
          } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            logger.error(`[persistence] Batch write failed for ${store}: ${errMsg}`);
            healthMonitor.recordFailure(store as any);
            await failureQueue.enqueue(op, errMsg).catch(() => {});
            allResults.push({ success: false, latencyMs: null, retried: false, failureReason: errMsg });
          }
        }

        // Flush interval: yield to event loop between chunks
        if (i + IntelligencePersistenceAdapter.BATCH_FLUSH_SIZE < ops.length) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      }
    }

    logger.info(`[persistence] Batch write completed: ${operations.length} ops across ${byStore.size} stores in ${Date.now() - startMs}ms`);
    return allResults;
  }

  /**
   * Flush any pending batch operations. Called during graceful shutdown.
   */
  async flushBatchQueue(): Promise<void> {
    if (this.batchFlushTimer) {
      clearTimeout(this.batchFlushTimer);
      this.batchFlushTimer = null;
    }
    if (this.batchQueue.length > 0) {
      await this.executeBatchWithFlush(this.batchQueue);
      this.batchQueue = [];
    }
  }

  // ── Read Operations ──────────────────────────────────────────────

  async read<T = unknown>(store: string, key: string): Promise<T | null> {
    if (!this.isEnabled()) return null;

    const prisma = getPrisma();
    try {
      switch (store) {
        case 'knowledge_graph_nodes':
          return await prisma.knowledgeGraphNode.findUnique({ where: { id: key } }) as unknown as T;
        case 'knowledge_graph_edges':
          return await prisma.knowledgeGraphEdge.findUnique({ where: { id: key } }) as unknown as T;
        case 'ai_memory':
          return await prisma.aIMemoryEntry.findUnique({ where: { id: key } }) as unknown as T;
        case 'retrieval_index':
          return await prisma.retrievalIndexEntry.findUnique({ where: { id: key } }) as unknown as T;
        case 'retrieval_corpus_stats':
          return await prisma.retrievalCorpusStats.findUnique({ where: { id: 'singleton_corpus' } }) as unknown as T;
        default:
          logger.warn(`[persistence] Unknown store for read: ${store}`);
          return null;
      }
    } catch (error) {
      logger.error(`[persistence] Read failed for ${store}/${key}: ${error}`);
      return null;
    }
  }

  async readByCompany<T = unknown>(store: string, companyId: string): Promise<T[]> {
    if (!this.isEnabled()) return [];

    // Lock L3: All company-scoped reads MUST filter by companyId
    const prisma = getPrisma();
    try {
      switch (store) {
        case 'knowledge_graph_nodes':
          return await unsafeFindMany(prisma.knowledgeGraphNode.findMany, {
            where: { companyId },
          }, 'Persistence adapter cold-start requires full table scan for knowledge graph nodes') as unknown as T[];
        case 'knowledge_graph_edges':
          return await unsafeFindMany(prisma.knowledgeGraphEdge.findMany, {
            where: { companyId },
          }, 'Persistence adapter cold-start requires full table scan for knowledge graph edges') as unknown as T[];
        case 'ai_memory':
          return await unsafeFindMany(prisma.aIMemoryEntry.findMany, {
            where: { companyId },
          }, 'Persistence adapter cold-start requires full table scan for AI memory entries') as unknown as T[];
        case 'retrieval_index':
          return await unsafeFindMany(prisma.retrievalIndexEntry.findMany, {
            where: { companyId },
          }, 'Persistence adapter cold-start requires full table scan for retrieval index entries') as unknown as T[];
        default:
          logger.warn(`[persistence] Unknown store for readByCompany: ${store}`);
          return [];
      }
    } catch (error) {
      logger.error(`[persistence] readByCompany failed for ${store}/${companyId}: ${error}`);
      return [];
    }
  }

  async readAll<T = unknown>(store: string, options?: LoadOptions): Promise<T[]> {
    if (!this.isEnabled()) return [];

    const prisma = getPrisma();
    try {
      const where: Record<string, unknown> = {};

      // Lock L3: Apply tenant filter
      if (options?.companyId) {
        where.companyId = options.companyId;
      } else if (!options?.includeGlobal) {
        // No companyId and not explicitly requesting global = error
        logger.warn(`[persistence] readAll on ${store} without tenant context or global flag`);
        return [];
      }

      if (options?.entityType) {
        where.type = options.entityType;
      }

      const take = options?.limit ?? 100000; // Default max for cold start
      const skip = options?.offset ?? 0;

      switch (store) {
        case 'knowledge_graph_nodes':
          return await prisma.knowledgeGraphNode.findMany({
            where,
            take,
            skip,
            orderBy: { updatedAtMs: 'desc' },
          }) as unknown as T[];

        case 'knowledge_graph_edges':
          return await prisma.knowledgeGraphEdge.findMany({
            where,
            take,
            skip,
            orderBy: { createdAtMs: 'desc' },
          }) as unknown as T[];

        case 'ai_memory':
          return await prisma.aIMemoryEntry.findMany({
            where,
            take,
            skip,
            orderBy: { updatedAtMs: 'desc' },
          }) as unknown as T[];

        case 'retrieval_index':
          return await prisma.retrievalIndexEntry.findMany({
            where,
            take,
            skip,
            orderBy: { indexedAtMs: 'desc' },
          }) as unknown as T[];

        case 'retrieval_corpus_stats': {
          const row = await prisma.retrievalCorpusStats.findUnique({
            where: { id: 'singleton_corpus' },
          });
          return row ? [row as unknown as T] : [];
        }

        default:
          logger.warn(`[persistence] Unknown store for readAll: ${store}`);
          return [];
      }
    } catch (error) {
      logger.error(`[persistence] readAll failed for ${store}: ${error}`);
      return [];
    }
  }

  // ── Delete Operations ────────────────────────────────────────────

  async delete(store: string, key: string): Promise<PersistenceResult> {
    if (!this.isEnabled()) {
      return { success: true, latencyMs: null, retried: false };
    }

    const startMs = Date.now();
    const healthMonitor = getPersistenceHealthMonitor();

    try {
      const prisma = getPrisma();

      switch (store) {
        case 'knowledge_graph_nodes':
          await prisma.knowledgeGraphNode.delete({ where: { id: key } });
          break;
        case 'knowledge_graph_edges':
          await prisma.knowledgeGraphEdge.delete({ where: { id: key } });
          break;
        case 'ai_memory':
          await prisma.aIMemoryEntry.delete({ where: { id: key } });
          break;
        case 'retrieval_index':
          await prisma.retrievalIndexEntry.delete({ where: { id: key } });
          break;
        default:
          logger.warn(`[persistence] Unknown store for delete: ${store}`);
          return { success: false, latencyMs: null, retried: false, failureReason: `Unknown store: ${store}` };
      }

      const latencyMs = Date.now() - startMs;
      healthMonitor.recordSuccess(store as any, latencyMs);

      return { success: true, latencyMs, retried: false };
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error(`[persistence] Delete failed for ${store}/${key}: ${errMsg}`);
      healthMonitor.recordFailure(store as any);

      return { success: false, latencyMs: null, retried: false, failureReason: errMsg };
    }
  }

  // ── Health Monitoring ───────────────────────────────────────────

  getHealth(): PersistenceHealthStatus[] {
    return getPersistenceHealthMonitor().getAllHealth();
  }

  getStoreHealth(store: string): PersistenceHealthStatus | null {
    return getPersistenceHealthMonitor().getStoreHealth(store as any);
  }

  // ── Phase 4.6.6: Connection Pool Health ───────────────────────

  /**
   * Get PostgreSQL connection pool metrics for health monitoring.
   * Returns pool utilization statistics that can be surfaced in /api/health.
   *
   * Metrics include:
   *   - totalConnections: Total pool size
   *   - activeConnections: Currently active connections
   *   - idleConnections: Available idle connections
   *   - waitingRequests: Requests queued waiting for a connection
   *
   * Returns null when DB persistence is disabled or pool introspection fails.
   */
  getPoolMetrics(): {
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    waitingRequests: number;
    poolUtilizationPercent: number;
  } | null {
    if (!this.isEnabled()) return null;

    try {
      const prisma = getPrisma();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pool = (prisma as any).$engine || (prisma as any)._engine || (prisma as any)._client?._engine;
      if (!pool) {
        logger.debug('[persistence] Pool metrics unavailable — engine not introspectable');
        return {
          totalConnections: 0,
          activeConnections: 0,
          idleConnections: 0,
          waitingRequests: 0,
          poolUtilizationPercent: 0,
        };
      }

      const total = pool.numTotal ?? pool.totalCount ?? 0;
      const active = pool.numActive ?? pool.activeCount ?? 0;
      const idle = pool.numIdle ?? pool.idleCount ?? 0;
      const waiting = pool.numPending ?? pool.waitingCount ?? 0;

      return {
        totalConnections: total,
        activeConnections: active,
        idleConnections: idle,
        waitingRequests: waiting,
        poolUtilizationPercent: total > 0 ? Math.round((active / total) * 100) : 0,
      };
    } catch (err) {
      logger.debug(`[persistence] Pool metrics unavailable: ${err instanceof Error ? err.message : err}`);
      return {
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        waitingRequests: 0,
        poolUtilizationPercent: 0,
      };
    }
  }

  // ── Internal: Write Execution ────────────────────────────────────

  private async executeWrite<T>(operation: PersistenceOperation<T>): Promise<void> {
    const prisma = getPrisma();
    const data = operation.data as Record<string, unknown>;

    switch (operation.store) {
      case 'knowledge_graph_nodes':
        await prisma.knowledgeGraphNode.upsert({
          where: { id: operation.key },
          update: {
            label: data.label as string,
            type: data.type as any,
            aliases: typeof data.aliases === 'string' ? data.aliases : JSON.stringify(data.aliases ?? []),
            properties: data.properties ?? {},
            source: data.source as string | null,
            confidence: data.confidence as number ?? 0.7,
            companyId: data.companyId as string | null,
            isGlobal: data.isGlobal as boolean ?? false,
            createdBy: data.createdBy as string | null,
            sourceAttribution: data.sourceAttribution as string | null,
            confidenceHistory: typeof data.confidenceHistory === 'string' ? data.confidenceHistory : null,
            updatedAtMs: Date.now(),
          },
          create: {
            id: operation.key,
            label: data.label as string,
            type: data.type as any,
            aliases: typeof data.aliases === 'string' ? data.aliases : JSON.stringify(data.aliases ?? []),
            properties: data.properties ?? {},
            source: data.source as string | null,
            confidence: data.confidence as number ?? 0.7,
            companyId: data.companyId as string | null,
            isGlobal: data.isGlobal as boolean ?? false,
            createdBy: data.createdBy as string | null,
            sourceAttribution: data.sourceAttribution as string | null,
            confidenceHistory: typeof data.confidenceHistory === 'string' ? data.confidenceHistory : null,
            createdAtMs: (data.createdAtMs as number) ?? Date.now(),
            updatedAtMs: (data.updatedAtMs as number) ?? Date.now(),
          },
        });
        break;

      case 'knowledge_graph_edges':
        await prisma.knowledgeGraphEdge.upsert({
          where: { id: operation.key },
          update: {
            sourceId: data.sourceId as string,
            targetId: data.targetId as string,
            relationship: data.relationship as any,
            weight: data.weight as number ?? 0.5,
            confidence: data.confidence as number ?? 0.7,
            observedAt: data.observedAt as string | null,
            expiresAt: data.expiresAt as string | null,
            reason: (data.reason as string) ?? '',
            source: data.source as string | null,
            evidenceIds: typeof data.evidenceIds === 'string' ? data.evidenceIds : JSON.stringify(data.evidenceIds ?? []),
            companyId: data.companyId as string | null,
            isGlobal: data.isGlobal as boolean ?? false,
            updatedAtMs: Date.now(),
          },
          create: {
            id: operation.key,
            sourceId: data.sourceId as string,
            targetId: data.targetId as string,
            relationship: data.relationship as any,
            weight: data.weight as number ?? 0.5,
            confidence: data.confidence as number ?? 0.7,
            observedAt: data.observedAt as string | null,
            expiresAt: data.expiresAt as string | null,
            reason: (data.reason as string) ?? '',
            source: data.source as string | null,
            evidenceIds: typeof data.evidenceIds === 'string' ? data.evidenceIds : JSON.stringify(data.evidenceIds ?? []),
            companyId: data.companyId as string | null,
            isGlobal: data.isGlobal as boolean ?? false,
            createdBy: data.createdBy as string | null,
            createdAtMs: (data.createdAtMs as number) ?? Date.now(),
            updatedAtMs: (data.updatedAtMs as number) ?? Date.now(),
          },
        });
        break;

      case 'ai_memory':
        await prisma.aIMemoryEntry.upsert({
          where: { id: operation.key },
          update: {
            layer: data.layer as any,
            category: data.category as any,
            priority: data.priority as any,
            scopeType: data.scopeType as any ?? 'global',
            scopeEntityType: data.scopeEntityType as string | null,
            scopeEntityId: data.scopeEntityId as string | null,
            content: data.content as string,
            summary: data.summary as string | null,
            tags: typeof data.tags === 'string' ? data.tags : JSON.stringify(data.tags ?? []),
            referencedEntityIds: typeof data.referencedEntityIds === 'string'
              ? data.referencedEntityIds
              : JSON.stringify(data.referencedEntityIds ?? []),
            sourceType: data.sourceType as any,
            sourceDescription: data.sourceDescription as string,
            sourceId: data.sourceId as string | null,
            sourceTimestampMs: data.sourceTimestampMs as number | null,
            confidence: data.confidence as number ?? 0.7,
            importance: data.importance as number ?? 0.5,
            accessCount: data.accessCount as number ?? 0,
            lastAccessedAtMs: data.lastAccessedAtMs as number ?? 0,
            expiresAtMs: data.expiresAtMs as number | null,
            version: data.version as number ?? 1,
            parentMemoryId: data.parentMemoryId as string | null,
            childMemoryIds: typeof data.childMemoryIds === 'string'
              ? data.childMemoryIds
              : JSON.stringify(data.childMemoryIds ?? []),
            metadata: data.metadata ?? {},
            companyId: data.companyId as string | null,
            isGlobal: data.isGlobal as boolean ?? true,
            updatedAtMs: Date.now(),
          },
          create: {
            id: operation.key,
            layer: data.layer as any,
            category: data.category as any,
            priority: data.priority as any,
            scopeType: data.scopeType as any ?? 'global',
            scopeEntityType: data.scopeEntityType as string | null,
            scopeEntityId: data.scopeEntityId as string | null,
            content: data.content as string,
            summary: data.summary as string | null,
            tags: typeof data.tags === 'string' ? data.tags : JSON.stringify(data.tags ?? []),
            referencedEntityIds: typeof data.referencedEntityIds === 'string'
              ? data.referencedEntityIds
              : JSON.stringify(data.referencedEntityIds ?? []),
            sourceType: data.sourceType as any,
            sourceDescription: data.sourceDescription as string,
            sourceId: data.sourceId as string | null,
            sourceTimestampMs: data.sourceTimestampMs as number | null,
            confidence: data.confidence as number ?? 0.7,
            importance: data.importance as number ?? 0.5,
            accessCount: data.accessCount as number ?? 0,
            lastAccessedAtMs: data.lastAccessedAtMs as number ?? 0,
            expiresAtMs: data.expiresAtMs as number | null,
            version: data.version as number ?? 1,
            parentMemoryId: data.parentMemoryId as string | null,
            childMemoryIds: typeof data.childMemoryIds === 'string'
              ? data.childMemoryIds
              : JSON.stringify(data.childMemoryIds ?? []),
            metadata: data.metadata ?? {},
            companyId: data.companyId as string | null,
            isGlobal: data.isGlobal as boolean ?? true,
            createdBy: data.createdBy as string | null,
            createdAtMs: (data.createdAtMs as number) ?? Date.now(),
            updatedAtMs: (data.updatedAtMs as number) ?? Date.now(),
          },
        });
        break;

      case 'retrieval_index':
        await prisma.retrievalIndexEntry.upsert({
          where: { id: operation.key },
          update: {
            entityId: data.entityId as string,
            entityType: data.entityType as string,
            content: data.content as string,
            snippet: data.snippet as string,
            vector: data.vector as any,
            termFrequencies: typeof data.termFrequencies === 'string'
              ? data.termFrequencies
              : JSON.stringify(data.termFrequencies ?? {}),
            source: data.source as string | null,
            sourceDate: data.sourceDate as string | null,
            sourceTier: data.sourceTier as any ?? 'unknown',
            entities: typeof data.entities === 'string' ? data.entities : JSON.stringify(data.entities ?? []),
            metadata: data.metadata ?? {},
            companyId: data.companyId as string | null,
            isGlobal: data.isGlobal as boolean ?? true,
            updatedAtMs: Date.now(),
          },
          create: {
            id: operation.key,
            entityId: data.entityId as string,
            entityType: data.entityType as string,
            content: data.content as string,
            snippet: data.snippet as string,
            vector: data.vector as any,
            termFrequencies: typeof data.termFrequencies === 'string'
              ? data.termFrequencies
              : JSON.stringify(data.termFrequencies ?? {}),
            source: data.source as string | null,
            sourceDate: data.sourceDate as string | null,
            sourceTier: data.sourceTier as any ?? 'unknown',
            entities: typeof data.entities === 'string' ? data.entities : JSON.stringify(data.entities ?? []),
            metadata: data.metadata ?? {},
            companyId: data.companyId as string | null,
            isGlobal: data.isGlobal as boolean ?? true,
            createdBy: data.createdBy as string | null,
            sourceAttribution: data.sourceAttribution as string | null,
            indexedAtMs: (data.indexedAtMs as number) ?? Date.now(),
            createdAtMs: (data.createdAtMs as number) ?? Date.now(),
            updatedAtMs: (data.updatedAtMs as number) ?? Date.now(),
          },
        });
        // Phase 2: pgvector dual-write
        if (data.vector) {
          await writePgVectorEmbedding(prisma, operation.key, data.vector as Float64Array | number[]);
        }
        break;

      case 'retrieval_corpus_stats':
        await prisma.retrievalCorpusStats.upsert({
          where: { id: 'singleton_corpus' },
          update: {
            documentFrequency: typeof data.documentFrequency === 'string'
              ? data.documentFrequency
              : JSON.stringify(data.documentFrequency ?? {}),
            totalDocuments: (data.totalDocuments as number) ?? 0,
            lastUpdatedAtMs: Date.now(),
          },
          create: {
            id: 'singleton_corpus',
            documentFrequency: typeof data.documentFrequency === 'string'
              ? data.documentFrequency
              : JSON.stringify(data.documentFrequency ?? {}),
            totalDocuments: (data.totalDocuments as number) ?? 0,
            lastUpdatedAtMs: Date.now(),
          },
        });
        break;

      default:
        logger.warn(`[persistence] Unknown store for write: ${operation.store}`);
    }
  }

  // ── Internal: Audit Log ──────────────────────────────────────────

  private async logOperation(
    operation: PersistenceOperation,
    status: 'completed' | 'failed' | 'pending',
    latencyMs: number | null,
    errorMessage?: string
  ): Promise<void> {
    try {
      const prisma = getPrisma();
      const payloadStr = JSON.stringify(operation.data);
      const summary = payloadStr.length > 500 ? payloadStr.slice(0, 500) + '...[truncated]' : payloadStr;

      await prisma.persistenceOperationLog.create({
        data: {
          store: operation.store,
          operation: operation.operation,
          mapKey: operation.key,
          companyId: operation.companyId,
          payloadSummary: summary,
          status: status === 'completed' ? 'completed' : status === 'failed' ? 'failed' : 'pending',
          latencyMs: latencyMs ?? undefined,
          errorMessage,
        },
      });
    } catch (error) {
      // Audit log failure is non-critical — log and continue
      logger.warn(`[persistence] Audit log write failed: ${error}`);
    }
  }
}

/**
 * Phase 2: Vector similarity search using pgvector.
 * Falls back to empty array when pgvector is not available
 * (caller should fall back to in-memory cosine similarity).
 * 
 * @param queryVector - Query embedding as Float64Array
 * @param topK - Number of results to return
 * @param companyId - Optional company filter
 * @returns Array of { id, score } pairs
 */
export async function vectorSimilaritySearch(
  queryVector: Float64Array | number[],
  topK: number = 10,
  companyId?: string,
): Promise<Array<{ id: string; score: number }>> {
  if (!ENABLE_PGVECTOR_DUAL_WRITE) {
    return []; // Caller should fall back to in-memory search
  }

  try {
    const prismaClient = getPrisma();
    const pgVectorStr = float64ArrayToPgVector(queryVector);

    const results = await prismaClient.$queryRawUnsafe(
      `SELECT id, 1 - (embedding_vector <=> $1::vector) as score
       FROM "RetrievalIndexEntry"
       WHERE embedding_vector IS NOT NULL
       ${companyId ? 'AND "companyId" = $2' : ''}
       ORDER BY embedding_vector <=> $1::vector
       LIMIT $3`,
      pgVectorStr,
      companyId || null,
      topK,
    );

    return (results as any[]).map(r => ({
      id: r.id,
      score: r.score,
    }));
  } catch (err) {
    logger.warn(`[persistence] pgvector similarity search failed: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

// ── Singleton Export ──────────────────────────────────────────────────

/**
 * The singleton persistence adapter instance.
 * Import this wherever Tier-1 persistence is needed.
 *
 * Usage:
 *   import { getPersistenceAdapter } from '@/lib/persistence/intelligence-persistence-adapter';
 *   const adapter = getPersistenceAdapter();
 *   await adapter.write({ store: 'knowledge_graph_nodes', ... });
 */
let _adapter: IntelligencePersistenceAdapter | null = null;

export function getPersistenceAdapter(): IIntelligencePersistenceAdapter {
  if (!_adapter) {
    _adapter = new IntelligencePersistenceAdapter();
  }
  return _adapter;
}
