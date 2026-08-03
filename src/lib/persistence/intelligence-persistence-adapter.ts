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
class IntelligencePersistenceAdapter implements IIntelligencePersistenceAdapter {
  private initialized = false;

  constructor() {
    if (PERSISTENCE_FEATURE_FLAGS.USE_DB_PERSISTENCE) {
      logger.info('[persistence] DB persistence ENABLED' +
        (PERSISTENCE_FEATURE_FLAGS.PERSISTENCE_SHADOW_MODE ? ' (SHADOW MODE)' : ''));
    } else {
      logger.info('[persistence] DB persistence DISABLED — Map-only mode');
    }
  }

  // ── Feature Flag Checks ──────────────────────────────────────────

  isEnabled(): boolean {
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

  async writeBatch<T = unknown>(operations: PersistenceOperation<T>[]): Promise<PersistenceResult[]> {
    // Process writes sequentially to maintain ordering and avoid overwhelming DB
    const results: PersistenceResult[] = [];
    for (const op of operations) {
      results.push(await this.write(op));
    }
    return results;
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
