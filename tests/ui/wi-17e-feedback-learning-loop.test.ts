/**
 * WI-17E — Feedback Learning Loop Tests
 *
 * Tests cover:
 * 1. Feedback submission and storage
 * 2. Memory creation from positive feedback
 * 3. Memory creation from negative feedback (corrections)
 * 4. Learning event creation for significant outcomes
 * 5. Confidence calibration from accumulated feedback
 * 6. Calibration adjustments (company-specific and system-wide)
 * 7. Company feedback statistics
 * 8. System-wide learning analytics
 * 9. Feedback memory search
 * 10. Edge cases (minimal feedback, no company, empty state)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Mocks ──

const mockStoreMemory = vi.fn();
const mockSearchMemories = vi.fn();
vi.mock('@/lib/ai-memory', () => ({
  storeMemory: (...args: unknown[]) => mockStoreMemory(...args),
  searchMemories: (...args: unknown[]) => mockSearchMemories(...args),
}));

const mockKgRecommendations = vi.fn();
const mockGetGraphStats = vi.fn();
vi.mock('@/lib/ai-knowledge-graph', () => ({
  generateRecommendations: (...args: unknown[]) => mockKgRecommendations(...args),
  getGraphStats: (...args: unknown[]) => mockGetGraphStats(...args),
}));

const mockComputeUnifiedConfidence = vi.fn();
vi.mock('@/lib/ai-unified-confidence', () => ({
  computeUnifiedConfidence: (...args: unknown[]) => mockComputeUnifiedConfidence(...args),
}));

const mockDbCompanyFindUnique = vi.fn();
const mockDbCompanyFindMany = vi.fn();
const mockDbIntelligenceFeedbackCreate = vi.fn();
const mockDbIntelligenceFeedbackCount = vi.fn();
const mockDbIntelligenceFeedbackFindMany = vi.fn();
const mockDbIntelligenceFeedbackUpdate = vi.fn();
const mockDbLearningEventCreate = vi.fn();
const mockDbAccountScoreFindMany = vi.fn();
const mockDbAccountScoreFindFirst = vi.fn();
const mockDbOpportunityFindMany = vi.fn();
const mockDbSignalFindMany = vi.fn();
const mockDbCapMatchFindMany = vi.fn();
const mockDbInsightFindMany = vi.fn();
const mockDbEvidenceFindMany = vi.fn();
const mockDbContactFindMany = vi.fn();
const mockDbCompanyCount = vi.fn();
const mockDbSignalGroupBy = vi.fn();
const mockDbAccountScoreGroupBy = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    company: {
      findUnique: (...args: unknown[]) => mockDbCompanyFindUnique(...args),
      findMany: (...args: unknown[]) => mockDbCompanyFindMany(...args),
      count: (...args: unknown[]) => mockDbCompanyCount(...args),
    },
    intelligenceFeedback: {
      create: (...args: unknown[]) => mockDbIntelligenceFeedbackCreate(...args),
      count: (...args: unknown[]) => mockDbIntelligenceFeedbackCount(...args),
      findMany: (...args: unknown[]) => mockDbIntelligenceFeedbackFindMany(...args),
      update: (...args: unknown[]) => mockDbIntelligenceFeedbackUpdate(...args),
    },
    learningEvent: {
      create: (...args: unknown[]) => mockDbLearningEventCreate(...args),
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

const { logger } = await import('@/lib/logger');

// ── Import after mocks ──

const {
  processFeedback,
  getCalibrationAdjustments,
  getCompanyFeedbackStats,
  getLearningAnalytics,
  searchFeedbackMemories,
  FEEDBACK_REASON_LABELS,
} = await import('@/lib/feedback-learning-loop');

// ── Test Data ──

function makeCompany() {
  return {
    id: 'comp-1',
    rawName: 'Acme Corporation',
    domain: 'acme.com',
    industry: 'Technology',
    sizeRange: '201-500',
    source: 'manual',
    lastEnrichedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
    status: 'active',
    intelligenceScore: 72,
  };
}

function makePositiveSubmission(overrides: Record<string, unknown> = {}) {
  return {
    companyId: 'comp-1',
    verdict: 'useful',
    feedbackReason: 'converted_opportunity',
    actualOutcome: 'converted',
    recommendationSnapshot: { priority: 'critical', opportunityScore: 86, confidenceGrade: 'B+' },
    ...overrides,
  };
}

function makeNegativeSubmission(overrides: Record<string, unknown> = {}) {
  return {
    companyId: 'comp-1',
    verdict: 'not_useful',
    feedbackReason: 'wrong_decision_maker',
    feedbackDetail: 'The CTO was not the right person to contact',
    correctAction: false,
    ...overrides,
  };
}

function makePartialSubmission() {
  return {
    companyId: 'comp-1',
    verdict: 'partially_useful',
    feedbackReason: 'bad_timing',
    correctSignals: ['sig-1'],
    incorrectSignals: ['sig-3'],
  };
}

function makeFeedbackRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'fb-1',
    companyId: 'comp-1',
    recommendationSnapshot: '{}',
    verdict: 'useful',
    sentiment: 'positive',
    feedbackReason: 'converted_opportunity',
    feedbackDetail: null,
    correctSignals: '[]',
    incorrectSignals: '[]',
    correctAction: true,
    actualOutcome: 'converted',
    priorityAtFeedback: 'critical',
    scoreAtFeedback: 86,
    confidenceAtFeedback: 'B+',
    memoryCreated: false,
    learningEventId: null,
    calibrationApplied: false,
    userId: null,
    createdAt: new Date(),
    ...overrides,
  };
}

// ── Setup ──

function setupDefaultMocks() {
  mockGetGraphStats.mockReturnValue({ totalNodes: 50, totalEdges: 120 });
  mockComputeUnifiedConfidence.mockReturnValue({
    score: 78, grade: 'B+', trustClass: 'enterprise', enterpriseReady: true,
    factors: [], summary: 'test', recommendations: [], timestamp: new Date().toISOString(), modelVersion: '1.0.0',
  });

  // Company lookup
  mockDbCompanyFindUnique.mockResolvedValue(makeCompany());
  mockDbCompanyFindMany.mockResolvedValue([makeCompany()]);

  // Feedback storage
  mockDbIntelligenceFeedbackCreate.mockResolvedValue({
    id: 'fb-new-1',
    companyId: 'comp-1',
  });

  // Feedback counts
  mockDbIntelligenceFeedbackCount.mockResolvedValue(1);
  mockDbIntelligenceFeedbackFindMany.mockResolvedValue([
    makeFeedbackRecord({ verdict: 'useful' }),
  ]);

  // Feedback update (for memoryCreated/calibrationApplied)
  mockDbIntelligenceFeedbackUpdate.mockResolvedValue({});

  // Learning event
  mockDbLearningEventCreate.mockResolvedValue({
    id: 'le-1',
    companyId: 'comp-1',
  });

  // For recommendation engine (called indirectly)
  mockDbAccountScoreFindMany.mockResolvedValue([]);
  mockDbOpportunityFindMany.mockResolvedValue([]);
  mockDbSignalFindMany.mockResolvedValue([]);
  mockDbCapMatchFindMany.mockResolvedValue([]);
  mockDbInsightFindMany.mockResolvedValue([]);
  mockDbEvidenceFindMany.mockResolvedValue([]);
  mockDbContactFindMany.mockResolvedValue([]);
  mockDbCompanyCount.mockResolvedValue(1);
  mockDbSignalGroupBy.mockResolvedValue([]);
  mockDbAccountScoreGroupBy.mockResolvedValue([]);
}

beforeEach(() => {
  vi.resetAllMocks();
  setupDefaultMocks();
});

// ── 1. Feedback Submission and Storage ──

describe('WI-17E: Feedback Submission', () => {
  it('should store feedback with correct verdict and sentiment', async () => {
    const result = await processFeedback(makePositiveSubmission());

    expect(result.feedbackId).toBe('fb-new-1');
    expect(result.verdict).toBe('useful');
    expect(result.sentiment).toBe('positive');
    expect(result.companyId).toBe('comp-1');
  });

  it('should determine sentiment from verdict when not provided', async () => {
    const result = await processFeedback(makeNegativeSubmission());

    expect(result.sentiment).toBe('negative');
    expect(result.verdict).toBe('not_useful');
  });

  it('should handle partially useful verdict', async () => {
    const result = await processFeedback(makePartialSubmission());

    expect(result.verdict).toBe('partially_useful');
    expect(result.sentiment).toBe('neutral');
  });

  it('should store recommendation snapshot', async () => {
    const submission = makePositiveSubmission();
    await processFeedback(submission);

    expect(mockDbIntelligenceFeedbackCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          verdict: 'useful',
          sentiment: 'positive',
          feedbackReason: 'converted_opportunity',
          actualOutcome: 'converted',
        }),
      })
    );
  });

  it('should store signal correctness data', async () => {
    const submission = makePartialSubmission();
    await processFeedback(submission);

    expect(mockDbIntelligenceFeedbackCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          correctSignals: JSON.stringify(['sig-1']),
          incorrectSignals: JSON.stringify(['sig-3']),
        }),
      })
    );
  });
});

// ── 2. Memory Creation from Positive Feedback ──

describe('WI-17E: Positive Feedback Memory', () => {
  it('should create institutional memory for useful feedback', async () => {
    const result = await processFeedback(makePositiveSubmission());

    expect(result.memoryCreated).toBe(true);
    expect(result.memoryId).toBeDefined();
  });

  it('should store memory in institutional layer', async () => {
    await processFeedback(makePositiveSubmission());

    expect(mockStoreMemory).toHaveBeenCalledWith(
      expect.objectContaining({
        layer: 'institutional',
        category: 'learning_insight',
      })
    );
  });

  it('should include company context in memory tags', async () => {
    await processFeedback(makePositiveSubmission());

    const call = mockStoreMemory.mock.calls[0][0] as any;
    expect(call.tags).toContain('Technology');
    expect(call.tags).toContain('converted_opportunity');
    expect(call.tags).toContain('feedback_learning');
  });

  it('should set high importance for conversion feedback', async () => {
    await processFeedback(makePositiveSubmission({
      verdict: 'useful',
      actualOutcome: 'converted',
    }));

    const call = mockStoreMemory.mock.calls[0][0] as any;
    expect(call.importance).toBe(1.0);
    expect(call.confidence).toBe(0.95);
    expect(call.priority).toBe('critical');
  });

  it('should set moderate importance for simple useful feedback', async () => {
    await processFeedback(makePositiveSubmission({
      actualOutcome: null,
    }));

    const call = mockStoreMemory.mock.calls[0][0] as any;
    expect(call.importance).toBe(0.7);
    expect(call.confidence).toBe(0.80);
  });

  it('should include feedback summary', async () => {
    const result = await processFeedback(makePositiveSubmission());

    expect(result.learningSummary).toContain('Acme Corporation');
    expect(result.learningSummary).toContain('converted_opportunity');
  });
});

// ── 3. Memory Creation from Negative Feedback (Corrections) ──

describe('WI-17E: Negative Feedback Memory (Corrections)', () => {
  it('should create institutional memory for negative feedback', async () => {
    const result = await processFeedback(makeNegativeSubmission());

    expect(result.memoryCreated).toBe(true);
  });

  it('should set high importance for negative feedback (learning value)', async () => {
    await processFeedback(makeNegativeSubmission());

    const call = mockStoreMemory.mock.calls[0][0] as any;
    expect(call.importance).toBe(0.8);
    expect(call.priority).toBe('critical'); // importance >= 0.8 maps to critical
  });

  it('should include correction-specific guidance in memory content', async () => {
    await processFeedback(makeNegativeSubmission({
      feedbackReason: 'wrong_decision_maker',
    }));

    const call = mockStoreMemory.mock.calls[0][0] as any;
    expect(call.content).toContain('CORRECTION LEARNING');
    expect(call.content).toContain('contact');
  });

  it('should include stale data guidance for data_was_stale', async () => {
    await processFeedback(makeNegativeSubmission({
      feedbackReason: 'data_was_stale',
    }));

    const call = mockStoreMemory.mock.calls[0][0] as any;
    expect(call.content).toContain('freshness');
  });

  it('should include technology detection guidance for incorrect_technology', async () => {
    await processFeedback(makeNegativeSubmission({
      feedbackReason: 'incorrect_technology',
    }));

    const call = mockStoreMemory.mock.calls[0][0] as any;
    expect(call.content).toContain('Technology detection');
  });

  it('should include user detail in memory content', async () => {
    await processFeedback(makeNegativeSubmission({
      feedbackDetail: 'The VP of Engineering was the actual decision maker',
    }));

    const call = mockStoreMemory.mock.calls[0][0] as any;
    expect(call.content).toContain('VP of Engineering');
  });
});

// ── 4. Learning Event Creation ──

describe('WI-17E: Learning Event Creation', () => {
  it('should create learning event for useful feedback', async () => {
    const result = await processFeedback(makePositiveSubmission());

    expect(result.learningEventCreated).toBe(true);
    expect(result.learningEventId).toBe('le-1');
  });

  it('should create learning event for not_useful feedback', async () => {
    const result = await processFeedback(makeNegativeSubmission());

    expect(result.learningEventCreated).toBe(true);
  });

  it('should set correct event type for positive feedback', async () => {
    await processFeedback(makePositiveSubmission());

    expect(mockDbLearningEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'feedback_positive',
          source: 'user',
        }),
      })
    );
  });

  it('should set correct event type for negative feedback', async () => {
    await processFeedback(makeNegativeSubmission());

    expect(mockDbLearningEventCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          eventType: 'feedback_negative',
        }),
      })
    );
  });

  it('should include learned insight about conversion', async () => {
    await processFeedback(makePositiveSubmission({
      verdict: 'useful',
      actualOutcome: 'converted',
    }));

    const call = mockDbLearningEventCreate.mock.calls[0][0] as any;
    expect(call.data.learnedInsight).toContain('conversion');
  });

  it('should set higher confidence for positive learning events', async () => {
    await processFeedback(makePositiveSubmission());

    const call = mockDbLearningEventCreate.mock.calls[0][0] as any;
    expect(call.data.confidence).toBe(0.85);
  });

  it('should set applicable context and tags', async () => {
    await processFeedback(makePositiveSubmission());

    const call = mockDbLearningEventCreate.mock.calls[0][0] as any;
    const context = JSON.parse(call.data.applicableContext);
    expect(context.industry).toBe('Technology');
    expect(context.verdict).toBe('useful');
  });
});

// ── 5. Confidence Calibration ──

describe('WI-17E: Confidence Calibration', () => {
  it('should not calibrate with less than 3 feedback items', async () => {
    mockDbIntelligenceFeedbackCount.mockResolvedValue(2);

    const result = await processFeedback(makePositiveSubmission());

    expect(result.calibrationApplied).toBe(false);
  });

  it('should increase confidence with 3+ useful and 0 negative', async () => {
    mockDbIntelligenceFeedbackCount.mockResolvedValue(3);
    mockDbIntelligenceFeedbackFindMany.mockResolvedValue([
      makeFeedbackRecord({ verdict: 'useful' }),
      makeFeedbackRecord({ verdict: 'useful' }),
      makeFeedbackRecord({ verdict: 'useful' }),
    ]);

    const result = await processFeedback(makePositiveSubmission());

    expect(result.calibrationApplied).toBe(true);
    expect(result.calibrationDetails).toBeDefined();
    expect(result.calibrationDetails!.direction).toBe('increased');
    expect(result.calibrationDetails!.previousConfidence).toBe(70);
    expect(result.calibrationDetails!.newConfidence).toBeGreaterThan(70);
  });

  it('should decrease confidence with 3+ negative and 0 useful', async () => {
    mockDbIntelligenceFeedbackCount.mockResolvedValue(3);
    mockDbIntelligenceFeedbackFindMany.mockResolvedValue([
      makeFeedbackRecord({ verdict: 'not_useful' }),
      makeFeedbackRecord({ verdict: 'not_useful' }),
      makeFeedbackRecord({ verdict: 'not_useful' }),
    ]);

    const result = await processFeedback(makeNegativeSubmission());

    expect(result.calibrationApplied).toBe(true);
    expect(result.calibrationDetails!.direction).toBe('decreased');
    expect(result.calibrationDetails!.newConfidence).toBeLessThan(70);
  });

  it('should not calibrate with mixed feedback', async () => {
    mockDbIntelligenceFeedbackCount.mockResolvedValue(5);
    mockDbIntelligenceFeedbackFindMany.mockResolvedValue([
      makeFeedbackRecord({ verdict: 'useful' }),
      makeFeedbackRecord({ verdict: 'not_useful' }),
      makeFeedbackRecord({ verdict: 'useful' }),
      makeFeedbackRecord({ verdict: 'partially_useful' }),
      makeFeedbackRecord({ verdict: 'useful' }),
    ]);

    const result = await processFeedback(makePositiveSubmission());

    expect(result.calibrationApplied).toBe(false);
  });
});

// ── 6. Calibration Adjustments ──

describe('WI-17E: Calibration Adjustments', () => {
  it('should increase priority for companies with positive feedback majority', async () => {
    mockDbIntelligenceFeedbackFindMany.mockResolvedValue([
      makeFeedbackRecord({ verdict: 'useful', feedbackReason: 'accurate_signals' }),
      makeFeedbackRecord({ verdict: 'useful', feedbackReason: 'accurate_signals' }),
      makeFeedbackRecord({ verdict: 'useful', feedbackReason: 'accurate_signals' }),
      makeFeedbackRecord({ verdict: 'not_useful', feedbackReason: 'bad_timing' }),
    ]);

    const adjustments = await getCalibrationAdjustments('comp-1');

    expect(adjustments.length).toBeGreaterThan(0);
    const companyAdj = adjustments.find(a => a.pattern === 'company:comp-1');
    expect(companyAdj).toBeDefined();
    expect(companyAdj!.direction).toBe('up');
  });

  it('should decrease priority for companies with negative feedback majority', async () => {
    mockDbIntelligenceFeedbackFindMany.mockResolvedValue([
      makeFeedbackRecord({ verdict: 'not_useful', feedbackReason: 'wrong_decision_maker' }),
      makeFeedbackRecord({ verdict: 'not_useful', feedbackReason: 'wrong_decision_maker' }),
      makeFeedbackRecord({ verdict: 'not_useful', feedbackReason: 'wrong_decision_maker' }),
      makeFeedbackRecord({ verdict: 'useful', feedbackReason: 'good_timing' }),
    ]);

    const adjustments = await getCalibrationAdjustments('comp-1');

    const companyAdj = adjustments.find(a => a.pattern === 'company:comp-1');
    expect(companyAdj).toBeDefined();
    expect(companyAdj!.direction).toBe('down');
  });

  it('should provide reason-specific calibration', async () => {
    mockDbIntelligenceFeedbackFindMany.mockResolvedValue([
      makeFeedbackRecord({ verdict: 'useful', feedbackReason: 'accurate_signals' }),
      makeFeedbackRecord({ verdict: 'useful', feedbackReason: 'accurate_signals' }),
      makeFeedbackRecord({ verdict: 'useful', feedbackReason: 'accurate_signals' }),
    ]);

    const adjustments = await getCalibrationAdjustments('comp-1');

    const reasonAdj = adjustments.find(a => a.pattern === 'reason:accurate_signals');
    expect(reasonAdj).toBeDefined();
    expect(reasonAdj!.direction).toBe('up');
  });

  it('should return empty adjustments with insufficient feedback', async () => {
    mockDbIntelligenceFeedbackFindMany.mockResolvedValue([
      makeFeedbackRecord({ verdict: 'useful' }),
      makeFeedbackRecord({ verdict: 'not_useful' }),
    ]);

    const adjustments = await getCalibrationAdjustments('comp-1');

    expect(adjustments).toHaveLength(0);
  });

  it('should handle system-wide calibration (no companyId)', async () => {
    // First call for company-specific (empty)
    mockDbIntelligenceFeedbackFindMany.mockResolvedValueOnce([]);
    // Second call for system-wide
    mockDbIntelligenceFeedbackFindMany.mockResolvedValueOnce([]);

    const adjustments = await getCalibrationAdjustments();

    expect(adjustments).toBeDefined();
    expect(Array.isArray(adjustments)).toBe(true);
  });
});

// ── 7. Company Feedback Statistics ──

describe('WI-17E: Company Feedback Stats', () => {
  it('should return feedback statistics for a company', async () => {
    // Directly verify the function logic by examining what it does with feedback data
    // The issue is mock isolation — getCompanyFeedbackStats reads from db.intelligenceFeedback.findMany
    // which is shared across all tests. Use mockImplementationOnce with exact override.
    mockDbIntelligenceFeedbackFindMany
      .mockImplementationOnce(async () => [
        makeFeedbackRecord({ verdict: 'useful', feedbackReason: 'converted_opportunity', actualOutcome: 'converted' }),
        makeFeedbackRecord({ verdict: 'useful', feedbackReason: 'accurate_signals' }),
        makeFeedbackRecord({ verdict: 'not_useful', feedbackReason: 'wrong_decision_maker' }),
      ])
      .mockImplementationOnce(async () => []); // for any follow-up calls

    const stats = await getCompanyFeedbackStats('comp-1');

    expect(stats.companyId).toBe('comp-1');
    expect(stats.totalFeedback).toBe(3);
    expect(stats.useful).toBe(2);
    expect(stats.notUseful).toBe(1);
    expect(stats.positiveRate).toBeCloseTo(2 / 3);
  });

  it('should include top feedback reasons', async () => {
    mockDbIntelligenceFeedbackFindMany
      .mockImplementationOnce(async () => [
        makeFeedbackRecord({ verdict: 'useful', feedbackReason: 'converted_opportunity' }),
        makeFeedbackRecord({ verdict: 'useful', feedbackReason: 'converted_opportunity' }),
        makeFeedbackRecord({ verdict: 'not_useful', feedbackReason: 'bad_timing' }),
      ])
      .mockImplementationOnce(async () => []);

    const stats = await getCompanyFeedbackStats('comp-1');

    expect(stats.topReasons.length).toBeGreaterThan(0);
    const topReason = stats.topReasons[0];
    expect(topReason.reason).toBe('converted_opportunity');
    expect(topReason.count).toBe(2);
  });

  it('should include outcome distribution', async () => {
    mockDbIntelligenceFeedbackFindMany
      .mockImplementationOnce(async () => [
        makeFeedbackRecord({ verdict: 'useful', actualOutcome: 'converted' }),
        makeFeedbackRecord({ verdict: 'useful', actualOutcome: 'meeting_held' }),
      ])
      .mockImplementationOnce(async () => []);

    const stats = await getCompanyFeedbackStats('comp-1');

    expect(stats.outcomes.length).toBe(2);
  });

  it('should handle zero feedback gracefully', async () => {
    mockDbIntelligenceFeedbackFindMany.mockImplementationOnce(async () => []);

    const stats = await getCompanyFeedbackStats('comp-1');

    expect(stats.totalFeedback).toBe(0);
    expect(stats.positiveRate).toBe(0);
    expect(stats.lastFeedbackAt).toBeNull();
  });
});

// ── 8. System-wide Learning Analytics ──

describe('WI-17E: Learning Analytics', () => {
  it('should return system-wide analytics', async () => {
    mockDbIntelligenceFeedbackCount.mockResolvedValue(10);
    mockDbIntelligenceFeedbackFindMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => makeFeedbackRecord({
        id: `fb-${i}`,
        verdict: i < 7 ? 'useful' : 'not_useful',
        feedbackReason: i < 5 ? 'converted_opportunity' : i < 7 ? 'accurate_signals' : 'wrong_decision_maker',
        actualOutcome: i < 3 ? 'converted' : i < 5 ? 'meeting_held' : null,
        createdAt: new Date(Date.now() - i * 7 * 24 * 60 * 60 * 1000),
      }))
    );

    const analytics = await getLearningAnalytics();

    expect(analytics.totalFeedback).toBe(10);
    expect(analytics.overallUsefulRate).toBeCloseTo(0.7);
    expect(analytics.verdictDistribution.useful).toBe(7);
    expect(analytics.verdictDistribution.not_useful).toBe(3);
  });

  it('should include feedback trend (12 weeks)', async () => {
    mockDbIntelligenceFeedbackCount.mockResolvedValue(0);
    mockDbIntelligenceFeedbackFindMany.mockResolvedValue([]);

    const analytics = await getLearningAnalytics();

    expect(analytics.feedbackTrend).toHaveLength(12);
    for (const week of analytics.feedbackTrend) {
      expect(week.period).toMatch(/Week \d+/);
      expect(typeof week.useful).toBe('number');
      expect(typeof week.notUseful).toBe('number');
      expect(typeof week.total).toBe('number');
    }
  });

  it('should count conversions from recommendations', async () => {
    mockDbIntelligenceFeedbackCount.mockResolvedValue(5);
    mockDbIntelligenceFeedbackFindMany.mockResolvedValue([
      makeFeedbackRecord({ verdict: 'useful', actualOutcome: 'converted' }),
      makeFeedbackRecord({ verdict: 'useful', actualOutcome: 'converted' }),
      makeFeedbackRecord({ verdict: 'useful', actualOutcome: 'meeting_held' }),
    ]);

    const analytics = await getLearningAnalytics();

    expect(analytics.conversionFromRecommendation).toBe(2);
  });

  it('should include top reasons with useful rates', async () => {
    mockDbIntelligenceFeedbackCount.mockResolvedValue(5);
    mockDbIntelligenceFeedbackFindMany.mockResolvedValue([
      makeFeedbackRecord({ verdict: 'useful', feedbackReason: 'converted_opportunity' }),
      makeFeedbackRecord({ verdict: 'not_useful', feedbackReason: 'wrong_decision_maker' }),
    ]);

    const analytics = await getLearningAnalytics();

    expect(analytics.topReasons.length).toBeGreaterThan(0);
    for (const reason of analytics.topReasons) {
      expect(reason.reason).toBeDefined();
      expect(typeof reason.count).toBe('number');
      expect(typeof reason.usefulRate).toBe('number');
    }
  });
});

// ── 9. Feedback Memory Search ──

describe('WI-17E: Feedback Memory Search', () => {
  it('should search institutional memory for feedback patterns', async () => {
    mockSearchMemories.mockReturnValue([
      {
        memory: {
          id: 'mem-1',
          content: 'Conversion learning for Acme Corp',
          summary: 'Converted opportunity',
          tags: ['Technology', 'feedback_learning'],
          metadata: { verdict: 'useful', reason: 'converted_opportunity' },
        },
        relevanceScore: 0.85,
      },
    ]);

    const results = searchFeedbackMemories('conversion');

    expect(results).toHaveLength(1);
    expect(results[0].relevance).toBe(0.85);
    expect(results[0].learningType).toBe('useful');
  });

  it('should return empty results when no memories found', async () => {
    mockSearchMemories.mockReturnValue([]);

    const results = searchFeedbackMemories('nonexistent pattern');

    expect(results).toHaveLength(0);
  });
});

// ── 10. Edge Cases ──

describe('WI-17E: Edge Cases', () => {
  it('should handle feedback reason label lookup', () => {
    expect(FEEDBACK_REASON_LABELS['converted_opportunity']).toBe('Converted to opportunity');
    expect(FEEDBACK_REASON_LABELS['wrong_decision_maker']).toBe('Wrong decision maker');
    expect(FEEDBACK_REASON_LABELS['data_was_stale']).toBe('Data was stale');
  });

  it('should handle memory creation failure gracefully', async () => {
    mockStoreMemory.mockImplementation(() => {
      throw new Error('Memory store failed');
    });

    const result = await processFeedback(makePositiveSubmission());

    expect(result.memoryCreated).toBe(false);
    expect(result.learningSummary).toContain('failed');
    // Feedback should still be stored
    expect(result.feedbackId).toBeDefined();
  });

  it('should handle learning event creation failure gracefully', async () => {
    mockDbLearningEventCreate.mockRejectedValue(new Error('DB error'));

    const result = await processFeedback(makePositiveSubmission());

    expect(result.learningEventCreated).toBe(true); // Still attempted
    expect(result.learningEventId).toBe('learning-event-failed');
  });

  it('should handle wrong_account verdict', async () => {
    const result = await processFeedback({
      companyId: 'comp-1',
      verdict: 'wrong_account',
      feedbackReason: 'already_customer',
    });

    expect(result.verdict).toBe('wrong_account');
    expect(result.sentiment).toBe('negative');
  });

  it('should handle incorrect_action verdict', async () => {
    const result = await processFeedback({
      companyId: 'comp-1',
      verdict: 'incorrect_action',
      feedbackReason: 'vendor_relationship',
      correctAction: false,
    });

    expect(result.verdict).toBe('incorrect_action');
    expect(result.sentiment).toBe('negative');
  });

  it('should not create learning event for partially useful without outcome', async () => {
    // Partially useful verdict is NOT in the learning event condition
    // Only 'useful' and 'not_useful' verdicts trigger learning events
    const result = await processFeedback(makePartialSubmission());
    expect(result.learningEventCreated).toBe(false);
  });
});

// ── 11. Integration Validation ──

describe('WI-17E: Integration Validation', () => {
  it('should update feedback record with learning integration', async () => {
    await processFeedback(makePositiveSubmission());

    // The update sets memoryCreated from the memory result
    // and calibrationApplied from calibration result
    expect(mockDbIntelligenceFeedbackUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'fb-new-1' },
      })
    );
    // Verify the data structure was passed
    const updateCall = mockDbIntelligenceFeedbackUpdate.mock.calls[0][0] as any;
    expect(updateCall.data).toHaveProperty('memoryCreated');
    expect(updateCall.data).toHaveProperty('calibrationApplied');
    expect(updateCall.data).toHaveProperty('learningEventId');
  });

  it('should reference feedback ID in memory source', async () => {
    await processFeedback(makePositiveSubmission());

    const call = mockStoreMemory.mock.calls[0][0] as any;
    expect(call.source.sourceId).toBe('fb-new-1');
    expect(call.source.type).toBe('human_intelligence');
    expect(call.referencedEntityIds).toContain('fb-new-1');
  });

  it('should log processing details', async () => {
    await processFeedback(makePositiveSubmission());

    // logger.info is called with format string + data object
    expect(logger.info).toHaveBeenCalled();
    const logCall = logger.info.mock.calls[0];
    // First arg is string, second is data object
    const logData = logCall[1] || logCall[0];
    expect(logData).toHaveProperty('feedbackId');
    expect(logData).toHaveProperty('companyId');
    expect(logData).toHaveProperty('verdict');
  });
});
