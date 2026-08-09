/**
 * Phase 1 — Learning Loop Closed-Circuit Test
 * ================================================
 *
 * This test proves the COMPLETE feedback loop:
 *   1. User submits feedback (useful / not_useful)
 *   2. Feedback is stored in intelligenceFeedback table
 *   3. getCalibrationAdjustments() computes adjustments from stored feedback
 *   4. Recommendation engine applies adjustments to scores
 *   5. Recommendations change as a result of feedback
 *   6. Changes are user-visible (reasons include calibration explanation)
 *
 * Non-negotiable: The loop is only complete when step 5 produces a
 * DIFFERENT score than step 4 would without feedback.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mock DB ──

const mockDbIntelligenceFeedbackFindMany = vi.fn();
const mockDbIntelligenceFeedbackCreate = vi.fn();
const mockDbIntelligenceFeedbackCount = vi.fn();
const mockDbCompanyFindMany = vi.fn();
const mockDbAccountScoreFindMany = vi.fn();
const mockDbOpportunityFindMany = vi.fn();
const mockDbSignalFindMany = vi.fn();
const mockDbCapMatchFindMany = vi.fn();
const mockDbInsightFindMany = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    intelligenceFeedback: {
      findMany: (...args: unknown[]) => mockDbIntelligenceFeedbackFindMany(...args),
      create: (...args: unknown[]) => mockDbIntelligenceFeedbackCreate(...args),
      count: (...args: unknown[]) => mockDbIntelligenceFeedbackCount(...args),
    },
    company: {
      findMany: (...args: unknown[]) => mockDbCompanyFindMany(...args),
    },
    accountScore: {
      findMany: (...args: unknown[]) => mockDbAccountScoreFindMany(...args),
    },
    opportunityRecommendation: {
      findMany: (...args: unknown[]) => mockDbOpportunityFindMany(...args),
    },
    companySignal: {
      findMany: (...args: unknown[]) => mockDbSignalFindMany(...args),
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
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/ai-unified-confidence', () => ({
  computeUnifiedConfidence: () => ({
    score: 0.75,
    grade: 'B',
    enterpriseReady: true,
    factors: [{ dimension: 'data', score: 0.8, weight: 0.3, explanation: 'test' }],
  }),
}));

vi.mock('@/lib/ai-knowledge-graph', () => ({
  generateRecommendations: () => ({ similarCompanies: [], patterns: [] }),
  expandFromEntity: () => [],
  getGraphStats: () => ({ totalNodes: 0, totalEdges: 0 }),
}));

vi.mock('@/lib/ai-memory', () => ({
  searchMemories: () => [],
  buildMemoryContext: () => ({ context: '', relevantMemories: [] }),
}));

// ── Imports after mocks ──

const { processFeedback, getCalibrationAdjustments } = await import('@/lib/feedback-learning-loop');
const { generateAllRecommendations } = await import('@/lib/recommendation-engine');

// ── Test Data ──

function makeCompany(overrides: Record<string, unknown> = {}) {
  return {
    id: 'comp-feedback-1',
    rawName: 'FeedbackTest Corp',
    domain: 'feedback-test.com',
    industry: 'Technology',
    intelligenceScore: 65,
    lastEnrichedAt: new Date('2025-06-15'),
    sizeRange: '50-200',
    location: 'London, UK',
    country: 'GB',
    source: 'manual',
    status: 'active',
    _count: { contacts: 3, signals: 2, evidence: 5, opportunityRecommendations: 1, strategicInsights: 1 },
    ...overrides,
  };
}

function makeFeedbackRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: `fb-${Math.random().toString(36).slice(2)}`,
    companyId: 'comp-feedback-1',
    verdict: 'useful',
    feedbackReason: 'accurate_signals',
    recommendationSnapshot: { priority: 'high', opportunityScore: 65, confidenceGrade: 'B' },
    createdAt: new Date(),
    ...overrides,
  };
}

function makeOpportunity(cid: string, overrides: Record<string, unknown> = {}) {
  return {
    companyId: cid,
    id: `opp-${cid}`,
    opportunityTitle: 'Cloud Migration Opportunity',
    opportunityScore: 70,
    priority: 'high',
    signalId: `sig-${cid}`,
    whyNow: 'New CTO hired, actively evaluating cloud solutions',
    businessProblem: 'Legacy on-premise infrastructure bottleneck',
    recommendedCapability: 'Cloud Architecture Assessment',
    confidenceScore: 0.85,
    status: 'active',
    ...overrides,
  };
}

function makeSignal(cid: string, overrides: Record<string, unknown> = {}) {
  return {
    companyId: cid,
    id: `sig-${cid}`,
    signalType: 'leadership_change',
    title: 'New CTO hired',
    severity: 'high',
    confidence: 0.7,
    impact: 'high',
    signalDate: new Date(),
    recommendedAction: 'Engage with technical discovery',
    timingWindow: 'within_14_days',
    ...overrides,
  };
}

/** Helper: set up all DB mocks for a set of companies */
function setupRecommendationMocks(companies: ReturnType<typeof makeCompany>[]) {
  mockDbCompanyFindMany.mockResolvedValue(companies);
  mockDbAccountScoreFindMany.mockResolvedValue(
    companies.map(c => ({ companyId: c.id, score: 65, category: 'WARM_ACCOUNT' }))
  );
  mockDbOpportunityFindMany.mockResolvedValue(
    companies.map(c => makeOpportunity(c.id))
  );
  mockDbSignalFindMany.mockResolvedValue(
    companies.map(c => makeSignal(c.id))
  );
  mockDbCapMatchFindMany.mockResolvedValue([]);
  mockDbInsightFindMany.mockResolvedValue([]);
}

// ── Tests ──

describe('Learning Loop Closed Circuit', () => {

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Circuit Step 1-2: Feedback is stored', () => {
    it('processFeedback stores feedback in the database', async () => {
      mockDbIntelligenceFeedbackCreate.mockResolvedValue({
        id: 'fb-test-1',
        companyId: 'comp-feedback-1',
        verdict: 'useful',
        feedbackReason: 'accurate_signals',
      });
      mockDbIntelligenceFeedbackCount.mockResolvedValue(0);

      const result = await processFeedback({
        companyId: 'comp-feedback-1',
        verdict: 'useful',
        feedbackReason: 'accurate_signals',
        recommendationId: 'rec-1',
        userId: 'user-1',
      });

      expect(mockDbIntelligenceFeedbackCreate).toHaveBeenCalledTimes(1);
      expect(result).toBeDefined();
    });
  });

  describe('Circuit Step 2-3: Calibration computes from stored feedback', () => {
    it('getCalibrationAdjustments returns up adjustment for company with 6+ useful vs 1 negative', async () => {
      mockDbIntelligenceFeedbackFindMany.mockResolvedValueOnce([
        makeFeedbackRecord({ verdict: 'useful', feedbackReason: 'accurate_signals' }),
        makeFeedbackRecord({ verdict: 'useful', feedbackReason: 'accurate_signals' }),
        makeFeedbackRecord({ verdict: 'useful', feedbackReason: 'good_timing' }),
        makeFeedbackRecord({ verdict: 'useful', feedbackReason: 'accurate_signals' }),
        makeFeedbackRecord({ verdict: 'useful', feedbackReason: 'accurate_signals' }),
        makeFeedbackRecord({ verdict: 'useful', feedbackReason: 'good_timing' }),
        makeFeedbackRecord({ verdict: 'useful', feedbackReason: 'accurate_signals' }),
        makeFeedbackRecord({ verdict: 'not_useful', feedbackReason: 'bad_timing' }),
      ]);
      mockDbIntelligenceFeedbackFindMany.mockResolvedValueOnce([]);

      const adjustments = await getCalibrationAdjustments('comp-feedback-1');

      expect(adjustments.length).toBeGreaterThan(0);

      const companyAdj = adjustments.find(a => a.pattern === 'company:comp-feedback-1');
      expect(companyAdj).toBeDefined();
      expect(companyAdj!.direction).toBe('up');
      expect(companyAdj!.magnitude).toBeGreaterThan(0);
      expect(companyAdj!.supportingFeedbackCount).toBe(7);
    });

    it('getCalibrationAdjustments returns down adjustment when negative feedback dominates', async () => {
      mockDbIntelligenceFeedbackFindMany.mockResolvedValueOnce([
        makeFeedbackRecord({ verdict: 'not_useful', feedbackReason: 'incorrect_technology' }),
        makeFeedbackRecord({ verdict: 'not_useful', feedbackReason: 'wrong_decision_maker' }),
        makeFeedbackRecord({ verdict: 'not_useful', feedbackReason: 'data_was_stale' }),
        makeFeedbackRecord({ verdict: 'not_useful', feedbackReason: 'incorrect_technology' }),
        makeFeedbackRecord({ verdict: 'not_useful', feedbackReason: 'data_was_stale' }),
        makeFeedbackRecord({ verdict: 'not_useful', feedbackReason: 'incorrect_technology' }),
        makeFeedbackRecord({ verdict: 'useful', feedbackReason: 'accurate_signals' }),
      ]);
      mockDbIntelligenceFeedbackFindMany.mockResolvedValueOnce([]);

      const adjustments = await getCalibrationAdjustments('comp-feedback-1');

      const companyAdj = adjustments.find(a => a.pattern === 'company:comp-feedback-1');
      expect(companyAdj).toBeDefined();
      expect(companyAdj!.direction).toBe('down');
      expect(companyAdj!.magnitude).toBeGreaterThan(0);
    });

    it('returns empty when feedback count is below threshold (fewer than 3)', async () => {
      mockDbIntelligenceFeedbackFindMany.mockResolvedValueOnce([
        makeFeedbackRecord({ verdict: 'useful', feedbackReason: 'accurate_signals' }),
        makeFeedbackRecord({ verdict: 'useful', feedbackReason: 'accurate_signals' }),
      ]);
      mockDbIntelligenceFeedbackFindMany.mockResolvedValueOnce([]);

      const adjustments = await getCalibrationAdjustments('comp-feedback-1');
      expect(adjustments).toHaveLength(0);
    });
  });

  describe('Circuit Step 3-5: Calibration changes recommendation scores', () => {
    it('FULL CLOSED LOOP: positive feedback increases recommendation score', async () => {
      const companyA = makeCompany({ id: 'comp-a', rawName: 'Company A' });
      const companyB = makeCompany({ id: 'comp-b', rawName: 'Company B' });

      // ── Run 1: WITHOUT calibration ──
      setupRecommendationMocks([companyA, companyB]);
      // 5 DB calls: system-wide(1) + comp-a(2) + comp-b(2)
      for (let i = 0; i < 5; i++) mockDbIntelligenceFeedbackFindMany.mockResolvedValueOnce([]);

      const resultWithout = await generateAllRecommendations({ limit: 10 });

      // ── Run 2: WITH calibration — Company A has positive feedback ──
      setupRecommendationMocks([companyA, companyB]);
      // Call order: system-wide(1) → comp-a-specific(1) → comp-a-sys-wide(1) → comp-b-specific(1) → comp-b-sys-wide(1)
      // Response 1: system-wide → empty
      mockDbIntelligenceFeedbackFindMany.mockResolvedValueOnce([]);
      // Response 2: company-specific for comp-a → 7 useful, 1 not_useful
      mockDbIntelligenceFeedbackFindMany.mockResolvedValueOnce([
        makeFeedbackRecord({ companyId: 'comp-a', verdict: 'useful' }),
        makeFeedbackRecord({ companyId: 'comp-a', verdict: 'useful' }),
        makeFeedbackRecord({ companyId: 'comp-a', verdict: 'useful' }),
        makeFeedbackRecord({ companyId: 'comp-a', verdict: 'useful' }),
        makeFeedbackRecord({ companyId: 'comp-a', verdict: 'useful' }),
        makeFeedbackRecord({ companyId: 'comp-a', verdict: 'useful' }),
        makeFeedbackRecord({ companyId: 'comp-a', verdict: 'not_useful' }),
      ]);
      // Response 3: system-wide within comp-a call → empty
      mockDbIntelligenceFeedbackFindMany.mockResolvedValueOnce([]);
      // Response 4: company-specific for comp-b → empty (no feedback for B)
      mockDbIntelligenceFeedbackFindMany.mockResolvedValueOnce([]);
      // Response 5: system-wide within comp-b call → empty
      mockDbIntelligenceFeedbackFindMany.mockResolvedValueOnce([]);

      const resultWith = await generateAllRecommendations({ limit: 10 });

      // VERIFY: Both runs produced recommendations
      const compABefore = resultWithout.recommendations.find(r => r.companyId === 'comp-a');
      const compAAfter = resultWith.recommendations.find(r => r.companyId === 'comp-a');
      const compBAfter = resultWith.recommendations.find(r => r.companyId === 'comp-b');
      const compBBefore = resultWithout.recommendations.find(r => r.companyId === 'comp-b');

      expect(compABefore).toBeDefined();
      expect(compAAfter).toBeDefined();
      expect(compBBefore).toBeDefined();
      expect(compBAfter).toBeDefined();

      // CIRCUIT CLOSURE: Company A score must be HIGHER with calibration
      // (Company A gets company-specific + reason-level boost)
      expect(compAAfter!.opportunityScore).toBeGreaterThan(compABefore!.opportunityScore);

      // Company B may get reason-level adjustments (global), but should get less boost than A
      // because B has no company-specific adjustment
      const deltaA = compAAfter!.opportunityScore - compABefore!.opportunityScore;
      const deltaB = compBAfter!.opportunityScore - compBBefore!.opportunityScore;
      expect(deltaA).toBeGreaterThan(deltaB);

      // USER-VISIBLE: calibration reason appears in reasons
      const calibrationReason = compAAfter!.reasons.find(r => r.sourceId?.startsWith('calibration:'));
      expect(calibrationReason).toBeDefined();
      expect(calibrationReason!.category).toBe('pattern');
      expect(calibrationReason!.strength).toBeGreaterThan(0);
    });

    it('FULL CLOSED LOOP: negative feedback decreases recommendation score', async () => {
      const company = makeCompany({ id: 'comp-neg', rawName: 'NegativeFeedback Corp' });

      // ── Run 1: WITHOUT calibration ──
      setupRecommendationMocks([company]);
      // 3 DB calls: system-wide(1) + company-specific(1) + system-wide-in-company-call(1)
      for (let i = 0; i < 3; i++) mockDbIntelligenceFeedbackFindMany.mockResolvedValueOnce([]);

      const resultWithout = await generateAllRecommendations({ limit: 10 });

      // ── Run 2: WITH negative calibration ──
      setupRecommendationMocks([company]);
      // Call order: system-wide(1) → company-specific(1) → system-wide-in-company-call(1)
      // Response 1: system-wide → empty
      mockDbIntelligenceFeedbackFindMany.mockResolvedValueOnce([]);
      // Response 2: company-specific for comp-neg → 7 negative, 1 positive
      mockDbIntelligenceFeedbackFindMany.mockResolvedValueOnce([
        makeFeedbackRecord({ companyId: 'comp-neg', verdict: 'not_useful' }),
        makeFeedbackRecord({ companyId: 'comp-neg', verdict: 'not_useful' }),
        makeFeedbackRecord({ companyId: 'comp-neg', verdict: 'not_useful' }),
        makeFeedbackRecord({ companyId: 'comp-neg', verdict: 'not_useful' }),
        makeFeedbackRecord({ companyId: 'comp-neg', verdict: 'not_useful' }),
        makeFeedbackRecord({ companyId: 'comp-neg', verdict: 'not_useful' }),
        makeFeedbackRecord({ companyId: 'comp-neg', verdict: 'incorrect_action' }),
        makeFeedbackRecord({ companyId: 'comp-neg', verdict: 'useful' }),
      ]);
      // Response 3: system-wide within company call → empty
      mockDbIntelligenceFeedbackFindMany.mockResolvedValueOnce([]);

      const resultWith = await generateAllRecommendations({ limit: 10 });

      const before = resultWithout.recommendations.find(r => r.companyId === 'comp-neg');
      const after = resultWith.recommendations.find(r => r.companyId === 'comp-neg');

      expect(before).toBeDefined();
      expect(after).toBeDefined();

      // CIRCUIT CLOSURE: negative feedback DECREASES score
      expect(after!.opportunityScore).toBeLessThan(before!.opportunityScore);

      // USER-VISIBLE: calibration reason
      const calReason = after!.reasons.find(r => r.sourceId?.startsWith('calibration:'));
      expect(calReason).toBeDefined();
      expect(calReason!.text).toContain('negative');
    });

    it('Calibration does not break when feedback fetch fails (graceful degradation)', async () => {
      const company = makeCompany({ id: 'comp-grace', rawName: 'Graceful Corp' });

      setupRecommendationMocks([company]);
      // Calibration throws — should NOT throw, graceful degradation
      mockDbIntelligenceFeedbackFindMany.mockRejectedValueOnce(new Error('DB connection lost'));
      mockDbIntelligenceFeedbackFindMany.mockRejectedValueOnce(new Error('DB connection lost'));

      const result = await generateAllRecommendations({ limit: 10 });
      expect(result.recommendations).toBeDefined();
      expect(result.recommendations.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Circuit completeness verification', () => {
    it('Score delta matches expected magnitude from calibration', async () => {
      // With 7 useful vs 1 not_useful:
      //   magnitude = min(0.15, (7-1)*0.02) = min(0.15, 0.12) = 0.12
      //   Score shift = 0.12 * 100 = +12 points
      const company = makeCompany({ id: 'comp-mag', rawName: 'Magnitude Test' });

      // ── Run 1: WITHOUT calibration ──
      setupRecommendationMocks([company]);
      // 3 DB calls: system-wide(1) + company-specific(1) + system-wide-in-company-call(1)
      for (let i = 0; i < 3; i++) mockDbIntelligenceFeedbackFindMany.mockResolvedValueOnce([]);

      const resultBefore = await generateAllRecommendations({ limit: 10 });

      // ── Run 2: WITH calibration: 7 useful, 1 not_useful ──
      setupRecommendationMocks([company]);
      // Call order: system-wide(1) → company-specific(1) → system-wide-in-company-call(1)
      // Response 1: system-wide → empty
      mockDbIntelligenceFeedbackFindMany.mockResolvedValueOnce([]);
      // Response 2: company-specific for comp-mag → 7 useful, 1 not_useful
      mockDbIntelligenceFeedbackFindMany.mockResolvedValueOnce([
        makeFeedbackRecord({ companyId: 'comp-mag', verdict: 'useful' }),
        makeFeedbackRecord({ companyId: 'comp-mag', verdict: 'useful' }),
        makeFeedbackRecord({ companyId: 'comp-mag', verdict: 'useful' }),
        makeFeedbackRecord({ companyId: 'comp-mag', verdict: 'useful' }),
        makeFeedbackRecord({ companyId: 'comp-mag', verdict: 'useful' }),
        makeFeedbackRecord({ companyId: 'comp-mag', verdict: 'useful' }),
        makeFeedbackRecord({ companyId: 'comp-mag', verdict: 'useful' }),
        makeFeedbackRecord({ companyId: 'comp-mag', verdict: 'not_useful' }),
      ]);
      // Response 3: system-wide within company call → empty
      mockDbIntelligenceFeedbackFindMany.mockResolvedValueOnce([]);

      const resultAfter = await generateAllRecommendations({ limit: 10 });

      const before = resultBefore.recommendations.find(r => r.companyId === 'comp-mag');
      const after = resultAfter.recommendations.find(r => r.companyId === 'comp-mag');

      expect(before).toBeDefined();
      expect(after).toBeDefined();

      const delta = after!.opportunityScore - before!.opportunityScore;
      // Company-level: magnitude = min(0.15, (7-1)*0.02) = 0.12 → shift = +12
      // Reason-level 'accurate_signals': magnitude = 0.05, dampened 0.5x → shift = +2.5
      // Total: 12 + 2.5 = 14.5 → Math.round(rawScore + 14.5) = rawScore + 15
      expect(delta).toBe(15);
    });
  });
});
