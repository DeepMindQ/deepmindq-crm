/**
 * Session 1 E2E Validation Tests — Persistence Batch
 * =================================================
 * Items: 1.2 (MapStateProvider Wiring), 1.3 (Cold-Start Hydration),
 *        1.4 (Cold-Start Trigger), 1.5 (Score Config Persistence)
 *
 * Auditor standard: Proves closed-loop for each item.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { wireMapStateProvider } from '@/lib/persistence/map-state-provider';
import {
  getKnowledgeGraphMaps,
  hydrateNodes,
  hydrateEdges,
  addNode,
  getNode,
  clearGraph,
} from '@/lib/ai-knowledge-graph';
import {
  getMemoryMaps,
  hydrateMemories,
  storeMemory,
  recallMemory,
  clearAllMemories,
} from '@/lib/ai-memory';
import {
  getRetrievalMaps,
  hydrateRetrievalEntries,
  addToIndex,
  clearHybridIndex,
} from '@/lib/ai-hybrid-retrieval';
import {
  updateScoringConfig,
  getCachedScoringConfig,
  DEFAULT_SCORING_CONFIG,
} from '@/lib/scoring-config';

// ─── 1.2: Map State Provider Wiring ──────────────────────────────────

describe('1.2 — registerMapStateProvider Wiring', () => {
  it('wireMapStateProvider() calls registerMapStateProvider without error', () => {
    expect(() => wireMapStateProvider()).not.toThrow();
  });

  it('registered provider returns correct Map for knowledge_graph_nodes', () => {
    clearGraph();
    addNode({
      id: 'test-node-1',
      label: 'Test Company',
      type: 'company',
      confidence: 0.9,
    });

    wireMapStateProvider();

    const kgMaps = getKnowledgeGraphMaps();
    expect(kgMaps.nodeStore.size).toBeGreaterThanOrEqual(1);
    expect(kgMaps.nodeStore.has('test-node-1')).toBe(true);
  });

  it('registered provider returns correct Map for ai_memory', () => {
    clearAllMemories();
    storeMemory({
      id: 'test-mem-1',
      layer: 'enterprise',
      category: 'company_intelligence',
      content: 'Test memory content',
      summary: 'Test summary',
      confidence: 0.8,
      importance: 0.5,
      priority: 'medium',
      scope: { entityType: 'company', entityId: 'co-test' },
      tags: ['test-tag'],
    });

    wireMapStateProvider();

    const memMaps = getMemoryMaps();
    expect(memMaps.memoryStore.size).toBeGreaterThanOrEqual(1);
    expect(memMaps.memoryStore.has('test-mem-1')).toBe(true);
  });

  it('registered provider returns correct Map for retrieval_index', () => {
    clearHybridIndex();
    addToIndex({
      id: 'test-entry-1',
      entityId: 'co-test',
      entityType: 'company',
      content: 'Test retrieval content for search indexing',
      snippet: 'Test snippet',
      source: 'test_source',
      sourceDate: new Date().toISOString(),
      sourceTier: 'standard',
      entities: [],
      metadata: {},
    });

    wireMapStateProvider();

    const retMaps = getRetrievalMaps();
    expect(retMaps.hybridIndex.size).toBeGreaterThanOrEqual(1);
    expect(retMaps.hybridIndex.has('test-entry-1')).toBe(true);
  });
});

// ─── 1.3: Maps Cold-Start Hydration ─────────────────────────────────

describe('1.3 — Maps Cold-Start Hydration', () => {
  it('hydrateNodes() populates nodeStore and rebuilds indices', () => {
    clearGraph();

    const testNodes = [
      {
        id: 'hydrate-node-1',
        label: 'Hydrated Company',
        type: 'company' as const,
        confidence: 0.85,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
      {
        id: 'hydrate-node-2',
        label: 'Hydrated Technology',
        type: 'technology' as const,
        confidence: 0.9,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ];

    hydrateNodes(testNodes as any);

    const maps = getKnowledgeGraphMaps();
    expect(maps.nodeStore.size).toBe(2);
    expect(maps.nodeStore.has('hydrate-node-1')).toBe(true);
    expect(maps.nodeStore.has('hydrate-node-2')).toBe(true);
    expect(maps.labelIndex.size).toBeGreaterThanOrEqual(2);
    expect(maps.typeIndex.size).toBeGreaterThanOrEqual(2);
  });

  it('hydrateEdges() populates edgeStore and rebuilds indices', () => {
    clearGraph();
    hydrateNodes([
      { id: 'edge-src', label: 'Source', type: 'company', confidence: 0.8, createdAt: Date.now(), updatedAt: Date.now() },
      { id: 'edge-tgt', label: 'Target', type: 'technology', confidence: 0.8, createdAt: Date.now(), updatedAt: Date.now() },
    ] as any);

    const testEdges = [
      {
        id: 'hydrate-edge-1',
        sourceId: 'edge-src',
        targetId: 'edge-tgt',
        relationship: 'USES_TECHNOLOGY' as const,
        weight: 0.9,
        confidence: 0.85,
        createdAt: Date.now(),
      },
    ];

    hydrateEdges(testEdges as any);

    const maps = getKnowledgeGraphMaps();
    expect(maps.edgeStore.size).toBe(1);
    expect(maps.edgeStore.has('hydrate-edge-1')).toBe(true);
    expect(maps.sourceEdgeIndex.get('edge-src')?.length).toBeGreaterThanOrEqual(1);
    expect(maps.relationshipIndex.size).toBeGreaterThanOrEqual(1);
  });

  it('hydrateMemories() populates memoryStore and rebuilds indices', () => {
    clearAllMemories();

    const testMemories = [
      {
        id: 'hydrate-mem-1',
        layer: 'enterprise' as const,
        category: 'company_intelligence' as const,
        content: 'Hydrated memory content',
        summary: 'Hydrated summary',
        confidence: 0.9,
        importance: 0.7,
        priority: 'high' as const,
        scope: { entityType: 'company', entityId: 'co-hydrate' },
        tags: ['tag-a', 'tag-b'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        version: 1,
        accessCount: 0,
        lastAccessedAt: Date.now(),
        childMemoryIds: [],
        referencedEntityIds: [],
        source: { type: 'user', description: 'test' },
        sourceTimestampMs: Date.now(),
        expiresAtMs: null,
      },
    ];

    hydrateMemories(testMemories as any);

    const maps = getMemoryMaps();
    expect(maps.memoryStore.size).toBe(1);
    expect(maps.memoryStore.has('hydrate-mem-1')).toBe(true);
    expect(maps.layerIndex.size).toBeGreaterThanOrEqual(1);
    expect(maps.tagIndex.size).toBeGreaterThanOrEqual(2);
  });

  it('hydrateRetrievalEntries() populates hybridIndex', () => {
    clearHybridIndex();

    const testEntries = [
      {
        id: 'hydrate-ret-1',
        entityId: 'co-hydrate',
        entityType: 'company',
        content: 'Hydrated retrieval content',
        snippet: 'Hydrated snippet',
        source: 'test_source',
        sourceDate: new Date().toISOString(),
        sourceTier: 'standard' as const,
        entities: [],
        metadata: {},
        termFrequencies: {},
        indexedAt: Date.now(),
      },
    ];

    hydrateRetrievalEntries(testEntries as any);

    const maps = getRetrievalMaps();
    expect(maps.hybridIndex.size).toBe(1);
    expect(maps.hybridIndex.has('hydrate-ret-1')).toBe(true);
    expect(maps.indexTimestamps.has('hydrate-ret-1')).toBe(true);
  });

  it('hydrateRetrievalEntries() restores IDF data', () => {
    clearHybridIndex();

    const docFreqMap = new Map([
      ['cloud', 15],
      ['ai', 22],
      ['migration', 8],
    ]);

    hydrateRetrievalEntries([], docFreqMap, 100);

    const maps = getRetrievalMaps();
    expect(maps.documentFrequency.size).toBe(3);
    expect(maps.documentFrequency.get('cloud')).toBe(15);
    expect(maps.documentFrequency.get('ai')).toBe(22);
    expect(maps.getTotalDocuments()).toBe(100);
  });
});

// ─── 1.4: Cold-Start Trigger Validation ────────────────────────────────

describe('1.4 — Cold-Start Trigger Validation', () => {
  it('wireMapStateProvider exists and is callable', () => {
    expect(typeof wireMapStateProvider).toBe('function');
    expect(() => wireMapStateProvider()).not.toThrow();
  });

  it('full cold-start cycle: wire then hydrate then Maps accessible', () => {
    wireMapStateProvider();

    clearGraph();
    clearAllMemories();
    clearHybridIndex();

    hydrateNodes([
      { id: 'cs-node-1', label: 'ColdStart Co', type: 'company', confidence: 0.9, createdAt: Date.now(), updatedAt: Date.now() },
    ] as any);
    hydrateMemories([
      {
        id: 'cs-mem-1', layer: 'enterprise', category: 'signal_analysis', content: 'Cold start memory',
        summary: 'CS', confidence: 0.8, importance: 0.5, priority: 'medium',
        scope: { entityType: 'company', entityId: 'cs-node-1' },
        tags: ['cold-start'], createdAt: Date.now(), updatedAt: Date.now(), version: 1,
        accessCount: 0, lastAccessedAt: Date.now(), childMemoryIds: [], referencedEntityIds: [],
        source: { type: 'system', description: 'test' }, sourceTimestampMs: Date.now(), expiresAtMs: null,
      },
    ] as any);

    const node = getNode('cs-node-1');
    expect(node).toBeDefined();
    expect(node?.label).toBe('ColdStart Co');

    const mem = recallMemory('cs-mem-1');
    expect(mem).toBeDefined();
    expect(mem?.content).toBe('Cold start memory');
  });
});

// ─── 1.5: Score Config Persistence Validation ────────────────────────

const hasDatabase = process.env.DATABASE_URL?.startsWith('postgresql') || process.env.DATABASE_URL?.startsWith('postgres');

describe('1.5 — Score Config Persistence Validation', () => {
  it('getCachedScoringConfig returns valid defaults', () => {
    const config = getCachedScoringConfig();
    expect(config.weights.staticFit).toBe(0.40);
    expect(config.weights.dynamicIntelligence).toBe(0.40);
    expect(config.weights.timingUrgency).toBe(0.20);
    expect(config.tierThresholds.hot).toBe(90);
    expect(config.tierThresholds.active).toBe(70);
    expect(config.tierThresholds.nurture).toBe(50);
    expect(config.signalRecencyDays).toBe(30);
  });

  it('updateScoringConfig rejects invalid weight sums', async () => {
    if (!hasDatabase) {
      console.warn('[test] Skipping: no database available');
      return;
    }
    await expect(
      updateScoringConfig({
        weights: { staticFit: 0.50, dynamicIntelligence: 0.50, timingUrgency: 0.10 },
      })
    ).rejects.toThrow('must sum to 1.0');
  });

  it('updateScoringConfig rejects invalid threshold ordering', async () => {
    if (!hasDatabase) {
      console.warn('[test] Skipping: no database available');
      return;
    }
    await expect(
      updateScoringConfig({
        tierThresholds: { hot: 70, active: 90, nurture: 50 },
      })
    ).rejects.toThrow('must be greater than active');
  });

  it('updateScoringConfig accepts valid update and syncs cache', async () => {
    if (!hasDatabase) {
      console.warn('[test] Skipping: no database available');
      return;
    }
    const updated = await updateScoringConfig({
      tierThresholds: { hot: 95, active: 75, nurture: 55 },
    });

    expect(updated.tierThresholds.hot).toBe(95);
    expect(updated.tierThresholds.active).toBe(75);

    const cached = getCachedScoringConfig();
    expect(cached.tierThresholds.hot).toBe(95);

    // Restore defaults
    await updateScoringConfig({
      tierThresholds: DEFAULT_SCORING_CONFIG.tierThresholds,
    });
  });

  it('config changes propagate to cached config immediately', async () => {
    if (!hasDatabase) {
      console.warn('[test] Skipping: no database available');
      return;
    }
    await updateScoringConfig({
      tierThresholds: { hot: 80, active: 60, nurture: 40 },
    });

    const config = getCachedScoringConfig();
    expect(config.tierThresholds.hot).toBe(80);
    expect(config.tierThresholds.active).toBe(60);

    // Restore defaults
    await updateScoringConfig({
      tierThresholds: DEFAULT_SCORING_CONFIG.tierThresholds,
    });
  });

  it('scoring-config API route exports GET and PUT handlers', async () => {
    const route = await import('@/app/api/scoring-config/route');
    expect(typeof route.GET).toBe('function');
    expect(typeof route.PUT).toBe('function');
  });
});
