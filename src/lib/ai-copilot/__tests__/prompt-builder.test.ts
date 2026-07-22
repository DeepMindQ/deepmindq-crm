import { describe, test, expect } from 'bun:test';
import {
  buildReasoningPrompt,
  buildStrategyPrompt,
  buildBriefEnhancementPrompt,
} from '../prompt-builder';
import type { ReasoningContext, StrategicInsightOutput } from '../types';

/* ── Test Fixtures ── */

const makeMockContext = (overrides?: Partial<ReasoningContext>): ReasoningContext => ({
  companyId: 'co_abc123',
  companyName: 'ABC Bank',
  industry: 'Financial Services',
  sizeRange: '5001-10000',
  knowledgeEntries: [
    { id: 'ke1', category: 'Technology', content: 'ABC Bank migrating to Azure cloud', confidence: 0.9, source: 'press', updatedAt: new Date('2025-01-15') },
    { id: 'ke2', category: 'Strategy', content: 'Hiring 50 cloud engineers', confidence: 0.85, source: 'jobs', updatedAt: new Date('2025-01-10') },
    { id: 'ke3', category: 'Leadership', content: 'New CIO from AWS', confidence: 0.8, source: 'news', updatedAt: new Date('2025-01-08') },
  ],
  intelligenceObjects: [
    { id: 'io1', content: 'Cloud migration RFP', summary: 'RFP for cloud services', confidence: 0.75, sourceType: 'rss', capturedAt: new Date('2025-01-12') },
  ],
  associations: [],
  signals: [
    { id: 's1', signalType: 'technology', title: 'Cloud migration', confidence: 0.9, severity: 'high', createdAt: new Date('2025-01-10') },
  ],
  opportunitySignals: [
    { id: 'os1', signalType: 'TECHNOLOGY', title: 'Cloud modernization', score: 85, confidence: 0.85 },
  ],
  evidence: [
    { id: 'ev1', snippet: 'Selected Azure as primary cloud provider', extractedField: 'technology', relevanceScore: 0.9, confidence: 0.85 },
  ],
  accountBrief: {
    summary: 'ABC Bank is undergoing digital transformation.',
    themes: '["cloud migration", "hiring"]',
    risks: '[{"risk": "Internal resistance", "severity": "medium", "evidence": "Legacy systems"}]',
    recommendations: '[{"action": "Engage CIO", "priority": "high", "rationale": "Cloud signals"}]',
    confidence: 0.78,
  },
  accountScore: { score: 72, category: 'WARM_ACCOUNT', scoreBreakdown: '{"signalStrength":25}' },
  dataQualityMetrics: { totalKnowledgeEntries: 45, avgConfidence: 0.78, recentEntryCount: 28, sourceHealthAvg: 0.85 },
  ...overrides,
});

const mockInsight: StrategicInsightOutput = {
  insightType: 'STRATEGIC_SHIFT',
  summary: 'ABC Bank is entering cloud modernization phase.',
  keyThemes: ['cloud migration', 'leadership change'],
  reasoningSummary: {
    observations: ['Cloud migration announced', 'New CIO from AWS'],
    interpretation: 'Active cloud transformation',
    confidenceFactors: ['High confidence sources', 'Recent evidence'],
  },
  supportingEvidence: [
    { evidenceId: 'ev1', relevance: 'Direct evidence', quote: 'Selected Azure' },
  ],
  confidenceScore: 78,
};

/* ── Tests ── */

describe('buildReasoningPrompt', () => {
  test('returns system and user prompts as strings', () => {
    const { system, user } = buildReasoningPrompt(makeMockContext());
    expect(typeof system).toBe('string');
    expect(typeof user).toBe('string');
    expect(system.length).toBeGreaterThan(0);
    expect(user.length).toBeGreaterThan(0);
  });

  test('system prompt contains governance rules', () => {
    const { system } = buildReasoningPrompt(makeMockContext());
    expect(system).toContain('evidence');
    expect(system).toContain('Never');
    expect(system).toContain('fact');
  });

  test('user prompt includes company name', () => {
    const { user } = buildReasoningPrompt(makeMockContext());
    expect(user).toContain('ABC Bank');
  });

  test('user prompt includes industry when provided', () => {
    const { user } = buildReasoningPrompt(makeMockContext());
    expect(user).toContain('Financial Services');
  });

  test('user prompt handles null industry', () => {
    const { user } = buildReasoningPrompt(makeMockContext({ industry: null }));
    expect(user).toContain('Unknown');
  });

  test('user prompt includes intelligence data categories', () => {
    const { user } = buildReasoningPrompt(makeMockContext());
    expect(user).toContain('Technology');
    expect(user).toContain('Strategy');
  });

  test('user prompt includes data quality metrics', () => {
    const { user } = buildReasoningPrompt(makeMockContext());
    expect(user).toContain('45');
    expect(user).toContain('78%');
  });

  test('user prompt is under reasonable length', () => {
    const { user } = buildReasoningPrompt(makeMockContext());
    expect(user.length).toBeLessThan(20000);
  });

  test('system prompt is under reasonable length', () => {
    const { system } = buildReasoningPrompt(makeMockContext());
    expect(system.length).toBeLessThan(3000);
  });

  test('handles empty knowledge entries', () => {
    const { user } = buildReasoningPrompt(makeMockContext({ knowledgeEntries: [] }));
    expect(user).toContain('No knowledge');
  });

  test('handles no account brief', () => {
    const { user } = buildReasoningPrompt(makeMockContext({ accountBrief: null }));
    expect(user).toContain('Not available');
  });

  test('handles no account score', () => {
    const { user } = buildReasoningPrompt(makeMockContext({ accountScore: null }));
    expect(user).toContain('Not available');
  });

  test('user prompt includes evidence snippets', () => {
    const { user } = buildReasoningPrompt(makeMockContext());
    expect(user).toContain('Selected Azure');
  });
});

describe('buildStrategyPrompt', () => {
  test('returns system and user prompts', () => {
    const { system, user } = buildStrategyPrompt(makeMockContext(), mockInsight);
    expect(typeof system).toBe('string');
    expect(typeof user).toBe('string');
    expect(system.length).toBeGreaterThan(0);
    expect(user.length).toBeGreaterThan(0);
  });

  test('system prompt mentions sales strategy', () => {
    const { system } = buildStrategyPrompt(makeMockContext(), mockInsight);
    expect(system).toContain('strategy');
    expect(system).toContain('recommend');
  });

  test('user prompt includes insight summary', () => {
    const { user } = buildStrategyPrompt(makeMockContext(), mockInsight);
    expect(user).toContain('cloud modernization');
  });

  test('user prompt includes account score category', () => {
    const { user } = buildStrategyPrompt(makeMockContext(), mockInsight);
    expect(user).toContain('WARM_ACCOUNT');
  });

  test('system prompt forbids competitor hallucination', () => {
    const { system } = buildStrategyPrompt(makeMockContext(), mockInsight);
    expect(system).toContain('competitor');
  });
});

describe('buildBriefEnhancementPrompt', () => {
  test('returns system and user prompts', () => {
    const { system, user } = buildBriefEnhancementPrompt(makeMockContext(), mockInsight);
    expect(typeof system).toBe('string');
    expect(typeof user).toBe('string');
  });

  test('system prompt mentions executive audience', () => {
    const { system } = buildBriefEnhancementPrompt(makeMockContext(), mockInsight);
    expect(system).toContain('executive');
  });

  test('system prompt requires evidence-backed takeaways', () => {
    const { system } = buildBriefEnhancementPrompt(makeMockContext(), mockInsight);
    expect(system).toContain('evidence IDs');
  });

  test('user prompt includes existing brief', () => {
    const { user } = buildBriefEnhancementPrompt(makeMockContext(), mockInsight);
    expect(user).toContain('digital transformation');
  });

  test('system prompt specifies narrative length', () => {
    const { system } = buildBriefEnhancementPrompt(makeMockContext(), mockInsight);
    expect(system).toContain('200');
    expect(system).toContain('1000');
  });
});
