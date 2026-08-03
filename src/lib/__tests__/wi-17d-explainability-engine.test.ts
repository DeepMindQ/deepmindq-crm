/**
 * WI-17D — Explainability Layer Tests
 *
 * Tests cover:
 * 1. Full Intelligence Trail generation
 * 2. Reasoning section (score decomposition, weight transparency)
 * 3. Evidence section (categorization, quality assessment, recency)
 * 4. Sources section (provenance, reliability, diversity)
 * 5. Confidence section (6-dimension breakdown, improvements, detractors)
 * 6. Risk section (identification, severity, mitigation, overall assessment)
 * 7. Action section (rationale, alternatives, prerequisites)
 * 8. Bulk explainability summaries
 * 9. Edge cases (missing data, no signals, no evidence)
 * 10. Graceful degradation (DB failures, confidence failures)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mocks ──

const mockComputeUnifiedConfidence = vi.fn();
vi.mock('@/lib/ai-unified-confidence', () => ({
  computeUnifiedConfidence: (...args: unknown[]) => mockComputeUnifiedConfidence(...args),
}));

const mockKgRecommendations = vi.fn();
const mockExpandFromEntity = vi.fn();
const mockGetGraphStats = vi.fn();
vi.mock('@/lib/ai-knowledge-graph', () => ({
  generateRecommendations: (...args: unknown[]) => mockKgRecommendations(...args),
  expandFromEntity: (...args: unknown[]) => mockExpandFromEntity(...args),
  getGraphStats: (...args: unknown[]) => mockGetGraphStats(...args),
}));

const mockSearchMemories = vi.fn();
const mockBuildMemoryContext = vi.fn();
vi.mock('@/lib/ai-memory', () => ({
  searchMemories: (...args: unknown[]) => mockSearchMemories(...args),
  buildMemoryContext: (...args: unknown[]) => mockBuildMemoryContext(...args),
}));

const mockDbCompanyFindMany = vi.fn();
const mockDbCompanyFindUnique = vi.fn();
const mockDbAccountScoreFindMany = vi.fn();
const mockDbAccountScoreFindFirst = vi.fn();
const mockDbOpportunityFindMany = vi.fn();
const mockDbSignalFindMany = vi.fn();
const mockDbCapMatchFindMany = vi.fn();
const mockDbInsightFindMany = vi.fn();
const mockDbCompanyCount = vi.fn();
const mockDbSignalGroupBy = vi.fn();
const mockDbAccountScoreGroupBy = vi.fn();
const mockDbEvidenceFindMany = vi.fn();
const mockDbContactFindMany = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    company: {
      findMany: (...args: unknown[]) => mockDbCompanyFindMany(...args),
      findUnique: (...args: unknown[]) => mockDbCompanyFindUnique(...args),
      count: (...args: unknown[]) => mockDbCompanyCount(...args),
    },
    accountScore: {
      findMany: (...args: unknown[]) => mockDbAccountScoreFindMany(...args),
      findFirst: (...args: unknown[]) => mockDbAccountScoreFindFirst(...args),
      groupBy: (...args: unknown[]) => mockDbAccountScoreGroupBy(...args),
    },
    opportunityRecommendation: {
      findMany: (...args: unknown[]) => mockDbOpportunityFindMany(...args),
    },
    companySignal: {
      findMany: (...args: unknown[]) => mockDbSignalFindMany(...args),
      groupBy: (...args: unknown[]) => mockDbSignalGroupBy(...args),
    },
    signalCapabilityMatch: {
      findMany: (...args: unknown[]) => mockDbCapMatchFindMany(...args),
    },
    strategicInsight: {
      findMany: (...args: unknown[]) => mockDbInsightFindMany(...args),
    },
    evidence: {
      findMany: (...args: unknown[]) => mockDbEvidenceFindMany(...args),
    },
    contact: {
      findMany: (...args: unknown[]) => mockDbContactFindMany(...args),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('@/lib/ai-evidence-framework', () => ({
  EVIDENCE_QUALITY_SCORES: {
    verified: 1.0,
    corroborated: 0.8,
    inferred: 0.6,
    estimated: 0.4,
    speculative: 0.2,
  },
}));

// ── Import after mocks ──

const {
  generateExplainabilityReport,
  generateBulkExplainabilitySummaries,
  getExplainabilityStats,
} = await import('@/lib/explainability-engine');

// ── Test Data Factories ──

function makeFullCompanyData(overrides: Record<string, unknown> = {}) {
  return {
    id: 'comp-1',
    rawName: 'Acme Corporation',
    domain: 'acme.com',
    industry: 'Technology',
    sizeRange: null,  // Intentionally null to ensure improvement opportunities exist in tests
    location: 'San Francisco, CA',
    country: 'US',
    source: 'manual',
    lastEnrichedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
    status: 'active',
    intelligenceScore: 72,
    _count: {
      contacts: 3,
      signals: 5,
      evidence: 5,
      opportunityRecommendations: 2,
      strategicInsights: 2,
      signalCapabilityMatches: 3,
    },
    ...overrides,
  };
}

function makeSignals(count: number, overrides: Record<string, unknown> = {}) {
  return Array.from({ length: count }, (_, i) => ({
    id: `sig-${i + 1}`,
    signalType: i === 0 ? 'executive_change' : i === 1 ? 'technology_trigger' : 'growth_signal',
    title: i === 0 ? 'New CTO joined 45 days ago' : i === 1 ? 'AWS migration detected' : 'Series C funding raised',
    severity: i < 2 ? 'critical' : 'high',
    confidence: 0.92 - i * 0.05,
    impact: 'high',
    signalDate: new Date(Date.now() - (i + 1) * 7 * 24 * 60 * 60 * 1000),
    evidenceSummary: i === 0 ? 'LinkedIn profile change detected' : `Signal evidence ${i + 1}`,
    recommendedAction: i === 0 ? 'Schedule executive call' : null,
    timingWindow: i === 0 ? '30 days' : null,
    ...overrides,
  }));
}

function makeOpportunities(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `opp-${i + 1}`,
    opportunityTitle: i === 0 ? 'Cloud Modernization Services' : 'Data Platform Migration',
    opportunityScore: 85 - i * 15,
    priority: i === 0 ? 'high' : 'medium',
    signalId: `sig-${i + 1}`,
    whyNow: 'Technology stack change creates immediate opportunity',
    businessProblem: 'Legacy infrastructure migration needed',
    recommendedCapability: i === 0 ? 'Cloud Architecture' : 'Data Engineering',
    confidenceScore: 88 - i * 10,
  }));
}

function makeCapabilityMatches(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `cap-${i + 1}`,
    matchScore: 0.85 - i * 0.1,
    capability: { title: i === 0 ? 'Cloud Modernization' : 'Data Engineering', category: 'technology' },
  }));
}

function makeEvidence(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `evid-${i + 1}`,
    evidenceType: i === 0 ? 'news' : i === 1 ? 'press_release' : 'job_posting',
    summary: i === 0 ? 'Acme Corp announces cloud initiative' : `Evidence item ${i + 1}`,
    source: i === 0 ? 'techcrunch.com' : 'linkedin.com',
    sourceUrl: i === 0 ? 'https://techcrunch.com/acme-cloud' : null,
    reliability: 0.85 - i * 0.05,
    detectedAt: new Date(Date.now() - (i + 2) * 5 * 24 * 60 * 60 * 1000),
  }));
}

function makeContacts(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `contact-${i + 1}`,
    fullName: i === 0 ? 'Jane Smith' : `Contact ${i + 1}`,
    role: i === 0 ? 'CTO' : 'Engineering Manager',
    seniority: i === 0 ? 'executive' : 'director',
    leadScore: 90 - i * 10,
  }));
}

function makeInsights(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `insight-${i + 1}`,
    insightType: i === 0 ? 'OPPORTUNITY' : 'STRATEGIC_SHIFT',
    summary: i === 0 ? 'Cloud modernization alignment detected' : 'Strategic technology shift underway',
    confidenceScore: 85 - i * 10,
  }));
}

function makeAccountScore(overrides: Record<string, unknown> = {}) {
  return {
    score: 72,
    scoreBreakdown: JSON.stringify({ staticFit: { score: 75 }, dynamicFit: { score: 68 } }),
    category: 'HOT_ACCOUNT',
    ...overrides,
  };
}

function makeConfidenceResult(overrides: Record<string, unknown> = {}) {
  return {
    score: 78,
    grade: 'B+',
    trustClass: 'enterprise',
    enterpriseReady: true,
    factors: [
      {
        dimension: 'data_quality',
        score: 82,
        weight: 0.20,
        explanation: 'Company data is reasonably complete with domain, industry, and contacts present.',
        positiveSignals: ['Domain present', 'Industry classified', '3+ contacts'],
        negativeSignals: ['No size range data'],
      },
      {
        dimension: 'source_reliability',
        score: 90,
        weight: 0.20,
        explanation: 'Data sourced from manual entry — highest reliability rating.',
        positiveSignals: ['Manual entry', 'Direct CRM data'],
        negativeSignals: [],
      },
      {
        dimension: 'freshness',
        score: 70,
        weight: 0.15,
        explanation: 'Data enriched 10 days ago — within acceptable freshness window.',
        positiveSignals: ['Enriched within 30 days'],
        negativeSignals: ['Not enriched in last 7 days'],
      },
      {
        dimension: 'cross_validation',
        score: 65,
        weight: 0.15,
        explanation: '5 corroborating evidence items support signal claims.',
        positiveSignals: ['5 evidence records'],
        negativeSignals: ['Limited external validation'],
      },
      {
        dimension: 'evidence_coverage',
        score: 75,
        weight: 0.15,
        explanation: 'Evidence covers technology and executive changes but lacks financial data.',
        positiveSignals: ['Technology evidence', 'Executive change evidence'],
        negativeSignals: ['No financial evidence', 'No market data'],
      },
      {
        dimension: 'ai_certainty',
        score: 85,
        weight: 0.15,
        explanation: 'AI models show high confidence in detected signals and patterns.',
        positiveSignals: ['High signal confidence', 'Consistent pattern match'],
        negativeSignals: [],
      },
    ],
    summary: 'Strong overall confidence with room for improvement in cross-validation.',
    recommendations: ['Add financial data for better coverage', 'Increase evidence diversity'],
    timestamp: new Date().toISOString(),
    modelVersion: '1.0.0',
  };
}

// ── Setup Default Mocks ──

function setupDefaultMocks() {
  mockGetGraphStats.mockReturnValue({ totalNodes: 50, totalEdges: 120 });

  mockComputeUnifiedConfidence.mockReturnValue(makeConfidenceResult());

  // For WI-17C recommendation engine (called inside generateExplainabilityReport)
  mockDbCompanyFindMany.mockResolvedValue([{
    id: 'comp-1',
    rawName: 'Acme Corporation',
    domain: 'acme.com',
    industry: 'Technology',
    intelligenceScore: 72,
    lastEnrichedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    sizeRange: '201-500',
    location: 'San Francisco, CA',
    country: 'US',
    source: 'manual',
    status: 'active',
    _count: { contacts: 3, signals: 5, evidence: 5, opportunityRecommendations: 2, strategicInsights: 2 },
  }]);

  mockDbAccountScoreFindMany.mockResolvedValue([makeAccountScore()]);
  mockDbOpportunityFindMany.mockResolvedValue(makeOpportunities(2));
  mockDbSignalFindMany.mockResolvedValue(makeSignals(5));
  mockDbCapMatchFindMany.mockResolvedValue(makeCapabilityMatches(3));
  mockDbInsightFindMany.mockResolvedValue(makeInsights(2));

  // For WI-17D explainability engine (raw data fetch)
  // Note: generateExplainabilityReport calls generateCompanyRecommendation first,
  // which calls db.company.findUnique with _count. Must match the shape.
  mockDbCompanyFindUnique.mockResolvedValue(makeFullCompanyData());
  mockDbEvidenceFindMany.mockResolvedValue(makeEvidence(5));
  mockDbContactFindMany.mockResolvedValue(makeContacts(3));
  mockDbAccountScoreFindFirst.mockResolvedValue(makeAccountScore());
}

beforeEach(() => {
  vi.clearAllMocks();
  setupDefaultMocks();
});

// ── 1. Full Intelligence Trail ──

describe('WI-17D: Full Intelligence Trail', () => {
  it('should generate a complete explainability report with all 6 sections', async () => {
    const report = await generateExplainabilityReport('comp-1');

    expect(report).not.toBeNull();
    expect(report!.companyId).toBe('comp-1');
    expect(report!.companyName).toBe('Acme Corporation');

    // All 6 sections present
    expect(report!.reasoning).toBeDefined();
    expect(report!.evidence).toBeDefined();
    expect(report!.sources).toBeDefined();
    expect(report!.confidence).toBeDefined();
    expect(report!.risks).toBeDefined();
    expect(report!.action).toBeDefined();

    // Metadata
    expect(report!.generatedAt).toBeDefined();
    expect(report!.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('should return null for non-existent company', async () => {
    mockDbCompanyFindUnique.mockResolvedValue(null);
    mockDbCompanyFindMany.mockResolvedValue([]);

    const report = await generateExplainabilityReport('nonexistent');
    expect(report).toBeNull();
  });

  it('should include recommendation summary in the report', async () => {
    const report = await generateExplainabilityReport('comp-1');

    expect(report!.recommendation).toBeDefined();
    expect(report!.recommendation.priority).toBeDefined();
    expect(report!.recommendation.opportunityScore).toBeGreaterThanOrEqual(0);
    expect(report!.recommendation.opportunityScore).toBeLessThanOrEqual(100);
    expect(report!.recommendation.confidenceGrade).toBeDefined();
    expect(report!.recommendation.enterpriseReady).toBeDefined();
  });
});

// ── 2. Reasoning Section ──

describe('WI-17D: Reasoning Section', () => {
  it('should include score decomposition with all 5 factors', async () => {
    const report = await generateExplainabilityReport('comp-1');

    const { reasoning } = report!;
    expect(reasoning.scoreDecomposition).toHaveLength(5);

    // Check all 5 factors
    const factorNames = reasoning.scoreDecomposition.map(f => f.name);
    expect(factorNames).toContain('Account Score (ICP Fit)');
    expect(factorNames).toContain('Best Opportunity Score');
    expect(factorNames).toContain('Signal Strength');
    expect(factorNames).toContain('Capability Match');
    expect(factorNames).toContain('Engagement Readiness');
  });

  it('should show weight transparency for each factor', async () => {
    const report = await generateExplainabilityReport('comp-1');

    const { reasoning } = report!;
    for (const factor of reasoning.scoreDecomposition) {
      expect(factor.weight).toBeGreaterThan(0);
      expect(factor.weight).toBeLessThanOrEqual(1);
      expect(factor.contribution).toBeGreaterThanOrEqual(0);
      expect(factor.rawValue).toBeGreaterThanOrEqual(0);
      expect(factor.method).toBeDefined();
      expect(factor.source).toBeDefined();
    }
  });

  it('should show correct weight values (30/30/15/10/15)', async () => {
    const report = await generateExplainabilityReport('comp-1');

    const { reasoning } = report!;
    const weights = reasoning.scoreDecomposition.reduce((acc, f) => {
      acc[f.name] = f.weight;
      return acc;
    }, {} as Record<string, number>);

    expect(weights['Account Score (ICP Fit)']).toBe(0.30);
    expect(weights['Best Opportunity Score']).toBe(0.30);
    expect(weights['Signal Strength']).toBe(0.15);
    expect(weights['Capability Match']).toBe(0.10);
    expect(weights['Engagement Readiness']).toBe(0.15);
  });

  it('should include priority mapping with threshold explanation', async () => {
    const report = await generateExplainabilityReport('comp-1');

    const { reasoning } = report!;
    expect(reasoning.priorityMapping).toBeDefined();
    expect(reasoning.priorityMapping.score).toBeGreaterThanOrEqual(0);
    expect(reasoning.priorityMapping.threshold).toBeDefined();
    expect(reasoning.priorityMapping.range).toContain('Critical: 80-100');
    expect(reasoning.priorityMapping.range).toContain('High: 60-79');
    expect(reasoning.priorityMapping.range).toContain('Medium: 35-59');
    expect(reasoning.priorityMapping.range).toContain('Low: 0-34');
  });

  it('should include "Why this account?" narrative', async () => {
    const report = await generateExplainabilityReport('comp-1');

    const { reasoning } = report!;
    expect(reasoning.whyThisAccount).toBeDefined();
    expect(typeof reasoning.whyThisAccount).toBe('string');
    expect(reasoning.whyThisAccount.length).toBeGreaterThan(0);
  });

  it('should have a human-readable summary', async () => {
    const report = await generateExplainabilityReport('comp-1');

    const { reasoning } = report!;
    expect(reasoning.summary).toBeDefined();
    expect(reasoning.summary).toContain('Score of');
    expect(reasoning.summary).toContain('/100');
  });
});

// ── 3. Evidence Section ──

describe('WI-17D: Evidence Section', () => {
  it('should categorize evidence into correct categories', async () => {
    const report = await generateExplainabilityReport('comp-1');

    const { evidence } = report!;
    expect(evidence.totalCount).toBeGreaterThan(0);
    expect(evidence.categories.length).toBeGreaterThan(0);

    const categoryNames = evidence.categories.map(c => c.category);
    expect(categoryNames).toContain('Buying Signals');
    expect(categoryNames).toContain('Opportunities');
  });

  it('should include quality assessment with correct counts', async () => {
    const report = await generateExplainabilityReport('comp-1');

    const { evidence } = report!;
    expect(evidence.qualityAssessment).toBeDefined();
    expect(evidence.qualityAssessment.overallQuality).toBeDefined();
    expect(typeof evidence.qualityAssessment.verifiedCount).toBe('number');
    expect(typeof evidence.qualityAssessment.corroboratedCount).toBe('number');
    expect(typeof evidence.qualityAssessment.inferredCount).toBe('number');
  });

  it('should show strength rating per evidence category', async () => {
    const report = await generateExplainabilityReport('comp-1');

    const { evidence } = report!;
    for (const category of evidence.categories) {
      expect(['strong', 'moderate', 'weak']).toContain(category.strength);
      expect(category.count).toBeGreaterThan(0);
      expect(category.items.length).toBeGreaterThan(0);
    }
  });

  it('should include recency for time-based evidence', async () => {
    const report = await generateExplainabilityReport('comp-1');

    const { evidence } = report!;
    const signalCategory = evidence.categories.find(c => c.category === 'Buying Signals');
    expect(signalCategory).toBeDefined();

    // At least some items should have recency
    const itemsWithRecency = signalCategory!.items.filter(i => i.recency !== null);
    expect(itemsWithRecency.length).toBeGreaterThan(0);
  });

  it('should include sentiment classification per evidence item', async () => {
    const report = await generateExplainabilityReport('comp-1');

    const { evidence } = report!;
    for (const category of evidence.categories) {
      for (const item of category.items) {
        expect(['positive', 'negative', 'neutral']).toContain(item.sentiment);
      }
    }
  });

  it('should include sourceId and sourceType for traceability', async () => {
    const report = await generateExplainabilityReport('comp-1');

    const { evidence } = report!;
    for (const category of evidence.categories) {
      for (const item of category.items) {
        expect(item.sourceId).toBeDefined();
        expect(item.sourceType).toBeDefined();
      }
    }
  });

  it('should handle empty evidence gracefully', async () => {
    mockDbSignalFindMany.mockResolvedValue([]);
    mockDbOpportunityFindMany.mockResolvedValue([]);
    mockDbCapMatchFindMany.mockResolvedValue([]);
    mockDbInsightFindMany.mockResolvedValue([]);
    mockDbEvidenceFindMany.mockResolvedValue([]);

    const report = await generateExplainabilityReport('comp-1');

    const { evidence } = report!;
    expect(evidence.totalCount).toBe(0);
    expect(evidence.categories).toHaveLength(0);
    expect(evidence.qualityAssessment.overallQuality).toBe('speculative');
  });
});

// ── 4. Sources Section ──

describe('WI-17D: Sources Section', () => {
  it('should list all data sources used in the recommendation', async () => {
    const report = await generateExplainabilityReport('comp-1');

    const { sources } = report!;
    expect(sources.items.length).toBeGreaterThan(0);

    const sourceNames = sources.items.map(s => s.name);
    expect(sourceNames).toContain('Company Base Data');
    expect(sourceNames).toContain('Signal Detection');
  });

  it('should include reliability scores per source', async () => {
    const report = await generateExplainabilityReport('comp-1');

    const { sources } = report!;
    for (const source of sources.items) {
      expect(source.reliability).toBeGreaterThanOrEqual(0);
      expect(source.reliability).toBeLessThanOrEqual(1);
      expect(source.reliabilityExplanation).toBeDefined();
    }
  });

  it('should calculate overall reliability as weighted average', async () => {
    const report = await generateExplainabilityReport('comp-1');

    const { sources } = report!;
    expect(sources.overallReliability).toBeGreaterThanOrEqual(0);
    expect(sources.overallReliability).toBeLessThanOrEqual(1);
  });

  it('should calculate source diversity score', async () => {
    const report = await generateExplainabilityReport('comp-1');

    const { sources } = report!;
    expect(sources.diversityScore).toBeGreaterThanOrEqual(0);
    expect(sources.diversityScore).toBeLessThanOrEqual(1);
  });

  it('should show higher reliability for manual entry vs import', async () => {
    const report = await generateExplainabilityReport('comp-1');

    const { sources } = report!;
    const companySource = sources.items.find(s => s.name === 'Company Base Data');
    expect(companySource).toBeDefined();
    expect(companySource!.reliability).toBe(0.95); // Manual entry
    expect(companySource!.reliabilityExplanation.toLowerCase()).toContain('manually entered');
  });
});

// ── 5. Confidence Section ──

describe('WI-17D: Confidence Section', () => {
  it('should include overall confidence with grade and trust classification', async () => {
    const report = await generateExplainabilityReport('comp-1');

    const { confidence } = report!;
    expect(confidence.overall).toBeDefined();
    expect(confidence.overall.score).toBe(78);
    expect(confidence.overall.grade).toBe('B+');
    expect(confidence.overall.trustClassification).toBe('enterprise');
    expect(confidence.overall.enterpriseReady).toBe(true);
  });

  it('should include all 6 confidence dimensions', async () => {
    const report = await generateExplainabilityReport('comp-1');

    const { confidence } = report!;
    expect(confidence.dimensions).toHaveLength(6);

    const dimensionNames = confidence.dimensions.map(d => d.dimension);
    expect(dimensionNames).toContain('Data Quality');
    expect(dimensionNames).toContain('Source Reliability');
    expect(dimensionNames).toContain('Data Freshness');
    expect(dimensionNames).toContain('Cross Validation');
    expect(dimensionNames).toContain('Evidence Coverage');
    expect(dimensionNames).toContain('AI Certainty');
  });

  it('should show positive and negative signals per dimension', async () => {
    const report = await generateExplainabilityReport('comp-1');

    const { confidence } = report!;
    for (const dim of confidence.dimensions) {
      expect(Array.isArray(dim.positiveSignals)).toBe(true);
      expect(Array.isArray(dim.negativeSignals)).toBe(true);
      expect(dim.explanation).toBeDefined();
      expect(dim.weight).toBeGreaterThan(0);
      expect(dim.score).toBeGreaterThanOrEqual(0);
      expect(dim.score).toBeLessThanOrEqual(100);
    }
  });

  it('should include improvement opportunities', async () => {
    const report = await generateExplainabilityReport('comp-1');

    const { confidence } = report!;
    expect(confidence.improvementOpportunities.length).toBeGreaterThan(0);
    // Should have actionable suggestions
    for (const opp of confidence.improvementOpportunities) {
      expect(typeof opp).toBe('string');
      expect(opp.length).toBeGreaterThan(10);
    }
  });

  it('should include confidence detractors when dimensions are low', async () => {
    // Make some dimensions low
    mockComputeUnifiedConfidence.mockReturnValue(makeConfidenceResult());
    // Override one factor to be low
    const lowConfResult = makeConfidenceResult();
    lowConfResult.factors[0].score = 30; // Data Quality low
    lowConfResult.factors[3].score = 25; // Cross Validation low
    mockComputeUnifiedConfidence.mockReturnValue(lowConfResult);

    const report = await generateExplainabilityReport('comp-1');

    const { confidence } = report!;
    expect(confidence.detractors.length).toBeGreaterThan(0);
  });

  it('should handle confidence computation failure gracefully', async () => {
    mockComputeUnifiedConfidence.mockReturnValue(null);

    const report = await generateExplainabilityReport('comp-1');

    const { confidence } = report!;
    // Should still have a confidence section with fallback values
    expect(confidence.overall).toBeDefined();
    expect(confidence.dimensions.length).toBe(0); // No dimensions from failed computation
    expect(confidence.improvementOpportunities.length).toBeGreaterThan(0);
  });
});

// ── 6. Risk Section ──

describe('WI-17D: Risk Section', () => {
  it('should include severity breakdown', async () => {
    const report = await generateExplainabilityReport('comp-1');

    const { risks } = report!;
    expect(risks.severityBreakdown).toBeDefined();
    expect(typeof risks.severityBreakdown.critical).toBe('number');
    expect(typeof risks.severityBreakdown.high).toBe('number');
    expect(typeof risks.severityBreakdown.medium).toBe('number');
    expect(typeof risks.severityBreakdown.low).toBe('number');
    expect(risks.totalRisks).toBe(
      risks.severityBreakdown.critical +
      risks.severityBreakdown.high +
      risks.severityBreakdown.medium +
      risks.severityBreakdown.low
    );
  });

  it('should include overall risk assessment', async () => {
    const report = await generateExplainabilityReport('comp-1');

    const { risks } = report!;
    expect(['low_risk', 'moderate_risk', 'elevated_risk', 'high_risk']).toContain(risks.overallAssessment);
  });

  it('should include mitigation for each risk', async () => {
    const report = await generateExplainabilityReport('comp-1');

    const { risks } = report!;
    for (const risk of risks.items) {
      expect(risk.description).toBeDefined();
      expect(risk.mitigation).toBeDefined();
      expect(risk.impact).toBeDefined();
      expect(['critical', 'high', 'medium', 'low']).toContain(risk.severity);
      expect(['data_gap', 'staleness', 'contradiction', 'competition', 'confidence', 'coverage']).toContain(risk.category);
    }
  });

  it('should detect no-contacts risk', async () => {
    mockDbContactFindMany.mockResolvedValue([]);

    const report = await generateExplainabilityReport('comp-1');

    const { risks } = report!;
    const noContactRisk = risks.items.find(r => r.category === 'coverage' && r.description.includes('No contacts'));
    expect(noContactRisk).toBeDefined();
    expect(noContactRisk!.severity).toBe('high');
  });

  it('should detect staleness risk for never-enriched company', async () => {
    mockDbCompanyFindUnique.mockResolvedValue(makeFullCompanyData({ lastEnrichedAt: null }));
    const report = await generateExplainabilityReport('comp-1');

    const { risks } = report!;
    const stalenessRisk = risks.items.find(r => r.category === 'staleness');
    expect(stalenessRisk).toBeDefined();
    expect(stalenessRisk!.severity).toBe('high');
  });

  it('should detect low-confidence risk', async () => {
    const lowConfResult = makeConfidenceResult();
    lowConfResult.score = 35;
    lowConfResult.enterpriseReady = false;
    mockComputeUnifiedConfidence.mockReturnValue(lowConfResult);

    const report = await generateExplainabilityReport('comp-1');

    const { risks } = report!;
    const confRisk = risks.items.find(r => r.category === 'confidence');
    expect(confRisk).toBeDefined();
  });

  it('should detect competition risks from signals', async () => {
    const signals = makeSignals(3);
    signals.push({
      id: 'sig-comp-1',
      signalType: 'competitive',
      title: 'Existing vendor relationship with CompetitorX detected',
      severity: 'high',
      confidence: 0.85,
      impact: 'high',
      signalDate: new Date(),
      evidenceSummary: 'Procurement records show active contract',
      recommendedAction: null,
      timingWindow: null,
    });
    mockDbSignalFindMany.mockResolvedValue(signals);

    const report = await generateExplainabilityReport('comp-1');

    const { risks } = report!;
    const compRisk = risks.items.find(r => r.category === 'competition');
    expect(compRisk).toBeDefined();
    expect(compRisk!.sourceId).toBeDefined();
  });

  it('should sort risks by severity (critical first)', async () => {
    const report = await generateExplainabilityReport('comp-1');

    const { risks } = report!;
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    for (let i = 1; i < risks.items.length; i++) {
      const prev = severityOrder[risks.items[i - 1].severity as keyof typeof severityOrder];
      const curr = severityOrder[risks.items[i].severity as keyof typeof severityOrder];
      expect(prev).toBeLessThanOrEqual(curr);
    }
  });

  it('should handle zero risks gracefully', async () => {
    // Company with perfect data
    mockDbContactFindMany.mockResolvedValue(makeContacts(5));
    mockDbCompanyFindUnique.mockResolvedValue(makeFullCompanyData({ lastEnrichedAt: new Date() }));
    mockDbSignalFindMany.mockResolvedValue(makeSignals(3).map(s => ({ ...s, confidence: 0.9 })));
    mockDbEvidenceFindMany.mockResolvedValue(makeEvidence(10));

    const report = await generateExplainabilityReport('comp-1');

    const { risks } = report!;
    // May still have some risks (e.g., low-confidence signals if any)
    expect(risks.totalRisks).toBeGreaterThanOrEqual(0);
    expect(risks.overallAssessment).toBeDefined();
  });
});

// ── 7. Action Section ──

describe('WI-17D: Action Section', () => {
  it('should include action text and timeline', async () => {
    const report = await generateExplainabilityReport('comp-1');

    const { action } = report!;
    expect(action.text).toBeDefined();
    expect(action.text.length).toBeGreaterThan(0);
    expect(action.timeline).toBeDefined();
    expect(action.timeline.length).toBeGreaterThan(0);
  });

  it('should include rationale explaining why this action', async () => {
    const report = await generateExplainabilityReport('comp-1');

    const { action } = report!;
    expect(action.rationale).toBeDefined();
    expect(action.rationale.length).toBeGreaterThan(20);
  });

  it('should include alternative actions', async () => {
    const report = await generateExplainabilityReport('comp-1');

    const { action } = report!;
    expect(action.alternatives.length).toBeGreaterThan(0);
    for (const alt of action.alternatives) {
      expect(typeof alt).toBe('string');
      expect(alt.length).toBeGreaterThan(10);
    }
  });

  it('should include prerequisites when gaps exist', async () => {
    mockDbContactFindMany.mockResolvedValue([]);

    const report = await generateExplainabilityReport('comp-1');

    const { action } = report!;
    const contactPrereq = action.prerequisites.find(
      p => p.toLowerCase().includes('contact')
    );
    expect(contactPrereq).toBeDefined();
  });

  it('should have no prerequisites when data is complete', async () => {
    mockDbContactFindMany.mockResolvedValue(makeContacts(5));
    mockDbCompanyFindUnique.mockResolvedValue(makeFullCompanyData({ lastEnrichedAt: new Date() }));
    mockDbEvidenceFindMany.mockResolvedValue(makeEvidence(5));
    mockDbSignalFindMany.mockResolvedValue(makeSignals(3).map(s => ({ ...s, confidence: 0.9 })));

    const report = await generateExplainabilityReport('comp-1');

    const { action } = report!;
    // With high confidence and complete data, prerequisites should be minimal or empty
    expect(action.prerequisites.length).toBe(0);
  });

  it('should include conversation angle for high-priority recommendations', async () => {
    const report = await generateExplainabilityReport('comp-1');

    const { action } = report!;
    // High-priority recommendations should have a conversation angle
    // (this depends on the score being >= 60)
    if (report!.recommendation.priority === 'critical' || report!.recommendation.priority === 'high') {
      expect(action.conversationAngle).toBeDefined();
      expect(action.conversationAngle!.length).toBeGreaterThan(0);
    }
  });
});

// ── 8. Bulk Explainability Summaries ──

describe('WI-17D: Bulk Explainability Summaries', () => {
  it('should generate summaries for multiple companies', async () => {
    const companyIds = ['comp-1', 'comp-2', 'comp-3'];

    mockDbCompanyFindMany.mockResolvedValue([
      makeFullCompanyData({ id: 'comp-1', rawName: 'Acme Corp' }),
      makeFullCompanyData({ id: 'comp-2', rawName: 'Beta Inc', lastEnrichedAt: null }),
      makeFullCompanyData({ id: 'comp-3', rawName: 'Gamma LLC', domain: null }),
    ]);

    const summaries = await generateBulkExplainabilitySummaries(companyIds);

    expect(summaries.size).toBe(3);
    expect(summaries.get('comp-1')!.companyName).toBe('Acme Corp');
    expect(summaries.get('comp-2')!.companyName).toBe('Beta Inc');
    expect(summaries.get('comp-3')!.companyName).toBe('Gamma LLC');
  });

  it('should include top evidence in each summary', async () => {
    const summaries = await generateBulkExplainabilitySummaries(['comp-1']);

    const summary = summaries.get('comp-1')!;
    expect(summary.topEvidence.length).toBeGreaterThan(0);
    for (const evidence of summary.topEvidence) {
      expect(evidence.detected).toBeDefined();
      expect(evidence.confidence).toBeGreaterThanOrEqual(0);
      expect(evidence.confidence).toBeLessThanOrEqual(100);
    }
  });

  it('should include risk summary', async () => {
    const summaries = await generateBulkExplainabilitySummaries(['comp-1']);

    const summary = summaries.get('comp-1')!;
    expect(summary.riskSummary).toBeDefined();
    expect(typeof summary.riskSummary.critical).toBe('number');
    expect(typeof summary.riskSummary.high).toBe('number');
    expect(typeof summary.riskSummary.medium).toBe('number');
    expect(typeof summary.riskSummary.low).toBe('number');
  });

  it('should include data quality assessment', async () => {
    const summaries = await generateBulkExplainabilitySummaries(['comp-1']);

    const summary = summaries.get('comp-1')!;
    expect(['verified', 'corroborated', 'inferred', 'estimated', 'speculative']).toContain(summary.dataQuality);
  });

  it('should identify top improvement opportunity', async () => {
    const summaries = await generateBulkExplainabilitySummaries(['comp-1']);

    const summary = summaries.get('comp-1')!;
    expect(summary.topImprovement).toBeDefined();
    expect(summary.topImprovement.length).toBeGreaterThan(5);
  });

  it('should show speculative quality for company with no data', async () => {
    mockDbCompanyFindMany.mockResolvedValue([{
      id: 'comp-empty',
      rawName: 'Empty Corp',
      domain: null,
      industry: null,
      sizeRange: null,
      location: null,
      country: null,
      source: null,
      lastEnrichedAt: null,
      status: 'active',
      _count: { signals: 0, evidence: 0, contacts: 0, opportunityRecommendations: 0, signalCapabilityMatches: 0, strategicInsights: 0 },
    }]);

    const summaries = await generateBulkExplainabilitySummaries(['comp-empty']);

    const summary = summaries.get('comp-empty')!;
    expect(summary.dataQuality).toBe('speculative');
    expect(summary.topImprovement).toContain('contacts');
  });
});

// ── 9. Edge Cases ──

describe('WI-17D: Edge Cases', () => {
  it('should handle company with zero signals', async () => {
    mockDbSignalFindMany.mockResolvedValue([]);

    const report = await generateExplainabilityReport('comp-1');

    expect(report).not.toBeNull();
    const { evidence, reasoning } = report!;
    // Evidence section should not have Buying Signals category
    const signalCategory = evidence.categories.find(c => c.category === 'Buying Signals');
    expect(signalCategory).toBeUndefined();
  });

  it('should handle company with no domain', async () => {
    mockDbCompanyFindUnique.mockResolvedValue(makeFullCompanyData({ domain: null }));
    const report = await generateExplainabilityReport('comp-1');

    expect(report).not.toBeNull();
    const { risks, confidence } = report!;
    // Should identify missing domain as a risk
    const domainRisk = risks.items.find(r => r.description.includes('domain'));
    expect(domainRisk).toBeDefined();
    // Should suggest adding domain as improvement
    const domainImprovement = confidence.improvementOpportunities.find(o => o.includes('domain'));
    expect(domainImprovement).toBeDefined();
  });

  it('should handle company with no industry', async () => {
    mockDbCompanyFindUnique.mockResolvedValue(makeFullCompanyData({ industry: null }));
    const report = await generateExplainabilityReport('comp-1');

    expect(report).not.toBeNull();
    const { risks } = report!;
    const industryRisk = risks.items.find(r => r.description.includes('industry'));
    expect(industryRisk).toBeDefined();
  });

  it('should handle very old enrichment data (>90 days)', async () => {
    mockDbCompanyFindUnique.mockResolvedValue(
      makeFullCompanyData({ lastEnrichedAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000) })
    );
    const report = await generateExplainabilityReport('comp-1');

    const { risks } = report!;
    const staleRisk = risks.items.find(r =>
      r.category === 'staleness' && r.description.includes('120 days')
    );
    expect(staleRisk).toBeDefined();
    expect(staleRisk!.severity).toBe('high');
  });

  it('should handle DB failure gracefully', async () => {
    // Both generateCompanyRecommendation and fetchRawIntelligenceData use findUnique
    // Make findUnique fail for raw data fetch but succeed for recommendation
    let callCount = 0;
    mockDbCompanyFindUnique.mockImplementation(() => {
      callCount++;
      if (callCount === 1) return Promise.resolve(makeFullCompanyData());
      return Promise.reject(new Error('DB connection failed'));
    });

    const report = await generateExplainabilityReport('comp-1');

    // Should still return a report with fallback data
    expect(report).not.toBeNull();
    const { evidence, reasoning } = report!;
    expect(evidence.totalCount).toBe(0);
  });
});

// ── 10. Explainability Stats ──

describe('WI-17D: Explainability Stats', () => {
  it('should return engine information', () => {
    const stats = getExplainabilityStats();

    expect(stats.engine).toBe('WI-17D Explainability Layer');
    expect(stats.version).toBe('1.0.0');
    expect(stats.capabilities.length).toBeGreaterThan(0);
    expect(stats.integrationPoints.length).toBeGreaterThan(0);
  });

  it('should list all integration points', () => {
    const stats = getExplainabilityStats();

    const integrationNames = stats.integrationPoints;
    expect(integrationNames.some(n => n.includes('WI-17C'))).toBe(true);
    expect(integrationNames.some(n => n.includes('WI-16C'))).toBe(true);
    expect(integrationNames.some(n => n.includes('Evidence Framework'))).toBe(true);
  });
});

// ── 11. Enterprise Trust Validation ──

describe('WI-17D: Enterprise Trust Validation', () => {
  it('should never produce a report with undefined confidence', async () => {
    mockComputeUnifiedConfidence.mockReturnValue(null);

    const report = await generateExplainabilityReport('comp-1');

    expect(report!.confidence.overall.score).toBeDefined();
    expect(typeof report!.confidence.overall.score).toBe('number');
  });

  it('should clearly mark non-enterprise-ready recommendations', async () => {
    const lowConfResult = makeConfidenceResult();
    lowConfResult.score = 45;
    lowConfResult.grade = 'D';
    lowConfResult.trustClass = 'speculative';
    lowConfResult.enterpriseReady = false;
    mockComputeUnifiedConfidence.mockReturnValue(lowConfResult);

    const report = await generateExplainabilityReport('comp-1');

    expect(report!.confidence.overall.enterpriseReady).toBe(false);
    expect(report!.confidence.overall.grade).toBe('D');

    // Should have risk about not meeting enterprise threshold
    const thresholdRisk = report!.risks.items.find(r =>
      r.category === 'confidence' && r.description.includes('enterprise confidence threshold')
    );
    expect(thresholdRisk).toBeDefined();
  });

  it('should explain why confidence is low, not just show a number', async () => {
    const lowConfResult = makeConfidenceResult();
    lowConfResult.score = 40;
    lowConfResult.factors = lowConfResult.factors.map(f => ({
      ...f,
      score: f.dimension === 'data_quality' ? 20 : f.dimension === 'freshness' ? 15 : 50,
      explanation: `Low score due to ${f.dimension}: ${f.score}/100`,
    }));
    mockComputeUnifiedConfidence.mockReturnValue(lowConfResult);

    const report = await generateExplainabilityReport('comp-1');

    // Should have detractors explaining what's wrong
    expect(report!.confidence.detractors.length).toBeGreaterThan(0);
    for (const d of report!.confidence.detractors) {
      expect(d).toContain('low');
      expect(d).toContain('/100');
    }
  });

  it('should make the intelligence trail navigable (sourceIds for drill-down)', async () => {
    const report = await generateExplainabilityReport('comp-1');

    // Evidence items should have sourceIds
    for (const category of report!.evidence.categories) {
      for (const item of category.items) {
        expect(item.sourceId).toBeDefined();
        expect(item.sourceType).toBeDefined();
      }
    }

    // Risk items should have sourceIds where applicable
    for (const risk of report!.risks.items) {
      if (risk.sourceId) {
        expect(risk.sourceId.length).toBeGreaterThan(0);
      }
    }
  });
});
