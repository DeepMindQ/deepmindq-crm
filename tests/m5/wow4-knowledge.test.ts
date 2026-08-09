/**
 * M5 Unit Tests — WOW #4 Knowledge Intelligence
 * 
 * The WOW4 module is a composition layer that imports heavily from
 * ai-hybrid-retrieval, ai-knowledge-graph, ai-memory, and ai-unified-confidence.
 * All internal helpers (buildReasoning, synthesizeAnswer, etc.) are NOT exported.
 * 
 * This test file verifies:
 *   1. Type imports are correct
 *   2. The main queryKnowledgeIntelligence composes correctly with mocked deps
 */

import { describe, it, expect, vi } from 'vitest';

// ── Mock all heavy dependencies ───────────────────────────────

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  },
}));

vi.mock('@/lib/ai-hybrid-retrieval', () => ({
  understandQuery: vi.fn().mockReturnValue({
    intent: 'factual',
    queryType: 'entity_attribute',
    entities: [
      { text: 'healthcare', type: 'industry', normalized: 'healthcare' },
    ],
  }),
  extractEntities: vi.fn().mockReturnValue([]),
  hybridSearch: vi.fn().mockReturnValue({
    results: [],
    activeSignalCount: 0,
    quality: {
      averageConfidence: 0.5,
      premiumSourceCount: 0,
      signalDiversity: 0.3,
      averageRecencyScore: 0.5,
    },
  }),
}));

vi.mock('@/lib/ai-knowledge-graph', () => ({
  resolveEntity: vi.fn().mockReturnValue([]),
  expandFromEntity: vi.fn().mockReturnValue({
    nodes: [],
    edges: [],
    evidenceChains: [],
  }),
  extractGraphEntities: vi.fn().mockReturnValue([]),
  getGraphStats: vi.fn().mockReturnValue({
    totalNodes: 0,
    totalEdges: 0,
  }),
  seedKnowledgeGraph: vi.fn(),
}));

vi.mock('@/lib/ai-memory', () => ({
  searchMemories: vi.fn().mockReturnValue([]),
  buildMemoryContext: vi.fn().mockReturnValue({
    totalMemories: 0,
    working: [],
    conversation: [],
    enterprise: [],
    institutional: [],
  }),
}));

vi.mock('@/lib/ai-unified-confidence', () => ({
  computeUnifiedConfidence: vi.fn().mockReturnValue({
    score: 0,
    grade: 'F',
    trustClass: 'no_trust',
    dimensions: {
      dataCompleteness: 0,
      sourceReliability: 0,
      freshness: 0,
      crossValidation: 0,
      evidenceCoverage: 0,
      qualityGate: 0,
    },
  }),
}));

import {
  queryKnowledgeIntelligence,
  type KnowledgeQueryInput,
  type KnowledgeAnswer,
  type KnowledgeIntelligenceOutput,
  type EvidenceDatum,
  type CitedSource,
} from '@/lib/m5-wow4-knowledge-intelligence';

// ─── Type Validation ────────────────────────────────────────

describe('WOW4 Types', () => {
  it('should accept a valid KnowledgeQueryInput', () => {
    const input: KnowledgeQueryInput = {
      query: 'What do we know about AI adoption?',
    };
    expect(input.query).toBeTruthy();
  });

  it('should accept KnowledgeQueryInput with companyId', () => {
    const input: KnowledgeQueryInput = {
      query: 'Tell me about this company',
      companyId: 'company-1',
      maxResults: 5,
    };
    expect(input.companyId).toBe('company-1');
    expect(input.maxResults).toBe(5);
  });

  it('should validate EvidenceDatum shape', () => {
    const datum: EvidenceDatum = {
      claim: 'Revenue is $50M',
      snippet: 'The company reported $50M in annual revenue.',
      source: 'SEC Filing',
      sourceDate: '2025-01-15',
      relevanceScore: 0.95,
      entityIds: ['acme-corp'],
    };
    expect(datum.claim).toBeTruthy();
    expect(datum.entityIds).toHaveLength(1);
  });

  it('should validate CitedSource shape', () => {
    const source: CitedSource = {
      name: 'SEC Filing',
      tier: 'premium',
      evidenceCount: 3,
      mostRecentDate: '2025-06-01',
    };
    expect(source.tier).toBe('premium');
    expect(source.evidenceCount).toBe(3);
  });
});

// ─── queryKnowledgeIntelligence ─────────────────────────────

describe('queryKnowledgeIntelligence', () => {
  it('should return success: true', () => {
    const result = queryKnowledgeIntelligence({ query: 'test' });
    expect(result.success).toBe(true);
  });

  it('should return a KnowledgeAnswer', () => {
    const result = queryKnowledgeIntelligence({ query: 'test' });
    expect(result.answer).toBeDefined();
    expect(result.answer.answerId).toBeTruthy();
    expect(result.answer.question).toBe('test');
    expect(result.answer.timestamp).toBeTruthy();
  });

  it('should include trust metadata', () => {
    const result = queryKnowledgeIntelligence({ query: 'test' });
    expect(result.trust).toBeDefined();
    expect(result.trust.source).toBe('platform_computed');
  });

  it('should include trustScore', () => {
    const result = queryKnowledgeIntelligence({ query: 'test' });
    expect(result.trustScore).toBeDefined();
    expect(typeof result.trustScore.score).toBe('number');
    expect(typeof result.trustScore.grade).toBe('string');
  });

  it('should include confidence result', () => {
    const result = queryKnowledgeIntelligence({ query: 'test' });
    expect(result.answer.confidence).toBeDefined();
    expect(typeof result.answer.confidence.score).toBe('number');
  });

  it('should include retrieval metrics', () => {
    const result = queryKnowledgeIntelligence({ query: 'test' });
    expect(result.answer.retrievalMetrics).toBeDefined();
    expect(typeof result.answer.retrievalMetrics.totalLatencyMs).toBe('number');
    expect(typeof result.answer.retrievalMetrics.retrievalLatencyMs).toBe('number');
    expect(typeof result.answer.retrievalMetrics.graphLatencyMs).toBe('number');
    expect(typeof result.answer.retrievalMetrics.memoryLatencyMs).toBe('number');
  });

  it('should set knowledgeFound to false when no data', () => {
    const result = queryKnowledgeIntelligence({ query: 'obscure unknown thing' });
    expect(result.answer.knowledgeFound).toBe(false);
  });

  it('should generate an answer text', () => {
    const result = queryKnowledgeIntelligence({ query: 'test' });
    expect(typeof result.answer.answer).toBe('string');
    expect(result.answer.answer.length).toBeGreaterThan(0);
  });

  it('should generate reasoning', () => {
    const result = queryKnowledgeIntelligence({ query: 'test' });
    expect(typeof result.answer.reasoning).toBe('string');
    expect(result.answer.reasoning.length).toBeGreaterThan(0);
  });

  it('should include empty evidence/sources when no data', () => {
    const result = queryKnowledgeIntelligence({ query: 'test' });
    expect(result.answer.evidence).toHaveLength(0);
    expect(result.answer.sources).toHaveLength(0);
  });

  it('should include memory context summary', () => {
    const result = queryKnowledgeIntelligence({ query: 'test' });
    expect(typeof result.answer.memoryContextSummary).toBe('string');
  });

  it('should generate unique answer IDs', () => {
    const r1 = queryKnowledgeIntelligence({ query: 'test' });
    const r2 = queryKnowledgeIntelligence({ query: 'test' });
    // Even for same query, IDs should be unique (timestamp-based)
    expect(r1.answer.answerId).not.toBe(r2.answer.answerId);
  });

  it('should handle companyId without error', () => {
    // The composition layer should pass companyId to sub-systems.
    // Since all deps are mocked, we verify the function completes successfully.
    const result = queryKnowledgeIntelligence({ query: 'test', companyId: 'c-123' });
    expect(result.success).toBe(true);
    expect(result.answer).toBeDefined();
  });
});
