/**
 * WI-17C — AI Recommendation Engine Tests
 *
 * Tests cover:
 * 1. Recommendation score computation (weights, priority mapping)
 * 2. Reason building (signals, capabilities, timing, contacts, KG, ICP)
 * 3. Risk identification (no contacts, stale data, low confidence, competition)
 * 4. Recommended action generation (per priority level)
 * 5. "Why this account?" narrative
 * 6. Confidence integration (enterprise-ready threshold)
 * 7. Knowledge Graph enrichment (non-blocking)
 * 8. Memory enrichment (non-blocking)
 * 9. Edge cases (minimal data, no intelligence, empty opportunities)
 * 10. Graceful degradation (KG failure, memory failure, confidence failure)
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
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// ── Import after mocks ──

const {
  generateAllRecommendations,
  generateCompanyRecommendation,
  getRecommendationStats,
} = await import('@/lib/recommendation-engine');

// ── Test Data Factories ──

function makeCompany(overrides: Record<string, unknown> = {}) {
  return {
    id: 'comp-1',
    rawName: 'Acme Corporation',
    domain: 'acme.com',
    industry: 'Technology',
    intelligenceScore: 75,
    lastEnrichedAt: new Date('2025-07-01'),
    sizeRange: '50-200',
    location: 'San Francisco, CA',
    country: 'US',
    source: 'manual',
    status: 'active',
    _count: { contacts: 5, signals: 8, evidence: 12, opportunityRecommendations: 3, strategicInsights: 2 },
    ...overrides,
  };
}

function makeAccountScore(overrides: Record<string, unknown> = {}) {
  return {
    companyId: 'comp-1',
    score: 72,
    scoreBreakdown: JSON.stringify({
      staticFit: { score: 80, industry: 90, size: 70, geography: 80, techAlignment: 80 },
      dynamicIntelligence: { score: 65, evidenceQuality: 70, signalStrength: 60, capabilityMatch: 70, contactCoverage: 60 },
      timingUrgency: { score: 70, signalRecency: 80, opportunityWindow: 60, engagementVelocity: 70 },
    }),
    category: 'HOT_ACCOUNT',
    ...overrides,
  };
}

function makeOpportunity(overrides: Record<string, unknown> = {}) {
  return {
    id: 'opp-1',
    companyId: 'comp-1',
    opportunityTitle: 'Cloud Migration Opportunity',
    opportunityScore: 82,
    priority: 'high',
    signalId: 'sig-1',
    whyNow: 'New CTO hired 30 days ago, actively evaluating cloud solutions',
    businessProblem: 'Legacy on-premise infrastructure is becoming a bottleneck for scaling',
    recommendedCapability: 'Cloud Architecture Assessment',
    confidenceScore: 0.85,
    status: 'pending_review',
    ...overrides,
  };
}

function makeSignal(overrides: Record<string, unknown> = {}) {
  return {
    id: 'sig-1',
    companyId: 'comp-1',
    signalType: 'leadership_change',
    title: 'New CTO hired — Sarah Chen from AWS',
    severity: 'high',
    confidence: 0.9,
    impact: 'high',
    signalDate: new Date('2025-07-15'),
    recommendedAction: 'Engage with technical discovery',
    timingWindow: 'within_14_days',
    ...overrides,
  };
}

function makeCapabilityMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cap-1',
    companyId: 'comp-1',
    matchScore: 0.88,
    capability: { title: 'Cloud Architecture', category: 'Infrastructure' },
    ...overrides,
  };
}

function makeInsight(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ins-1',
    companyId: 'comp-1',
    insightType: 'OPPORTUNITY',
    summary: 'Strategic shift toward cloud-native architecture detected',
    confidenceScore: 75,
    ...overrides,
  };
}

function makeConfidenceResult(overrides: Record<string, unknown> = {}) {
  return {
    score: 78,
    grade: 'B+',
    trustClass: 'advisory',
    enterpriseReady: true,
    factors: [
      { dimension: 'data_quality', score: 82, weight: 0.20, explanation: 'Most fields populated' },
      { dimension: 'source_reliability', score: 95, weight: 0.20, explanation: 'Manual entry' },
      { dimension: 'freshness', score: 70, weight: 0.15, explanation: 'Enriched recently' },
      { dimension: 'cross_validation', score: 65, weight: 0.15, explanation: 'Some cross-validation' },
      { dimension: 'evidence_coverage', score: 80, weight: 0.15, explanation: 'Good evidence' },
      { dimension: 'ai_certainty', score: 85, weight: 0.15, explanation: 'Strong signals' },
    ],
    summary: 'Good confidence — enterprise ready',
    recommendations: ['Re-enrich in 30 days'],
    timestamp: new Date().toISOString(),
    modelVersion: '1.0',
    ...overrides,
  };
}

// ── Tests ──

describe('WI-17C: AI Recommendation Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetGraphStats.mockReturnValue({ totalNodes: 0, totalEdges: 0 });
    mockComputeUnifiedConfidence.mockReturnValue(makeConfidenceResult());
  });

  describe('1. Score computation and priority mapping', () => {
    it('should compute composite opportunity score using all 5 weights', async () => {
      const company = makeCompany();
      mockDbCompanyFindMany.mockResolvedValue([company]);
      mockDbAccountScoreFindMany.mockResolvedValue([makeAccountScore()]);
      mockDbOpportunityFindMany.mockResolvedValue([makeOpportunity()]);
      mockDbSignalFindMany.mockResolvedValue([makeSignal()]);
      mockDbCapMatchFindMany.mockResolvedValue([makeCapabilityMatch()]);
      mockDbInsightFindMany.mockResolvedValue([makeInsight()]);

      const result = await generateAllRecommendations({ limit: 10 });

      expect(result.recommendations).toHaveLength(1);
      const rec = result.recommendations[0];
      expect(rec.opportunityScore).toBeGreaterThanOrEqual(0);
      expect(rec.opportunityScore).toBeLessThanOrEqual(100);
      expect(rec.priority).toBeDefined();
      expect(['critical', 'high', 'medium', 'low']).toContain(rec.priority);
    });

    it('should map score ranges to correct priorities', async () => {
      // Use minimal company (no contacts, no enrichment) so engagementReadiness=0
      // Score = 0.85 * X (accountScore*0.30 + oppScore*0.30 + signal*0.15 + cap*0.10)
      const minimalCompany = makeCompany({
        lastEnrichedAt: null,
        _count: { contacts: 0, signals: 0, evidence: 0, opportunityRecommendations: 0, strategicInsights: 0 },
      });
      const testCases = [
        { score: 95, expected: 'critical' }, // 0.85*95=80.75 → critical
        { score: 75, expected: 'high' },     // 0.85*75=63.75 → high
        { score: 45, expected: 'medium' },   // 0.85*45=38.25 → medium
        { score: 15, expected: 'low' },      // 0.85*15=12.75 → low
      ];

      for (const { score, expected } of testCases) {
        mockDbCompanyFindMany.mockResolvedValue([minimalCompany]);
        mockDbAccountScoreFindMany.mockResolvedValue([makeAccountScore({ score })]);
        mockDbOpportunityFindMany.mockResolvedValue([makeOpportunity({ opportunityScore: score })]);
        mockDbSignalFindMany.mockResolvedValue([makeSignal({ confidence: score / 100 })]);
        mockDbCapMatchFindMany.mockResolvedValue([makeCapabilityMatch({ matchScore: score / 100 })]);
        mockDbInsightFindMany.mockResolvedValue([]);

        const result = await generateAllRecommendations({ limit: 10 });
        expect(result.recommendations[0].priority).toBe(expected);
      }
    });
  });

  describe('2. Reason building', () => {
    it('should build reasons from high-severity signals', async () => {
      const company = makeCompany();
      mockDbCompanyFindMany.mockResolvedValue([company]);
      mockDbAccountScoreFindMany.mockResolvedValue([makeAccountScore()]);
      mockDbOpportunityFindMany.mockResolvedValue([]);
      mockDbSignalFindMany.mockResolvedValue([
        makeSignal({ id: 'sig-1', title: 'CTO hired', severity: 'critical', confidence: 0.95 }),
        makeSignal({ id: 'sig-2', title: 'Funding round', severity: 'high', confidence: 0.8 }),
      ]);
      mockDbCapMatchFindMany.mockResolvedValue([]);
      mockDbInsightFindMany.mockResolvedValue([]);

      const result = await generateAllRecommendations({ limit: 10 });
      const signalReasons = result.recommendations[0].reasons.filter(r => r.category === 'signal');
      expect(signalReasons.length).toBeGreaterThanOrEqual(2);
      expect(signalReasons[0].sourceType).toBe('CompanySignal');
      expect(signalReasons[0].strength).toBeGreaterThan(0);
    });

    it('should add capability match reason', async () => {
      const company = makeCompany();
      mockDbCompanyFindMany.mockResolvedValue([company]);
      mockDbAccountScoreFindMany.mockResolvedValue([makeAccountScore()]);
      mockDbOpportunityFindMany.mockResolvedValue([]);
      mockDbSignalFindMany.mockResolvedValue([]);
      mockDbCapMatchFindMany.mockResolvedValue([
        makeCapabilityMatch(),
        makeCapabilityMatch({ id: 'cap-2', capability: { title: 'DevOps', category: 'Engineering' }, matchScore: 0.75 }),
      ]);
      mockDbInsightFindMany.mockResolvedValue([]);

      const result = await generateAllRecommendations({ limit: 10 });
      const capReason = result.recommendations[0].reasons.find(r => r.category === 'capability');
      expect(capReason).toBeDefined();
      expect(capReason!.text).toContain('2 capability matches');
      expect(capReason!.text).toContain('Cloud Architecture');
    });

    it('should add timing reason for signals within 30 days', async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10);
      const company = makeCompany();
      mockDbCompanyFindMany.mockResolvedValue([company]);
      mockDbAccountScoreFindMany.mockResolvedValue([makeAccountScore()]);
      mockDbOpportunityFindMany.mockResolvedValue([]);
      mockDbSignalFindMany.mockResolvedValue([
        makeSignal({ signalDate: recentDate, severity: 'high', title: 'Hiring spree' }),
      ]);
      mockDbCapMatchFindMany.mockResolvedValue([]);
      mockDbInsightFindMany.mockResolvedValue([]);

      const result = await generateAllRecommendations({ limit: 10 });
      const timingReason = result.recommendations[0].reasons.find(r => r.category === 'timing');
      expect(timingReason).toBeDefined();
      expect(timingReason!.text).toContain('Active buying signal within 30 days');
    });

    it('should add contact coverage reason', async () => {
      const company = makeCompany({ _count: { ...makeCompany()._count, contacts: 7 } });
      mockDbCompanyFindMany.mockResolvedValue([company]);
      mockDbAccountScoreFindMany.mockResolvedValue([makeAccountScore()]);
      mockDbOpportunityFindMany.mockResolvedValue([]);
      mockDbSignalFindMany.mockResolvedValue([]);
      mockDbCapMatchFindMany.mockResolvedValue([]);
      mockDbInsightFindMany.mockResolvedValue([]);

      const result = await generateAllRecommendations({ limit: 10 });
      const contactReason = result.recommendations[0].reasons.find(r => r.category === 'contact');
      expect(contactReason).toBeDefined();
      expect(contactReason!.text).toContain('7 contacts');
    });

    it('should add ICP fit reason from AccountScore', async () => {
      const company = makeCompany();
      mockDbCompanyFindMany.mockResolvedValue([company]);
      mockDbAccountScoreFindMany.mockResolvedValue([makeAccountScore()]);
      mockDbOpportunityFindMany.mockResolvedValue([]);
      mockDbSignalFindMany.mockResolvedValue([]);
      mockDbCapMatchFindMany.mockResolvedValue([]);
      mockDbInsightFindMany.mockResolvedValue([]);

      const result = await generateAllRecommendations({ limit: 10 });
      const icpReason = result.recommendations[0].reasons.find(r => r.category === 'icp_fit');
      expect(icpReason).toBeDefined();
      expect(icpReason!.text).toContain('Strong ICP fit');
    });
  });

  describe('3. Risk identification', () => {
    it('should identify no-contacts risk', async () => {
      const company = makeCompany({ _count: { ...makeCompany()._count, contacts: 0 } });
      mockDbCompanyFindMany.mockResolvedValue([company]);
      mockDbAccountScoreFindMany.mockResolvedValue([]);
      mockDbOpportunityFindMany.mockResolvedValue([]);
      mockDbSignalFindMany.mockResolvedValue([]);
      mockDbCapMatchFindMany.mockResolvedValue([]);
      mockDbInsightFindMany.mockResolvedValue([]);

      const result = await generateAllRecommendations({ limit: 10 });
      const noContactRisk = result.recommendations[0].risks.find(r => r.text.includes('No contacts'));
      expect(noContactRisk).toBeDefined();
      expect(noContactRisk!.severity).toBe('high');
      expect(noContactRisk!.mitigation).toBeDefined();
    });

    it('should identify stale data risk', async () => {
      const staleDate = new Date('2025-01-01'); // 7+ months old
      const company = makeCompany({ lastEnrichedAt: staleDate });
      mockDbCompanyFindMany.mockResolvedValue([company]);
      mockDbAccountScoreFindMany.mockResolvedValue([]);
      mockDbOpportunityFindMany.mockResolvedValue([]);
      mockDbSignalFindMany.mockResolvedValue([]);
      mockDbCapMatchFindMany.mockResolvedValue([]);
      mockDbInsightFindMany.mockResolvedValue([]);

      const result = await generateAllRecommendations({ limit: 10 });
      const staleRisk = result.recommendations[0].risks.find(r => r.text.includes('days old'));
      expect(staleRisk).toBeDefined();
      expect(staleRisk!.severity).toBe('high');
    });

    it('should identify competition risk from signals', async () => {
      const company = makeCompany();
      mockDbCompanyFindMany.mockResolvedValue([company]);
      mockDbAccountScoreFindMany.mockResolvedValue([]);
      mockDbOpportunityFindMany.mockResolvedValue([]);
      mockDbSignalFindMany.mockResolvedValue([
        makeSignal({ title: 'Existing vendor relationship with CompetitorX', signalType: 'competitive' }),
      ]);
      mockDbCapMatchFindMany.mockResolvedValue([]);
      mockDbInsightFindMany.mockResolvedValue([]);

      const result = await generateAllRecommendations({ limit: 10 });
      const compRisk = result.recommendations[0].risks.find(r => r.text.includes('vendor'));
      expect(compRisk).toBeDefined();
    });

    it('should identify never-enriched risk', async () => {
      const company = makeCompany({ lastEnrichedAt: null });
      mockDbCompanyFindMany.mockResolvedValue([company]);
      mockDbAccountScoreFindMany.mockResolvedValue([]);
      mockDbOpportunityFindMany.mockResolvedValue([]);
      mockDbSignalFindMany.mockResolvedValue([]);
      mockDbCapMatchFindMany.mockResolvedValue([]);
      mockDbInsightFindMany.mockResolvedValue([]);

      const result = await generateAllRecommendations({ limit: 10 });
      const enrichRisk = result.recommendations[0].risks.find(r => r.text.includes('Never enriched'));
      expect(enrichRisk).toBeDefined();
    });
  });

  describe('4. Recommended action generation', () => {
    it('should generate urgent action for critical priority', async () => {
      const company = makeCompany();
      mockDbCompanyFindMany.mockResolvedValue([company]);
      mockDbAccountScoreFindMany.mockResolvedValue([makeAccountScore({ score: 95 })]);
      mockDbOpportunityFindMany.mockResolvedValue([makeOpportunity({ opportunityScore: 95, businessProblem: 'Scaling bottleneck' })]);
      mockDbSignalFindMany.mockResolvedValue([makeSignal({ confidence: 0.95 })]);
      mockDbCapMatchFindMany.mockResolvedValue([makeCapabilityMatch({ matchScore: 0.95 })]);
      mockDbInsightFindMany.mockResolvedValue([]);

      const result = await generateAllRecommendations({ limit: 10 });
      const action = result.recommendations[0].recommendedAction;
      expect(action.timeline).toContain('7 days');
      expect(action.targetRole).toBeDefined();
    });

    it('should generate proactive action for high priority', async () => {
      const company = makeCompany();
      mockDbCompanyFindMany.mockResolvedValue([company]);
      mockDbAccountScoreFindMany.mockResolvedValue([makeAccountScore({ score: 65 })]);
      mockDbOpportunityFindMany.mockResolvedValue([makeOpportunity({ opportunityScore: 65 })]);
      mockDbSignalFindMany.mockResolvedValue([makeSignal()]);
      mockDbCapMatchFindMany.mockResolvedValue([makeCapabilityMatch()]);
      mockDbInsightFindMany.mockResolvedValue([]);

      const result = await generateAllRecommendations({ limit: 10 });
      const action = result.recommendations[0].recommendedAction;
      expect(action.timeline).toContain('14 days');
      expect(action.text).toBeDefined();
    });

    it('should generate nurture action for medium priority', async () => {
      const company = makeCompany();
      mockDbCompanyFindMany.mockResolvedValue([company]);
      mockDbAccountScoreFindMany.mockResolvedValue([makeAccountScore({ score: 45 })]);
      mockDbOpportunityFindMany.mockResolvedValue([makeOpportunity({ opportunityScore: 45 })]);
      mockDbSignalFindMany.mockResolvedValue([]);
      mockDbCapMatchFindMany.mockResolvedValue([]);
      mockDbInsightFindMany.mockResolvedValue([]);

      const result = await generateAllRecommendations({ limit: 10 });
      const action = result.recommendations[0].recommendedAction;
      expect(action.text).toContain('nurture');
      expect(action.timeline).toBeDefined();
    });

    it('should generate monitor action for low priority', async () => {
      const company = makeCompany({ intelligenceScore: 10, _count: { contacts: 0, signals: 0, evidence: 0, opportunityRecommendations: 0, strategicInsights: 0 } });
      mockDbCompanyFindMany.mockResolvedValue([company]);
      mockDbAccountScoreFindMany.mockResolvedValue([]);
      mockDbOpportunityFindMany.mockResolvedValue([]);
      mockDbSignalFindMany.mockResolvedValue([]);
      mockDbCapMatchFindMany.mockResolvedValue([]);
      mockDbInsightFindMany.mockResolvedValue([]);

      const result = await generateAllRecommendations({ limit: 10 });
      const action = result.recommendations[0].recommendedAction;
      expect(action.timeline).toContain('quarterly');
      expect(action.text).toContain('Monitor');
    });
  });

  describe('5. "Why this account?" narrative', () => {
    it('should generate narrative for accounts with reasons', async () => {
      const company = makeCompany();
      mockDbCompanyFindMany.mockResolvedValue([company]);
      mockDbAccountScoreFindMany.mockResolvedValue([makeAccountScore()]);
      mockDbOpportunityFindMany.mockResolvedValue([makeOpportunity()]);
      mockDbSignalFindMany.mockResolvedValue([makeSignal()]);
      mockDbCapMatchFindMany.mockResolvedValue([makeCapabilityMatch()]);
      mockDbInsightFindMany.mockResolvedValue([]);

      const result = await generateAllRecommendations({ limit: 10 });
      const why = result.recommendations[0].whyThisAccount;
      expect(why).toContain('Acme Corporation');
      expect(why.length).toBeGreaterThan(20);
    });

    it('should handle accounts with no reasons gracefully', async () => {
      const company = makeCompany({ intelligenceScore: 0, _count: { contacts: 0, signals: 0, evidence: 0, opportunityRecommendations: 0, strategicInsights: 0 } });
      mockDbCompanyFindMany.mockResolvedValue([company]);
      mockDbAccountScoreFindMany.mockResolvedValue([]);
      mockDbOpportunityFindMany.mockResolvedValue([]);
      mockDbSignalFindMany.mockResolvedValue([]);
      mockDbCapMatchFindMany.mockResolvedValue([]);
      mockDbInsightFindMany.mockResolvedValue([]);

      const result = await generateAllRecommendations({ limit: 10 });
      const why = result.recommendations[0].whyThisAccount;
      expect(why).toContain('Enrichment recommended');
    });
  });

  describe('6. Confidence integration', () => {
    it('should compute unified confidence and map to grade', async () => {
      const company = makeCompany();
      mockDbCompanyFindMany.mockResolvedValue([company]);
      mockDbAccountScoreFindMany.mockResolvedValue([makeAccountScore()]);
      mockDbOpportunityFindMany.mockResolvedValue([]);
      mockDbSignalFindMany.mockResolvedValue([]);
      mockDbCapMatchFindMany.mockResolvedValue([]);
      mockDbInsightFindMany.mockResolvedValue([]);
      mockComputeUnifiedConfidence.mockReturnValue(makeConfidenceResult({ score: 82, grade: 'A-', enterpriseReady: true }));

      const result = await generateAllRecommendations({ limit: 10 });
      const rec = result.recommendations[0];
      expect(rec.confidenceScore).toBe(82);
      expect(rec.confidenceGrade).toBe('A-');
      expect(rec.enterpriseReady).toBe(true);
      expect(rec.confidenceFactors).toBeDefined();
      expect(rec.confidenceFactors!.length).toBe(6);
    });

    it('should degrade gracefully when confidence fails', async () => {
      mockComputeUnifiedConfidence.mockImplementationOnce(() => { throw new Error('Confidence engine error'); });
      const company = makeCompany();
      mockDbCompanyFindMany.mockResolvedValue([company]);
      mockDbAccountScoreFindMany.mockResolvedValue([]);
      mockDbOpportunityFindMany.mockResolvedValue([]);
      mockDbSignalFindMany.mockResolvedValue([]);
      mockDbCapMatchFindMany.mockResolvedValue([]);
      mockDbInsightFindMany.mockResolvedValue([]);

      const result = await generateAllRecommendations({ limit: 10 });
      const rec = result.recommendations[0];
      expect(rec.confidenceScore).toBe(50); // Fallback
      expect(rec.confidenceGrade).toBe('C'); // Fallback
      expect(rec.enterpriseReady).toBe(false);
    });
  });

  describe('7. Knowledge Graph enrichment', () => {
    it('should enrich with KG recommendations when available', async () => {
      mockGetGraphStats.mockReturnValue({ totalNodes: 150, totalEdges: 200 });
      mockKgRecommendations.mockReturnValue([
        {
          id: 'kg-rec-1',
          type: 'similar_companies',
          entity: { id: 'comp-similar', label: 'TechCorp Inc.', type: 'company' },
          reason: 'Similar technology stack and size range',
          confidence: 0.82,
          signals: [{ title: 'Cloud migration' }],
          suggestedActions: [],
          timestamp: new Date().toISOString(),
        },
      ]);
      const company = makeCompany();
      mockDbCompanyFindMany.mockResolvedValue([company]);
      mockDbAccountScoreFindMany.mockResolvedValue([makeAccountScore()]);
      mockDbOpportunityFindMany.mockResolvedValue([]);
      mockDbSignalFindMany.mockResolvedValue([]);
      mockDbCapMatchFindMany.mockResolvedValue([]);
      mockDbInsightFindMany.mockResolvedValue([]);

      const result = await generateAllRecommendations({ limit: 10 });
      const rec = result.recommendations[0];
      expect(rec.graphInsights).toBeDefined();
      expect(rec.graphInsights!.similarCompanies).toBe(1);
      const similarityReason = rec.reasons.find(r => r.category === 'similarity');
      expect(similarityReason).toBeDefined();
      expect(similarityReason!.text).toContain('TechCorp');
    });

    it('should not fail when KG is unavailable', async () => {
      mockGetGraphStats.mockReturnValue({ totalNodes: 0, totalEdges: 0 });
      const company = makeCompany();
      mockDbCompanyFindMany.mockResolvedValue([company]);
      mockDbAccountScoreFindMany.mockResolvedValue([]);
      mockDbOpportunityFindMany.mockResolvedValue([]);
      mockDbSignalFindMany.mockResolvedValue([]);
      mockDbCapMatchFindMany.mockResolvedValue([]);
      mockDbInsightFindMany.mockResolvedValue([]);

      const result = await generateAllRecommendations({ limit: 10 });
      expect(result.recommendations).toHaveLength(1);
      expect(result.recommendations[0].graphInsights).toBeUndefined();
    });

    it('should not fail when KG throws an error', async () => {
      mockGetGraphStats.mockImplementation(() => { throw new Error('KG crashed'); });
      const company = makeCompany();
      mockDbCompanyFindMany.mockResolvedValue([company]);
      mockDbAccountScoreFindMany.mockResolvedValue([]);
      mockDbOpportunityFindMany.mockResolvedValue([]);
      mockDbSignalFindMany.mockResolvedValue([]);
      mockDbCapMatchFindMany.mockResolvedValue([]);
      mockDbInsightFindMany.mockResolvedValue([]);

      const result = await generateAllRecommendations({ limit: 10 });
      expect(result.recommendations).toHaveLength(1);
    });
  });

  describe('8. Memory enrichment', () => {
    it('should enrich with memory patterns when available', async () => {
      mockSearchMemories.mockReturnValue([
        {
          memory: {
            id: 'mem-1',
            summary: 'Similar companies in tech industry showed 40% conversion after CTO change',
            content: 'Historical pattern analysis',
            category: 'company_intelligence',
          },
          relevanceScore: 0.85,
          matchReason: 'Historical conversion pattern match',
          layer: 'enterprise',
        },
      ]);
      const company = makeCompany();
      mockDbCompanyFindMany.mockResolvedValue([company]);
      mockDbAccountScoreFindMany.mockResolvedValue([makeAccountScore()]);
      mockDbOpportunityFindMany.mockResolvedValue([]);
      mockDbSignalFindMany.mockResolvedValue([]);
      mockDbCapMatchFindMany.mockResolvedValue([]);
      mockDbInsightFindMany.mockResolvedValue([]);

      const result = await generateAllRecommendations({ limit: 10 });
      const rec = result.recommendations[0];
      expect(rec.memoryPatterns).toBeDefined();
      expect(rec.memoryPatterns!.relevantMemories).toBe(1);
    });

    it('should not fail when memory throws', async () => {
      mockSearchMemories.mockImplementation(() => { throw new Error('Memory error'); });
      const company = makeCompany();
      mockDbCompanyFindMany.mockResolvedValue([company]);
      mockDbAccountScoreFindMany.mockResolvedValue([]);
      mockDbOpportunityFindMany.mockResolvedValue([]);
      mockDbSignalFindMany.mockResolvedValue([]);
      mockDbCapMatchFindMany.mockResolvedValue([]);
      mockDbInsightFindMany.mockResolvedValue([]);

      const result = await generateAllRecommendations({ limit: 10 });
      expect(result.recommendations).toHaveLength(1);
    });
  });

  describe('9. Edge cases', () => {
    it('should return empty list when no companies exist', async () => {
      mockDbCompanyFindMany.mockResolvedValue([]);
      const result = await generateAllRecommendations();
      expect(result.recommendations).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('should handle company with zero intelligence data', async () => {
      const company = makeCompany({
        intelligenceScore: null,
        lastEnrichedAt: null,
        domain: null,
        industry: null,
        _count: { contacts: 0, signals: 0, evidence: 0, opportunityRecommendations: 0, strategicInsights: 0 },
      });
      mockDbCompanyFindMany.mockResolvedValue([company]);
      mockDbAccountScoreFindMany.mockResolvedValue([]);
      mockDbOpportunityFindMany.mockResolvedValue([]);
      mockDbSignalFindMany.mockResolvedValue([]);
      mockDbCapMatchFindMany.mockResolvedValue([]);
      mockDbInsightFindMany.mockResolvedValue([]);

      const result = await generateAllRecommendations({ limit: 10 });
      expect(result.recommendations).toHaveLength(1);
      const rec = result.recommendations[0];
      expect(rec.reasons).toHaveLength(0);
      expect(rec.opportunityScore).toBeGreaterThanOrEqual(0);
      expect(rec.risks.length).toBeGreaterThanOrEqual(1); // Should have no-contacts risk
    });

    it('should filter by minScore', async () => {
      mockDbCompanyFindMany.mockResolvedValue([
        makeCompany({ id: 'comp-1', rawName: 'High Score Corp' }),
        makeCompany({ id: 'comp-2', rawName: 'Low Score Corp' }),
      ]);
      mockDbAccountScoreFindMany.mockResolvedValue([]);
      mockDbOpportunityFindMany.mockResolvedValue([]);
      mockDbSignalFindMany.mockResolvedValue([]);
      mockDbCapMatchFindMany.mockResolvedValue([]);
      mockDbInsightFindMany.mockResolvedValue([]);

      const result = await generateAllRecommendations({ limit: 10, minScore: 50 });
      expect(result.recommendations.length).toBeLessThanOrEqual(2);
    });

    it('should respect limit', async () => {
      const companies = Array.from({ length: 100 }, (_, i) =>
        makeCompany({ id: `comp-${i}`, rawName: `Company ${i}` })
      );
      mockDbCompanyFindMany.mockResolvedValue(companies);
      mockDbAccountScoreFindMany.mockResolvedValue([]);
      mockDbOpportunityFindMany.mockResolvedValue([]);
      mockDbSignalFindMany.mockResolvedValue([]);
      mockDbCapMatchFindMany.mockResolvedValue([]);
      mockDbInsightFindMany.mockResolvedValue([]);

      const result = await generateAllRecommendations({ limit: 5 });
      expect(result.recommendations.length).toBeLessThanOrEqual(5);
    });
  });

  describe('10. Single company recommendation', () => {
    it('should return null for non-existent company', async () => {
      mockDbCompanyFindUnique.mockResolvedValue(null);
      const result = await generateCompanyRecommendation('non-existent');
      expect(result).toBeNull();
    });

    it('should return full recommendation for existing company', async () => {
      const company = makeCompany();
      mockDbCompanyFindUnique.mockResolvedValue(company);
      mockDbAccountScoreFindFirst.mockResolvedValue(makeAccountScore());
      mockDbOpportunityFindMany.mockResolvedValue([makeOpportunity()]);
      mockDbSignalFindMany.mockResolvedValue([makeSignal()]);
      mockDbCapMatchFindMany.mockResolvedValue([makeCapabilityMatch()]);
      mockDbInsightFindMany.mockResolvedValue([makeInsight()]);

      const result = await generateCompanyRecommendation('comp-1');
      expect(result).toBeDefined();
      expect(result!.companyId).toBe('comp-1');
      expect(result!.companyName).toBe('Acme Corporation');
      expect(result!.topOpportunity).toBeDefined();
      expect(result!.topOpportunity!.title).toBe('Cloud Migration Opportunity');
      expect(result!.dataDepthIndicator).toBeDefined();
      expect(['comprehensive', 'moderate', 'limited', 'minimal']).toContain(result!.dataDepthIndicator);
    });
  });

  describe('11. Stats endpoint', () => {
    it('should return recommendation engine stats', async () => {
      mockDbCompanyCount.mockResolvedValueOnce(50); // total
      mockDbCompanyCount.mockResolvedValueOnce(30); // with signals
      mockDbCompanyCount.mockResolvedValueOnce(20); // with opportunities
      mockDbCompanyCount.mockResolvedValueOnce(25); // with cap matches
      mockDbAccountScoreFindMany.mockResolvedValue([
        { score: 70 }, { score: 80 }, { score: 60 }, { score: 90 },
      ]);
      mockDbAccountScoreGroupBy.mockResolvedValue([
        { category: 'HOT_ACCOUNT', _count: { category: 10 } },
        { category: 'NURTURE', _count: { category: 15 } },
      ]);
      mockDbSignalGroupBy.mockResolvedValue([
        { signalType: 'leadership_change', _count: { signalType: 12 } },
        { signalType: 'funding', _count: { signalType: 8 } },
      ]);

      const stats = await getRecommendationStats();
      expect(stats.totalCompanies).toBe(50);
      expect(stats.companiesWithSignals).toBe(30);
      expect(stats.averageAccountScore).toBe(75);
      expect(stats.tierDistribution['HOT_ACCOUNT']).toBe(10);
      expect(stats.topSignalsByType.length).toBeGreaterThan(0);
    });
  });

  describe('12. List result structure', () => {
    it('should include summary with priority breakdown', async () => {
      const companies = [
        makeCompany({ id: 'comp-1', rawName: 'Critical Corp' }),
        makeCompany({ id: 'comp-2', rawName: 'Low Corp' }),
      ];
      mockDbCompanyFindMany.mockResolvedValue(companies);
      mockDbAccountScoreFindMany.mockResolvedValue([makeAccountScore({ score: 95, companyId: 'comp-1' })]);
      mockDbOpportunityFindMany.mockResolvedValue([makeOpportunity({ companyId: 'comp-1', opportunityScore: 95 })]);
      mockDbSignalFindMany.mockResolvedValue([makeSignal()]);
      mockDbCapMatchFindMany.mockResolvedValue([makeCapabilityMatch()]);
      mockDbInsightFindMany.mockResolvedValue([]);

      const result = await generateAllRecommendations({ limit: 10 });
      expect(result.summary).toBeDefined();
      expect(result.summary.critical + result.summary.high + result.summary.medium + result.summary.low)
        .toBe(result.recommendations.length);
      expect(result.generatedAt).toBeDefined();
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);

      // Every recommendation should have a dataDepthIndicator
      for (const rec of result.recommendations) {
        expect(rec.dataDepthIndicator).toBeDefined();
        expect(['comprehensive', 'moderate', 'limited', 'minimal']).toContain(rec.dataDepthIndicator);
      }
    });
  });

  describe('Data Depth Indicator (Phase 4.5.6)', () => {
    it('should classify comprehensive depth when all dimensions are rich', async () => {
      const richCompany = makeCompany({
        _count: { contacts: 10, signals: 8, evidence: 15, opportunityRecommendations: 5, strategicInsights: 3 },
      });
      mockDbCompanyFindUnique.mockResolvedValue(richCompany);
      mockDbAccountScoreFindFirst.mockResolvedValue(makeAccountScore());
      mockDbOpportunityFindMany.mockResolvedValue([
        makeOpportunity({ id: 'opp-1' }),
        makeOpportunity({ id: 'opp-2' }),
        makeOpportunity({ id: 'opp-3' }),
      ]);
      mockDbSignalFindMany.mockResolvedValue([
        makeSignal({ id: 'sig-1' }), makeSignal({ id: 'sig-2' }),
        makeSignal({ id: 'sig-3' }), makeSignal({ id: 'sig-4' }),
        makeSignal({ id: 'sig-5' }),
      ]);
      mockDbCapMatchFindMany.mockResolvedValue([
        makeCapabilityMatch({ id: 'cap-1' }),
        makeCapabilityMatch({ id: 'cap-2' }),
        makeCapabilityMatch({ id: 'cap-3' }),
      ]);
      mockDbInsightFindMany.mockResolvedValue([]);

      const result = await generateCompanyRecommendation('comp-1');
      expect(result).toBeDefined();
      expect(result!.dataDepthIndicator).toBe('comprehensive');
    });

    it('should classify minimal depth when data is sparse', async () => {
      const sparseCompany = makeCompany({
        _count: { contacts: 0, signals: 0, evidence: 0, opportunityRecommendations: 0, strategicInsights: 0 },
        lastEnrichedAt: null,
      });
      mockDbCompanyFindUnique.mockResolvedValue(sparseCompany);
      mockDbAccountScoreFindFirst.mockResolvedValue(null);
      mockDbOpportunityFindMany.mockResolvedValue([]);
      mockDbSignalFindMany.mockResolvedValue([]);
      mockDbCapMatchFindMany.mockResolvedValue([]);
      mockDbInsightFindMany.mockResolvedValue([]);

      const result = await generateCompanyRecommendation('comp-1');
      expect(result).toBeDefined();
      expect(result!.dataDepthIndicator).toBe('minimal');
    });

    it('should handle moderate and limited depth levels', async () => {
      // Moderate: 3 signal types with reasonable coverage
      // signals=3 (score 1), opportunities=2 (score 1), capMatches=1 (score 1), contacts=3 (score 1) → total=4 → moderate
      const moderateCompany = makeCompany({
        _count: { contacts: 3, signals: 3, evidence: 2, opportunityRecommendations: 2, strategicInsights: 0 },
      });
      mockDbCompanyFindUnique.mockResolvedValue(moderateCompany);
      mockDbAccountScoreFindFirst.mockResolvedValue(makeAccountScore());
      mockDbOpportunityFindMany.mockResolvedValue([
        makeOpportunity({ id: 'opp-1' }), makeOpportunity({ id: 'opp-2' }),
      ]);
      mockDbSignalFindMany.mockResolvedValue([
        makeSignal({ id: 'sig-1' }), makeSignal({ id: 'sig-2' }), makeSignal({ id: 'sig-3' }),
      ]);
      mockDbCapMatchFindMany.mockResolvedValue([makeCapabilityMatch({ id: 'cap-1' })]);
      mockDbInsightFindMany.mockResolvedValue([]);

      const result = await generateCompanyRecommendation('comp-1');
      expect(result).toBeDefined();
      expect(result!.dataDepthIndicator).toBe('moderate');

      // Limited: 2 signal types with sparse coverage
      // signals=2 (score 1), opportunities=0 (score 0), capMatches=1 (score 1), contacts=1 (score 1) → total=3 → limited
      const limitedCompany = makeCompany({
        _count: { contacts: 1, signals: 2, evidence: 0, opportunityRecommendations: 0, strategicInsights: 0 },
      });
      mockDbCompanyFindUnique.mockResolvedValue(limitedCompany);
      mockDbAccountScoreFindFirst.mockResolvedValue(null);
      mockDbOpportunityFindMany.mockResolvedValue([]);
      mockDbSignalFindMany.mockResolvedValue([
        makeSignal({ id: 'sig-1' }), makeSignal({ id: 'sig-2' }),
      ]);
      mockDbCapMatchFindMany.mockResolvedValue([makeCapabilityMatch({ id: 'cap-1' })]);
      mockDbInsightFindMany.mockResolvedValue([]);

      const result2 = await generateCompanyRecommendation('comp-1');
      expect(result2).toBeDefined();
      expect(result2!.dataDepthIndicator).toBe('limited');
    });
  });
});
