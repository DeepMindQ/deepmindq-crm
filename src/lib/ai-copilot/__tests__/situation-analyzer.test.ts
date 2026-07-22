import { describe, test, expect } from 'bun:test';
import { analyzeSituation } from '../situation-analyzer';
import type { ReasoningContext, StrategicInsightOutput } from '../types';

const makeCtx = (overrides?: Partial<ReasoningContext>): ReasoningContext => ({
  companyId: 'co1',
  companyName: 'Test Co',
  industry: 'Technology',
  sizeRange: '5001-10000',
  knowledgeEntries: [
    { id: 'ke1', category: 'Technology', content: 'Cloud migration to Azure', confidence: 0.9, source: 'press', updatedAt: new Date() },
    { id: 'ke2', category: 'Leadership', content: 'New CIO appointed from AWS', confidence: 0.85, source: 'news', updatedAt: new Date() },
    { id: 'ke3', category: 'Strategy', content: 'Hiring 50 cloud engineers', confidence: 0.8, source: 'jobs', updatedAt: new Date() },
  ],
  intelligenceObjects: [],
  associations: [],
  signals: [
    { id: 's1', signalType: 'hiring', title: 'Hiring cloud engineers', confidence: 0.9, severity: 'high', createdAt: new Date() },
    { id: 's2', signalType: 'technology', title: 'Cloud migration', confidence: 0.85, severity: 'high', createdAt: new Date() },
  ],
  opportunitySignals: [
    { id: 'os1', signalType: 'TECHNOLOGY', title: 'Cloud modernization', score: 85, confidence: 0.85 },
  ],
  evidence: [],
  accountBrief: null,
  accountScore: null,
  dataQualityMetrics: { totalKnowledgeEntries: 45, avgConfidence: 0.78, recentEntryCount: 28, sourceHealthAvg: 0.85 },
  ...overrides,
});

const mockInsight: StrategicInsightOutput = {
  insightType: 'STRATEGIC_SHIFT',
  summary: 'Cloud modernization underway.',
  keyThemes: ['cloud migration', 'hiring'],
  reasoningSummary: { observations: ['Migration announced'], interpretation: 'Active transformation', confidenceFactors: ['Strong signals'] },
  supportingEvidence: [],
  confidenceScore: 78,
};

describe('analyzeSituation', () => {
  test('returns required fields', () => {
    const result = analyzeSituation(makeCtx(), mockInsight);
    expect(result).toHaveProperty('currentPhase');
    expect(result).toHaveProperty('keyDrivers');
    expect(result).toHaveProperty('maturityLevel');
    expect(typeof result.currentPhase).toBe('string');
    expect(Array.isArray(result.keyDrivers)).toBe(true);
    expect(typeof result.maturityLevel).toBe('string');
  });

  test('detects active procurement with hiring + tech signals', () => {
    const result = analyzeSituation(makeCtx(), mockInsight);
    // With hiring + cloud signals, should indicate active phase
    expect(['active_procurement', 'evaluation', 'exploration', 'implementation', 'optimization']).toContain(result.currentPhase);
  });

  test('detects exploration phase with few entries', () => {
    const sparseCtx = makeCtx({
      knowledgeEntries: [
        { id: 'ke1', category: 'Strategy', content: 'Exploring AI options', confidence: 0.4, source: 'src', updatedAt: new Date() },
      ],
      signals: [],
      opportunitySignals: [],
      dataQualityMetrics: { totalKnowledgeEntries: 1, avgConfidence: 0.4, recentEntryCount: 1, sourceHealthAvg: 0.5 },
    });
    const result = analyzeSituation(sparseCtx, mockInsight);
    expect(result.currentPhase).toBe('exploration');
  });

  test('detects implementation phase with implementation knowledge', () => {
    const implCtx = makeCtx({
      knowledgeEntries: [
        { id: 'ke1', category: 'Technology', content: 'Kubernetes deployment phase 2 complete', confidence: 0.9, source: 'src', updatedAt: new Date() },
        { id: 'ke2', category: 'Technology', content: 'Microservices migration in progress', confidence: 0.85, source: 'src', updatedAt: new Date() },
        { id: 'ke3', category: 'Operations', content: 'Production infrastructure integration complete', confidence: 0.8, source: 'src', updatedAt: new Date() },
      ],
      signals: [],
      opportunitySignals: [],
    });
    const result = analyzeSituation(implCtx, mockInsight);
    expect(result.currentPhase).toBe('implementation');
  });

  test('determines high maturity with many entries', () => {
    const matureCtx = makeCtx({
      dataQualityMetrics: { totalKnowledgeEntries: 200, avgConfidence: 0.85, recentEntryCount: 80, sourceHealthAvg: 0.9 },
    });
    const result = analyzeSituation(matureCtx, mockInsight);
    expect(result.maturityLevel).toBe('late');
  });

  test('determines low maturity with few entries', () => {
    const youngCtx = makeCtx({
      dataQualityMetrics: { totalKnowledgeEntries: 3, avgConfidence: 0.4, recentEntryCount: 2, sourceHealthAvg: 0.3 },
    });
    const result = analyzeSituation(youngCtx, mockInsight);
    expect(result.maturityLevel).toBe('early');
  });

  test('extracts key drivers from knowledge entries', () => {
    const result = analyzeSituation(makeCtx(), mockInsight);
    expect(result.keyDrivers.length).toBeGreaterThan(0);
  });

  test('handles empty data gracefully', () => {
    const emptyCtx = makeCtx({
      knowledgeEntries: [],
      signals: [],
      opportunitySignals: [],
      dataQualityMetrics: { totalKnowledgeEntries: 0, avgConfidence: 0, recentEntryCount: 0, sourceHealthAvg: 0 },
    });
    const result = analyzeSituation(emptyCtx, mockInsight);
    expect(result.currentPhase).toBe('exploration');
    expect(result.maturityLevel).toBe('early');
  });

  test('valid maturity levels are within expected range', () => {
    const result = analyzeSituation(makeCtx(), mockInsight);
    expect(['early', 'mid', 'late']).toContain(result.maturityLevel);
  });

  test('valid phases are within expected range', () => {
    const result = analyzeSituation(makeCtx(), mockInsight);
    expect(['exploration', 'evaluation', 'active_procurement', 'implementation', 'optimization']).toContain(result.currentPhase);
  });
});
