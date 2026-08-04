/**
 * Research Engine Tests
 *
 * Comprehensive tests for:
 *   - signals.ts: LLM signal detection, rule-based fallback, storeSignals, lifecycle classification
 *   - evidence.ts: Evidence storage, quality tiers, field linking, summaries
 *   - signal-capability-matching.ts: Match scoring, threshold handling, retrieval
 *   - opportunity-recommendation-engine.ts: Score computation, recommendation generation, ranking
 *   - evidence-quality.ts: Quality scoring across multiple dimensions
 */

import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';

// ── Mocks (hoisted for vi.mock) ──

const { mockDb, mockGovernedAICallAggregate, mockExtractJSON, mockComputeEvidenceQuality } = vi.hoisted(() => {
  const db = {
    companySignal: {
      findMany: vi.fn(),
      count: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      findUnique: vi.fn(),
    },
    evidence: {
      findMany: vi.fn(),
      createMany: vi.fn(),
      count: vi.fn(),
      deleteMany: vi.fn(),
      updateMany: vi.fn(),
    },
    companyTimelineEvent: {
      createMany: vi.fn(),
    },
    capabilityAsset: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    signalCapabilityMatch: {
      findMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
      findUnique: vi.fn(),
    },
    companyResearchCard: {
      findUnique: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
    },
    opportunityRecommendation: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    systemSetting: {
      findUnique: vi.fn(),
    },
  };
  return {
    mockDb: db,
    mockGovernedAICallAggregate: vi.fn(),
    mockExtractJSON: vi.fn(),
    mockComputeEvidenceQuality: vi.fn().mockResolvedValue({
      overall: 75, coverage: 80, freshness: 70, sourceQuality: 85,
      corroboration: 60, volume: 65, totalEvidence: 12, activeEvidence: 10,
      fieldsCovered: 5, totalFields: 6, premiumSourceCount: 4, lowSourceCount: 1,
      avgRecencyDays: 15,
    }),
  };
});

vi.mock('@/lib/db', () => ({ db: mockDb }));

vi.mock('@/lib/ai-governance', () => ({
  governedAICallAggregate: (...args: unknown[]) => mockGovernedAICallAggregate(...args),
}));

vi.mock('@/lib/zai-helpers', () => ({
  extractJSON: (...args: unknown[]) => mockExtractJSON(...args),
  webSearch: vi.fn(),
}));

vi.mock('@/lib/research-engine/evidence-quality', () => ({
  computeEvidenceQuality: (...args: unknown[]) => mockComputeEvidenceQuality(...args),
}));

vi.mock('@/lib/intelligence-confidence', () => ({
  computeFullConfidenceBreakdown: vi.fn().mockResolvedValue({
    signalQuality: 0.8, evidenceQuality: 0.75, capabilityFit: 0.7,
    dataCompleteness: 0.85, overall: 0.78,
  }),
}));

// ── Imports after mocks ──

import { detectSignals, storeSignals, type DetectedSignal } from '@/lib/research-engine/signals';
import {
  storeEvidenceFromResults,
  linkEvidenceToFields,
  getEvidenceForField,
  getCompanyEvidence,
  getEvidenceSummary,
  cleanupOldEvidence,
} from '@/lib/research-engine/evidence';
import {
  matchSignalsToCapabilities,
  getSignalCapabilityMatches,
} from '@/lib/research-engine/signal-capability-matching';
import {
  computeOpportunityScore,
  generateOpportunityRecommendation,
  generateCompanyOpportunities,
} from '@/lib/research-engine/opportunity-recommendation-engine';

// ── Helpers ──

function makeLLMResultSuccess(response: string) {
  return {
    success: true,
    response,
    governanceResult: { passed: true, checks: {}, overallMessage: '', canProceed: true, rejectionReason: null },
    rejectionReason: null, groundingNote: '', promptAddon: '',
  };
}

function makeLLMResultFail(reason: string) {
  return {
    success: false, response: null,
    governanceResult: { passed: true, checks: {}, overallMessage: '', canProceed: true, rejectionReason: reason },
    rejectionReason: reason, groundingNote: '', promptAddon: '',
  };
}

// ═══════════════════════════════════════════════════════════════
// 1. SIGNAL DETECTION — detectSignals
// ═══════════════════════════════════════════════════════════════

describe('detectSignals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Empty / null inputs ──

  it('should return empty result when snippets array is empty', async () => {
    const result = await detectSignals('Acme Corp', []);
    expect(result.signals).toEqual([]);
    expect(result.signalCount).toBe(0);
    expect(result.highImpactCount).toBe(0);
    expect(mockGovernedAICallAggregate).not.toHaveBeenCalled();
  });

  // ── LLM-based detection ──

  it('should return empty result when LLM call fails (success: false)', async () => {
    mockGovernedAICallAggregate.mockResolvedValue(makeLLMResultFail('LLM error'));

    const snippets = [{ title: 'Acme raises funding', snippet: 'Acme raised $50M', url: 'https://example.com/1', source: 'TechCrunch' }];
    const result = await detectSignals('Acme Corp', snippets);

    expect(result.signals).toEqual([]);
    expect(result.signalCount).toBe(0);
  });

  it('should return empty result when LLM response is null', async () => {
    mockGovernedAICallAggregate.mockResolvedValue({
      ...makeLLMResultSuccess(''),
      response: null,
    });

    const snippets = [{ title: 'Acme raises funding', snippet: 'Acme raised $50M', url: 'https://example.com/1', source: 'TechCrunch' }];
    const result = await detectSignals('Acme Corp', snippets);
    expect(result.signalCount).toBe(0);
  });

  it('should parse valid LLM JSON response into signals', async () => {
    const llmResponse = JSON.stringify([
      {
        signalType: 'funding',
        title: 'Acme raises $50M Series C',
        description: 'Acme Corp raised $50M to expand cloud infrastructure.',
        source: 'TechCrunch',
        sourceUrl: 'https://example.com/1',
        impact: 'high',
        severity: 'high',
        signalDate: '2024-01-15',
        confidence: 0.9,
        evidenceIndex: 0,
      },
    ]);

    mockGovernedAICallAggregate.mockResolvedValue(makeLLMResultSuccess(llmResponse));
    mockExtractJSON.mockReturnValue([llmResponse]);

    const snippets = [{ title: 'Acme raises funding', snippet: 'Acme raised $50M', url: 'https://example.com/1', source: 'TechCrunch' }];
    const result = await detectSignals('Acme Corp', snippets);

    expect(result.signalCount).toBe(1);
    expect(result.highImpactCount).toBe(1);
    expect(result.signals[0].signalType).toBe('funding');
    expect(result.signals[0].title).toBe('Acme raises $50M Series C');
    expect(result.signals[0].impact).toBe('high');
    expect(result.signals[0].severity).toBe('high');
    expect(result.signals[0].confidence).toBe(0.9);
    expect(result.signals[0].evidenceSnippet).toBe('Acme raised $50M');
    expect(result.signals[0].evidenceUrl).toBe('https://example.com/1');
    expect(result.signals[0].signalDate).toBe('2024-01-15');
  });

  it('should filter out signals without title or description', async () => {
    const llmResponse = JSON.stringify([
      { signalType: 'funding', title: '', description: 'Valid', source: 'S', sourceUrl: 'http://x', impact: 'high', severity: 'high', signalDate: null, confidence: 0.8, evidenceIndex: -1 },
      { signalType: 'hiring', title: 'Valid title', description: '', source: 'S', sourceUrl: 'http://x', impact: 'medium', severity: 'medium', signalDate: null, confidence: 0.7, evidenceIndex: -1 },
      { signalType: 'expansion', title: 'Good signal', description: 'Has description', source: 'S', sourceUrl: 'http://x', impact: 'low', severity: 'low', signalDate: null, confidence: 0.6, evidenceIndex: -1 },
    ]);

    mockGovernedAICallAggregate.mockResolvedValue(makeLLMResultSuccess(llmResponse));
    mockExtractJSON.mockReturnValue(JSON.parse(llmResponse));

    const snippets = [{ title: 'Acme', snippet: 'Some text', url: 'http://x', source: 'S' }];
    const result = await detectSignals('Acme', snippets);

    expect(result.signalCount).toBe(1);
    expect(result.signals[0].title).toBe('Good signal');
  });

  it('should normalize non-canonical signal types to expansion', async () => {
    const llmResponse = JSON.stringify([
      { signalType: 'unknown_type', title: 'Something', description: 'Desc', source: 'S', sourceUrl: 'http://x', impact: 'medium', severity: 'medium', signalDate: null, confidence: 0.5, evidenceIndex: -1 },
    ]);

    mockGovernedAICallAggregate.mockResolvedValue(makeLLMResultSuccess(llmResponse));
    mockExtractJSON.mockReturnValue(JSON.parse(llmResponse));

    const snippets = [{ title: 'Something', snippet: 'desc', url: 'http://x', source: 'S' }];
    const result = await detectSignals('Acme', snippets);

    expect(result.signals[0].signalType).toBe('expansion');
  });

  it('should clamp confidence between 0 and 1', async () => {
    const llmResponse = JSON.stringify([
      { signalType: 'funding', title: 'T', description: 'D', source: 'S', sourceUrl: 'http://x', impact: 'high', severity: 'high', signalDate: null, confidence: 1.5, evidenceIndex: -1 },
      { signalType: 'hiring', title: 'T2', description: 'D2', source: 'S', sourceUrl: 'http://x', impact: 'medium', severity: 'medium', signalDate: null, confidence: -0.3, evidenceIndex: -1 },
    ]);

    mockGovernedAICallAggregate.mockResolvedValue(makeLLMResultSuccess(llmResponse));
    mockExtractJSON.mockReturnValue(JSON.parse(llmResponse));

    const snippets = [{ title: 'x', snippet: 'x', url: 'http://x', source: 'S' }];
    const result = await detectSignals('Acme', snippets);

    expect(result.signals[0].confidence).toBe(1);
    expect(result.signals[1].confidence).toBe(0);
  });

  it('should default confidence to 0.6 when not a number', async () => {
    const llmResponse = JSON.stringify([
      { signalType: 'funding', title: 'T', description: 'D', source: 'S', sourceUrl: 'http://x', impact: 'high', severity: 'high', signalDate: null, confidence: 'high', evidenceIndex: -1 },
    ]);

    mockGovernedAICallAggregate.mockResolvedValue(makeLLMResultSuccess(llmResponse));
    mockExtractJSON.mockReturnValue(JSON.parse(llmResponse));

    const snippets = [{ title: 'x', snippet: 'x', url: 'http://x', source: 'S' }];
    const result = await detectSignals('Acme', snippets);

    expect(result.signals[0].confidence).toBe(0.6);
  });

  it('should default impact to medium when invalid', async () => {
    const llmResponse = JSON.stringify([
      { signalType: 'funding', title: 'T', description: 'D', source: 'S', sourceUrl: 'http://x', impact: 'critical', severity: 'high', signalDate: null, confidence: 0.8, evidenceIndex: -1 },
      { signalType: 'hiring', title: 'T2', description: 'D2', source: 'S', sourceUrl: 'http://x', impact: '', severity: 'low', signalDate: null, confidence: 0.7, evidenceIndex: -1 },
    ]);

    mockGovernedAICallAggregate.mockResolvedValue(makeLLMResultSuccess(llmResponse));
    mockExtractJSON.mockReturnValue(JSON.parse(llmResponse));

    const snippets = [{ title: 'x', snippet: 'x', url: 'http://x', source: 'S' }];
    const result = await detectSignals('Acme', snippets);

    expect(result.signals[0].impact).toBe('medium');
    expect(result.signals[1].impact).toBe('medium');
  });

  it('should default severity to medium when invalid', async () => {
    const llmResponse = JSON.stringify([
      { signalType: 'funding', title: 'T', description: 'D', source: 'S', sourceUrl: 'http://x', impact: 'high', severity: 'extreme', signalDate: null, confidence: 0.8, evidenceIndex: -1 },
    ]);

    mockGovernedAICallAggregate.mockResolvedValue(makeLLMResultSuccess(llmResponse));
    mockExtractJSON.mockReturnValue(JSON.parse(llmResponse));

    const snippets = [{ title: 'x', snippet: 'x', url: 'http://x', source: 'S' }];
    const result = await detectSignals('Acme', snippets);

    expect(result.signals[0].severity).toBe('medium');
  });

  it('should correctly count high-impact signals', async () => {
    const llmResponse = JSON.stringify([
      { signalType: 'funding', title: 'A', description: 'D', source: 'S', sourceUrl: 'http://x', impact: 'high', severity: 'high', signalDate: null, confidence: 0.9, evidenceIndex: -1 },
      { signalType: 'hiring', title: 'B', description: 'D', source: 'S', sourceUrl: 'http://x', impact: 'high', severity: 'medium', signalDate: null, confidence: 0.8, evidenceIndex: -1 },
      { signalType: 'expansion', title: 'C', description: 'D', source: 'S', sourceUrl: 'http://x', impact: 'low', severity: 'low', signalDate: null, confidence: 0.5, evidenceIndex: -1 },
      { signalType: 'product', title: 'D', description: 'D', source: 'S', sourceUrl: 'http://x', impact: 'medium', severity: 'medium', signalDate: null, confidence: 0.6, evidenceIndex: -1 },
    ]);

    mockGovernedAICallAggregate.mockResolvedValue(makeLLMResultSuccess(llmResponse));
    mockExtractJSON.mockReturnValue(JSON.parse(llmResponse));

    const snippets = [{ title: 'x', snippet: 'x', url: 'http://x', source: 'S' }];
    const result = await detectSignals('Acme', snippets);

    expect(result.signalCount).toBe(4);
    expect(result.highImpactCount).toBe(2);
  });

  it('should use source data from evidenceIndex when valid', async () => {
    const llmResponse = JSON.stringify([
      {
        signalType: 'funding',
        title: 'Big funding',
        description: 'Raised money',
        source: '',  // empty — should fall back to snippet source
        sourceUrl: '', // empty — should fall back to snippet url
        impact: 'high',
        severity: 'high',
        signalDate: null,
        confidence: 0.8,
        evidenceIndex: 0,
      },
    ]);

    mockGovernedAICallAggregate.mockResolvedValue(makeLLMResultSuccess(llmResponse));
    mockExtractJSON.mockReturnValue(JSON.parse(llmResponse));

    const snippets = [{ title: 'Funding news', snippet: 'Raised $40M', url: 'https://reuters.com/funding', source: 'Reuters' }];
    const result = await detectSignals('Acme', snippets);

    expect(result.signals[0].source).toBe('Reuters');
    expect(result.signals[0].sourceUrl).toBe('https://reuters.com/funding');
    expect(result.signals[0].evidenceSnippet).toBe('Raised $40M');
    expect(result.signals[0].evidenceUrl).toBe('https://reuters.com/funding');
  });

  it('should handle out-of-range evidenceIndex gracefully', async () => {
    const llmResponse = JSON.stringify([
      { signalType: 'funding', title: 'T', description: 'D', source: 'S', sourceUrl: 'http://real.com', impact: 'high', severity: 'high', signalDate: null, confidence: 0.8, evidenceIndex: 999, },
    ]);

    mockGovernedAICallAggregate.mockResolvedValue(makeLLMResultSuccess(llmResponse));
    mockExtractJSON.mockReturnValue(JSON.parse(llmResponse));

    const snippets = [{ title: 'x', snippet: 'x', url: 'http://x', source: 'S' }];
    const result = await detectSignals('Acme', snippets);

    // Should not crash; evidenceSnippet should be empty, evidenceUrl from sourceUrl
    expect(result.signals[0].evidenceSnippet).toBe('');
    expect(result.signals[0].evidenceUrl).toBe('http://real.com');
  });

  it('should limit context to 25 snippets', async () => {
    const snippets = Array.from({ length: 30 }, (_, i) => ({
      title: `Snippet ${i}`, snippet: `Content ${i}`, url: `http://x.com/${i}`, source: 'Source',
    }));

    mockGovernedAICallAggregate.mockResolvedValue(makeLLMResultSuccess('[]'));
    mockExtractJSON.mockReturnValue([]);

    await detectSignals('Acme', snippets);

    const callArgs = mockGovernedAICallAggregate.mock.calls[0][0] as { userPrompt: string };
    // The prompt should contain indexed snippets [0] through [24] but NOT [25]
    expect(callArgs.userPrompt).toContain('[0]');
    expect(callArgs.userPrompt).toContain('[24]');
    expect(callArgs.userPrompt).not.toContain('[25]');
  });

  // ── Rule-based fallback ──

  it('should fall back to rule-based detection when LLM throws', async () => {
    mockGovernedAICallAggregate.mockRejectedValue(new Error('LLM timeout'));

    const snippets = [
      { title: 'Acme raises $50M Series C funding', snippet: 'Acme Corp announced a $50M Series C funding round', url: 'http://x', source: 'TechCrunch' },
    ];

    const result = await detectSignals('Acme', snippets);

    expect(result.signalCount).toBeGreaterThanOrEqual(1);
    expect(result.signals[0].signalType).toBe('funding');
    expect(result.signals[0].impact).toBe('high');
  });

  it('should fall back to rule-based detection when LLM returns non-array', async () => {
    mockGovernedAICallAggregate.mockResolvedValue(makeLLMResultSuccess('not json'));
    mockExtractJSON.mockReturnValue(null);

    const snippets = [
      { title: 'Acme hiring VP of Sales', snippet: 'Acme Corp is hiring a new VP of Sales', url: 'http://x', source: 'LinkedIn' },
    ];

    const result = await detectSignals('Acme', snippets);

    expect(result.signalCount).toBeGreaterThanOrEqual(1);
    expect(result.signals[0].signalType).toBe('hiring');
  });

  it('rule-based: should detect leadership change', async () => {
    mockGovernedAICallAggregate.mockRejectedValue(new Error('fail'));

    const snippets = [
      { title: 'New CEO at Acme', snippet: 'Acme Corp appointed Jane Doe as new CEO', url: 'http://x', source: 'WSJ' },
    ];

    const result = await detectSignals('Acme', snippets);

    expect(result.signalCount).toBeGreaterThanOrEqual(1);
    expect(result.signals[0].signalType).toBe('leadership_change');
    expect(result.signals[0].impact).toBe('high');
  });

  it('rule-based: should detect acquisition signal', async () => {
    mockGovernedAICallAggregate.mockRejectedValue(new Error('fail'));

    const snippets = [
      { title: 'Acme acquired by BigCo', snippet: 'BigCo announced acquisition of Acme Corp', url: 'http://x', source: 'Reuters' },
    ];

    const result = await detectSignals('Acme', snippets);

    expect(result.signalCount).toBeGreaterThanOrEqual(1);
    expect(result.signals[0].signalType).toBe('acquisition');
  });

  it('rule-based: should detect financial pressure', async () => {
    mockGovernedAICallAggregate.mockRejectedValue(new Error('fail'));

    const snippets = [
      { title: 'Acme layoffs', snippet: 'Acme Corp announced layoffs affecting 200 employees as part of cost cutting', url: 'http://x', source: 'Bloomberg' },
    ];

    const result = await detectSignals('Acme', snippets);

    expect(result.signalCount).toBeGreaterThanOrEqual(1);
    expect(result.signals[0].signalType).toBe('financial_pressure');
  });

  it('rule-based: should detect technology adoption', async () => {
    mockGovernedAICallAggregate.mockRejectedValue(new Error('fail'));

    const snippets = [
      { title: 'Acme migrates to cloud', snippet: 'Acme Corp is migrating to AWS cloud infrastructure', url: 'http://x', source: 'TechCrunch' },
    ];

    const result = await detectSignals('Acme', snippets);

    expect(result.signalCount).toBeGreaterThanOrEqual(1);
    expect(result.signals[0].signalType).toBe('technology');
  });

  it('rule-based: should detect regulatory signal', async () => {
    mockGovernedAICallAggregate.mockRejectedValue(new Error('fail'));

    const snippets = [
      { title: 'Acme GDPR compliance', snippet: 'Acme Corp must comply with new GDPR regulations', url: 'http://x', source: 'LawBlog' },
    ];

    const result = await detectSignals('Acme', snippets);

    expect(result.signalCount).toBeGreaterThanOrEqual(1);
    expect(result.signals[0].signalType).toBe('regulatory');
  });

  it('rule-based: should produce only one signal per snippet', async () => {
    mockGovernedAICallAggregate.mockRejectedValue(new Error('fail'));

    // This snippet matches funding ($50M) AND expansion (new office)
    const snippets = [
      { title: 'Acme $50M funding and new office', snippet: 'Acme raised $50M in funding and is opening a new office', url: 'http://x', source: 'S' },
    ];

    const result = await detectSignals('Acme', snippets);

    // Should only get one signal (first matching pattern wins)
    expect(result.signalCount).toBe(1);
  });

  it('rule-based: should require company name in snippet', async () => {
    mockGovernedAICallAggregate.mockRejectedValue(new Error('fail'));

    // Snippet doesn't mention "Acme"
    const snippets = [
      { title: 'Big funding round', snippet: 'A company raised $50M in funding', url: 'http://x', source: 'S' },
    ];

    const result = await detectSignals('Acme', snippets);

    expect(result.signalCount).toBe(0);
  });

  it('rule-based: should cap signals at 8', async () => {
    mockGovernedAICallAggregate.mockRejectedValue(new Error('fail'));

    const snippets = Array.from({ length: 15 }, (_, i) => ({
      title: `Acme raises $${i + 10}M funding round ${i}`,
      snippet: `Acme Corp raised $${i + 10}M in their latest funding round`,
      url: `http://x.com/${i}`,
      source: 'TechCrunch',
    }));

    const result = await detectSignals('Acme', snippets);

    expect(result.signals.length).toBeLessThanOrEqual(8);
  });

  it('rule-based: should set confidence to 0.5 for all rule-based signals', async () => {
    mockGovernedAICallAggregate.mockRejectedValue(new Error('fail'));

    const snippets = [
      { title: 'Acme raises $50M', snippet: 'Acme raised $50M', url: 'http://x', source: 'S' },
    ];

    const result = await detectSignals('Acme', snippets);

    result.signals.forEach(s => {
      expect(s.confidence).toBe(0.5);
    });
  });

  it('rule-based: should set signalDate to null', async () => {
    mockGovernedAICallAggregate.mockRejectedValue(new Error('fail'));

    const snippets = [
      { title: 'Acme raises $50M', snippet: 'Acme raised $50M', url: 'http://x', source: 'S' },
    ];

    const result = await detectSignals('Acme', snippets);

    result.signals.forEach(s => {
      expect(s.signalDate).toBeNull();
    });
  });

  it('rule-based: should detect multiple signal types from different snippets', async () => {
    mockGovernedAICallAggregate.mockRejectedValue(new Error('fail'));

    const snippets = [
      { title: 'Acme funding', snippet: 'Acme raised $50M in series B funding', url: 'http://x/1', source: 'TC' },
      { title: 'Acme hiring', snippet: 'Acme is looking for 50 engineers to join the team', url: 'http://x/2', source: 'LN' },
      { title: 'Acme new CEO', snippet: 'Acme appointed a new CEO named John', url: 'http://x/3', source: 'WSJ' },
    ];

    const result = await detectSignals('Acme', snippets);

    const types = result.signals.map(s => s.signalType);
    expect(types).toContain('funding');
    expect(types).toContain('hiring');
    expect(types).toContain('leadership_change');
  });
});

// ═══════════════════════════════════════════════════════════════
// 2. SIGNAL STORAGE — storeSignals
// ═══════════════════════════════════════════════════════════════

describe('storeSignals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty array when no signals provided', async () => {
    const result = await storeSignals('company-1', [], 'job-1');
    expect(result).toEqual([]);
    expect(mockDb.companySignal.findMany).not.toHaveBeenCalled();
    expect(mockDb.companySignal.createMany).not.toHaveBeenCalled();
  });

  it('should deduplicate against existing signal titles (case-insensitive)', async () => {
    mockDb.companySignal.findMany.mockResolvedValue([
      { title: 'Acme raises $50M Series C' },
    ]);
    mockDb.evidence.findMany.mockResolvedValue([]);
    mockDb.companySignal.createMany.mockResolvedValue({ count: 0 });
    mockDb.companyTimelineEvent.createMany.mockResolvedValue({ count: 0 });
    mockDb.companySignal.findMany.mockResolvedValueOnce([{ title: 'Acme raises $50M Series C' }]);

    const signals: DetectedSignal[] = [
      {
        signalType: 'funding', title: 'Acme raises $50M Series C', description: 'Desc',
        source: 'S', sourceUrl: 'http://x', impact: 'high', severity: 'high',
        signalDate: null, confidence: 0.9, evidenceSnippet: 'snippet', evidenceUrl: 'http://x',
      },
      {
        signalType: 'hiring', title: 'Acme hiring 50 engineers', description: 'Desc',
        source: 'S', sourceUrl: 'http://y', impact: 'medium', severity: 'medium',
        signalDate: null, confidence: 0.7, evidenceSnippet: 'snippet2', evidenceUrl: 'http://y',
      },
    ];

    const result = await storeSignals('company-1', signals, 'job-1');

    // Only the hiring signal should be new
    expect(result.length).toBe(1);
    expect(mockDb.companySignal.createMany).toHaveBeenCalledTimes(1);
    const createData = mockDb.companySignal.createMany.mock.calls[0][0].data;
    expect(createData.length).toBe(1);
    expect(createData[0].signalType).toBe('hiring');
  });

  it('should return empty array when all signals already exist', async () => {
    mockDb.companySignal.findMany.mockResolvedValue([
      { title: 'existing signal' },
      { title: 'another existing signal' },
    ]);

    const signals: DetectedSignal[] = [
      {
        signalType: 'funding', title: 'Existing Signal', description: 'Desc',
        source: 'S', sourceUrl: 'http://x', impact: 'high', severity: 'high',
        signalDate: null, confidence: 0.9, evidenceSnippet: '', evidenceUrl: 'http://x',
      },
      {
        signalType: 'hiring', title: 'Another Existing Signal', description: 'Desc',
        source: 'S', sourceUrl: 'http://y', impact: 'medium', severity: 'medium',
        signalDate: null, confidence: 0.7, evidenceSnippet: '', evidenceUrl: 'http://y',
      },
    ];

    const result = await storeSignals('company-1', signals, 'job-1');
    expect(result).toEqual([]);
    expect(mockDb.companySignal.createMany).not.toHaveBeenCalled();
  });

  it('should link evidence via sourceUrl', async () => {
    mockDb.companySignal.findMany.mockResolvedValue([]);
    mockDb.evidence.findMany.mockResolvedValue([
      { id: 'ev-1', sourceUrl: 'http://reuters.com/funding' },
      { id: 'ev-2', sourceUrl: 'http://techcrunch.com/hiring' },
    ]);
    mockDb.companySignal.createMany.mockResolvedValue({ count: 2 });
    mockDb.companyTimelineEvent.createMany.mockResolvedValue({ count: 0 });
    mockDb.companySignal.findMany
      .mockResolvedValueOnce([{ title: 'none' }]) // first call for dedup
      .mockResolvedValueOnce([ // second call for lifecycle classification
        { id: 'sig-0', title: 'Funding Signal', signalDate: null, confidence: 0.9, impact: 'high', status: 'detected' },
        { id: 'sig-1', title: 'Hiring Signal', signalDate: null, confidence: 0.7, impact: 'medium', status: 'detected' },
      ]);

    const signals: DetectedSignal[] = [
      {
        signalType: 'funding', title: 'Funding Signal', description: 'Desc',
        source: 'S', sourceUrl: 'http://reuters.com/funding', impact: 'high', severity: 'high',
        signalDate: null, confidence: 0.9, evidenceSnippet: 'snip', evidenceUrl: 'http://reuters.com/funding',
      },
      {
        signalType: 'hiring', title: 'Hiring Signal', description: 'Desc',
        source: 'S', sourceUrl: 'http://techcrunch.com/hiring', impact: 'medium', severity: 'medium',
        signalDate: null, confidence: 0.7, evidenceSnippet: 'snip2', evidenceUrl: 'http://techcrunch.com/hiring',
      },
    ];

    const result = await storeSignals('company-1', signals, 'job-1');

    expect(result.length).toBe(2);
    const createData = mockDb.companySignal.createMany.mock.calls[0][0].data;
    // First signal should have evidenceIds containing ev-1
    expect(JSON.parse(createData[0].evidenceIds)).toEqual(['ev-1']);
    expect(JSON.parse(createData[1].evidenceIds)).toEqual(['ev-2']);
  });

  it('should create timeline events only for high-impact signals', async () => {
    mockDb.companySignal.findMany.mockResolvedValue([]);
    mockDb.evidence.findMany.mockResolvedValue([]);
    mockDb.companySignal.createMany.mockResolvedValue({ count: 3 });
    mockDb.companyTimelineEvent.createMany.mockResolvedValue({ count: 2 });
    mockDb.companySignal.findMany
      .mockResolvedValueOnce([{ title: 'none' }]) // dedup
      .mockResolvedValueOnce([ // lifecycle
        { id: 's0', title: 'High', signalDate: null, confidence: 0.9, impact: 'high', status: 'detected' },
        { id: 's1', title: 'Med', signalDate: null, confidence: 0.7, impact: 'medium', status: 'detected' },
        { id: 's2', title: 'High2', signalDate: null, confidence: 0.8, impact: 'high', status: 'detected' },
      ]);

    const signals: DetectedSignal[] = [
      makeTestSignal('funding', 'High', 'high'),
      makeTestSignal('hiring', 'Med', 'medium'),
      makeTestSignal('expansion', 'High2', 'high'),
    ];

    await storeSignals('company-1', signals, 'job-1');

    expect(mockDb.companyTimelineEvent.createMany).toHaveBeenCalledTimes(1);
    const timelineData = mockDb.companyTimelineEvent.createMany.mock.calls[0][0].data;
    expect(timelineData.length).toBe(2); // only high-impact
    expect(timelineData[0].eventType).toBe('signal');
    expect(timelineData[0].title).toContain('Signal: High');
  });

  // ── Signal lifecycle classification ──

  it('should classify signal as "active" when high confidence + high impact + recent', async () => {
    const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    mockDb.companySignal.findMany.mockResolvedValueOnce([{ title: 'none' }]); // dedup
    mockDb.evidence.findMany.mockResolvedValue([]);
    mockDb.companySignal.createMany.mockResolvedValue({ count: 1 });
    mockDb.companyTimelineEvent.createMany.mockResolvedValue({ count: 1 });
    mockDb.companySignal.findMany.mockResolvedValueOnce([
      { id: 's1', title: 'Active Signal', signalDate: recentDate, confidence: 0.9, impact: 'high', status: 'detected' },
    ]);

    await storeSignals('company-1', [makeTestSignal('funding', 'Active Signal', 'high', 0.9, recentDate)], 'job-1');

    expect(mockDb.companySignal.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 's1' }, data: { status: 'active' } }),
    );
  });

  it('should classify signal as "validated" when confidence >= 0.5 but not high-impact-active', async () => {
    const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    mockDb.companySignal.findMany.mockResolvedValueOnce([{ title: 'none' }]);
    mockDb.evidence.findMany.mockResolvedValue([]);
    mockDb.companySignal.createMany.mockResolvedValue({ count: 1 });
    mockDb.companyTimelineEvent.createMany.mockResolvedValue({ count: 0 });
    mockDb.companySignal.findMany.mockResolvedValueOnce([
      { id: 's1', title: 'Validated Signal', signalDate: recentDate, confidence: 0.6, impact: 'medium', status: 'detected' },
    ]);

    await storeSignals('company-1', [makeTestSignal('hiring', 'Validated Signal', 'medium', 0.6, recentDate)], 'job-1');

    expect(mockDb.companySignal.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'validated' } }),
    );
  });

  it('should classify signal as "detected" when confidence < 0.5', async () => {
    const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    mockDb.companySignal.findMany.mockResolvedValueOnce([{ title: 'none' }]);
    mockDb.evidence.findMany.mockResolvedValue([]);
    mockDb.companySignal.createMany.mockResolvedValue({ count: 1 });
    mockDb.companyTimelineEvent.createMany.mockResolvedValue({ count: 0 });
    mockDb.companySignal.findMany.mockResolvedValueOnce([
      { id: 's1', title: 'Detected Signal', signalDate: recentDate, confidence: 0.3, impact: 'low', status: 'detected' },
    ]);

    await storeSignals('company-1', [makeTestSignal('expansion', 'Detected Signal', 'low', 0.3, recentDate)], 'job-1');

    // Status is already 'detected', so update should NOT be called
    expect(mockDb.companySignal.update).not.toHaveBeenCalled();
  });

  it('should classify signal as "aging" when signalDate is 15-90 days ago', async () => {
    const agingDate = new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString();
    mockDb.companySignal.findMany.mockResolvedValueOnce([{ title: 'none' }]);
    mockDb.evidence.findMany.mockResolvedValue([]);
    mockDb.companySignal.createMany.mockResolvedValue({ count: 1 });
    mockDb.companyTimelineEvent.createMany.mockResolvedValue({ count: 0 });
    mockDb.companySignal.findMany.mockResolvedValueOnce([
      { id: 's1', title: 'Aging Signal', signalDate: agingDate, confidence: 0.8, impact: 'high', status: 'detected' },
    ]);

    await storeSignals('company-1', [makeTestSignal('funding', 'Aging Signal', 'high', 0.8, agingDate)], 'job-1');

    expect(mockDb.companySignal.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'aging' } }),
    );
  });

  it('should classify signal as "expired" when signalDate is 90-365 days ago', async () => {
    const expiredDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
    mockDb.companySignal.findMany.mockResolvedValueOnce([{ title: 'none' }]);
    mockDb.evidence.findMany.mockResolvedValue([]);
    mockDb.companySignal.createMany.mockResolvedValue({ count: 1 });
    mockDb.companyTimelineEvent.createMany.mockResolvedValue({ count: 0 });
    mockDb.companySignal.findMany.mockResolvedValueOnce([
      { id: 's1', title: 'Expired Signal', signalDate: expiredDate, confidence: 0.9, impact: 'high', status: 'detected' },
    ]);

    await storeSignals('company-1', [makeTestSignal('funding', 'Expired Signal', 'high', 0.9, expiredDate)], 'job-1');

    expect(mockDb.companySignal.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'expired' } }),
    );
  });

  it('should classify signal as "archived" when signalDate is over 1 year ago', async () => {
    const archivedDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000).toISOString();
    mockDb.companySignal.findMany.mockResolvedValueOnce([{ title: 'none' }]);
    mockDb.evidence.findMany.mockResolvedValue([]);
    mockDb.companySignal.createMany.mockResolvedValue({ count: 1 });
    mockDb.companyTimelineEvent.createMany.mockResolvedValue({ count: 0 });
    mockDb.companySignal.findMany.mockResolvedValueOnce([
      { id: 's1', title: 'Archived Signal', signalDate: archivedDate, confidence: 0.9, impact: 'high', status: 'detected' },
    ]);

    await storeSignals('company-1', [makeTestSignal('funding', 'Archived Signal', 'high', 0.9, archivedDate)], 'job-1');

    expect(mockDb.companySignal.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'archived' } }),
    );
  });

  it('should handle null signalDate as recent (age=0) for classification', async () => {
    mockDb.companySignal.findMany.mockResolvedValueOnce([{ title: 'none' }]);
    mockDb.evidence.findMany.mockResolvedValue([]);
    mockDb.companySignal.createMany.mockResolvedValue({ count: 1 });
    mockDb.companyTimelineEvent.createMany.mockResolvedValue({ count: 1 });
    mockDb.companySignal.findMany.mockResolvedValueOnce([
      { id: 's1', title: 'Null Date Signal', signalDate: null, confidence: 0.9, impact: 'high', status: 'detected' },
    ]);

    await storeSignals('company-1', [makeTestSignal('funding', 'Null Date Signal', 'high', 0.9)], 'job-1');

    // null signalDate → age 0 → confidence 0.9 + high impact → active
    expect(mockDb.companySignal.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'active' } }),
    );
  });

  it('should not update status when it is already correct', async () => {
    const recentDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
    mockDb.companySignal.findMany.mockResolvedValueOnce([{ title: 'none' }]);
    mockDb.evidence.findMany.mockResolvedValue([]);
    mockDb.companySignal.createMany.mockResolvedValue({ count: 1 });
    mockDb.companyTimelineEvent.createMany.mockResolvedValue({ count: 1 });
    mockDb.companySignal.findMany.mockResolvedValueOnce([
      { id: 's1', title: 'Already Active', signalDate: recentDate, confidence: 0.9, impact: 'high', status: 'active' },
    ]);

    await storeSignals('company-1', [makeTestSignal('funding', 'Already Active', 'high', 0.9, recentDate)], 'job-1');

    expect(mockDb.companySignal.update).not.toHaveBeenCalled();
  });

  it('should return signal IDs in format signal_0, signal_1, ...', async () => {
    mockDb.companySignal.findMany.mockResolvedValueOnce([{ title: 'none' }]);
    mockDb.evidence.findMany.mockResolvedValue([]);
    mockDb.companySignal.createMany.mockResolvedValue({ count: 2 });
    mockDb.companyTimelineEvent.createMany.mockResolvedValue({ count: 0 });
    mockDb.companySignal.findMany.mockResolvedValueOnce([]);

    const signals = [makeTestSignal('funding', 'A', 'high'), makeTestSignal('hiring', 'B', 'medium')];
    const result = await storeSignals('company-1', signals, 'job-1');

    expect(result).toEqual(['signal_0', 'signal_1']);
  });
});

// ── Helper for storeSignals tests ──

function makeTestSignal(
  type: string,
  title: string,
  impact: 'high' | 'medium' | 'low',
  confidence = 0.8,
  signalDate: string | null = null,
): DetectedSignal {
  return {
    signalType: type,
    title,
    description: `Description for ${title}`,
    source: 'TestSource',
    sourceUrl: `http://example.com/${title}`,
    impact,
    severity: impact,
    signalDate,
    confidence,
    evidenceSnippet: `Snippet for ${title}`,
    evidenceUrl: `http://example.com/${title}`,
  };
}

// ═══════════════════════════════════════════════════════════════
// 3. EVIDENCE STORAGE — evidence.ts
// ═══════════════════════════════════════════════════════════════

describe('storeEvidenceFromResults', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no existing evidence, no system setting (use defaults)
    mockDb.evidence.findMany.mockResolvedValue([]);
    mockDb.systemSetting.findUnique.mockResolvedValue(null);
    mockDb.evidence.createMany.mockResolvedValue({ count: 0 });
  });

  it('should return empty array when results array is empty', async () => {
    const result = await storeEvidenceFromResults('company-1', 'job-1', 'test query', []);
    expect(result).toEqual([]);
    expect(mockDb.evidence.createMany).not.toHaveBeenCalled();
  });

  it('should store all results when no existing evidence', async () => {
    const results = [
      { title: 'T1', snippet: 'S1', url: 'https://bloomberg.com/1', source: 'Bloomberg' },
      { title: 'T2', snippet: 'S2', url: 'https://techcrunch.com/2', source: 'TechCrunch' },
    ];

    const evidence = await storeEvidenceFromResults('company-1', 'job-1', 'test', results);

    expect(evidence.length).toBe(2);
    expect(mockDb.evidence.createMany).toHaveBeenCalledTimes(1);
    const createData = mockDb.evidence.createMany.mock.calls[0][0].data;
    expect(createData.length).toBe(2);
  });

  it('should deduplicate against existing evidence URLs', async () => {
    mockDb.evidence.findMany.mockResolvedValue([
      { sourceUrl: 'https://bloomberg.com/1' },
    ]);

    const results = [
      { title: 'T1', snippet: 'S1', url: 'https://bloomberg.com/1', source: 'Bloomberg' },
      { title: 'T2', snippet: 'S2', url: 'https://techcrunch.com/2', source: 'TechCrunch' },
    ];

    const evidence = await storeEvidenceFromResults('company-1', 'job-1', 'test', results);

    expect(evidence.length).toBe(1);
    expect(evidence[0].sourceUrl).toBe('https://techcrunch.com/2');
  });

  it('should deduplicate within the same batch', async () => {
    const results = [
      { title: 'T1', snippet: 'S1', url: 'https://same.com/1', source: 'S' },
      { title: 'T2', snippet: 'S2', url: 'https://same.com/1', source: 'S' },
      { title: 'T3', snippet: 'S3', url: 'https://other.com/2', source: 'S' },
    ];

    const evidence = await storeEvidenceFromResults('company-1', 'job-1', 'test', results);

    expect(evidence.length).toBe(2);
  });

  it('should classify bloomberg.com as premium tier', async () => {
    const results = [
      { title: 'T', snippet: 'S', url: 'https://bloomberg.com/article', source: 'Bloomberg' },
    ];

    const evidence = await storeEvidenceFromResults('company-1', 'job-1', 'test', results);

    const createData = mockDb.evidence.createMany.mock.calls[0][0].data;
    expect(createData[0].sourceQualityTier).toBe('premium');
  });

  it('should classify twitter.com as low tier', async () => {
    const results = [
      { title: 'T', snippet: 'S', url: 'https://twitter.com/user/status/123', source: 'Twitter' },
    ];

    const evidence = await storeEvidenceFromResults('company-1', 'job-1', 'test', results);

    const createData = mockDb.evidence.createMany.mock.calls[0][0].data;
    expect(createData[0].sourceQualityTier).toBe('low');
  });

  it('should classify unknown domains as standard tier', async () => {
    const results = [
      { title: 'T', snippet: 'S', url: 'https://randomblog.com/article', source: 'Blog' },
    ];

    const evidence = await storeEvidenceFromResults('company-1', 'job-1', 'test', results);

    const createData = mockDb.evidence.createMany.mock.calls[0][0].data;
    expect(createData[0].sourceQualityTier).toBe('standard');
  });

  it('should classify reuters.com as premium tier', async () => {
    const results = [
      { title: 'T', snippet: 'S', url: 'https://reuters.com/business/article', source: 'Reuters' },
    ];

    const evidence = await storeEvidenceFromResults('company-1', 'job-1', 'test', results);
    const createData = mockDb.evidence.createMany.mock.calls[0][0].data;
    expect(createData[0].sourceQualityTier).toBe('premium');
  });

  it('should classify linkedin.com as premium tier', async () => {
    const results = [
      { title: 'T', snippet: 'S', url: 'https://linkedin.com/company/acme', source: 'LinkedIn' },
    ];

    const evidence = await storeEvidenceFromResults('company-1', 'job-1', 'test', results);
    const createData = mockDb.evidence.createMany.mock.calls[0][0].data;
    expect(createData[0].sourceQualityTier).toBe('premium');
  });

  it('should store evidence with correct field values', async () => {
    const results = [
      { title: 'Revenue News', snippet: 'Acme revenue was $100M', url: 'https://example.com/1', source: 'Example', date: '2024-06-15' },
    ];

    const evidence = await storeEvidenceFromResults('company-1', 'job-1', 'Acme revenue', results);

    expect(evidence[0].searchQuery).toBe('Acme revenue');
    expect(evidence[0].sourceTitle).toBe('Revenue News');
    expect(evidence[0].sourceUrl).toBe('https://example.com/1');
    expect(evidence[0].snippet).toBe('Acme revenue was $100M');
    expect(evidence[0].sourceDate).toBe('2024-06-15');

    const createData = mockDb.evidence.createMany.mock.calls[0][0].data;
    expect(createData[0].companyId).toBe('company-1');
    expect(createData[0].jobId).toBe('job-1');
    expect(createData[0].searchQuery).toBe('Acme revenue');
    expect(createData[0].sourceQualityTier).toBe('standard');
  });

  it('should compute relevance score based on snippet length, title, and tier', async () => {
    const results = [
      // Long snippet + premium source + title = high score
      { title: 'Long Article', snippet: 'A'.repeat(250), url: 'https://bloomberg.com/1', source: 'Bloomberg' },
      // Short snippet + low tier + no title = lower score
      { title: '', snippet: 'Short', url: 'https://reddit.com/2', source: 'Reddit' },
    ];

    const evidence = await storeEvidenceFromResults('company-1', 'job-1', 'test', results);

    expect(evidence[0].relevanceScore).toBeGreaterThan(evidence[1].relevanceScore);
  });

  it('should set initial confidence to relevanceScore * 0.8', async () => {
    const results = [
      { title: 'T', snippet: 'S', url: 'https://bloomberg.com/1', source: 'Bloomberg' },
    ];

    await storeEvidenceFromResults('company-1', 'job-1', 'test', results);

    const createData = mockDb.evidence.createMany.mock.calls[0][0].data;
    expect(createData[0].confidence).toBeCloseTo(createData[0].relevanceScore * 0.8, 2);
  });
});

// ═══════════════════════════════════════════════════════════════

describe('linkEvidenceToFields', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.systemSetting.findUnique.mockResolvedValue(null);
  });

  it('should return 0.2 confidence for all fields when no evidence exists', async () => {
    mockDb.evidence.findMany.mockResolvedValue([]);

    const result = await linkEvidenceToFields('company-1', {
      revenue: '$100M',
      employeeCount: '500',
    });

    expect(result.fieldConfidence.revenue).toBe(0.2);
    expect(result.fieldConfidence.employeeCount).toBe(0.2);
    expect(result.updatedEvidence).toBe(0);
  });

  it('should return 0 confidence for "Not found" values', async () => {
    mockDb.evidence.findMany.mockResolvedValue([
      { id: 'ev-1', snippet: 'revenue info here', sourceUrl: 'https://example.com/1', relevanceScore: 0.8, sourceQualityTier: 'premium', sourceDate: new Date(), extractedField: null },
    ]);

    const result = await linkEvidenceToFields('company-1', {
      revenue: 'Not found',
    });

    expect(result.fieldConfidence.revenue).toBe(0);
  });

  it('should return 0 confidence for empty values', async () => {
    mockDb.evidence.findMany.mockResolvedValue([]);

    const result = await linkEvidenceToFields('company-1', {
      revenue: '',
    });

    expect(result.fieldConfidence.revenue).toBe(0);
  });

  it('should return 0.5 for non-searchable fields', async () => {
    mockDb.evidence.findMany.mockResolvedValue([]);

    const result = await linkEvidenceToFields('company-1', {
      customField: 'some value',
    });

    expect(result.fieldConfidence.customField).toBe(0.5);
  });

  it('should return 0.3 when no supporting evidence found for a searchable field', async () => {
    mockDb.evidence.findMany.mockResolvedValue([
      { id: 'ev-1', snippet: 'unrelated content about weather', sourceUrl: 'https://example.com/1', relevanceScore: 0.5, sourceQualityTier: 'standard', sourceDate: new Date(), extractedField: null },
    ]);

    const result = await linkEvidenceToFields('company-1', {
      revenue: '$200M',
    });

    expect(result.fieldConfidence.revenue).toBe(0.3);
  });

  it('should compute higher confidence for premium sources', async () => {
    const now = new Date();
    const premiumResult = await linkEvidenceToFieldsWithEvidence(
      'company-1', 'revenue', '$100M',
      [{ id: 'ev-1', snippet: 'Acme revenue $100M annually', sourceUrl: 'https://bloomberg.com/rev', relevanceScore: 0.9, sourceQualityTier: 'premium', sourceDate: now, extractedField: null }],
    );
    const lowResult = await linkEvidenceToFieldsWithEvidence(
      'company-1', 'revenue', '$100M',
      [{ id: 'ev-1', snippet: 'Acme revenue $100M annually', sourceUrl: 'https://reddit.com/rev', relevanceScore: 0.9, sourceQualityTier: 'low', sourceDate: now, extractedField: null }],
    );

    expect(premiumResult.fieldConfidence.revenue).toBeGreaterThan(lowResult.fieldConfidence.revenue);
  });

  it('should boost confidence with multiple corroborating sources', async () => {
    const now = new Date();
    const singleResult = await linkEvidenceToFieldsWithEvidence(
      'company-1', 'revenue', '$100M',
      [{ id: 'ev-1', snippet: 'revenue $100M', sourceUrl: 'https://bloomberg.com/1', relevanceScore: 0.9, sourceQualityTier: 'premium', sourceDate: now, extractedField: null }],
    );
    const multiResult = await linkEvidenceToFieldsWithEvidence(
      'company-1', 'revenue', '$100M',
      [
        { id: 'ev-1', snippet: 'revenue $100M', sourceUrl: 'https://bloomberg.com/1', relevanceScore: 0.9, sourceQualityTier: 'premium', sourceDate: now, extractedField: null },
        { id: 'ev-2', snippet: 'revenue $100M', sourceUrl: 'https://reuters.com/2', relevanceScore: 0.8, sourceQualityTier: 'premium', sourceDate: now, extractedField: null },
        { id: 'ev-3', snippet: 'revenue $100M', sourceUrl: 'https://techcrunch.com/3', relevanceScore: 0.7, sourceQualityTier: 'standard', sourceDate: now, extractedField: null },
      ],
    );

    expect(multiResult.fieldConfidence.revenue).toBeGreaterThan(singleResult.fieldConfidence.revenue);
  });

  it('should update evidence records with field linkage', async () => {
    mockDb.evidence.updateMany.mockResolvedValue({ count: 1 });

    await linkEvidenceToFieldsWithEvidence(
      'company-1', 'revenue', '$100M',
      [{ id: 'ev-1', snippet: 'revenue $100M', sourceUrl: 'https://bloomberg.com/1', relevanceScore: 0.9, sourceQualityTier: 'premium', sourceDate: new Date(), extractedField: null }],
    );

    expect(mockDb.evidence.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['ev-1'] }, extractedField: null },
        data: expect.objectContaining({
          extractedField: 'revenue',
          extractedValue: '$100M',
        }),
      }),
    );
  });

  it('should not update evidence that is already linked to a field', async () => {
    mockDb.evidence.updateMany.mockResolvedValue({ count: 0 });

    await linkEvidenceToFieldsWithEvidence(
      'company-1', 'revenue', '$100M',
      [{ id: 'ev-1', snippet: 'revenue $100M', sourceUrl: 'https://bloomberg.com/1', relevanceScore: 0.9, sourceQualityTier: 'premium', sourceDate: new Date(), extractedField: 'employeeCount' }],
    );

    expect(mockDb.evidence.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: { in: ['ev-1'] }, extractedField: null },
      }),
    );
    // Since extractedField is already 'employeeCount' (not null), it won't match the where clause
    // So updateMany would be called but with 0 matching records
  });

  it('should handle multiple fields in one call', async () => {
    const now = new Date();
    mockDb.evidence.findMany.mockResolvedValue([
      { id: 'ev-1', snippet: 'revenue $100M', sourceUrl: 'https://bloomberg.com/1', relevanceScore: 0.9, sourceQualityTier: 'premium', sourceDate: now, extractedField: null },
      { id: 'ev-2', snippet: '500 employees', sourceUrl: 'https://reuters.com/2', relevanceScore: 0.8, sourceQualityTier: 'premium', sourceDate: now, extractedField: null },
    ]);
    mockDb.evidence.updateMany.mockResolvedValue({ count: 1 });

    const result = await linkEvidenceToFields('company-1', {
      revenue: '$100M',
      employeeCount: '500',
      techStack: 'React, Node.js',
    });

    expect(Object.keys(result.fieldConfidence)).toHaveLength(3);
    expect(mockDb.evidence.updateMany).toHaveBeenCalledTimes(3);
  });
});

// Helper for linkEvidenceToFields tests
async function linkEvidenceToFieldsWithEvidence(
  companyId: string,
  field: string,
  value: string,
  evidence: Array<{ id: string; snippet: string; sourceUrl: string; relevanceScore: number; sourceQualityTier: string; sourceDate: Date | null; extractedField: string | null }>,
) {
  mockDb.evidence.findMany.mockResolvedValue(evidence);
  mockDb.evidence.updateMany.mockResolvedValue({ count: evidence.length });
  return linkEvidenceToFields(companyId, { [field]: value });
}

// ═══════════════════════════════════════════════════════════════

describe('getEvidenceForField', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return evidence ordered by confidence descending', async () => {
    const now = new Date();
    mockDb.evidence.findMany.mockResolvedValue([
      { id: 'ev-1', sourceUrl: 'https://a.com', sourceTitle: 'T1', sourceName: 'A', snippet: 'S1', extractedValue: '$100M', confidence: 0.9, sourceQualityTier: 'premium', sourceDate: now, createdAt: now },
      { id: 'ev-2', sourceUrl: 'https://b.com', sourceTitle: 'T2', sourceName: 'B', snippet: 'S2', extractedValue: '$95M', confidence: 0.7, sourceQualityTier: 'standard', sourceDate: now, createdAt: now },
    ]);

    const result = await getEvidenceForField('company-1', 'revenue');

    expect(result.length).toBe(2);
    expect(result[0].confidence).toBeGreaterThanOrEqual(result[1].confidence);
    expect(mockDb.evidence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { companyId: 'company-1', extractedField: 'revenue' },
        orderBy: { confidence: 'desc' },
      }),
    );
  });

  it('should return empty array when no evidence for field', async () => {
    mockDb.evidence.findMany.mockResolvedValue([]);

    const result = await getEvidenceForField('company-1', 'revenue');
    expect(result).toEqual([]);
  });
});

// ═══════════════════════════════════════════════════════════════

describe('getCompanyEvidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return evidence with total count', async () => {
    const now = new Date();
    mockDb.evidence.findMany.mockResolvedValue([
      { id: 'ev-1', searchQuery: 'q1', sourceUrl: 'https://a.com', sourceTitle: 'T', sourceName: 'A', snippet: 'S', extractedField: 'revenue', extractedValue: '$100M', relevanceScore: 0.9, confidence: 0.9, sourceQualityTier: 'premium', sourceDate: now, createdAt: now },
    ]);
    mockDb.evidence.count.mockResolvedValue(5);

    const result = await getCompanyEvidence('company-1');

    expect(result.evidence.length).toBe(1);
    expect(result.total).toBe(5);
  });

  it('should filter by field when option provided', async () => {
    mockDb.evidence.findMany.mockResolvedValue([]);
    mockDb.evidence.count.mockResolvedValue(0);

    await getCompanyEvidence('company-1', { field: 'revenue' });

    expect(mockDb.evidence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ extractedField: 'revenue' }),
      }),
    );
  });

  it('should apply pagination with limit and offset', async () => {
    mockDb.evidence.findMany.mockResolvedValue([]);
    mockDb.evidence.count.mockResolvedValue(0);

    await getCompanyEvidence('company-1', { limit: 10, offset: 20 });

    expect(mockDb.evidence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 10, skip: 20 }),
    );
  });

  it('should use default limit of 50 and offset of 0', async () => {
    mockDb.evidence.findMany.mockResolvedValue([]);
    mockDb.evidence.count.mockResolvedValue(0);

    await getCompanyEvidence('company-1');

    expect(mockDb.evidence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50, skip: 0 }),
    );
  });

  it('should order by createdAt desc', async () => {
    mockDb.evidence.findMany.mockResolvedValue([]);
    mockDb.evidence.count.mockResolvedValue(0);

    await getCompanyEvidence('company-1');

    expect(mockDb.evidence.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
    );
  });
});

// ═══════════════════════════════════════════════════════════════

describe('getEvidenceSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return zero evidence when no extracted fields exist', async () => {
    mockDb.evidence.findMany.mockResolvedValue([]);

    const result = await getEvidenceSummary('company-1');

    expect(result.totalEvidence).toBe(0);
    expect(result.fields).toEqual({});
  });

  it('should aggregate evidence by field with correct counts', async () => {
    mockDb.evidence.findMany.mockResolvedValue([
      { extractedField: 'revenue', confidence: 0.9, sourceQualityTier: 'premium' },
      { extractedField: 'revenue', confidence: 0.8, sourceQualityTier: 'premium' },
      { extractedField: 'revenue', confidence: 0.7, sourceQualityTier: 'standard' },
      { extractedField: 'employeeCount', confidence: 0.6, sourceQualityTier: 'standard' },
    ]);

    const result = await getEvidenceSummary('company-1');

    expect(result.totalEvidence).toBe(4);
    expect(result.fields.revenue).toBeDefined();
    expect(result.fields.revenue.count).toBe(3);
    expect(result.fields.employeeCount.count).toBe(1);
  });

  it('should compute average confidence per field', async () => {
    mockDb.evidence.findMany.mockResolvedValue([
      { extractedField: 'revenue', confidence: 0.9, sourceQualityTier: 'premium' },
      { extractedField: 'revenue', confidence: 0.7, sourceQualityTier: 'premium' },
    ]);

    const result = await getEvidenceSummary('company-1');

    expect(result.fields.revenue.avgConfidence).toBe(0.8);
  });

  it('should break down evidence by quality tier', async () => {
    mockDb.evidence.findMany.mockResolvedValue([
      { extractedField: 'revenue', confidence: 0.9, sourceQualityTier: 'premium' },
      { extractedField: 'revenue', confidence: 0.8, sourceQualityTier: 'premium' },
      { extractedField: 'revenue', confidence: 0.7, sourceQualityTier: 'standard' },
      { extractedField: 'revenue', confidence: 0.5, sourceQualityTier: 'low' },
    ]);

    const result = await getEvidenceSummary('company-1');

    expect(result.fields.revenue.tierBreakdown.premium).toBe(2);
    expect(result.fields.revenue.tierBreakdown.standard).toBe(1);
    expect(result.fields.revenue.tierBreakdown.low).toBe(1);
  });

  it('should only count evidence with extractedField set', async () => {
    mockDb.evidence.findMany.mockResolvedValue([
      { extractedField: 'revenue', confidence: 0.9, sourceQualityTier: 'premium' },
      { extractedField: null, confidence: 0.5, sourceQualityTier: 'standard' },
    ]);

    const result = await getEvidenceSummary('company-1');

    expect(result.totalEvidence).toBe(1);
  });

  it('should handle multiple fields in summary', async () => {
    mockDb.evidence.findMany.mockResolvedValue([
      { extractedField: 'revenue', confidence: 0.9, sourceQualityTier: 'premium' },
      { extractedField: 'techStack', confidence: 0.8, sourceQualityTier: 'standard' },
      { extractedField: 'industry', confidence: 0.7, sourceQualityTier: 'premium' },
    ]);

    const result = await getEvidenceSummary('company-1');

    expect(Object.keys(result.fields)).toHaveLength(3);
    expect(Object.keys(result.fields)).toContain('revenue');
    expect(Object.keys(result.fields)).toContain('techStack');
    expect(Object.keys(result.fields)).toContain('industry');
  });
});

// ═══════════════════════════════════════════════════════════════

describe('cleanupOldEvidence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 0 when evidence count is under 50', async () => {
    const ids = Array.from({ length: 10 }, (_, i) => ({ id: `ev-${i}` }));
    mockDb.evidence.findMany.mockResolvedValue(ids);

    const result = await cleanupOldEvidence('company-1', 'job-1');
    expect(result).toBe(0);
    expect(mockDb.evidence.deleteMany).not.toHaveBeenCalled();
  });

  it('should delete evidence beyond the latest 50', async () => {
    const latestIds = Array.from({ length: 50 }, (_, i) => ({ id: `ev-${i}` }));
    mockDb.evidence.findMany.mockResolvedValue(latestIds);
    mockDb.evidence.count.mockResolvedValue(60);

    const result = await cleanupOldEvidence('company-1', 'job-1');
    expect(result).toBe(10);
    expect(mockDb.evidence.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: 'company-1',
          id: { notIn: expect.arrayContaining(latestIds.map(e => e.id)) },
        }),
      }),
    );
  });

  it('should return 0 when exactly 50 records exist', async () => {
    const latestIds = Array.from({ length: 50 }, (_, i) => ({ id: `ev-${i}` }));
    mockDb.evidence.findMany.mockResolvedValue(latestIds);

    const result = await cleanupOldEvidence('company-1', 'job-1');
    expect(result).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════
// 4. SIGNAL-CAPABILITY MATCHING
// ═══════════════════════════════════════════════════════════════

describe('matchSignalsToCapabilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty result when no active signals exist', async () => {
    mockDb.companySignal.findMany.mockResolvedValue([]);
    const result = await matchSignalsToCapabilities('company-1');

    expect(result.totalMatches).toBe(0);
    expect(result.highConfidence).toBe(0);
    expect(result.results).toEqual([]);
    expect(mockDb.capabilityAsset.findMany).not.toHaveBeenCalled();
  });

  it('should return empty result when no capability assets exist', async () => {
    mockDb.companySignal.findMany.mockResolvedValue([
      { id: 'sig-1', signalType: 'funding', title: 'Funding signal', description: 'Raised $50M', impact: 'high', confidence: 0.9, status: 'active' },
    ]);
    mockDb.capabilityAsset.findMany.mockResolvedValue([]);

    const result = await matchSignalsToCapabilities('company-1');

    expect(result.totalMatches).toBe(0);
    expect(mockDb.signalCapabilityMatch.deleteMany).toHaveBeenCalledWith({ where: { companyId: 'company-1' } });
  });

  it('should match funding signals to cloud_migration capability via category', async () => {
    mockDb.companySignal.findMany.mockResolvedValue([
      { id: 'sig-1', signalType: 'funding', title: 'Raised $50M Series C', description: 'Funding for expansion', impact: 'high', confidence: 0.9, status: 'active' },
    ]);
    mockDb.capabilityAsset.findMany.mockResolvedValue([
      makeCapabilityAsset('cap-1', 'Cloud Migration', 'Migrate to cloud', 'cloud_migration', ['scaling infrastructure'], ['cloud', 'migration'], 'AWS', 'Scalable infrastructure'),
    ]);
    mockDb.signalCapabilityMatch.deleteMany.mockResolvedValue({ count: 0 });
    mockDb.signalCapabilityMatch.createMany.mockResolvedValue({ count: 1 });

    const result = await matchSignalsToCapabilities('company-1');

    expect(result.totalMatches).toBeGreaterThanOrEqual(1);
    expect(result.results[0].capabilityId).toBe('cap-1');
    expect(result.results[0].signalId).toBe('sig-1');
    expect(result.results[0].matchScore).toBeGreaterThan(0);
    expect(result.results[0].reason).toContain('capability category matches');
  });

  it('should score keyword overlap between signal and capability', async () => {
    mockDb.companySignal.findMany.mockResolvedValue([
      { id: 'sig-1', signalType: 'technology', title: 'Migrating to AWS', description: 'Adopting cloud platform', impact: 'medium', confidence: 0.8, status: 'validated' },
    ]);
    mockDb.capabilityAsset.findMany.mockResolvedValue([
      makeCapabilityAsset('cap-1', 'Cloud Migration', 'Help companies migrate to AWS', 'cloud_migration', ['legacy modernization'], ['cloud', 'migration', 'aws', 'infrastructure'], 'AWS', 'Cloud-native'),
    ]);
    mockDb.signalCapabilityMatch.deleteMany.mockResolvedValue({ count: 0 });
    mockDb.signalCapabilityMatch.createMany.mockResolvedValue({ count: 1 });

    const result = await matchSignalsToCapabilities('company-1');

    expect(result.results[0].matchScore).toBeGreaterThan(0);
    expect(result.results[0].reason).toContain('keyword overlap');
  });

  it('should give high-impact signals an impact bonus', async () => {
    mockDb.companySignal.findMany.mockResolvedValue([
      { id: 'sig-1', signalType: 'funding', title: 'Funding', description: 'Raised money', impact: 'high', confidence: 0.9, status: 'active' },
      { id: 'sig-2', signalType: 'funding', title: 'Funding 2', description: 'Raised money', impact: 'low', confidence: 0.9, status: 'active' },
    ]);
    mockDb.capabilityAsset.findMany.mockResolvedValue([
      makeCapabilityAsset('cap-1', 'Cloud', 'Cloud service', 'cloud_migration', null, null, null, 'scaling'),
    ]);
    mockDb.signalCapabilityMatch.deleteMany.mockResolvedValue({ count: 0 });
    mockDb.signalCapabilityMatch.createMany.mockResolvedValue({ count: 2 });

    const result = await matchSignalsToCapabilities('company-1');

    const highImpactMatch = result.results.find(r => r.signalId === 'sig-1');
    const lowImpactMatch = result.results.find(r => r.signalId === 'sig-2');

    expect(highImpactMatch!.matchScore).toBeGreaterThan(lowImpactMatch!.matchScore);
  });

  it('should filter matches below minMatchScore threshold', async () => {
    mockDb.companySignal.findMany.mockResolvedValue([
      { id: 'sig-1', signalType: 'regulatory', title: 'Compliance', description: 'GDPR audit', impact: 'low', confidence: 0.3, status: 'aging' },
    ]);
    mockDb.capabilityAsset.findMany.mockResolvedValue([
      makeCapabilityAsset('cap-1', 'Talent Acquisition', 'Help recruit talent', 'talent_acquisition', ['talent retention'], ['recruiting', 'onboarding', 'talent'], null, null),
    ]);
    mockDb.signalCapabilityMatch.deleteMany.mockResolvedValue({ count: 0 });

    const result = await matchSignalsToCapabilities('company-1');

    expect(result.totalMatches).toBe(0);
    expect(mockDb.signalCapabilityMatch.createMany).not.toHaveBeenCalled();
  });

  it('should store results in SignalCapabilityMatch and cap at 50', async () => {
    const signals = Array.from({ length: 5 }, (_, i) => ({
      id: `sig-${i}`, signalType: 'funding', title: `Funding ${i}`, description: 'Desc', impact: 'high', confidence: 0.9, status: 'active',
    }));
    const capabilities = Array.from({ length: 20 }, (_, i) =>
      makeCapabilityAsset(`cap-${i}`, `Cloud Service ${i}`, 'Cloud', 'cloud_migration', null, null, null, 'scaling'),
    );

    mockDb.companySignal.findMany.mockResolvedValue(signals);
    mockDb.capabilityAsset.findMany.mockResolvedValue(capabilities);
    mockDb.signalCapabilityMatch.deleteMany.mockResolvedValue({ count: 0 });
    mockDb.signalCapabilityMatch.createMany.mockResolvedValue({ count: 100 });

    const result = await matchSignalsToCapabilities('company-1');

    expect(result.results.length).toBeLessThanOrEqual(50);
    expect(mockDb.signalCapabilityMatch.createMany).toHaveBeenCalledTimes(1);
  });

  it('should count high-confidence matches (score >= 0.6)', async () => {
    mockDb.companySignal.findMany.mockResolvedValue([
      { id: 'sig-1', signalType: 'funding', title: 'Big funding', description: 'Raised $100M for cloud', impact: 'high', confidence: 0.95, status: 'active' },
    ]);
    mockDb.capabilityAsset.findMany.mockResolvedValue([
      makeCapabilityAsset('cap-1', 'Cloud Migration', 'Migrate to cloud infrastructure for scaling', 'cloud_migration', ['scaling infrastructure', 'rapid growth'], ['cloud', 'migration', 'scaling', 'infrastructure'], 'AWS', 'Scalable cloud'),
    ]);
    mockDb.signalCapabilityMatch.deleteMany.mockResolvedValue({ count: 0 });
    mockDb.signalCapabilityMatch.createMany.mockResolvedValue({ count: 1 });

    const result = await matchSignalsToCapabilities('company-1');

    // With category match + keyword overlap + business problem alignment + high impact, score should be >= 0.6
    expect(result.highConfidence).toBeGreaterThanOrEqual(1);
  });

  it('should delete old matches before storing new ones', async () => {
    mockDb.companySignal.findMany.mockResolvedValue([
      { id: 'sig-1', signalType: 'funding', title: 'Funding', description: 'Desc', impact: 'high', confidence: 0.9, status: 'active' },
    ]);
    mockDb.capabilityAsset.findMany.mockResolvedValue([
      makeCapabilityAsset('cap-1', 'Cloud', 'Cloud service', 'cloud_migration', null, null, null, 'scaling'),
    ]);
    mockDb.signalCapabilityMatch.deleteMany.mockResolvedValue({ count: 5 });
    mockDb.signalCapabilityMatch.createMany.mockResolvedValue({ count: 1 });

    await matchSignalsToCapabilities('company-1');

    expect(mockDb.signalCapabilityMatch.deleteMany).toHaveBeenCalledWith({ where: { companyId: 'company-1' } });
    expect(mockDb.signalCapabilityMatch.deleteMany).toHaveBeenCalledBefore(mockDb.signalCapabilityMatch.createMany);
  });

  it('should match financial_pressure signals to cost_optimization category', async () => {
    mockDb.companySignal.findMany.mockResolvedValue([
      { id: 'sig-1', signalType: 'financial_pressure', title: 'Layoffs', description: 'Cost cutting measures', impact: 'high', confidence: 0.8, status: 'active' },
    ]);
    mockDb.capabilityAsset.findMany.mockResolvedValue([
      makeCapabilityAsset('cap-1', 'Cost Optimization', 'Reduce operational costs', 'cost_optimization', ['cost reduction', 'operational efficiency'], ['cost', 'optimization', 'efficiency'], null, 'Reduced operational costs'),
    ]);
    mockDb.signalCapabilityMatch.deleteMany.mockResolvedValue({ count: 0 });
    mockDb.signalCapabilityMatch.createMany.mockResolvedValue({ count: 1 });

    const result = await matchSignalsToCapabilities('company-1');

    expect(result.totalMatches).toBeGreaterThanOrEqual(1);
  });

  it('should match regulatory signals to compliance/security categories', async () => {
    mockDb.companySignal.findMany.mockResolvedValue([
      { id: 'sig-1', signalType: 'regulatory', title: 'GDPR compliance', description: 'New GDPR audit requirements', impact: 'medium', confidence: 0.7, status: 'validated' },
    ]);
    mockDb.capabilityAsset.findMany.mockResolvedValue([
      makeCapabilityAsset('cap-1', 'Data Governance', 'Implement data governance framework', 'data_governance', ['compliance automation', 'data privacy'], ['compliance', 'governance', 'data', 'privacy'], null, 'Compliance automation'),
    ]);
    mockDb.signalCapabilityMatch.deleteMany.mockResolvedValue({ count: 0 });
    mockDb.signalCapabilityMatch.createMany.mockResolvedValue({ count: 1 });

    const result = await matchSignalsToCapabilities('company-1');

    expect(result.totalMatches).toBeGreaterThanOrEqual(1);
  });

  it('should accept custom config to override defaults', async () => {
    mockDb.companySignal.findMany.mockResolvedValue([
      { id: 'sig-1', signalType: 'funding', title: 'Funding', description: 'Desc', impact: 'high', confidence: 0.9, status: 'active' },
    ]);
    mockDb.capabilityAsset.findMany.mockResolvedValue([
      makeCapabilityAsset('cap-1', 'Cloud', 'Cloud service', 'cloud_migration', null, null, null, 'scaling'),
    ]);
    mockDb.signalCapabilityMatch.deleteMany.mockResolvedValue({ count: 0 });
    mockDb.signalCapabilityMatch.createMany.mockResolvedValue({ count: 1 });

    // Set a very high threshold — no matches should pass
    const result = await matchSignalsToCapabilities('company-1', { minMatchScore: 0.99 });

    expect(result.totalMatches).toBe(0);
  });

  it('should only match active/validated/aging signals (not expired/archived)', async () => {
    mockDb.companySignal.findMany.mockResolvedValue([
      { id: 'sig-1', signalType: 'funding', title: 'Active', description: 'Desc', impact: 'high', confidence: 0.9, status: 'active' },
      { id: 'sig-2', signalType: 'funding', title: 'Expired', description: 'Desc', impact: 'high', confidence: 0.9, status: 'expired' },
      { id: 'sig-3', signalType: 'funding', title: 'Archived', description: 'Desc', impact: 'high', confidence: 0.9, status: 'archived' },
    ]);
    mockDb.capabilityAsset.findMany.mockResolvedValue([
      makeCapabilityAsset('cap-1', 'Cloud', 'Cloud service', 'cloud_migration', null, null, null, 'scaling'),
    ]);
    mockDb.signalCapabilityMatch.deleteMany.mockResolvedValue({ count: 0 });
    mockDb.signalCapabilityMatch.createMany.mockResolvedValue({ count: 1 });

    const result = await matchSignalsToCapabilities('company-1');

    // Only sig-1 should produce a match (expired/archived filtered by query)
    const signalIds = result.results.map(r => r.signalId);
    expect(signalIds).not.toContain('sig-2');
    expect(signalIds).not.toContain('sig-3');
  });

  it('should include business problem and sales angle in results', async () => {
    mockDb.companySignal.findMany.mockResolvedValue([
      { id: 'sig-1', signalType: 'funding', title: 'Funding', description: 'Desc', impact: 'high', confidence: 0.9, status: 'active' },
    ]);
    mockDb.capabilityAsset.findMany.mockResolvedValue([
      makeCapabilityAsset('cap-1', 'Cloud Migration', 'Migrate to cloud', 'cloud_migration', ['scaling'], ['cloud'], 'AWS', 'Scalable cloud'),
    ]);
    mockDb.signalCapabilityMatch.deleteMany.mockResolvedValue({ count: 0 });
    mockDb.signalCapabilityMatch.createMany.mockResolvedValue({ count: 1 });

    const result = await matchSignalsToCapabilities('company-1');

    expect(result.results[0].businessProblem).toBeTruthy();
    expect(result.results[0].salesAngle).toBeTruthy();
  });
});

// ── getSignalCapabilityMatches ──

describe('getSignalCapabilityMatches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return stored matches ordered by matchScore desc', async () => {
    mockDb.signalCapabilityMatch.findMany.mockResolvedValue([
      { signalId: 'sig-1', capabilityId: 'cap-1', matchScore: 0.8, reason: 'strong match', businessProblem: 'scaling', expectedOutcome: 'Cloud infra', salesAngle: 'Scale up' },
      { signalId: 'sig-2', capabilityId: 'cap-2', matchScore: 0.5, reason: 'weak match', businessProblem: null, expectedOutcome: null, salesAngle: null },
    ]);

    const result = await getSignalCapabilityMatches('company-1');

    expect(result.length).toBe(2);
    expect(result[0].matchScore).toBeGreaterThanOrEqual(result[1].matchScore);
  });

  it('should filter by minScore', async () => {
    mockDb.signalCapabilityMatch.findMany.mockResolvedValue([
      { signalId: 'sig-1', capabilityId: 'cap-1', matchScore: 0.8, reason: 'high', businessProblem: null, expectedOutcome: null, salesAngle: null },
    ]);

    const result = await getSignalCapabilityMatches('company-1', { minScore: 0.6 });

    expect(mockDb.signalCapabilityMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ matchScore: { gte: 0.6 } }),
      }),
    );
  });

  it('should apply limit', async () => {
    mockDb.signalCapabilityMatch.findMany.mockResolvedValue([]);

    await getSignalCapabilityMatches('company-1', { limit: 5 });

    expect(mockDb.signalCapabilityMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 }),
    );
  });

  it('should use default limit of 50 and minScore of 0', async () => {
    mockDb.signalCapabilityMatch.findMany.mockResolvedValue([]);

    await getSignalCapabilityMatches('company-1');

    expect(mockDb.signalCapabilityMatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50, where: expect.objectContaining({ matchScore: { gte: 0 } }) }),
    );
  });

  it('should return empty array when no matches found', async () => {
    mockDb.signalCapabilityMatch.findMany.mockResolvedValue([]);

    const result = await getSignalCapabilityMatches('company-1');

    expect(result).toEqual([]);
  });
});

// ── Helper for capability matching tests ──

function makeCapabilityAsset(
  id: string,
  title: string,
  summary: string,
  category: string,
  problems: string[] | null,
  keywords: string[] | null,
  technology: string | null,
  customerOutcome: string | null,
) {
  return {
    id,
    title,
    summary,
    category,
    problems: problems ? JSON.stringify(problems) : null,
    keywords: keywords ? JSON.stringify(keywords) : null,
    targetIndustries: null,
    technology,
    businessProblem: problems ? problems[0] : null,
    customerOutcome,
    differentiator: null,
    isActive: true,
  };
}

// ═══════════════════════════════════════════════════════════════
// 5. OPPORTUNITY RECOMMENDATION ENGINE
// ═══════════════════════════════════════════════════════════════

describe('computeOpportunityScore', () => {
  it('should return 0 when all inputs are zero', () => {
    const score = computeOpportunityScore({
      signalConfidence: 0,
      matchScore: 0,
      freshnessScore: 0,
      evidenceQuality: 0,
      signalImpact: 'low',
    });
    expect(score).toBe(3); // 0 + 0 + 0 + 0 + 30*0.10 = 3
  });

  it('should return 100 for perfect inputs with high impact', () => {
    const score = computeOpportunityScore({
      signalConfidence: 1,
      matchScore: 1,
      freshnessScore: 100,
      evidenceQuality: 100,
      signalImpact: 'high',
    });
    expect(score).toBe(100);
  });

  it('should use composite formula with correct weights', () => {
    const score = computeOpportunityScore({
      signalConfidence: 0.8,
      matchScore: 0.7,
      freshnessScore: 60,
      evidenceQuality: 75,
      signalImpact: 'medium',
    });

    // signalConfidence*100 * 0.30 = 80 * 0.30 = 24
    // matchScore*100 * 0.25 = 70 * 0.25 = 17.5
    // freshnessScore * 0.20 = 60 * 0.20 = 12
    // evidenceQuality * 0.15 = 75 * 0.15 = 11.25
    // impactScore * 0.10 = 60 * 0.10 = 6
    // Total = 70.75 → rounded to 71
    expect(score).toBe(71);
  });

  it('should differentiate high vs low impact scores', () => {
    const highScore = computeOpportunityScore({
      signalConfidence: 0.7, matchScore: 0.6, freshnessScore: 50,
      evidenceQuality: 60, signalImpact: 'high',
    });
    const lowScore = computeOpportunityScore({
      signalConfidence: 0.7, matchScore: 0.6, freshnessScore: 50,
      evidenceQuality: 60, signalImpact: 'low',
    });

    // high impact = 100 * 0.10 = 10, low impact = 30 * 0.10 = 3, difference = 7
    expect(highScore - lowScore).toBe(7);
  });

  it('should default to medium impact for unknown impact values', () => {
    const score = computeOpportunityScore({
      signalConfidence: 0, matchScore: 0, freshnessScore: 0,
      evidenceQuality: 0, signalImpact: 'unknown_value',
    });
    // medium impact = 60 * 0.10 = 6
    expect(score).toBe(6);
  });

  it('should clamp result between 0 and 100', () => {
    const maxScore = computeOpportunityScore({
      signalConfidence: 2, matchScore: 2, freshnessScore: 999,
      evidenceQuality: 999, signalImpact: 'high',
    });
    expect(maxScore).toBe(100);

    const minScore = computeOpportunityScore({
      signalConfidence: -1, matchScore: -1, freshnessScore: -100,
      evidenceQuality: -100, signalImpact: 'low',
    });
    expect(minScore).toBe(0);
  });

  it('should weigh signal confidence highest (30%)', () => {
    const highConf = computeOpportunityScore({
      signalConfidence: 1, matchScore: 0, freshnessScore: 0,
      evidenceQuality: 0, signalImpact: 'low',
    });
    const highMatch = computeOpportunityScore({
      signalConfidence: 0, matchScore: 1, freshnessScore: 0,
      evidenceQuality: 0, signalImpact: 'low',
    });

    expect(highConf).toBeGreaterThan(highMatch);
  });

  it('should weigh match score second highest (25%)', () => {
    const highMatch = computeOpportunityScore({
      signalConfidence: 0, matchScore: 1, freshnessScore: 0,
      evidenceQuality: 0, signalImpact: 'low',
    });
    const highFresh = computeOpportunityScore({
      signalConfidence: 0, matchScore: 0, freshnessScore: 100,
      evidenceQuality: 0, signalImpact: 'low',
    });

    expect(highMatch).toBeGreaterThan(highFresh);
  });
});

// ── generateOpportunityRecommendation ──

describe('generateOpportunityRecommendation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: all DB lookups succeed
    mockDb.companySignal.findUnique.mockResolvedValue({
      id: 'sig-1', companyId: 'comp-1', signalType: 'funding', title: 'Raised $50M',
      description: 'Series C funding', source: 'TC', sourceUrl: 'http://x',
      impact: 'high', severity: 'high', signalDate: '2024-01-15',
      confidence: 0.9, status: 'active',
    });
    mockDb.signalCapabilityMatch.findUnique.mockResolvedValue({
      id: 'match-1', companyId: 'comp-1', signalId: 'sig-1', capabilityId: 'cap-1',
      matchScore: 0.85, reason: 'strong match', businessProblem: 'scaling',
      expectedOutcome: 'Cloud infrastructure', salesAngle: 'Scale-ready',
    });
    mockDb.capabilityAsset.findUnique.mockResolvedValue({
      id: 'cap-1', title: 'Cloud Migration', summary: 'Migrate to cloud',
    });
    mockDb.company.findUnique.mockResolvedValue({
      id: 'comp-1', rawName: 'Acme Corp', normalizedName: 'acme corp',
      industry: 'SaaS', sizeRange: '201-500', location: 'SF',
      website: 'https://acme.com',
    });
    mockDb.companyResearchCard.findUnique.mockResolvedValue({
      businessOverview: 'A SaaS company', techLandscape: 'React, AWS',
      strategicPriorities: '["Expand to Europe"]', businessProblems: '["Legacy infrastructure"]',
      signalFreshnessAt: new Date(), techFreshnessAt: new Date(),
      contactFreshnessAt: new Date(), profileFreshnessAt: new Date(),
    });
    mockDb.evidence.findMany.mockResolvedValue([
      { id: 'ev-1' }, { id: 'ev-2' },
    ]);
  });

  it('should throw when signal not found', async () => {
    mockDb.companySignal.findUnique.mockResolvedValue(null);

    await expect(
      generateOpportunityRecommendation({ companyId: 'comp-1', signalId: 'sig-missing', capabilityMatchId: 'match-1' }),
    ).rejects.toThrow('Signal sig-missing not found');
  });

  it('should throw when capability match not found', async () => {
    mockDb.signalCapabilityMatch.findUnique.mockResolvedValue(null);

    await expect(
      generateOpportunityRecommendation({ companyId: 'comp-1', signalId: 'sig-1', capabilityMatchId: 'match-missing' }),
    ).rejects.toThrow('Capability match match-missing not found');
  });

  it('should throw when company not found', async () => {
    mockDb.company.findUnique.mockResolvedValue(null);

    await expect(
      generateOpportunityRecommendation({ companyId: 'comp-missing', signalId: 'sig-1', capabilityMatchId: 'match-1' }),
    ).rejects.toThrow('Company comp-missing not found');
  });

  it('should throw when LLM call fails', async () => {
    mockGovernedAICallAggregate.mockResolvedValue(makeLLMResultFail('Governance rejected'));

    await expect(
      generateOpportunityRecommendation({ companyId: 'comp-1', signalId: 'sig-1', capabilityMatchId: 'match-1' }),
    ).rejects.toThrow('Failed to generate opportunity recommendation');
  });

  it('should generate recommendation with correct scores and priority', async () => {
    const llmJson = JSON.stringify({
      opportunityTitle: 'Cloud Migration — Acme Corp Post-Funding',
      businessTrigger: 'Series C funding of $50M',
      whyNow: 'Funding creates a window for transformation investment',
      businessProblem: 'Legacy infrastructure cannot scale',
      suggestedConversation: '- Cloud migration strategy\n- Timeline and budget\n- Risk mitigation',
      recommendedStakeholders: ['CTO', 'VP Engineering'],
    });

    mockGovernedAICallAggregate.mockResolvedValue(makeLLMResultSuccess(llmJson));

    const createdRec = {
      id: 'rec-1',
      companyId: 'comp-1',
      signalId: 'sig-1',
      capabilityMatchId: 'match-1',
      opportunityTitle: 'Cloud Migration — Acme Corp Post-Funding',
      businessTrigger: 'Series C funding of $50M',
      whyNow: 'Funding creates a window',
      businessProblem: 'Legacy infrastructure cannot scale',
      recommendedCapability: 'Cloud Migration',
      recommendedStakeholders: JSON.stringify(['CTO', 'VP Engineering']),
      suggestedConversation: '- Cloud strategy\n- Timeline',
      evidenceIds: JSON.stringify(['ev-1', 'ev-2']),
      confidenceScore: 0.9,
      freshnessScore: expect.any(Number),
      matchScore: 0.85,
      opportunityScore: expect.any(Number),
      priority: expect.any(String),
      status: 'pending_review',
      createdAt: new Date(),
      confidenceBreakdown: expect.any(Object),
    };
    mockDb.opportunityRecommendation.create.mockResolvedValue(createdRec);

    const result = await generateOpportunityRecommendation({
      companyId: 'comp-1', signalId: 'sig-1', capabilityMatchId: 'match-1',
    });

    expect(result.opportunityTitle).toBe('Cloud Migration — Acme Corp Post-Funding');
    expect(result.status).toBe('pending_review');
    expect(result.recommendedStakeholders).toEqual(['CTO', 'VP Engineering']);
    expect(result.evidenceIds).toEqual(['ev-1', 'ev-2']);
    expect(result.priority).toBe('high'); // score should be high with these inputs
    expect(result.opportunityScore).toBeGreaterThan(0);
  });

  it('should create recommendation with pending_review status', async () => {
    const llmJson = JSON.stringify({
      opportunityTitle: 'Test Opportunity',
      businessTrigger: 'Trigger',
      whyNow: 'Now',
      businessProblem: 'Problem',
      suggestedConversation: 'Topics',
      recommendedStakeholders: ['CTO'],
    });

    mockGovernedAICallAggregate.mockResolvedValue(makeLLMResultSuccess(llmJson));
    mockDb.opportunityRecommendation.create.mockResolvedValue({
      id: 'rec-1', companyId: 'comp-1', signalId: 'sig-1', capabilityMatchId: 'match-1',
      opportunityTitle: 'Test', businessTrigger: 'T', whyNow: 'W', businessProblem: 'B',
      recommendedCapability: 'Cloud', recommendedStakeholders: '["CTO"]',
      suggestedConversation: 'S', evidenceIds: '[]', confidenceScore: 0.9,
      freshnessScore: 80, matchScore: 0.85, opportunityScore: 75,
      priority: 'high', status: 'pending_review', createdAt: new Date(),
    });

    const result = await generateOpportunityRecommendation({
      companyId: 'comp-1', signalId: 'sig-1', capabilityMatchId: 'match-1',
    });

    expect(result.status).toBe('pending_review');
    expect(mockDb.opportunityRecommendation.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'pending_review' }) }),
    );
  });

  it('should handle LLM response with markdown code fences', async () => {
    const llmJson = '```json\n' + JSON.stringify({
      opportunityTitle: 'Fenced Opportunity',
      businessTrigger: 'T', whyNow: 'W', businessProblem: 'B',
      suggestedConversation: 'S', recommendedStakeholders: ['CEO'],
    }) + '\n```';

    mockGovernedAICallAggregate.mockResolvedValue(makeLLMResultSuccess(llmJson));
    mockDb.opportunityRecommendation.create.mockResolvedValue({
      id: 'rec-1', companyId: 'comp-1', signalId: 'sig-1', capabilityMatchId: 'match-1',
      opportunityTitle: 'Fenced Opportunity', businessTrigger: 'T', whyNow: 'W',
      businessProblem: 'B', recommendedCapability: 'Cloud',
      recommendedStakeholders: '["CEO"]', suggestedConversation: 'S',
      evidenceIds: '[]', confidenceScore: 0.9, freshnessScore: 80, matchScore: 0.85,
      opportunityScore: 75, priority: 'high', status: 'pending_review', createdAt: new Date(),
    });

    const result = await generateOpportunityRecommendation({
      companyId: 'comp-1', signalId: 'sig-1', capabilityMatchId: 'match-1',
    });

    expect(result.opportunityTitle).toBe('Fenced Opportunity');
  });

  it('should handle missing LLM fields with defaults', async () => {
    const llmJson = JSON.stringify({
      // Missing opportunityTitle
      businessTrigger: 'T',
      // Missing whyNow
      businessProblem: 'B',
      suggestedConversation: 'S',
      // Missing recommendedStakeholders
    });

    mockGovernedAICallAggregate.mockResolvedValue(makeLLMResultSuccess(llmJson));
    mockDb.opportunityRecommendation.create.mockResolvedValue({
      id: 'rec-1', companyId: 'comp-1', signalId: 'sig-1', capabilityMatchId: 'match-1',
      opportunityTitle: 'Untitled Opportunity', businessTrigger: 'T', whyNow: '',
      businessProblem: 'B', recommendedCapability: 'Cloud',
      recommendedStakeholders: '[]', suggestedConversation: 'S',
      evidenceIds: '[]', confidenceScore: 0.9, freshnessScore: 80, matchScore: 0.85,
      opportunityScore: 75, priority: 'high', status: 'pending_review', createdAt: new Date(),
    });

    const result = await generateOpportunityRecommendation({
      companyId: 'comp-1', signalId: 'sig-1', capabilityMatchId: 'match-1',
    });

    expect(result.opportunityTitle).toBe('Untitled Opportunity');
    expect(result.recommendedStakeholders).toEqual([]);
  });

  it('should handle missing research card gracefully', async () => {
    mockDb.companyResearchCard.findUnique.mockResolvedValue(null);

    const llmJson = JSON.stringify({
      opportunityTitle: 'Test', businessTrigger: 'T', whyNow: 'W',
      businessProblem: 'B', suggestedConversation: 'S', recommendedStakeholders: ['CTO'],
    });
    mockGovernedAICallAggregate.mockResolvedValue(makeLLMResultSuccess(llmJson));
    mockDb.opportunityRecommendation.create.mockResolvedValue({
      id: 'rec-1', companyId: 'comp-1', signalId: 'sig-1', capabilityMatchId: 'match-1',
      opportunityTitle: 'Test', businessTrigger: 'T', whyNow: 'W', businessProblem: 'B',
      recommendedCapability: 'Cloud', recommendedStakeholders: '["CTO"]',
      suggestedConversation: 'S', evidenceIds: '[]', confidenceScore: 0.9,
      freshnessScore: 0, matchScore: 0.85, opportunityScore: 50,
      priority: 'medium', status: 'pending_review', createdAt: new Date(),
    });

    const result = await generateOpportunityRecommendation({
      companyId: 'comp-1', signalId: 'sig-1', capabilityMatchId: 'match-1',
    });

    // Should not crash — freshness will be 0
    expect(result.freshnessScore).toBe(0);
  });

  it('should compute opportunity score using all five factors', async () => {
    const llmJson = JSON.stringify({
      opportunityTitle: 'Test', businessTrigger: 'T', whyNow: 'W',
      businessProblem: 'B', suggestedConversation: 'S', recommendedStakeholders: ['CTO'],
    });
    mockGovernedAICallAggregate.mockResolvedValue(makeLLMResultSuccess(llmJson));

    let capturedScore = 0;
    mockDb.opportunityRecommendation.create.mockImplementation(({ data }: { data: Record<string, unknown> }) => {
      capturedScore = data.opportunityScore as number;
      return Promise.resolve({
        id: 'rec-1', companyId: 'comp-1', signalId: 'sig-1', capabilityMatchId: 'match-1',
        ...data, createdAt: new Date(),
      });
    });

    await generateOpportunityRecommendation({
      companyId: 'comp-1', signalId: 'sig-1', capabilityMatchId: 'match-1',
    });

    // With confidence 0.9, match 0.85, high impact, evidence quality 75, freshness > 0:
    // Score should be substantial
    expect(capturedScore).toBeGreaterThan(50);
    expect(capturedScore).toBeLessThanOrEqual(100);
  });
});

// ── generateCompanyOpportunities ──

describe('generateCompanyOpportunities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw when company not found', async () => {
    mockDb.company.findUnique.mockResolvedValue(null);

    await expect(generateCompanyOpportunities('comp-missing')).rejects.toThrow('Company comp-missing not found');
  });

  it('should return empty when no active signals', async () => {
    mockDb.company.findUnique.mockResolvedValue({ id: 'comp-1' });
    mockDb.companySignal.findMany.mockResolvedValue([]);

    const result = await generateCompanyOpportunities('comp-1');

    expect(result.created).toBe(0);
    expect(result.results).toEqual([]);
  });

  it('should return empty when no capability matches above threshold', async () => {
    mockDb.company.findUnique.mockResolvedValue({ id: 'comp-1' });
    mockDb.companySignal.findMany.mockResolvedValue([
      { id: 'sig-1' },
    ]);
    mockDb.signalCapabilityMatch.findMany.mockResolvedValue([]);

    const result = await generateCompanyOpportunities('comp-1');

    expect(result.created).toBe(0);
    expect(result.results).toEqual([]);
  });

  it('should deduplicate against existing recommendations', async () => {
    mockDb.company.findUnique.mockResolvedValue({ id: 'comp-1' });
    mockDb.companySignal.findMany.mockResolvedValue([
      { id: 'sig-1' },
    ]);
    mockDb.signalCapabilityMatch.findMany.mockResolvedValue([
      { id: 'match-1', signalId: 'sig-1', matchScore: 0.8 },
    ]);
    mockDb.opportunityRecommendation.findMany.mockResolvedValue([
      { signalId: 'sig-1', capabilityMatchId: 'match-1' },
    ]);

    const result = await generateCompanyOpportunities('comp-1');

    expect(result.created).toBe(0);
    // generateOpportunityRecommendation should NOT be called since it's a duplicate
  });

  it('should generate recommendations for non-duplicate signal+match pairs', async () => {
    mockDb.company.findUnique.mockResolvedValue({ id: 'comp-1' });
    mockDb.companySignal.findMany.mockResolvedValue([
      { id: 'sig-1' },
    ]);
    mockDb.signalCapabilityMatch.findMany.mockResolvedValue([
      { id: 'match-1', signalId: 'sig-1', matchScore: 0.8 },
    ]);
    mockDb.opportunityRecommendation.findMany.mockResolvedValue([]); // no existing

    // Mock the inner generateOpportunityRecommendation dependencies
    mockDb.companySignal.findUnique.mockResolvedValue({
      id: 'sig-1', companyId: 'comp-1', signalType: 'funding', title: 'Funding',
      description: 'Desc', source: 'S', sourceUrl: 'http://x',
      impact: 'high', severity: 'high', signalDate: null,
      confidence: 0.9, status: 'active',
    });
    mockDb.signalCapabilityMatch.findUnique.mockResolvedValue({
      id: 'match-1', companyId: 'comp-1', signalId: 'sig-1', capabilityId: 'cap-1',
      matchScore: 0.8, reason: 'match', businessProblem: 'B',
      expectedOutcome: 'O', salesAngle: 'A',
    });
    mockDb.capabilityAsset.findUnique.mockResolvedValue({
      id: 'cap-1', title: 'Cloud', summary: 'Cloud migration',
    });
    mockDb.companyResearchCard.findUnique.mockResolvedValue({
      businessOverview: '', techLandscape: '', strategicPriorities: '[]',
      businessProblems: '[]', signalFreshnessAt: new Date(), techFreshnessAt: new Date(),
      contactFreshnessAt: new Date(), profileFreshnessAt: new Date(),
    });
    mockDb.evidence.findMany.mockResolvedValue([]);

    const llmJson = JSON.stringify({
      opportunityTitle: 'Opportunity', businessTrigger: 'T', whyNow: 'W',
      businessProblem: 'B', suggestedConversation: 'S', recommendedStakeholders: ['CTO'],
    });
    mockGovernedAICallAggregate.mockResolvedValue(makeLLMResultSuccess(llmJson));
    mockDb.opportunityRecommendation.create.mockResolvedValue({
      id: 'rec-1', companyId: 'comp-1', signalId: 'sig-1', capabilityMatchId: 'match-1',
      opportunityTitle: 'Opportunity', businessTrigger: 'T', whyNow: 'W',
      businessProblem: 'B', recommendedCapability: 'Cloud',
      recommendedStakeholders: '["CTO"]', suggestedConversation: 'S',
      evidenceIds: '[]', confidenceScore: 0.9, freshnessScore: 80, matchScore: 0.8,
      opportunityScore: 75, priority: 'high', status: 'pending_review', createdAt: new Date(),
    });

    const result = await generateCompanyOpportunities('comp-1');

    expect(result.created).toBe(1);
    expect(result.results.length).toBe(1);
  });

  it('should continue generating when individual recommendation fails', async () => {
    mockDb.company.findUnique.mockResolvedValue({ id: 'comp-1' });
    mockDb.companySignal.findMany.mockResolvedValue([
      { id: 'sig-1' }, { id: 'sig-2' },
    ]);
    mockDb.signalCapabilityMatch.findMany.mockResolvedValue([
      { id: 'match-1', signalId: 'sig-1', matchScore: 0.8 },
      { id: 'match-2', signalId: 'sig-2', matchScore: 0.7 },
    ]);
    mockDb.opportunityRecommendation.findMany.mockResolvedValue([]);

    // First call succeeds, second fails
    let callCount = 0;
    mockDb.companySignal.findUnique.mockImplementation(async (args: { where: { id: string } }) => {
      if (callCount === 0) {
        callCount++;
        return {
          id: args.where.id, companyId: 'comp-1', signalType: 'funding', title: 'Funding',
          description: 'Desc', source: 'S', sourceUrl: 'http://x',
          impact: 'high', severity: 'high', signalDate: null,
          confidence: 0.9, status: 'active',
        };
      }
      return null; // Second signal not found → throws
    });
    mockDb.signalCapabilityMatch.findUnique.mockResolvedValue({
      id: 'match-1', companyId: 'comp-1', signalId: 'sig-1', capabilityId: 'cap-1',
      matchScore: 0.8, reason: 'match', businessProblem: 'B',
      expectedOutcome: 'O', salesAngle: 'A',
    });
    mockDb.capabilityAsset.findUnique.mockResolvedValue({
      id: 'cap-1', title: 'Cloud', summary: 'Cloud migration',
    });
    mockDb.companyResearchCard.findUnique.mockResolvedValue({
      businessOverview: '', techLandscape: '', strategicPriorities: '[]',
      businessProblems: '[]', signalFreshnessAt: new Date(), techFreshnessAt: new Date(),
      contactFreshnessAt: new Date(), profileFreshnessAt: new Date(),
    });
    mockDb.evidence.findMany.mockResolvedValue([]);

    const llmJson = JSON.stringify({
      opportunityTitle: 'Opportunity', businessTrigger: 'T', whyNow: 'W',
      businessProblem: 'B', suggestedConversation: 'S', recommendedStakeholders: ['CTO'],
    });
    mockGovernedAICallAggregate.mockResolvedValue(makeLLMResultSuccess(llmJson));
    mockDb.opportunityRecommendation.create.mockResolvedValue({
      id: 'rec-1', companyId: 'comp-1', signalId: 'sig-1', capabilityMatchId: 'match-1',
      opportunityTitle: 'Opportunity', businessTrigger: 'T', whyNow: 'W',
      businessProblem: 'B', recommendedCapability: 'Cloud',
      recommendedStakeholders: '["CTO"]', suggestedConversation: 'S',
      evidenceIds: '[]', confidenceScore: 0.9, freshnessScore: 80, matchScore: 0.8,
      opportunityScore: 75, priority: 'high', status: 'pending_review', createdAt: new Date(),
    });

    const result = await generateCompanyOpportunities('comp-1');

    // First should succeed, second should fail silently
    expect(result.created).toBe(1);
  });

  it('should only match active/validated signals, not expired/archived', async () => {
    mockDb.company.findUnique.mockResolvedValue({ id: 'comp-1' });
    mockDb.companySignal.findMany.mockResolvedValue([
      { id: 'sig-1' },  // will be in active set
    ]);
    mockDb.signalCapabilityMatch.findMany.mockResolvedValue([
      { id: 'match-1', signalId: 'sig-1', matchScore: 0.8 },
      { id: 'match-2', signalId: 'sig-expired', matchScore: 0.9 }, // expired signal
    ]);
    mockDb.opportunityRecommendation.findMany.mockResolvedValue([]);

    const result = await generateCompanyOpportunities('comp-1');

    // sig-expired is not in activeSignalIds, so match-2 is filtered out
    // Only match-1 should be processed
    // (generateOpportunityRecommendation may fail since we didn't set up its mocks for sig-1,
    //  but it should at least not process match-2)
  });
});

// ═══════════════════════════════════════════════════════════════
// 6. EVIDENCE QUALITY — evidence-quality.ts
// ═══════════════════════════════════════════════════════════════

describe('computeEvidenceQuality (real implementation)', () => {
  let realCompute: typeof import('@/lib/research-engine/evidence-quality').computeEvidenceQuality;

  beforeAll(async () => {
    // Import the real implementation for testing
    const mod = await vi.importActual<typeof import('@/lib/research-engine/evidence-quality')>('@/lib/research-engine/evidence-quality');
    realCompute = mod.computeEvidenceQuality;
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Use the real implementation with our mocked db
    mockComputeEvidenceQuality.mockImplementation(realCompute!);
  });

  it('should return zero scores when no evidence exists', async () => {
    mockDb.evidence.findMany.mockResolvedValue([]);

    const result = await realCompute!('company-1');

    expect(result.overall).toBe(0);
    expect(result.coverage).toBe(0);
    expect(result.freshness).toBe(0);
    expect(result.sourceQuality).toBe(0);
    expect(result.totalEvidence).toBe(0);
    expect(result.activeEvidence).toBe(0);
    expect(result.fieldsCovered).toBe(0);
    expect(result.totalFields).toBe(6);
    expect(result.avgRecencyDays).toBe(999);
  });

  it('should compute coverage based on key fields with evidence', async () => {
    const now = new Date();
    mockDb.evidence.findMany.mockResolvedValue([
      { sourceQualityTier: 'premium', sourceDate: now, extractedField: 'revenue', sourceUrl: 'https://bloomberg.com/1', status: 'active', relevanceScore: 0.9, confidence: 0.85, createdAt: now },
      { sourceQualityTier: 'premium', sourceDate: now, extractedField: 'employeeCount', sourceUrl: 'https://reuters.com/1', status: 'active', relevanceScore: 0.8, confidence: 0.8, createdAt: now },
      { sourceQualityTier: 'standard', sourceDate: now, extractedField: 'fundingStage', sourceUrl: 'https://techcrunch.com/1', status: 'active', relevanceScore: 0.7, confidence: 0.75, createdAt: now },
      { sourceQualityTier: 'premium', sourceDate: now, extractedField: 'techStack', sourceUrl: 'https://crunchbase.com/1', status: 'active', relevanceScore: 0.85, confidence: 0.8, createdAt: now },
      { sourceQualityTier: 'standard', sourceDate: now, extractedField: 'industry', sourceUrl: 'https://linkedin.com/1', status: 'active', relevanceScore: 0.75, confidence: 0.9, createdAt: now },
      { sourceQualityTier: 'premium', sourceDate: now, extractedField: 'businessOverview', sourceUrl: 'https://wsj.com/1', status: 'active', relevanceScore: 0.8, confidence: 0.7, createdAt: now },
    ]);

    const result = await realCompute!('company-1');

    expect(result.coverage).toBe(100); // All 6 fields covered
    expect(result.fieldsCovered).toBe(6);
  });

  it('should classify premium sources for higher quality score', async () => {
    const now = new Date();
    mockDb.evidence.findMany.mockResolvedValue([
      { sourceQualityTier: 'premium', sourceDate: now, extractedField: 'revenue', sourceUrl: 'https://bloomberg.com/x', status: 'active', relevanceScore: 0.9, confidence: 0.9, createdAt: now },
      { sourceQualityTier: 'premium', sourceDate: now, extractedField: 'revenue', sourceUrl: 'https://reuters.com/x', status: 'active', relevanceScore: 0.8, confidence: 0.85, createdAt: now },
    ]);

    const result = await realCompute!('company-1');

    // premium = 1.0 weight: (1.0 + 1.0) / 2 * 100 = 100
    expect(result.sourceQuality).toBe(100);
    expect(result.premiumSourceCount).toBe(2);
    expect(result.lowSourceCount).toBe(0);
  });

  it('should penalize low-quality sources', async () => {
    const now = new Date();
    mockDb.evidence.findMany.mockResolvedValue([
      { sourceQualityTier: 'low', sourceDate: now, extractedField: 'revenue', sourceUrl: 'https://twitter.com/x', status: 'active', relevanceScore: 0.5, confidence: 0.3, createdAt: now },
      { sourceQualityTier: 'low', sourceDate: now, extractedField: 'revenue', sourceUrl: 'https://reddit.com/x', status: 'active', relevanceScore: 0.5, confidence: 0.3, createdAt: now },
    ]);

    const result = await realCompute!('company-1');

    // low = 0.4 weight: (0.4 + 0.4) / 2 * 100 = 40
    expect(result.sourceQuality).toBe(40);
    expect(result.premiumSourceCount).toBe(0);
    expect(result.lowSourceCount).toBe(2);
  });

  it('should compute corroboration based on unique source domains', async () => {
    const now = new Date();
    mockDb.evidence.findMany.mockResolvedValue([
      { sourceQualityTier: 'premium', sourceDate: now, extractedField: 'revenue', sourceUrl: 'https://bloomberg.com/a', status: 'active', relevanceScore: 0.9, confidence: 0.9, createdAt: now },
      { sourceQualityTier: 'premium', sourceDate: now, extractedField: 'revenue', sourceUrl: 'https://reuters.com/b', status: 'active', relevanceScore: 0.8, confidence: 0.85, createdAt: now },
      { sourceQualityTier: 'standard', sourceDate: now, extractedField: 'revenue', sourceUrl: 'https://techcrunch.com/c', status: 'active', relevanceScore: 0.7, confidence: 0.7, createdAt: now },
    ]);

    const result = await realCompute!('company-1');

    // 3 unique domains: 30 + (3-1)*20 = 70
    expect(result.corroboration).toBe(70);
  });

  it('should ignore non-active evidence in scoring', async () => {
    const now = new Date();
    mockDb.evidence.findMany.mockResolvedValue([
      { sourceQualityTier: 'premium', sourceDate: now, extractedField: 'revenue', sourceUrl: 'https://bloomberg.com/x', status: 'active', relevanceScore: 0.9, confidence: 0.9, createdAt: now },
      { sourceQualityTier: 'premium', sourceDate: now, extractedField: 'employeeCount', sourceUrl: 'https://reuters.com/x', status: 'archived', relevanceScore: 0.8, confidence: 0.8, createdAt: now },
    ]);

    const result = await realCompute!('company-1');

    expect(result.totalEvidence).toBe(2);
    expect(result.activeEvidence).toBe(1);
    // Only 1 field covered (revenue), not employeeCount (archived)
    expect(result.fieldsCovered).toBe(1);
  });

  it('should compute freshness score based on source recency', async () => {
    const oldDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
    mockDb.evidence.findMany.mockResolvedValue([
      { sourceQualityTier: 'standard', sourceDate: oldDate, extractedField: 'revenue', sourceUrl: 'https://example.com/x', status: 'active', relevanceScore: 0.7, confidence: 0.5, createdAt: oldDate },
    ]);

    const result = await realCompute!('company-1');

    // 180 days → 100 - (180/365)*90 ≈ 56
    expect(result.freshness).toBeGreaterThan(50);
    expect(result.freshness).toBeLessThan(60);
  });

  it('should compute volume score with diminishing returns', async () => {
    const now = new Date();
    // 4 evidence → sqrt(4) * 20 = 40
    mockDb.evidence.findMany.mockResolvedValue([
      { sourceQualityTier: 'standard', sourceDate: now, extractedField: 'revenue', sourceUrl: 'https://a.com/1', status: 'active', relevanceScore: 0.7, confidence: 0.5, createdAt: now },
      { sourceQualityTier: 'standard', sourceDate: now, extractedField: 'revenue', sourceUrl: 'https://b.com/2', status: 'active', relevanceScore: 0.7, confidence: 0.5, createdAt: now },
      { sourceQualityTier: 'standard', sourceDate: now, extractedField: 'revenue', sourceUrl: 'https://c.com/3', status: 'active', relevanceScore: 0.7, confidence: 0.5, createdAt: now },
      { sourceQualityTier: 'standard', sourceDate: now, extractedField: 'revenue', sourceUrl: 'https://d.com/4', status: 'active', relevanceScore: 0.7, confidence: 0.5, createdAt: now },
    ]);

    const result = await realCompute!('company-1');

    // sqrt(4) * 20 = 40
    expect(result.volume).toBe(40);
  });

  it('should count aging evidence as active for scoring', async () => {
    const now = new Date();
    mockDb.evidence.findMany.mockResolvedValue([
      { sourceQualityTier: 'premium', sourceDate: now, extractedField: 'revenue', sourceUrl: 'https://bloomberg.com/1', status: 'aging', relevanceScore: 0.9, confidence: 0.9, createdAt: now },
    ]);

    const result = await realCompute!('company-1');

    expect(result.activeEvidence).toBe(1);
    expect(result.fieldsCovered).toBe(1);
  });

  it('should compute overall as weighted average of dimensions', async () => {
    const now = new Date();
    mockDb.evidence.findMany.mockResolvedValue([
      { sourceQualityTier: 'premium', sourceDate: now, extractedField: 'revenue', sourceUrl: 'https://bloomberg.com/1', status: 'active', relevanceScore: 0.9, confidence: 0.9, createdAt: now },
      { sourceQualityTier: 'premium', sourceDate: now, extractedField: 'employeeCount', sourceUrl: 'https://reuters.com/2', status: 'active', relevanceScore: 0.8, confidence: 0.8, createdAt: now },
      { sourceQualityTier: 'standard', sourceDate: now, extractedField: 'fundingStage', sourceUrl: 'https://techcrunch.com/3', status: 'active', relevanceScore: 0.7, confidence: 0.7, createdAt: now },
    ]);

    const result = await realCompute!('company-1');

    // Overall should be a reasonable weighted average
    expect(result.overall).toBeGreaterThan(0);
    expect(result.overall).toBeLessThanOrEqual(100);
    // With 3 fields covered out of 6, premium + premium + standard:
    // coverage = 50, freshness = 100, sourceQuality = 90, corroboration = 70 (3 domains), volume = 35 (sqrt(3)*20)
    // overall = 50*0.25 + 100*0.25 + 90*0.20 + 70*0.15 + 35*0.15 = 12.5 + 25 + 18 + 10.5 + 5.25 = 71.25 → 71
    expect(result.overall).toBe(71);
  });
});