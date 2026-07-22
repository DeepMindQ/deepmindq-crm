import { describe, test, expect } from 'bun:test';
import {
  checkReasoningOutput,
  checkStrategyOutput,
  checkBriefOutput,
  guardrailsAllowOutput,
  getGuardrailErrors,
  getGuardrailWarnings,
  MIN_INTELLIGENCE_THRESHOLD,
  MIN_CONFIDENCE_THRESHOLD,
  MAX_EVIDENCE_CITATIONS,
} from '../guardrails';
import type { ReasoningContext, StrategicInsightOutput, EngagementStrategyOutput, EnhancedBriefOutput } from '../types';

const makeCtx = (overrides?: Partial<ReasoningContext>): ReasoningContext => ({
  companyId: 'co1',
  companyName: 'Test Co',
  industry: 'Technology',
  sizeRange: '5001-10000',
  knowledgeEntries: [
    { id: 'ke1', category: 'Technology', content: 'Cloud migration to Azure', confidence: 0.9, source: 'press', updatedAt: new Date() },
    { id: 'ke2', category: 'Leadership', content: 'New CIO appointed', confidence: 0.85, source: 'news', updatedAt: new Date() },
    { id: 'ke3', category: 'Strategy', content: 'Hiring 50 engineers', confidence: 0.8, source: 'jobs', updatedAt: new Date() },
  ],
  intelligenceObjects: [
    { id: 'io1', content: 'Cloud migration', summary: 'RFP issued', confidence: 0.75, sourceType: 'rss', capturedAt: new Date() },
  ],
  associations: [],
  signals: [
    { id: 's1', signalType: 'technology', title: 'Cloud migration', confidence: 0.9, severity: 'high', createdAt: new Date() },
  ],
  opportunitySignals: [
    { id: 'os1', signalType: 'TECHNOLOGY', title: 'Cloud modernization', score: 85, confidence: 0.85 },
  ],
  evidence: [
    { id: 'ev1', snippet: 'Azure selected as cloud provider', extractedField: 'technology', relevanceScore: 0.9, confidence: 0.85 },
    { id: 'ev2', snippet: 'CIO from AWS appointed', extractedField: 'leadership', relevanceScore: 0.8, confidence: 0.8 },
  ],
  accountBrief: {
    summary: 'Cloud modernization underway.',
    themes: '["cloud migration"]',
    risks: '[]',
    recommendations: '[]',
    confidence: 0.78,
  },
  accountScore: { score: 72, category: 'WARM_ACCOUNT', scoreBreakdown: '{}' },
  dataQualityMetrics: { totalKnowledgeEntries: 45, avgConfidence: 0.78, recentEntryCount: 28, sourceHealthAvg: 0.85 },
  ...overrides,
});

const validInsight: StrategicInsightOutput = {
  insightType: 'STRATEGIC_SHIFT',
  summary: 'Test Co is undergoing a significant cloud modernization effort across departments.',
  keyThemes: ['cloud migration', 'hiring'],
  reasoningSummary: {
    observations: ['Cloud migration announced', 'New CIO from AWS'],
    interpretation: 'Active cloud transformation phase',
    confidenceFactors: ['High confidence sources', 'Recent evidence'],
  },
  supportingEvidence: [
    { evidenceId: 'ev1', relevance: 'Direct evidence', quote: 'Azure selected' },
    { evidenceId: 'ev2', relevance: 'Supporting evidence', quote: 'CIO appointed' },
  ],
  confidenceScore: 78,
};

const validStrategy: EngagementStrategyOutput = {
  situationAssessment: { currentPhase: 'active_procurement', keyDrivers: ['cloud migration'], maturityLevel: 'mid' },
  recommendedEntry: { role: 'CIO', rationale: 'Cloud initiative lead', department: 'IT' },
  firstMeetingObjective: 'discovery',
  conversationAngles: [{ angle: 'Cost optimization', talkingPoints: ['Reduce spend'] }],
  riskFactors: [{ risk: 'Internal resistance', severity: 'medium', mitigation: 'Show ROI' }],
  priorityScore: 75,
};

const validBrief: EnhancedBriefOutput = {
  narrative: 'Over the past nine months, Test Co has moved from exploration to execution in cloud infrastructure modernization. Evidence includes Azure migration announcements, new CIO appointment from AWS, and significant hiring of cloud engineers across multiple departments.',
  keyTakeaways: ['Cloud migration is primary initiative', 'New leadership brings cloud-first mindset'],
  strategicImplications: [{ implication: 'Active procurement', impact: 'Engagement window', action: 'Schedule discovery' }],
};

/* ── Tests ── */

describe('checkReasoningOutput', () => {
  test('passes with valid output and matching evidence IDs', () => {
    const checks = checkReasoningOutput(validInsight, makeCtx());
    const errors = checks.filter(c => c.severity === 'error' && !c.passed);
    expect(errors.length).toBe(0);
  });

  test('fails evidence grounding with hallucinated evidence IDs', () => {
    const badInsight = {
      ...validInsight,
      supportingEvidence: [{ evidenceId: 'FAKE_ID', relevance: 'Fake', quote: 'Hallucinated' }],
    };
    const checks = checkReasoningOutput(badInsight, makeCtx());
    const grounding = checks.find(c => c.rule === 'evidence_grounding');
    expect(grounding).toBeDefined();
    expect(grounding!.passed).toBe(false);
    expect(grounding!.severity).toBe('error');
  });

  test('warns on low data sufficiency', () => {
    const sparseCtx = makeCtx({
      knowledgeEntries: [
        { id: 'ke1', category: 'Tech', content: 'Small signal', confidence: 0.5, source: 'src', updatedAt: new Date() },
      ],
      dataQualityMetrics: { totalKnowledgeEntries: 1, avgConfidence: 0.5, recentEntryCount: 1, sourceHealthAvg: 0.5 },
    });
    const checks = checkReasoningOutput(validInsight, sparseCtx);
    const sufficiency = checks.find(c => c.rule === 'data_sufficiency');
    expect(sufficiency).toBeDefined();
    expect(sufficiency!.passed).toBe(true);
    expect(sufficiency!.severity).toBe('warning');
  });

  test('passes data sufficiency with adequate entries', () => {
    const checks = checkReasoningOutput(validInsight, makeCtx());
    const sufficiency = checks.find(c => c.rule === 'data_sufficiency');
    expect(sufficiency).toBeDefined();
    expect(sufficiency!.passed).toBe(true);
  });

  test('warns on confidence calibration mismatch', () => {
    const overconfident = { ...validInsight, confidenceScore: 95 };
    const lowDataCtx = makeCtx({
      knowledgeEntries: [
        { id: 'ke1', category: 'Tech', content: 'Small signal', confidence: 0.3, source: 'src', updatedAt: new Date() },
      ],
      intelligenceObjects: [],
      signals: [],
      opportunitySignals: [],
      dataQualityMetrics: { totalKnowledgeEntries: 3, avgConfidence: 0.3, recentEntryCount: 1, sourceHealthAvg: 0.4 },
    });
    const checks = checkReasoningOutput(overconfident, lowDataCtx);
    const calibration = checks.find(c => c.rule === 'confidence_calibration');
    expect(calibration).toBeDefined();
    expect(calibration!.passed).toBe(false);
  });

  test('passes confidence calibration when aligned', () => {
    const checks = checkReasoningOutput(validInsight, makeCtx());
    const calibration = checks.find(c => c.rule === 'confidence_calibration');
    expect(calibration).toBeDefined();
    expect(calibration!.passed).toBe(true);
  });

  test('fails theme consistency when themes are fabricated', () => {
    const badThemes = {
      ...validInsight,
      keyThemes: ['quantum computing', 'blockchain revolution'], // Not in source data
    };
    const checks = checkReasoningOutput(badThemes, makeCtx());
    const themeCheck = checks.find(c => c.rule === 'theme_consistency');
    expect(themeCheck).toBeDefined();
    expect(themeCheck!.passed).toBe(false);
  });

  test('passes theme consistency when themes appear in data', () => {
    const checks = checkReasoningOutput(validInsight, makeCtx());
    const themeCheck = checks.find(c => c.rule === 'theme_consistency');
    expect(themeCheck).toBeDefined();
    expect(themeCheck!.passed).toBe(true);
  });

  test('enforces content length constraints', () => {
    const tooLong = { ...validInsight, summary: 'a'.repeat(1000) };
    const checks = checkReasoningOutput(tooLong, makeCtx());
    const lengthCheck = checks.find(c => c.rule === 'content_length');
    expect(lengthCheck).toBeDefined();
    expect(lengthCheck!.passed).toBe(false);
  });

  test('all checks have required fields', () => {
    const checks = checkReasoningOutput(validInsight, makeCtx());
    for (const check of checks) {
      expect(check).toHaveProperty('passed');
      expect(check).toHaveProperty('rule');
      expect(check).toHaveProperty('message');
      expect(check).toHaveProperty('severity');
      expect(['error', 'warning']).toContain(check.severity);
    }
  });
});

describe('checkStrategyOutput', () => {
  test('passes with valid strategy output', () => {
    const checks = checkStrategyOutput(validStrategy, makeCtx());
    const errors = checks.filter(c => c.severity === 'error' && !c.passed);
    expect(errors.length).toBe(0);
  });

  test('returns checks array', () => {
    const checks = checkStrategyOutput(validStrategy, makeCtx());
    expect(Array.isArray(checks)).toBe(true);
    expect(checks.length).toBeGreaterThan(0);
  });

  test('each check has required structure', () => {
    const checks = checkStrategyOutput(validStrategy, makeCtx());
    for (const check of checks) {
      expect(typeof check.passed).toBe('boolean');
      expect(typeof check.rule).toBe('string');
      expect(typeof check.message).toBe('string');
    }
  });
});

describe('checkBriefOutput', () => {
  test('passes with valid brief output', () => {
    const checks = checkBriefOutput(validBrief, makeCtx());
    const errors = checks.filter(c => c.severity === 'error' && !c.passed);
    expect(errors.length).toBe(0);
  });

  test('warns on short narrative', () => {
    const shortBrief = { ...validBrief, narrative: 'Too short.' };
    const checks = checkBriefOutput(shortBrief, makeCtx());
    const lengthCheck = checks.find(c => c.rule === 'content_length');
    expect(lengthCheck).toBeDefined();
    expect(lengthCheck!.passed).toBe(false);
  });
});

describe('guardrailsAllowOutput', () => {
  test('returns true when no errors', () => {
    const checks = checkReasoningOutput(validInsight, makeCtx());
    expect(guardrailsAllowOutput(checks)).toBe(true);
  });

  test('returns false when errors exist', () => {
    const checks = [
      { passed: false, rule: 'test_error', message: 'Test', severity: 'error' as const },
      { passed: true, rule: 'test_pass', message: 'Test', severity: 'warning' as const },
    ];
    expect(guardrailsAllowOutput(checks)).toBe(false);
  });
});

describe('getGuardrailErrors / getGuardrailWarnings', () => {
  test('filters errors correctly', () => {
    const checks = [
      { passed: false, rule: 'err1', message: 'Error', severity: 'error' as const },
      { passed: false, rule: 'warn1', message: 'Warning', severity: 'warning' as const },
      { passed: true, rule: 'pass1', message: 'Pass', severity: 'warning' as const },
    ];
    expect(getGuardrailErrors(checks)).toHaveLength(1);
    expect(getGuardrailWarnings(checks)).toHaveLength(2);
  });
});

describe('Constants', () => {
  test('MIN_INTELLIGENCE_THRESHOLD is a positive number', () => {
    expect(MIN_INTELLIGENCE_THRESHOLD).toBeGreaterThan(0);
  });

  test('MIN_CONFIDENCE_THRESHOLD is between 0 and 1', () => {
    expect(MIN_CONFIDENCE_THRESHOLD).toBeGreaterThanOrEqual(0);
    expect(MIN_CONFIDENCE_THRESHOLD).toBeLessThanOrEqual(1);
  });

  test('MAX_EVIDENCE_CITATIONS is a positive number', () => {
    expect(MAX_EVIDENCE_CITATIONS).toBeGreaterThan(0);
  });
});
