/**
 * Research Engine Tests
 *
 * Tests for signal detection, evidence collection, capability matching,
 * opportunity scoring, and evidence quality tier classification.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (hoisted for vi.mock) ──

const { mockDb, mockGovernedAICallAggregate, mockExtractJSON, mockComputeEvidenceQuality, mockCallLLM } = vi.hoisted(() => {
  const db = {
    companySignal: {
      findMany: vi.fn(),
      count: vi.fn(),
      createMany: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
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
    mockCallLLM: vi.fn(),
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

import { detectSignals } from '@/lib/research-engine/signals';
import { matchSignalsToCapabilities } from '@/lib/research-engine/signal-capability-matching';
import { computeOpportunityScore } from '@/lib/research-engine/opportunity-recommendation-engine';
import { computeEvidenceQuality } from '@/lib/research-engine/evidence-quality';

// ── Signal Detection Tests ──

describe('detectSignals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty result when snippets array is empty', async () => {
    const result = await detectSignals('Acme Corp', []);
    expect(result.signals).toEqual([]);
    expect(result.signalCount).toBe(0);
    expect(result.highImpactCount).toBe(0);
    // LLM should NOT be called for empty snippets
    expect(mockGovernedAICallAggregate).not.toHaveBeenCalled();
  });

  it('should return empty result when LLM call fails', async () => {
    mockGovernedAICallAggregate.mockResolvedValue({
      success: false, response: null, governanceResult: { passed: true, checks: {}, overallMessage: '', canProceed: true, rejectionReason: 'LLM error' },
      rejectionReason: 'LLM error', groundingNote: '', promptAddon: '',
    });

    const snippets = [{ title: 'Acme raises funding', snippet: 'Acme raised $50M', url: 'https://example.com/1', source: 'TechCrunch' }];
    const result = await detectSignals('Acme Corp', snippets);

    expect(result.signals).toEqual([]);
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

    mockGovernedAICallAggregate.mockResolvedValue({
      success: true, response: llmResponse,
      governanceResult: { passed: true, checks: {}, overallMessage: '', canProceed: true, rejectionReason: null },
      rejectionReason: null, groundingNote: '', promptAddon: '',
    });
    mockExtractJSON.mockReturnValue([llmResponse]);

    const snippets = [{ title: 'Acme raises funding', snippet: 'Acme raised $50M', url: 'https://example.com/1', source: 'TechCrunch' }];
    const result = await detectSignals('Acme Corp', snippets);

    expect(result.signalCount).toBe(1);
    expect(result.highImpactCount).toBe(1);
    expect(result.signals[0].signalType).toBe('funding');
    expect(result.signals[0].title).toBe('Acme raises $50M Series C');
    expect(result.signals[0].impact).toBe('high');
    expect(result.signals[0].confidence).toBe(0.9);
    expect(result.signals[0].evidenceSnippet).toBe('Acme raised $50M');
    expect(result.signals[0].evidenceUrl).toBe('https://example.com/1');
  });

  it('should filter out signals without title or description', async () => {
    const llmResponse = JSON.stringify([
      { signalType: 'funding', title: '', description: 'Valid', source: 'S', sourceUrl: 'http://x', impact: 'high', severity: 'high', signalDate: null, confidence: 0.8, evidenceIndex: -1 },
      { signalType: 'hiring', title: 'Valid title', description: '', source: 'S', sourceUrl: 'http://x', impact: 'medium', severity: 'medium', signalDate: null, confidence: 0.7, evidenceIndex: -1 },
      { signalType: 'expansion', title: 'Good signal', description: 'Has description', source: 'S', sourceUrl: 'http://x', impact: 'low', severity: 'low', signalDate: null, confidence: 0.6, evidenceIndex: -1 },
    ]);

    mockGovernedAICallAggregate.mockResolvedValue({
      success: true, response: llmResponse,
      governanceResult: { passed: true, checks: {}, overallMessage: '', canProceed: true, rejectionReason: null },
      rejectionReason: null, groundingNote: '', promptAddon: '',
    });
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

    mockGovernedAICallAggregate.mockResolvedValue({
      success: true, response: llmResponse,
      governanceResult: { passed: true, checks: {}, overallMessage: '', canProceed: true, rejectionReason: null },
      rejectionReason: null, groundingNote: '', promptAddon: '',
    });
    mockExtractJSON.mockReturnValue(JSON.parse(llmResponse));

    const snippets = [{ title: 'Something', snippet: 'desc', url: 'http://x', source: 'S' }];
    const result = await detectSignals('Acme', snippets);

    // non-canonical type should be mapped to 'expansion' by the CANONICAL check
    expect(result.signals[0].signalType).toBe('expansion');
  });

  it('should clamp confidence between 0 and 1', async () => {
    const llmResponse = JSON.stringify([
      { signalType: 'funding', title: 'T', description: 'D', source: 'S', sourceUrl: 'http://x', impact: 'high', severity: 'high', signalDate: null, confidence: 1.5, evidenceIndex: -1 },
      { signalType: 'hiring', title: 'T2', description: 'D2', source: 'S', sourceUrl: 'http://x', impact: 'medium', severity: 'medium', signalDate: null, confidence: -0.3, evidenceIndex: -1 },
    ]);

    mockGovernedAICallAggregate.mockResolvedValue({
      success: true, response: llmResponse,
      governanceResult: { passed: true, checks: {}, overallMessage: '', canProceed: true, rejectionReason: null },
      rejectionReason: null, groundingNote: '', promptAddon: '',
    });
    mockExtractJSON.mockReturnValue(JSON.parse(llmResponse));

    const snippets = [{ title: 'x', snippet: 'x', url: 'http://x', source: 'S' }];
    const result = await detectSignals('Acme', snippets);

    expect(result.signals[0].confidence).toBe(1);
    expect(result.signals[1].confidence).toBe(0);
  });

  it('should fall back to rule-based detection when LLM throws', async () => {
    mockGovernedAICallAggregate.mockRejectedValue(new Error('LLM timeout'));

    const snippets = [
      { title: 'Acme raises $50M Series C funding', snippet: 'Acme Corp announced a $50M Series C funding round', url: 'http://x', source: 'TechCrunch' },
    ];

    const result = await detectSignals('Acme', snippets);

    // Rule-based should detect the funding pattern
    expect(result.signalCount).toBeGreaterThanOrEqual(1);
    expect(result.signals[0].signalType).toBe('funding');
    expect(result.signals[0].impact).toBe('high');
  });

  it('should fall back to rule-based detection when LLM returns non-array', async () => {
    mockGovernedAICallAggregate.mockResolvedValue({
      success: true, response: 'not json',
      governanceResult: { passed: true, checks: {}, overallMessage: '', canProceed: true, rejectionReason: null },
      rejectionReason: null, groundingNote: '', promptAddon: '',
    });
    mockExtractJSON.mockReturnValue(null); // not an array

    const snippets = [
      { title: 'Acme hiring VP of Sales', snippet: 'Acme Corp is hiring a new VP of Sales', url: 'http://x', source: 'LinkedIn' },
    ];

    const result = await detectSignals('Acme', snippets);

    // Rule-based should detect hiring pattern
    expect(result.signalCount).toBeGreaterThanOrEqual(1);
    expect(result.signals[0].signalType).toBe('hiring');
  });
});

// ── Signal-Capability Matching Tests ──

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
      {
        id: 'cap-1', title: 'Cloud Migration', summary: 'Migrate to cloud infrastructure', category: 'cloud_migration',
        problems: JSON.stringify(['scaling infrastructure', 'legacy modernization']),
        keywords: JSON.stringify(['cloud', 'migration', 'infrastructure', 'aws']),
        targetIndustries: null, technology: 'AWS, Azure', businessProblem: 'scaling infrastructure',
        customerOutcome: 'Scalable cloud infrastructure', differentiator: 'Proven methodology',
        isActive: true,
      },
    ]);
    mockDb.signalCapabilityMatch.deleteMany.mockResolvedValue({ count: 0 });
    mockDb.signalCapabilityMatch.createMany.mockResolvedValue({ count: 1 });

    const result = await matchSignalsToCapabilities('company-1');

    expect(result.totalMatches).toBeGreaterThanOrEqual(1);
    // Cloud migration is in the funding capabilityCategories
    expect(result.results[0].capabilityId).toBe('cap-1');
    expect(result.results[0].signalId).toBe('sig-1');
    expect(result.results[0].matchScore).toBeGreaterThan(0);
    // Should include category match reason
    expect(result.results[0].reason).toContain('capability category matches');
  });

  it('should score keyword overlap between signal and capability', async () => {
    mockDb.companySignal.findMany.mockResolvedValue([
      { id: 'sig-1', signalType: 'technology', title: 'Migrating to AWS', description: 'Adopting cloud platform', impact: 'medium', confidence: 0.8, status: 'validated' },
    ]);
    mockDb.capabilityAsset.findMany.mockResolvedValue([
      {
        id: 'cap-1', title: 'Cloud Migration', summary: 'Help companies migrate to AWS', category: 'cloud_migration',
        problems: JSON.stringify(['legacy modernization']),
        keywords: JSON.stringify(['cloud', 'migration', 'aws', 'infrastructure']),
        targetIndustries: null, technology: 'AWS', businessProblem: 'legacy modernization',
        customerOutcome: 'Cloud-native', differentiator: null,
        isActive: true,
      },
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
      {
        id: 'cap-1', title: 'Cloud', summary: 'Cloud service', category: 'cloud_migration',
        problems: null, keywords: null, targetIndustries: null, technology: null,
        businessProblem: 'scaling', customerOutcome: null, differentiator: null,
        isActive: true,
      },
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
    // Capability with no category or keyword overlap to regulatory
    mockDb.capabilityAsset.findMany.mockResolvedValue([
      {
        id: 'cap-1', title: 'Talent Acquisition', summary: 'Help recruit talent', category: 'talent_acquisition',
        problems: JSON.stringify(['talent retention']),
        keywords: JSON.stringify(['recruiting', 'onboarding', 'talent']),
        targetIndustries: null, technology: null, businessProblem: 'talent retention',
        customerOutcome: null, differentiator: null,
        isActive: true,
      },
    ]);
    mockDb.signalCapabilityMatch.deleteMany.mockResolvedValue({ count: 0 });

    const result = await matchSignalsToCapabilities('company-1');

    // regulatory signal → talent_acquisition capability = no category match
    expect(result.totalMatches).toBe(0);
    expect(mockDb.signalCapabilityMatch.createMany).not.toHaveBeenCalled();
  });

  it('should store results in SignalCapabilityMatch and cap at 50', async () => {
    const signals = Array.from({ length: 5 }, (_, i) => ({
      id: `sig-${i}`, signalType: 'funding', title: `Funding ${i}`, description: 'Desc', impact: 'high', confidence: 0.9, status: 'active',
    }));
    const capabilities = Array.from({ length: 20 }, (_, i) => ({
      id: `cap-${i}`, title: `Cloud Service ${i}`, summary: 'Cloud', category: 'cloud_migration',
      problems: null, keywords: null, targetIndustries: null, technology: null,
      businessProblem: 'scaling', customerOutcome: null, differentiator: null,
      isActive: true,
    }));

    mockDb.companySignal.findMany.mockResolvedValue(signals);
    mockDb.capabilityAsset.findMany.mockResolvedValue(capabilities);
    mockDb.signalCapabilityMatch.deleteMany.mockResolvedValue({ count: 0 });
    mockDb.signalCapabilityMatch.createMany.mockResolvedValue({ count: 100 });

    const result = await matchSignalsToCapabilities('company-1');

    expect(result.results.length).toBeLessThanOrEqual(50);
    expect(mockDb.signalCapabilityMatch.createMany).toHaveBeenCalledTimes(1);
  });
});

// ── Opportunity Score Tests ──

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
});

// ── Evidence Quality Tests ──

describe('computeEvidenceQuality', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return zero scores when no evidence exists', async () => {
    mockDb.evidence.findMany.mockResolvedValue([]);

    const result = await computeEvidenceQuality('company-1');

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

    const result = await computeEvidenceQuality('company-1');

    expect(result.coverage).toBe(100); // All 6 fields covered
    expect(result.fieldsCovered).toBe(6);
  });

  it('should classify premium sources for higher quality score', async () => {
    const now = new Date();
    mockDb.evidence.findMany.mockResolvedValue([
      { sourceQualityTier: 'premium', sourceDate: now, extractedField: 'revenue', sourceUrl: 'https://bloomberg.com/x', status: 'active', relevanceScore: 0.9, confidence: 0.9, createdAt: now },
      { sourceQualityTier: 'premium', sourceDate: now, extractedField: 'revenue', sourceUrl: 'https://reuters.com/x', status: 'active', relevanceScore: 0.8, confidence: 0.85, createdAt: now },
    ]);

    const result = await computeEvidenceQuality('company-1');

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

    const result = await computeEvidenceQuality('company-1');

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

    const result = await computeEvidenceQuality('company-1');

    // 3 unique domains: 30 + (3-1)*20 = 70
    expect(result.corroboration).toBe(70);
  });

  it('should ignore non-active evidence in scoring', async () => {
    const now = new Date();
    mockDb.evidence.findMany.mockResolvedValue([
      { sourceQualityTier: 'premium', sourceDate: now, extractedField: 'revenue', sourceUrl: 'https://bloomberg.com/x', status: 'active', relevanceScore: 0.9, confidence: 0.9, createdAt: now },
      { sourceQualityTier: 'premium', sourceDate: now, extractedField: 'employeeCount', sourceUrl: 'https://reuters.com/x', status: 'archived', relevanceScore: 0.8, confidence: 0.8, createdAt: now },
    ]);

    const result = await computeEvidenceQuality('company-1');

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

    const result = await computeEvidenceQuality('company-1');

    // 180 days → 100 - (180/365)*90 ≈ 56
    expect(result.freshness).toBeGreaterThan(50);
    expect(result.freshness).toBeLessThan(60);
  });
});