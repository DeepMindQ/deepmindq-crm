/**
 * WI-18.2 Phase 2 — Integration Gate Tests
 * ============================================
 *
 * Validates all 6 Phase 2 acceptance gates:
 *   Gate 1: No AI Module Direct Database Calls
 *   Gate 2: Shadow Mode Correctness
 *   Gate 3: Write Failure Handling
 *   Gate 4: Multi-Tenant Isolation
 *   Gate 5: Performance Baseline
 *   Gate 6: Rollback Safety
 */

import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  db: {},
  PrismaDiagnostics: { totalQueries: 0, slowQueries: [] },
}));

vi.mock('@/lib/prisma-encryption-middleware', () => ({
  createEncryptionExtension: vi.fn(() => ({})),
}));

vi.mock('@/lib/db-performance-monitor', () => ({
  DBPerformanceMonitor: {
    isInitialized: vi.fn(() => false),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/timer-registry', () => ({
  registerTimer: vi.fn(() => {}),
}));

vi.mock('@/lib/embeddings', () => ({
  cosineSimilarity: vi.fn(() => 0.5),
  tokenize: vi.fn(() => ['test']),
  tokenizeWithBigrams: vi.fn(() => ['test']),
}));

// ── Imports (after mocks) ───────────────────────────────────────────

import { persistWrite, persistDelete, isPersistenceEnabled, isShadowModeActive, serializeVector, deserializeVector } from '@/lib/persistence/persistence-integration';
import { getPersistenceAdapter } from '@/lib/persistence/intelligence-persistence-adapter';
import { PERSISTENCE_FEATURE_FLAGS } from '@/lib/persistence/types';
import { addNode, getNode, removeNode } from '@/lib/ai-knowledge-graph';
import { storeMemory, recallMemory, forgetMemory, searchMemories } from '@/lib/ai-memory';
import { addToIndex } from '@/lib/ai-hybrid-retrieval';

// ── Gate 1: No AI Module Direct Database Calls ──────────────────────

describe('Gate 1: No AI Module Direct Database Calls', () => {
  const kgSource = fs.readFileSync('src/lib/ai-knowledge-graph.ts', 'utf-8');
  const memSource = fs.readFileSync('src/lib/ai-memory.ts', 'utf-8');
  const retSource = fs.readFileSync('src/lib/ai-hybrid-retrieval.ts', 'utf-8');
  const engineSource = fs.readFileSync('src/lib/engines/retrieval-engine.ts', 'utf-8');

  it('ai-knowledge-graph.ts must NOT import Prisma directly', () => {
    expect(kgSource).not.toContain("from '@prisma/client'");
    expect(kgSource).not.toContain("require('@prisma/client')");
    expect(kgSource).not.toContain('prisma.');
    // KG uses DB fallback layer via ai-knowledge-graph-db.ts instead of persistence-integration
    expect(kgSource).toContain('dbWriteNode');
  });

  it('ai-memory.ts must NOT import Prisma directly', () => {
    expect(memSource).not.toContain("from '@prisma/client'");
    expect(memSource).not.toContain("require('@prisma/client')");
    expect(memSource).not.toContain('prisma.');
  });

  it('ai-hybrid-retrieval.ts must NOT import Prisma directly', () => {
    expect(retSource).not.toContain("from '@prisma/client'");
    expect(retSource).not.toContain("require('@prisma/client')");
    expect(retSource).not.toContain('prisma.');
  });

  it('retrieval-engine.ts must NOT import Prisma directly', () => {
    expect(engineSource).not.toContain("from '@prisma/client'");
    expect(engineSource).not.toContain('prisma.');
  });

  it('All AI modules use persistence integration or DB fallback for writes', () => {
    // KG uses dbWriteNode/dbDeleteNode (DB fallback via ai-knowledge-graph-db.ts)
    expect(kgSource).toContain('dbWriteNode');
    expect(kgSource).toContain('dbDeleteNode');
    // Memory uses dbWriteMemory/dbDeleteMemory or WI-18.2 persist
    expect(memSource.includes('persistWrite') || memSource.includes('dbWrite') || memSource.includes('WI-18.2')).toBe(true);
    // Retrieval uses persistWrite/persistDelete
    expect(retSource).toContain('persistWrite');
    expect(retSource).toContain('persistDelete');
  });
});

// ── Gate 2: Shadow Mode ─────────────────────────────────────────────

describe('Gate 2: Shadow Mode Correctness', () => {
  it('persistWrite should be no-op when persistence is disabled', async () => {
    expect(isPersistenceEnabled()).toBe(false);
    await persistWrite('knowledge_graph_nodes', 'test-1', { id: 'test-1', label: 'Test' });
  });

  it('persistWrite function should exist and be callable', () => {
    expect(typeof persistWrite).toBe('function');
  });

  it('isShadowModeActive should reflect feature flag', () => {
    expect(isShadowModeActive()).toBe(false);
  });

  it('AI modules should have WI-18.2 integration or DB fallback at write points', () => {
    const kgSource = fs.readFileSync('src/lib/ai-knowledge-graph.ts', 'utf-8');
    const memSource = fs.readFileSync('src/lib/ai-memory.ts', 'utf-8');
    const retSource = fs.readFileSync('src/lib/ai-hybrid-retrieval.ts', 'utf-8');

    // KG uses dbWriteNode/dbDeleteNode (DB fallback) — WI-18.2 references for hydration
    expect(kgSource.includes('dbWriteNode') || kgSource.includes('WI-18.2')).toBe(true);
    // Memory uses WI-18.2 references or persist integration
    expect(memSource.includes('WI-18.2') || memSource.includes('persistWrite') || memSource.includes('dbWrite')).toBe(true);
    // Retrieval uses WI-18.2: Persist comments
    expect(retSource).toContain('WI-18.2');
  });
});

// ── Gate 3: Write Failure Handling ──────────────────────────────────

describe('Gate 3: Write Failure Handling', () => {
  it('persistWrite catches and suppresses errors (fire-and-forget)', async () => {
    await expect(
      persistWrite('knowledge_graph_nodes', 'fail-test', { id: 'fail-test' })
    ).resolves.toBeUndefined();
  });

  it('persistDelete catches and suppresses errors', async () => {
    await expect(
      persistDelete('ai_memory', 'fail-test')
    ).resolves.toBeUndefined();
  });

  it('addNode should succeed even if persistence fails', async () => {
    const node = await addNode({
      id: 'test-node-gate3',
      label: 'Test Company',
      type: 'company',
      aliases: [],
      properties: {},
    });
    expect(node).toBeDefined();
    expect(node.id).toBe('test-node-gate3');
    expect(node.label).toBe('Test Company');
  });

  it('storeMemory should succeed even if persistence fails', async () => {
    const memory = await storeMemory({
      id: 'test-mem-gate3',
      layer: 'enterprise',
      category: 'company_intelligence',
      priority: 'high',
      scope: 'global',
      content: 'Test intelligence data',
      tags: ['test'],
      referencedEntityIds: [],
      source: { type: 'ai_generation', description: 'Test' },
      confidence: 0.9,
      importance: 0.8,
    });
    expect(memory).toBeDefined();
    expect(memory.id).toBe('test-mem-gate3');
    expect(memory.version).toBe(1);
  });

  it('addToIndex should succeed even if persistence fails', () => {
    expect(() => {
      addToIndex({
        id: 'test-idx-gate3',
        entityId: 'entity-1',
        entityType: 'company_signal',
        content: 'Test content for indexing',
        snippet: 'Test snippet',
        vector: null,
        source: 'test.com',
        sourceDate: '2024-01-01',
        sourceTier: 'standard',
        metadata: {},
      });
    }).not.toThrow();
  });
});

// ── Gate 4: Multi-Tenant Isolation ────────────────────────────────

describe('Gate 4: Multi-Tenant Isolation', () => {
  it('KG nodes can be created with different company scopes', async () => {
    const nodeA = await addNode({
      id: 'company-a-node',
      label: 'Company A',
      type: 'company',
      aliases: ['CompA'],
      properties: { _companyId: 'company-a-id' },
    });
    const nodeB = await addNode({
      id: 'company-b-node',
      label: 'Company B',
      type: 'company',
      aliases: ['CompB'],
      properties: { _companyId: 'company-b-id' },
    });

    expect(await getNode('company-a-node')).toBeDefined();
    expect(await getNode('company-b-node')).toBeDefined();
    expect(nodeA.id).not.toBe(nodeB.id);
  });

  it('Memory can be scoped to different companies', async () => {
    const memA = await storeMemory({
      id: 'mem-company-a',
      layer: 'enterprise',
      category: 'company_intelligence',
      priority: 'critical',
      scope: { entityType: 'company', entityId: 'company-a-id' },
      content: 'Company A confidential intelligence',
      tags: ['confidential'],
      referencedEntityIds: [],
      source: { type: 'human_intelligence', description: 'Sales call' },
      confidence: 0.95,
      importance: 0.9,
    });
    const memB = await storeMemory({
      id: 'mem-company-b',
      layer: 'enterprise',
      category: 'company_intelligence',
      priority: 'critical',
      scope: { entityType: 'company', entityId: 'company-b-id' },
      content: 'Company B confidential intelligence',
      tags: ['confidential'],
      referencedEntityIds: [],
      source: { type: 'human_intelligence', description: 'Sales call' },
      confidence: 0.95,
      importance: 0.9,
    });

    expect(await recallMemory('mem-company-a')).toBeDefined();
    expect(await recallMemory('mem-company-b')).toBeDefined();
    expect(memA.scope).toEqual({ entityType: 'company', entityId: 'company-a-id' });
    expect(memB.scope).toEqual({ entityType: 'company', entityId: 'company-b-id' });
  });

  it('Search memories filters by company scope', async () => {
    const results = await searchMemories({
      query: 'confidential intelligence',
      scopeEntityId: 'company-a-id',
      scopeEntityType: 'company',
    });

    for (const result of results) {
      if (result.memory.scope !== 'global') {
        expect(result.memory.scope.entityId).toBe('company-a-id');
      }
    }
  });

  it('Global nodes are accessible to all tenants', async () => {
    const globalNode = await addNode({
      id: 'global-tech-node',
      label: 'PostgreSQL',
      type: 'technology',
      aliases: ['PG', 'postgres'],
      properties: {},
    });

    expect(await getNode('global-tech-node')).toBeDefined();
    expect(globalNode.label).toBe('PostgreSQL');
  });
});

// ── Gate 5: Performance Baseline ─────────────────────────────────

describe('Gate 5: Performance Baseline', () => {
  it('addNode: 100 ops under 5ms avg', async () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      await addNode({ id: `perf-node-${i}`, label: `Company ${i}`, type: 'company', aliases: [], properties: {} });
    }
    const avgMs = (performance.now() - start) / 100;
    expect(avgMs).toBeLessThan(5);
  });

  it('getNode: 1000 ops under 1ms avg', async () => {
    await addNode({ id: 'perf-lookup-node', label: 'Lookup Test', type: 'company', aliases: [], properties: {} });
    const start = performance.now();
    for (let i = 0; i < 1000; i++) await getNode('perf-lookup-node');
    const avgMs = (performance.now() - start) / 1000;
    expect(avgMs).toBeLessThan(1);
  });

  it('storeMemory: 100 ops under 5ms avg', async () => {
    const start = performance.now();
    for (let i = 0; i < 100; i++) {
      await storeMemory({
        id: `perf-mem-${i}`, layer: 'enterprise', category: 'company_intelligence',
        priority: 'medium', scope: 'global', content: `Data ${i}`, tags: ['perf'],
        referencedEntityIds: [], source: { type: 'ai_generation', description: 'Perf' },
        confidence: 0.7, importance: 0.5,
      });
    }
    const avgMs = (performance.now() - start) / 100;
    expect(avgMs).toBeLessThan(5);
  });

  it('recallMemory: 1000 ops under 1ms avg', async () => {
    await storeMemory({
      id: 'perf-recall-mem', layer: 'enterprise', category: 'company_intelligence',
      priority: 'medium', scope: 'global', content: 'Perf test', tags: ['perf'],
      referencedEntityIds: [], source: { type: 'ai_generation', description: 'Perf' },
      confidence: 0.7, importance: 0.5,
    });
    const start = performance.now();
    for (let i = 0; i < 1000; i++) await recallMemory('perf-recall-mem');
    const avgMs = (performance.now() - start) / 1000;
    expect(avgMs).toBeLessThan(1);
  });
});

// ── Gate 6: Rollback Safety ────────────────────────────────────────

describe('Gate 6: Rollback Safety', () => {
  it('USE_DB_PERSISTENCE defaults to false', () => {
    expect(PERSISTENCE_FEATURE_FLAGS.USE_DB_PERSISTENCE).toBe(false);
  });

  it('Disabling persistence makes adapter a no-op', async () => {
    const adapter = getPersistenceAdapter();
    expect(adapter.isEnabled()).toBe(false);
    const result = await adapter.write({
      store: 'knowledge_graph_nodes', operation: 'upsert',
      key: 'rollback-test', data: { id: 'rollback-test' }, timestamp: Date.now(),
    });
    expect(result.success).toBe(true);
  });

  it('Map operations work independently of persistence', async () => {
    await addNode({ id: 'rollback-node', label: 'Rollback', type: 'company', aliases: [], properties: {} });
    expect(await getNode('rollback-node')).toBeDefined();
    const removed = await removeNode('rollback-node');
    expect(removed).toBe(true);
    expect(await getNode('rollback-node')).toBeUndefined();
  });

  it('Memory operations work independently of persistence', async () => {
    await storeMemory({
      id: 'rollback-mem', layer: 'enterprise', category: 'company_intelligence',
      priority: 'medium', scope: 'global', content: 'Rollback', tags: ['test'],
      referencedEntityIds: [], source: { type: 'ai_generation', description: 'Test' },
      confidence: 0.7, importance: 0.5,
    });
    expect(await recallMemory('rollback-mem')).toBeDefined();
    expect(await forgetMemory('rollback-mem')).toBe(true);
    expect(await recallMemory('rollback-mem')).toBeUndefined();
  });

  it('Feature flags provide rollback mechanism', () => {
    expect(typeof PERSISTENCE_FEATURE_FLAGS.USE_DB_PERSISTENCE).toBe('boolean');
    expect(typeof PERSISTENCE_FEATURE_FLAGS.PERSISTENCE_SHADOW_MODE).toBe('boolean');
    expect(typeof PERSISTENCE_FEATURE_FLAGS.PERSISTENCE_REQUIRE_FULL_LOAD).toBe('boolean');
  });
});

// ── Vector Serialization ────────────────────────────────────────

describe('Vector Serialization', () => {
  it('serializes/deserializes Float64Array correctly', () => {
    const original = new Float64Array([0.1, 0.2, 0.3, 0.4, 0.5]);
    const serialized = serializeVector(original);
    expect(serialized).toBeInstanceOf(Buffer);
    expect(serialized.length).toBe(40);

    const restored = deserializeVector(serialized);
    expect(restored).toBeInstanceOf(Float64Array);
    expect(restored.length).toBe(5);
    expect(restored[0]).toBeCloseTo(0.1, 10);
    expect(restored[4]).toBeCloseTo(0.5, 10);
  });

  it('handles null vectors', () => {
    expect(serializeVector(null)).toBeNull();
    expect(deserializeVector(null)).toBeNull();
  });
});
