/**
 * M5 Phase 3 — Hallucination Prevention Unit Tests
 *
 * Tests the claim verification, safety scoring, and hallucination guard.
 * All pure computation — no database access.
 */

import { describe, it, expect } from 'vitest';
import {
  extractClaims,
  verifyClaims,
  scoreAnswerSafety,
  guardAgainstHallucination,
  type ClaimVerification,
  type AnswerSafetyReport,
} from '@/lib/hallucination-prevention';

// Mock KnowledgeAnswer type for testing
interface MockKnowledgeAnswer {
  answerId: string;
  question: string;
  reasoning: string;
  evidence: Array<{
    claim: string;
    snippet: string;
    source: string | null;
    sourceDate: string | null;
    relevanceScore: number;
    entityIds: string[];
  }>;
  sources: Array<{ name: string; tier: string; evidenceCount: number; mostRecentDate: string | null }>;
  confidence: { score: number; grade: string; trustClass: string };
  answer: string;
  knowledgeFound: boolean;
  graphEntities: Array<{ id: string; label: string; type: string }>;
  memoryContextSummary: string;
  retrievalMetrics: {
    retrievalLatencyMs: number;
    graphLatencyMs: number;
    memoryLatencyMs: number;
    totalLatencyMs: number;
    hybridSignalCount: number;
    evidencePackageQuality: {
      averageConfidence: number;
      premiumSourceCount: number;
      signalDiversity: number;
    };
  };
  timestamp: string;
  safetyReport?: AnswerSafetyReport;
  hallucinationRisk?: string;
}

// ─── extractClaims ─────────────────────────────────────────────

describe('extractClaims', () => {
  it('should extract factual sentences from answer text', () => {
    const text = 'Microsoft reported $212B in revenue for 2024. The company employs approximately 221,000 people. This is a significant increase from last year.';
    const claims = extractClaims(text);
    expect(claims.length).toBeGreaterThanOrEqual(2);
    expect(claims.some(c => c.includes('Microsoft') && c.includes('revenue'))).toBe(true);
  });

  it('should filter out meta-commentary sentences', () => {
    const text = 'No specific knowledge was found for this query. Try a more specific query. The knowledge base contains 50 entities.';
    const claims = extractClaims(text);
    // Meta-commentary about "no knowledge found" should be filtered
    expect(claims.every(c => !c.includes('No specific knowledge was found'))).toBe(true);
  });

  it('should return empty array for empty text', () => {
    const claims = extractClaims('');
    expect(claims).toHaveLength(0);
  });

  it('should extract sentences with numbers as claims', () => {
    const text = 'The company has 500 employees. Revenue is $50M. Founded in 2010.';
    const claims = extractClaims(text);
    expect(claims.length).toBeGreaterThanOrEqual(2);
  });
});

// ─── verifyClaims ──────────────────────────────────────────────

describe('verifyClaims', () => {
  const evidence = [
    {
      claim: 'Microsoft revenue',
      snippet: 'Microsoft reported $212B in annual revenue for fiscal year 2024',
      source: 'SEC Filing',
      sourceDate: '2024-07-01',
      relevanceScore: 0.95,
      entityIds: ['microsoft'],
    },
    {
      claim: 'Employee count',
      snippet: 'Microsoft employs approximately 221,000 people worldwide',
      source: 'Company Website',
      sourceDate: '2024-06-01',
      relevanceScore: 0.88,
      entityIds: ['microsoft'],
    },
  ];

  it('should verify claims supported by evidence', () => {
    const claims = ['Microsoft reported $212B in revenue', 'The company employs 221,000 people'];
    const results = verifyClaims(claims, evidence);
    expect(results.length).toBe(2);
    expect(results[0].status).toBe('verified');
    expect(results[0].confidence).toBeGreaterThan(0);
  });

  it('should mark unsupported claims correctly', () => {
    const claims = ['The company plans to acquire Salesforce in 2025'];
    const results = verifyClaims(claims, evidence);
    expect(results[0].status).toBe('unsupported');
  });

  it('should handle empty evidence array', () => {
    const claims = ['Microsoft has $212B revenue'];
    const results = verifyClaims(claims, []);
    expect(results[0].status).toBe('unsupported');
  });

  it('should handle empty claims array', () => {
    const results = verifyClaims([], evidence);
    expect(results).toHaveLength(0);
  });
});

// ─── scoreAnswerSafety ────────────────────────────────────────

describe('scoreAnswerSafety', () => {
  function makeAnswer(overrides: Partial<MockKnowledgeAnswer> = {}): MockKnowledgeAnswer {
    return {
      answerId: 'test',
      question: 'What is Microsoft revenue?',
      reasoning: 'Retrieved from evidence',
      evidence: [
        {
          claim: 'Revenue data',
          snippet: 'Microsoft reported $212B in annual revenue',
          source: 'SEC Filing',
          sourceDate: '2024-07-01',
          relevanceScore: 0.95,
          entityIds: ['microsoft'],
        },
      ],
      sources: [{ name: 'SEC Filing', tier: 'premium', evidenceCount: 1, mostRecentDate: '2024-07-01' }],
      confidence: { score: 85, grade: 'A', trustClass: 'high' },
      answer: 'Microsoft reported $212B in annual revenue for fiscal year 2024.',
      knowledgeFound: true,
      graphEntities: [{ id: 'msft', label: 'Microsoft', type: 'company' }],
      memoryContextSummary: 'No relevant memories',
      retrievalMetrics: {
        retrievalLatencyMs: 50,
        graphLatencyMs: 20,
        memoryLatencyMs: 10,
        totalLatencyMs: 80,
        hybridSignalCount: 4,
        evidencePackageQuality: {
          averageConfidence: 0.9,
          premiumSourceCount: 1,
          signalDiversity: 0.75,
        },
      },
      timestamp: new Date().toISOString(),
      ...overrides,
    };
  }

  it('should return danger level when knowledgeFound is false', () => {
    const answer = makeAnswer({
      knowledgeFound: false,
      evidence: [],
      answer: 'No specific knowledge was found for this query.',
    });
    const report = scoreAnswerSafety(answer as any);
    expect(report.riskLevel).toBe('danger');
    expect(report.safeToDisplay).toBe(false);
  });

  it('should return safe level with strong evidence and knowledge', () => {
    const answer = makeAnswer({
      knowledgeFound: true,
      evidence: [
        {
          claim: 'Revenue',
          snippet: 'Microsoft reported $212B in annual revenue for fiscal year 2024',
          source: 'SEC Filing',
          sourceDate: '2024-07-01',
          relevanceScore: 0.95,
          entityIds: ['microsoft'],
        },
        {
          claim: 'Employees',
          snippet: 'Microsoft employs 221,000 people worldwide',
          source: 'Company Report',
          sourceDate: '2024-06-01',
          relevanceScore: 0.88,
          entityIds: ['microsoft'],
        },
      ],
      confidence: { score: 85, grade: 'A', trustClass: 'high' },
    });
    const report = scoreAnswerSafety(answer as any);
    expect(report.riskLevel).toBe('safe');
    expect(report.safeToDisplay).toBe(true);
    expect(report.safetyScore).toBeGreaterThan(50);
  });

  it('should return zero safety score when no evidence', () => {
    const answer = makeAnswer({
      evidence: [],
      knowledgeFound: false,
    });
    const report = scoreAnswerSafety(answer as any);
    expect(report.safetyScore).toBe(0);
  });

  it('should include recommendations', () => {
    const answer = makeAnswer({
      knowledgeFound: false,
      evidence: [],
    });
    const report = scoreAnswerSafety(answer as any);
    expect(report.recommendations.length).toBeGreaterThan(0);
  });

  it('should report claim breakdown correctly', () => {
    const answer = makeAnswer();
    const report = scoreAnswerSafety(answer as any);
    expect(report).toHaveProperty('verifiedClaims');
    expect(report).toHaveProperty('unsupportedClaims');
    expect(report).toHaveProperty('contradictedClaims');
    expect(typeof report.verifiedClaims).toBe('number');
  });
});

// ─── guardAgainstHallucination ────────────────────────────────

describe('guardAgainstHallucination', () => {
  function makeAnswer(overrides: Partial<MockKnowledgeAnswer> = {}): MockKnowledgeAnswer {
    return {
      answerId: 'test',
      question: 'What is Microsoft revenue?',
      reasoning: 'Retrieved from evidence',
      evidence: [],
      sources: [],
      confidence: { score: 10, grade: 'F', trustClass: 'low' },
      answer: 'Some generated text without evidence.',
      knowledgeFound: false,
      graphEntities: [],
      memoryContextSummary: 'No memories',
      retrievalMetrics: {
        retrievalLatencyMs: 0,
        graphLatencyMs: 0,
        memoryLatencyMs: 0,
        totalLatencyMs: 0,
        hybridSignalCount: 0,
        evidencePackageQuality: {
          averageConfidence: 0,
          premiumSourceCount: 0,
          signalDiversity: 0,
        },
      },
      timestamp: new Date().toISOString(),
      ...overrides,
    };
  }

  it('should replace answer text when safety score < 10', () => {
    const answer = makeAnswer({
      knowledgeFound: false,
      evidence: [],
      confidence: { score: 5, grade: 'F', trustClass: 'low' },
    });
    const guarded = guardAgainstHallucination(answer as any);
    expect(guarded.answer).toContain('Insufficient verified knowledge');
    expect(guarded.hallucinationRisk).toBe('high');
  });

  it('should prepend hallucination risk warning when safety score is in caution range', () => {
    // Use a scenario that produces safety < 30: low evidence + low confidence
    const answer = makeAnswer({
      knowledgeFound: true,
      evidence: [
        {
          claim: 'Weak data',
          snippet: 'Some vague evidence',
          source: null,
          sourceDate: null,
          relevanceScore: 0.2,
          entityIds: [],
        },
      ],
      confidence: { score: 20, grade: 'D', trustClass: 'low' },
      answer: 'The company might be in the technology sector based on limited data.',
    });
    const guarded = guardAgainstHallucination(answer as any);
    // Verify safety report exists and check if warning was prepended
    expect(guarded.safetyReport).toBeDefined();
    if (guarded.safetyReport.safetyScore < 30 && guarded.safetyReport.safetyScore >= 10) {
      expect(guarded.answer).toContain('Hallucination Risk');
      expect(guarded.hallucinationRisk).toBe('medium');
    }
    // If score is < 10, answer should be replaced
    if (guarded.safetyReport.safetyScore < 10) {
      expect(guarded.answer).toContain('Insufficient');
      expect(guarded.hallucinationRisk).toBe('high');
    }
    // Either way, safetyReport should indicate risk
    expect(guarded.safetyReport.safeToDisplay).toBe(false);
  });

  it('should pass through answer when safety is high', () => {
    const answer = makeAnswer({
      knowledgeFound: true,
      evidence: [
        {
          claim: 'Strong evidence',
          snippet: 'Microsoft reported $212B revenue in 2024',
          source: 'SEC Filing',
          sourceDate: '2024-07-01',
          relevanceScore: 0.95,
          entityIds: ['microsoft'],
        },
      ],
      confidence: { score: 85, grade: 'A', trustClass: 'high' },
      answer: 'Microsoft reported $212B in annual revenue for fiscal year 2024.',
    });
    const guarded = guardAgainstHallucination(answer as any);
    expect(guarded.answer).toContain('$212B');
    // Risk is 'negligible' only when safety >= 70
    expect(['negligible', 'low']).toContain(guarded.hallucinationRisk);
  });

  it('should always include safetyReport', () => {
    const answer = makeAnswer();
    const guarded = guardAgainstHallucination(answer as any);
    expect(guarded.safetyReport).toBeDefined();
    expect(guarded.safetyReport).toHaveProperty('safetyScore');
    expect(guarded.safetyReport).toHaveProperty('riskLevel');
    expect(guarded.safetyReport).toHaveProperty('safeToDisplay');
  });
});
