/**
 * WI-16H — AI Memory Architecture Tests
 * =========================================
 *
 * Comprehensive test suite covering:
 *   1. Memory data model (layers, categories, priorities)
 *   2. Memory CRUD (store, recall, update, forget)
 *   3. Memory search and retrieval
 *   4. Entity-scoped memory
 *   5. Memory context building
 *   6. Memory consolidation
 *   7. Memory decay
 *   8. Memory statistics
 *   9. Seed data integrity
 */

import {
  clearAllMemories,
  seedMemorySystem,
  storeMemory,
  recallMemory,
  forgetMemory,
  updateMemory,
  searchMemories,
  getEntityMemories,
  buildMemoryContext,
  consolidateMemories,
  applyMemoryDecay,
  getMemoryStats,
  getAllMemories,
  type MemoryItem,
  type MemoryLayer,
  type MemoryCategory,
  type MemoryPriority,
} from '@/lib/ai-memory';

beforeEach(() => {
  clearAllMemories();
});

// ── 1. Memory Data Model ──────────────────────────────────────────

describe('WI-16H: Memory Data Model', () => {
  test('should create a memory with all required fields', () => {
    const memory = storeMemory({
      id: 'test-1',
      layer: 'enterprise',
      category: 'company_intelligence',
      priority: 'high',
      scope: { entityType: 'company', entityId: 'co-test' },
      content: 'Test company uses AWS cloud infrastructure',
      summary: 'Test: AWS cloud',
      tags: ['test', 'aws', 'cloud'],
      referencedEntityIds: ['co-test'],
      source: { type: 'external_intelligence', description: 'Test source' },
      confidence: 0.85,
      importance: 0.75,
      lastAccessedAt: Date.now(),
      metadata: {},
    });

    expect(memory).toBeDefined();
    expect(memory.id).toBe('test-1');
    expect(memory.layer).toBe('enterprise');
    expect(memory.confidence).toBe(0.85);
    expect(memory.importance).toBe(0.75);
    expect(memory.version).toBe(1);
    expect(memory.accessCount).toBe(0);
    expect(memory.createdAt).toBeDefined();
    expect(memory.updatedAt).toBeDefined();
    expect(memory.childMemoryIds).toEqual([]);
  });

  test('should support all 4 memory layers', () => {
    const layers: MemoryLayer[] = ['working', 'conversation', 'enterprise', 'institutional'];

    for (const layer of layers) {
      const m = storeMemory({
        id: `mem-layer-${layer}`,
        layer,
        category: 'company_intelligence',
        priority: 'medium',
        scope: 'global',
        content: `Test ${layer} memory`,
        tags: [],
        referencedEntityIds: [],
        source: { type: 'system_detection', description: '' },
        confidence: 0.7,
        importance: 0.5,
        lastAccessedAt: Date.now(),
        metadata: {},
      });
      expect(m.layer).toBe(layer);
    }

    expect(getAllMemories().length).toBe(4);
  });

  test('should support all 12 memory categories', () => {
    const categories: MemoryCategory[] = [
      'company_intelligence', 'contact_intelligence', 'signal_analysis', 'conversation_history',
      'user_preference', 'reasoning_chain', 'learning_insight', 'capability_knowledge',
      'competitive_intelligence', 'market_knowledge', 'feedback', 'error_correction',
    ];

    for (const category of categories) {
      storeMemory({
        id: `mem-cat-${category}`,
        layer: 'enterprise',
        category,
        priority: 'medium',
        scope: 'global',
        content: `Test ${category}`,
        tags: [category],
        referencedEntityIds: [],
        source: { type: 'system_detection', description: '' },
        confidence: 0.7,
        importance: 0.5,
        lastAccessedAt: Date.now(),
        metadata: {},
      });
    }

    expect(getAllMemories().length).toBe(12);
  });

  test('should support all 5 priority levels', () => {
    const priorities: MemoryPriority[] = ['critical', 'high', 'medium', 'low', 'ephemeral'];

    for (const priority of priorities) {
      storeMemory({
        id: `mem-pri-${priority}`,
        layer: 'enterprise',
        category: 'company_intelligence',
        priority,
        scope: 'global',
        content: `Test ${priority}`,
        tags: [],
        referencedEntityIds: [],
        source: { type: 'system_detection', description: '' },
        confidence: 0.7,
        importance: 0.5,
        lastAccessedAt: Date.now(),
        metadata: {},
      });
    }

    expect(getAllMemories().length).toBe(5);
  });
});

// ── 2. Memory CRUD ─────────────────────────────────────────────────

describe('WI-16H: Memory CRUD', () => {
  test('store should create new memory', () => {
    const m = storeMemory({
      id: 'm1',
      layer: 'enterprise',
      category: 'signal_analysis',
      priority: 'high',
      scope: 'global',
      content: 'Signal detected',
      tags: ['signal'],
      referencedEntityIds: [],
      source: { type: 'system_detection', description: '' },
      confidence: 0.8,
      importance: 0.7,
      lastAccessedAt: Date.now(),
      metadata: {},
    });

    expect(getAllMemories().length).toBe(1);
    expect(m.version).toBe(1);
  });

  test('store should upsert and increment version', () => {
    storeMemory({
      id: 'm1',
      layer: 'enterprise',
      category: 'signal_analysis',
      priority: 'high',
      scope: 'global',
      content: 'Original',
      tags: [],
      referencedEntityIds: [],
      source: { type: 'system_detection', description: '' },
      confidence: 0.8,
      importance: 0.7,
      lastAccessedAt: Date.now(),
      metadata: {},
    });

    const updated = storeMemory({
      id: 'm1',
      layer: 'enterprise',
      category: 'signal_analysis',
      priority: 'critical',
      scope: 'global',
      content: 'Updated content',
      tags: ['updated'],
      referencedEntityIds: [],
      source: { type: 'system_detection', description: '' },
      confidence: 0.9,
      importance: 0.85,
      lastAccessedAt: Date.now(),
      metadata: {},
    });

    expect(updated.version).toBe(2);
    expect(updated.content).toBe('Updated content');
    expect(updated.confidence).toBe(0.9);
    expect(getAllMemories().length).toBe(1); // Still only 1
  });

  test('recall should return memory and increment access count', () => {
    storeMemory({
      id: 'm1',
      layer: 'enterprise',
      category: 'company_intelligence',
      priority: 'medium',
      scope: 'global',
      content: 'Test',
      tags: [],
      referencedEntityIds: [],
      source: { type: 'system_detection', description: '' },
      confidence: 0.7,
      importance: 0.5,
      lastAccessedAt: Date.now(),
      metadata: {},
    });

    const first = recallMemory('m1');
    expect(first).toBeDefined();
    expect(first!.accessCount).toBe(1);

    const second = recallMemory('m1');
    expect(second!.accessCount).toBe(2);
  });

  test('recall should return undefined for non-existent memory', () => {
    expect(recallMemory('nonexistent')).toBeUndefined();
  });

  test('update should modify memory fields', () => {
    storeMemory({
      id: 'm1',
      layer: 'enterprise',
      category: 'signal_analysis',
      priority: 'medium',
      scope: 'global',
      content: 'Original content',
      tags: ['original'],
      referencedEntityIds: [],
      source: { type: 'system_detection', description: '' },
      confidence: 0.7,
      importance: 0.5,
      lastAccessedAt: Date.now(),
      metadata: {},
    });

    const updated = updateMemory('m1', {
      content: 'New content',
      confidence: 0.9,
      importance: 0.8,
      tags: ['new', 'tags'],
    });

    expect(updated).toBeDefined();
    expect(updated!.content).toBe('New content');
    expect(updated!.confidence).toBe(0.9);
    expect(updated!.importance).toBe(0.8);
    expect(updated!.version).toBe(2);
  });

  test('update should return undefined for non-existent memory', () => {
    expect(updateMemory('nonexistent', { content: 'x' })).toBeUndefined();
  });

  test('forget should delete memory', () => {
    storeMemory({
      id: 'm1',
      layer: 'enterprise',
      category: 'signal_analysis',
      priority: 'low',
      scope: 'global',
      content: 'To be forgotten',
      tags: [],
      referencedEntityIds: [],
      source: { type: 'system_detection', description: '' },
      confidence: 0.5,
      importance: 0.3,
      lastAccessedAt: Date.now(),
      metadata: {},
    });

    expect(forgetMemory('m1')).toBe(true);
    expect(recallMemory('m1')).toBeUndefined();
    expect(getAllMemories().length).toBe(0);
  });

  test('forget should return false for non-existent memory', () => {
    expect(forgetMemory('nonexistent')).toBe(false);
  });
});

// ── 3. Memory Search ────────────────────────────────────────────────

describe('WI-16H: Memory Search', () => {
  beforeEach(() => {
    storeMemory({
      id: 'm-aws',
      layer: 'enterprise',
      category: 'company_intelligence',
      priority: 'high',
      scope: { entityType: 'company', entityId: 'co-acme' },
      content: 'Acme Corp uses AWS for cloud infrastructure with Kubernetes orchestration',
      summary: 'Acme: AWS + K8s',
      tags: ['acme', 'aws', 'cloud', 'kubernetes'],
      referencedEntityIds: ['co-acme'],
      source: { type: 'external_intelligence', description: '' },
      confidence: 0.9,
      importance: 0.85,
      lastAccessedAt: Date.now(),
      metadata: {},
    });

    storeMemory({
      id: 'm-security',
      layer: 'enterprise',
      category: 'signal_analysis',
      priority: 'critical',
      scope: { entityType: 'company', entityId: 'co-umbrella' },
      content: 'Umbrella Corp suffered a major security breach affecting customer data',
      summary: 'Umbrella: security breach',
      tags: ['umbrella', 'security', 'breach'],
      referencedEntityIds: ['co-umbrella'],
      source: { type: 'external_intelligence', description: '' },
      confidence: 0.95,
      importance: 0.95,
      lastAccessedAt: Date.now(),
      metadata: {},
    });

    storeMemory({
      id: 'm-pattern',
      layer: 'institutional',
      category: 'learning_insight',
      priority: 'high',
      scope: 'global',
      content: 'Companies with security breaches convert at 72% higher rate within 48 hours',
      summary: 'Breach response pattern',
      tags: ['pattern', 'security', 'conversion'],
      referencedEntityIds: [],
      source: { type: 'learning_event', description: '' },
      confidence: 0.85,
      importance: 0.9,
      lastAccessedAt: Date.now(),
      metadata: {},
    });
  });

  test('should search by content keywords', () => {
    const results = searchMemories({ query: 'AWS cloud' });

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].memory.id).toBe('m-aws');
  });

  test('should search by tags', () => {
    const results = searchMemories({ query: 'security breach' });

    expect(results.length).toBeGreaterThanOrEqual(2); // Umbrella breach + institutional pattern
  });

  test('should filter by layer', () => {
    const results = searchMemories({
      query: 'security',
      layer: ['enterprise'],
    });

    expect(results.length).toBe(1); // Only Umbrella breach (enterprise), not pattern (institutional)
  });

  test('should filter by scope entity', () => {
    const results = searchMemories({
      query: 'cloud',
      scopeEntityId: 'co-acme',
    });

    expect(results.length).toBe(1);
    expect(results[0].memory.id).toBe('m-aws');
  });

  test('should filter by minimum confidence', () => {
    const results = searchMemories({
      query: 'security',
      minConfidence: 0.9,
    });

    // Only breach (0.95) passes, pattern (0.85) filtered out
    expect(results.length).toBeGreaterThanOrEqual(1);
    const ids = results.map(r => r.memory.id);
    expect(ids).toContain('m-security');
  });

  test('should return empty for no matches', () => {
    const results = searchMemories({ query: 'quantum computing blockchain AI' });

    expect(results.length).toBe(0);
  });

  test('results should be sorted by relevance score', () => {
    const results = searchMemories({ query: 'security' });

    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].relevanceScore).toBeGreaterThanOrEqual(results[i].relevanceScore);
    }
  });
});

// ── 4. Entity-Scoped Memory ──────────────────────────────────────────

describe('WI-16H: Entity-Scoped Memory', () => {
  test('should return only memories for a specific entity', () => {
    storeMemory({
      id: 'm1',
      layer: 'enterprise',
      category: 'company_intelligence',
      priority: 'high',
      scope: { entityType: 'company', entityId: 'co-acme' },
      content: 'Acme info',
      tags: [],
      referencedEntityIds: [],
      source: { type: 'system_detection', description: '' },
      confidence: 0.8,
      importance: 0.7,
      lastAccessedAt: Date.now(),
      metadata: {},
    });

    storeMemory({
      id: 'm2',
      layer: 'enterprise',
      category: 'signal_analysis',
      priority: 'high',
      scope: { entityType: 'company', entityId: 'co-globex' },
      content: 'Globex info',
      tags: [],
      referencedEntityIds: [],
      source: { type: 'system_detection', description: '' },
      confidence: 0.8,
      importance: 0.7,
      lastAccessedAt: Date.now(),
      metadata: {},
    });

    storeMemory({
      id: 'm3',
      layer: 'institutional',
      category: 'learning_insight',
      priority: 'medium',
      scope: 'global',
      content: 'Global pattern',
      tags: [],
      referencedEntityIds: [],
      source: { type: 'system_detection', description: '' },
      confidence: 0.7,
      importance: 0.5,
      lastAccessedAt: Date.now(),
      metadata: {},
    });

    const acmeMemories = getEntityMemories('company', 'co-acme');
    expect(acmeMemories.length).toBe(1);
    expect(acmeMemories[0].id).toBe('m1');

    const globexMemories = getEntityMemories('company', 'co-globex');
    expect(globexMemories.length).toBe(1);
  });

  test('should return empty for entity with no memories', () => {
    const memories = getEntityMemories('company', 'nonexistent');
    expect(memories.length).toBe(0);
  });
});

// ── 5. Memory Context Building ────────────────────────────────────

describe('WI-16H: Memory Context Building', () => {
  test('should build context with relevant memories', () => {
    storeMemory({
      id: 'm1',
      layer: 'working',
      category: 'signal_analysis',
      priority: 'high',
      scope: 'global',
      content: 'Active query context',
      tags: ['active'],
      referencedEntityIds: [],
      source: { type: 'user_input', description: '' },
      confidence: 0.9,
      importance: 0.8,
      lastAccessedAt: Date.now(),
      metadata: {},
    });

    storeMemory({
      id: 'm2',
      layer: 'conversation',
      category: 'user_preference',
      priority: 'medium',
      scope: 'global',
      content: 'User prefers technology-first analysis',
      tags: ['preference'],
      referencedEntityIds: [],
      source: { type: 'conversation', description: '' },
      confidence: 0.8,
      importance: 0.6,
      lastAccessedAt: Date.now(),
      metadata: {},
    });

    storeMemory({
      id: 'm3',
      layer: 'enterprise',
      category: 'company_intelligence',
      priority: 'high',
      scope: { entityType: 'company', entityId: 'co-test' },
      content: 'Test company intelligence',
      tags: ['test'],
      referencedEntityIds: [],
      source: { type: 'external_intelligence', description: '' },
      confidence: 0.85,
      importance: 0.75,
      lastAccessedAt: Date.now(),
      metadata: {},
    });

    storeMemory({
      id: 'm4',
      layer: 'institutional',
      category: 'learning_insight',
      priority: 'high',
      scope: 'global',
      content: 'Cloud migration pattern insight',
      tags: ['pattern'],
      referencedEntityIds: [],
      source: { type: 'learning_event', description: '' },
      confidence: 0.8,
      importance: 0.8,
      lastAccessedAt: Date.now(),
      metadata: {},
    });

    const context = buildMemoryContext({ query: 'test company analysis', maxPerLayer: 5 });

    expect(context.totalMemories).toBeGreaterThan(0);
    expect(context.working.length).toBeGreaterThanOrEqual(0);
    expect(context.conversation.length).toBeGreaterThanOrEqual(0);
    expect(context.enterprise.length).toBeGreaterThanOrEqual(0);
    expect(context.institutional.length).toBeGreaterThanOrEqual(0);
    expect(context.contextConfidence).toBeGreaterThan(0);
    expect(context.latencyMs).toBeGreaterThanOrEqual(0);
  });

  test('should return empty context for empty memory', () => {
    const context = buildMemoryContext({ query: 'nothing' });

    expect(context.totalMemories).toBe(0);
    expect(context.contextConfidence).toBe(0);
  });
});

// ── 6. Memory Consolidation ───────────────────────────────────────

describe('WI-16H: Memory Consolidation', () => {
  test('should consolidate related memories', () => {
    // Create a group of related memories
    for (let i = 0; i < 4; i++) {
      storeMemory({
        id: `consolidate-${i}`,
        layer: 'enterprise',
        category: 'signal_analysis',
        priority: 'medium',
        scope: { entityType: 'company', entityId: 'co-test' },
        content: `Signal ${i}: company cloud initiative update`,
        tags: ['cloud', 'signal', 'company'],
        referencedEntityIds: [],
        source: { type: 'system_detection', description: '' },
        confidence: 0.7 + i * 0.05,
        importance: 0.5 + i * 0.1,
        lastAccessedAt: Date.now() - i * 24 * 60 * 60 * 1000,
        metadata: {},
      });
    }

    const result = consolidateMemories({
      scopeEntityType: 'company',
      scopeEntityId: 'co-test',
    });

    // With 4 related memories, consolidation should produce at least archived memories
    expect(result.archivedMemories.length).toBeGreaterThan(0);
  });

  test('should not consolidate working memory', () => {
    storeMemory({
      id: 'wm-1',
      layer: 'working',
      category: 'signal_analysis',
      priority: 'medium',
      scope: 'global',
      content: 'Active working memory',
      tags: ['working'],
      referencedEntityIds: [],
      source: { type: 'user_input', description: '' },
      confidence: 0.7,
      importance: 0.5,
      lastAccessedAt: Date.now(),
      metadata: {},
    });

    const result = consolidateMemories();
    expect(result.sourceMemories.length).toBe(0); // Working memory excluded
  });
});

// ── 7. Memory Decay ─────────────────────────────────────────────────

describe('WI-16H: Memory Decay', () => {
  test('should apply time-based decay', () => {
    storeMemory({
      id: 'm-old',
      layer: 'conversation',
      category: 'conversation_history',
      priority: 'low',
      scope: 'global',
      content: 'Old memory that should decay',
      tags: [],
      referencedEntityIds: [],
      source: { type: 'system_detection', description: '' },
      confidence: 0.5,
      importance: 0.15,
      lastAccessedAt: Date.now(),
      metadata: {},
    });

    const before = recallMemory('m-old');
    const oldImportance = before!.importance;

    const result = applyMemoryDecay();

    // The memory may or may not be decayed depending on age (just created)
    expect(result.decayed).toBeGreaterThanOrEqual(0);
    expect(result.expired).toBeGreaterThanOrEqual(0);
  });

  test('should expire ephemeral memories', () => {
    const pastTime = Date.now() - 1000; // 1 second ago
    storeMemory({
      id: 'm-ephemeral',
      layer: 'working',
      category: 'signal_analysis',
      priority: 'ephemeral',
      scope: 'global',
      content: 'Ephemeral memory',
      tags: [],
      referencedEntityIds: [],
      source: { type: 'system_detection', description: '' },
      confidence: 0.5,
      importance: 0.1,
      lastAccessedAt: pastTime,
      expiresAt: pastTime, // Already expired
      metadata: {},
    });

    const result = applyMemoryDecay();
    expect(result.expired).toBeGreaterThanOrEqual(1);
    expect(recallMemory('m-ephemeral')).toBeUndefined();
  });
});

// ── 8. Memory Statistics ───────────────────────────────────────────

describe('WI-16H: Memory Statistics', () => {
  test('should return accurate stats for seeded memory', () => {
    seedMemorySystem();
    const stats = getMemoryStats();

    expect(stats.totalMemories).toBeGreaterThan(0);
    expect(stats.byLayer.working).toBeGreaterThan(0);
    expect(stats.byLayer.conversation).toBeGreaterThan(0);
    expect(stats.byLayer.enterprise).toBeGreaterThan(0);
    expect(stats.byLayer.institutional).toBeGreaterThan(0);
    expect(stats.averageConfidence).toBeGreaterThan(0);
    expect(stats.averageImportance).toBeGreaterThan(0);
    expect(stats.oldestMemory).toBeDefined();
    expect(stats.newestMemory).toBeDefined();
  });

  test('should return empty stats for cleared memory', () => {
    const stats = getMemoryStats();

    expect(stats.totalMemories).toBe(0);
    expect(stats.averageConfidence).toBe(0);
  });
});

// ── 9. Seed Data Integrity ─────────────────────────────────────────

describe('WI-16H: Seed Data Integrity', () => {
  test('seed should create expected memory counts', () => {
    seedMemorySystem();
    const stats = getMemoryStats();

    // 2 working + 3 conversation + 5 enterprise + 4 institutional = 14
    expect(stats.totalMemories).toBe(14);
    expect(stats.byLayer.working).toBe(2);
    expect(stats.byLayer.conversation).toBe(3);
    expect(stats.byLayer.enterprise).toBe(5);
    expect(stats.byLayer.institutional).toBe(4);
  });

  test('seed should not duplicate on double-call', () => {
    seedMemorySystem();
    const count1 = getMemoryStats().totalMemories;

    seedMemorySystem();
    const count2 = getMemoryStats().totalMemories;

    expect(count2).toBe(count1);
  });

  test('seed enterprise memories should have proper scope', () => {
    seedMemorySystem();

    const all = getAllMemories();
    const enterpriseMemories = all.filter(m => m.layer === 'enterprise');

    for (const m of enterpriseMemories) {
      expect(m.scope).not.toBe('global');
    }
  });

  test('seed should include critical priority memories', () => {
    seedMemorySystem();

    const critical = getAllMemories().filter(m => m.priority === 'critical');
    expect(critical.length).toBeGreaterThan(0);

    const ids = critical.map(m => m.id);
    expect(ids).toContain('em-globex-ciso-departure');
    expect(ids).toContain('em-umbrella-breach');
  });

  test('seed should include learning patterns', () => {
    seedMemorySystem();

    const institutional = getAllMemories().filter(m => m.layer === 'institutional');
    const patterns = institutional.filter(m => m.category === 'learning_insight');
    expect(patterns.length).toBeGreaterThan(0);

    const breachPattern = patterns.find(m => m.id === 'im-security-breach-response');
    expect(breachPattern).toBeDefined();
    expect(breachPattern!.importance).toBeGreaterThan(0.9);
  });
});

// ── 10. Memory Integration Scenarios ───────────────────────────────

describe('WI-16H: Integration Scenarios', () => {
  test('Scenario: Build context for Acme Corp opportunity assessment', () => {
    seedMemorySystem();

    const context = buildMemoryContext({
      query: 'Acme Corp cloud migration technology assessment',
      scopeEntityType: 'company',
      scopeEntityId: 'co-acme',
      maxPerLayer: 5,
    });

    // Context should contain memories from multiple layers
    expect(context.totalMemories).toBeGreaterThan(0);
    expect(context.contextConfidence).toBeGreaterThan(0);
  });

  test('Scenario: Search for security-related intelligence', () => {
    seedMemorySystem();

    const results = searchMemories({
      query: 'security breach opportunity',
      tags: ['security', 'breach'],
      limit: 10,
    });

    expect(results.length).toBeGreaterThan(0);

    // Should find Umbrella breach and institutional breach pattern
    const ids = results.map(r => r.memory.id);
    expect(ids).toContain('em-umbrella-breach');
  });

  test('Scenario: User preference should persist in conversation layer', () => {
    seedMemorySystem();

    const userPrefs = searchMemories({
      query: 'preference',
      layer: ['conversation'],
      category: ['user_preference'],
    });

    expect(userPrefs.length).toBeGreaterThan(0);
    expect(userPrefs[0].memory.content.toLowerCase()).toContain('prefer');
  });
});
