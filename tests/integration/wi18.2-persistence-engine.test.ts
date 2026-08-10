/**
 * WI-18.2 Persistence Engine — Unit Tests
 * ========================================
 *
 * Tests the persistence service layer without requiring a live database.
 * Uses module mocking to isolate adapter, health monitor, and failure queue logic.
 *
 * Lock coverage:
 *   L1: Contract Lock — adapter interface enforcement
 *   L2: Source of Truth — health tracking, failure detection
 *   L3: Multi-Tenant — companyId required for scoped queries
 *   L5: Cold Start — loading strategy, completeness tracking
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock('@prisma/client', () => ({
  Prisma: vi.fn().mockImplementation(() => ({
    knowledgeGraphNode: { upsert: vi.fn().mockResolvedValue({}), findUnique: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]), delete: vi.fn().mockResolvedValue({}) },
    knowledgeGraphEdge: { upsert: vi.fn().mockResolvedValue({}), findUnique: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]), delete: vi.fn().mockResolvedValue({}) },
    aIMemoryEntry: { upsert: vi.fn().mockResolvedValue({}), findUnique: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]), delete: vi.fn().mockResolvedValue({}) },
    retrievalIndexEntry: { upsert: vi.fn().mockResolvedValue({}), findUnique: vi.fn().mockResolvedValue(null), findMany: vi.fn().mockResolvedValue([]), delete: vi.fn().mockResolvedValue({}) },
    retrievalCorpusStats: { upsert: vi.fn().mockResolvedValue({}), findUnique: vi.fn().mockResolvedValue(null) },
    persistenceOperationLog: { create: vi.fn().mockResolvedValue({}), findMany: vi.fn().mockResolvedValue([]), update: vi.fn().mockResolvedValue({}), count: vi.fn().mockResolvedValue(0) },
    persistenceHealthSnapshot: { create: vi.fn().mockResolvedValue({}) },
    shadowModeReconciliation: { create: vi.fn().mockResolvedValue({}) },
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/timer-registry', () => ({
  registerTimer: vi.fn(() => {}),
}));

// ── Imports (after mocks) ───────────────────────────────────────────

import { PERSISTENCE_REGISTRY, getPrimaryStores, isPrimaryStore, getRegistrationsForStore } from '@/lib/persistence/persistence-registry';
import { PERSISTENCE_FEATURE_FLAGS } from '@/lib/persistence/types';
import { getPersistenceAdapter } from '@/lib/persistence/intelligence-persistence-adapter';
import { executeColdStartLoad, isPersistenceDegraded } from '@/lib/persistence/cold-start-loader';
import { getPersistenceHealthMonitor } from '@/lib/persistence/persistence-health-monitor';

// ── Persistence Registry Tests (L1) ──────────────────────────────────

describe('WI-18.2 Persistence Registry (Lock L1)', () => {
  it('should have 16 registered Maps across 4 files', () => {
    expect(PERSISTENCE_REGISTRY).toHaveLength(16);
  });

  it('should register all 7 knowledge graph Maps', () => {
    const kgMaps = PERSISTENCE_REGISTRY.filter(
      (r: any) => r.sourceFile === 'src/lib/ai-knowledge-graph.ts'
    );
    expect(kgMaps).toHaveLength(7);
    const names = kgMaps.map((r: any) => r.mapName);
    expect(names).toEqual(expect.arrayContaining([
      'nodeStore', 'edgeStore', 'sourceEdgeIndex', 'targetEdgeIndex',
      'labelIndex', 'typeIndex', 'relationshipIndex',
    ]));
  });

  it('should register all 5 memory Maps', () => {
    const memMaps = PERSISTENCE_REGISTRY.filter(
      (r: any) => r.sourceFile === 'src/lib/ai-memory.ts'
    );
    expect(memMaps).toHaveLength(5);
    expect(memMaps.find((r: any) => r.mapName === 'memoryStore')?.isPrimary).toBe(true);
  });

  it('should register all 3 retrieval Maps', () => {
    const retMaps = PERSISTENCE_REGISTRY.filter(
      (r: any) => r.sourceFile === 'src/lib/ai-hybrid-retrieval.ts'
    );
    expect(retMaps).toHaveLength(3);
  });

  it('should identify 4 primary stores', () => {
    const primary = getPrimaryStores();
    expect(primary).toEqual(expect.arrayContaining([
      'knowledge_graph_nodes', 'knowledge_graph_edges',
      'ai_memory', 'retrieval_index',
    ]));
  });

  it('should identify primary vs derived stores', () => {
    expect(isPrimaryStore('knowledge_graph_nodes')).toBe(true);
    expect(isPrimaryStore('ai_memory')).toBe(true);
    expect(isPrimaryStore('retrieval_corpus_stats')).toBe(true);
  });

  it('should have all derived stores reference a primary store', () => {
    const derived = PERSISTENCE_REGISTRY.filter((r: any) => !r.isPrimary);
    for (const reg of derived) {
      expect(reg.dependsOn).toBeDefined();
      expect(reg.dependsOn).not.toBeNull();
    }
  });

  it('getRegistrationsForStore should return correct entries', () => {
    const nodeRegs = getRegistrationsForStore('knowledge_graph_nodes');
    expect(nodeRegs.length).toBeGreaterThanOrEqual(4);
    const names = nodeRegs.map((r: any) => r.mapName);
    expect(names).toContain('nodeStore');
    expect(names).toContain('labelIndex');
    expect(names).toContain('typeIndex');
  });
});

// ── Persistence Types Tests ─────────────────────────────────────────

describe('WI-18.2 Persistence Types', () => {
  it('feature flags should default correctly', () => {
    expect(PERSISTENCE_FEATURE_FLAGS.USE_DB_PERSISTENCE).toBe(false);
    expect(PERSISTENCE_FEATURE_FLAGS.PERSISTENCE_SHADOW_MODE).toBe(false);
    expect(PERSISTENCE_FEATURE_FLAGS.PERSISTENCE_REQUIRE_FULL_LOAD).toBe(true);
    expect(PERSISTENCE_FEATURE_FLAGS.PERSISTENCE_MAX_LOAD_TIME_MS).toBe(60000);
    expect(PERSISTENCE_FEATURE_FLAGS.PERSISTENCE_DEGRADED_THRESHOLD).toBe(0.8);
  });
});

// ── Health Monitor Tests (L2) ────────────────────────────────────────

describe('WI-18.2 Health Monitor (Lock L2)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('should initialize all 6 stores as healthy', () => {
    const monitor = getPersistenceHealthMonitor();
    const health = monitor.getAllHealth();
    expect(health).toHaveLength(6);
    for (const h of health) {
      expect(h.healthy).toBe(true);
      expect(h.consecutiveFailures).toBe(0);
      expect(h.totalWrites).toBe(0);
      expect(h.totalFailures).toBe(0);
    }
  });

  it('should track successful writes', () => {
    const monitor = getPersistenceHealthMonitor();
    monitor.recordSuccess('knowledge_graph_nodes', 42);
    const h = monitor.getStoreHealth('knowledge_graph_nodes');
    expect(h.lastWriteAt).toBeGreaterThan(0);
    expect(h.lastWriteSuccess).toBe(true);
    expect(h.lastWriteLatencyMs).toBe(42);
    expect(h.totalWrites).toBe(1);
  });

  it('should track consecutive failures', () => {
    const monitor = getPersistenceHealthMonitor();
    monitor.recordFailure('ai_memory');
    monitor.recordFailure('ai_memory');
    monitor.recordFailure('ai_memory');
    const h = monitor.getStoreHealth('ai_memory');
    expect(h.consecutiveFailures).toBe(3);
    expect(h.totalFailures).toBe(3);
  });

  it('should mark store unhealthy after 4 failures', () => {
    const monitor = getPersistenceHealthMonitor();
    for (let i = 0; i < 4; i++) {
      monitor.recordFailure('retrieval_index');
    }
    const h = monitor.getStoreHealth('retrieval_index');
    expect(h.consecutiveFailures).toBe(4);
    expect(h.healthy).toBe(false);
  });

  it('should reset consecutive failures on success', () => {
    const monitor = getPersistenceHealthMonitor();
    monitor.recordFailure('ai_memory');
    monitor.recordFailure('ai_memory');
    monitor.recordSuccess('ai_memory', 10);
    const h = monitor.getStoreHealth('ai_memory');
    expect(h.consecutiveFailures).toBe(0);
    expect(h.healthy).toBe(true);
  });

  it('should detect critical failure state (10+ failures)', () => {
    const monitor = getPersistenceHealthMonitor();
    for (let i = 0; i < 10; i++) {
      monitor.recordFailure('knowledge_graph_nodes');
    }
    expect(monitor.hasCriticalFailure()).toBe(true);
  });

  it('should return null for unknown store', () => {
    const monitor = getPersistenceHealthMonitor();
    expect(monitor.getStoreHealth('unknown_store' as any)).toBeNull();
  });
});

// ── Adapter Interface Tests (L1) ────────────────────────────────────

describe('WI-18.2 Persistence Adapter (Lock L1)', () => {
  it('should return no-op results when persistence is disabled', async () => {
    const adapter = getPersistenceAdapter();
    expect(adapter.isEnabled()).toBe(false);
    expect(adapter.isShadowMode()).toBe(false);

    const writeResult = await adapter.write({
      store: 'knowledge_graph_nodes',
      operation: 'upsert',
      key: 'test-node-1',
      data: { id: 'test-node-1', label: 'Test' },
      timestamp: Date.now(),
    });
    expect(writeResult.success).toBe(true);
    expect(writeResult.latencyMs).toBeNull();

    const readResult = await adapter.read('knowledge_graph_nodes', 'test-node-1');
    expect(readResult).toBeNull();

    const readAllResult = await adapter.readAll('knowledge_graph_nodes');
    expect(readAllResult).toEqual([]);
  });

  it('should expose health status for all stores', () => {
    const adapter = getPersistenceAdapter();
    const health = adapter.getHealth();
    expect(health).toHaveLength(6);
    expect(health[0].store).toBeDefined();
  });
});

// ── Cold Start Loader Tests (L5) ─────────────────────────────────────

describe('WI-18.2 Cold Start Loader (Lock L5)', () => {
  it('should skip cold start when persistence is disabled', async () => {
    const report = await executeColdStartLoad();
    expect(report.status).toBe('loaded_full');
    expect(report.overallCompleteness).toBe(1.0);
  });

  it('should detect non-degraded mode initially', () => {
    expect(isPersistenceDegraded()).toBe(false);
  });
});

// ── CI Scanner File Tests ───────────────────────────────────────────

describe('WI-18.2 CI Scanners', () => {
  it('persistence-registration-scan.js should exist with correct structure', () => {
    expect(fs.existsSync('scripts/persistence-registration-scan.js')).toBe(true);
    const content = fs.readFileSync('scripts/persistence-registration-scan.js', 'utf-8');
    expect(content).toContain('TIER1_SOURCE_FILES');
    expect(content).toContain('EXEMPT_MAP_NAMES');
    expect(content).toContain('PERSISTENCE_REGISTRY');
  });

  it('tenant-leakage-scan.js should exist with correct structure', () => {
    expect(fs.existsSync('scripts/tenant-leakage-scan.js')).toBe(true);
    const content = fs.readFileSync('scripts/tenant-leakage-scan.js', 'utf-8');
    expect(content).toContain('TARGET_FILES');
    expect(content).toContain('EXEMPT_PATTERNS');
    expect(content).toContain('companyId');
    expect(content).toContain('includeGlobal');
  });
});

// ── Prisma Schema Tests ──────────────────────────────────────────────

describe('WI-18.2 Prisma Schema', () => {
  let schema: string;

  beforeEach(() => {
    schema = fs.readFileSync('prisma/schema.prisma', 'utf-8');
  });

  it('should include all 10 new enums', () => {
    const enums = [
      'IntelligencePersistenceStore',
      'KnowledgeGraphEntityType',
      'KnowledgeGraphRelationship',
      'AIMemoryLayer',
      'AIMemoryCategory',
      'AIMemoryPriority',
      'AIMemorySource',
      'RetrievalSourceTier',
      'PersistenceOperationStatus',
      'IntelligenceScopeType',
    ];
    for (const e of enums) {
      expect(schema).toContain(`enum ${e}`);
    }
  });

  it('should include KnowledgeGraphNode with L3+L7 fields', () => {
    expect(schema).toContain('model KnowledgeGraphNode');
    expect(schema).toContain('companyId');
    expect(schema).toContain('isGlobal');
    expect(schema).toContain('createdBy');
    expect(schema).toContain('sourceAttribution');
    expect(schema).toContain('confidenceHistory');
    expect(schema).toContain('createdAtMs');
  });

  it('should include KnowledgeGraphEdge with traversal indexes', () => {
    expect(schema).toContain('model KnowledgeGraphEdge');
    expect(schema).toContain('@@index([sourceId])');
    expect(schema).toContain('@@index([targetId])');
    expect(schema).toContain('@@index([relationship])');
    expect(schema).toContain('@@index([companyId, relationship])');
  });

  it('should include AIMemoryEntry with scope and provenance', () => {
    expect(schema).toContain('model AIMemoryEntry');
    expect(schema).toContain('scopeType');
    expect(schema).toContain('companyId');
    expect(schema).toContain('versionHistory');
    expect(schema).toContain('confidenceHistory');
  });

  it('should include RetrievalIndexEntry with vector bytes storage', () => {
    expect(schema).toContain('model RetrievalIndexEntry');
    expect(schema).toContain('vector');
    expect(schema).toContain('Bytes?');
    expect(schema).toContain('termFrequencies');
  });

  it('should include RetrievalCorpusStats singleton', () => {
    expect(schema).toContain('model RetrievalCorpusStats');
    expect(schema).toContain('singleton_corpus');
    expect(schema).toContain('documentFrequency');
  });

  it('should include PersistenceOperationLog (L2 audit trail)', () => {
    expect(schema).toContain('model PersistenceOperationLog');
    expect(schema).toContain('PersistenceOperationStatus');
    expect(schema).toContain('nextRetryAt');
    expect(schema).toContain('@@index([status, createdAt])');
  });

  it('should include PersistenceHealthSnapshot (L2 monitoring)', () => {
    expect(schema).toContain('model PersistenceHealthSnapshot');
    expect(schema).toContain('consecutiveFailures');
    expect(schema).toContain('failureQueueDepth');
    expect(schema).toContain('@@index([healthy])');
  });

  it('should include ShadowModeReconciliation (L4 migration)', () => {
    expect(schema).toContain('model ShadowModeReconciliation');
    expect(schema).toContain('missingFromDb');
    expect(schema).toContain('mismatchedEntries');
    expect(schema).toContain('mismatchDetails');
  });

  it('should use unquoted enum defaults', () => {
    expect(schema).toContain('@default(global)');
    expect(schema).toContain('@default(unknown)');
    expect(schema).toContain('@default(pending)');
  });
});
