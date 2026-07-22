import { describe, test, expect } from 'bun:test';
import {
  parseReasoningResponse,
  parseStrategyResponse,
  parseBriefResponse,
  sanitizeString,
  validateConfidenceScore,
  validatePriorityScore,
} from '../response-parser';

describe('parseReasoningResponse', () => {
  test('parses valid JSON response', () => {
    const raw = JSON.stringify({
      insightType: 'STRATEGIC_SHIFT',
      summary: 'Company is modernizing cloud infrastructure.',
      keyThemes: ['cloud migration', 'digital transformation'],
      reasoningSummary: {
        observations: ['Cloud migration announced'],
        interpretation: 'Active transformation',
        confidenceFactors: ['High confidence sources'],
      },
      supportingEvidence: [{ evidenceId: 'ev1', relevance: 'Direct', quote: 'Migrating to Azure' }],
      confidenceScore: 78,
    });
    const result = parseReasoningResponse(raw);
    expect(result).not.toBeNull();
    expect(result!.summary).toBe('Company is modernizing cloud infrastructure.');
    expect(result!.confidenceScore).toBe(78);
    expect(result!.keyThemes).toHaveLength(2);
  });

  test('handles markdown-wrapped JSON', () => {
    const raw = '```json\n{"insightType":"OPPORTUNITY","summary":"Growth opportunity detected.","keyThemes":[],"reasoningSummary":{"observations":[],"interpretation":"","confidenceFactors":[]},"supportingEvidence":[],"confidenceScore":65}\n```';
    const result = parseReasoningResponse(raw);
    expect(result).not.toBeNull();
    expect(result!.insightType).toBe('OPPORTUNITY');
  });

  test('returns null for completely invalid input', () => {
    expect(parseReasoningResponse('')).toBeNull();
    expect(parseReasoningResponse('just random text')).toBeNull();
    expect(parseReasoningResponse('<html>error</html>')).toBeNull();
  });

  test('returns null for valid JSON but wrong structure', () => {
    const raw = JSON.stringify({ foo: 'bar', baz: 123 });
    expect(parseReasoningResponse(raw)).toBeNull();
  });

  test('handles partial fields gracefully', () => {
    const raw = JSON.stringify({
      insightType: 'RISK',
      summary: 'Risk detected',
    });
    const result = parseReasoningResponse(raw);
    // reasoningSummary is a required field; missing it returns null
    expect(result).toBeNull();
  });

  test('clamps confidence score to 0-100', () => {
    const raw = JSON.stringify({
      insightType: 'STRATEGIC_SHIFT',
      summary: 'This is a test summary for validation',
      keyThemes: [],
      reasoningSummary: { observations: [], interpretation: '', confidenceFactors: [] },
      supportingEvidence: [],
      confidenceScore: 150, // over 100
    });
    const result = parseReasoningResponse(raw);
    expect(result!.confidenceScore).toBeLessThanOrEqual(100);
  });
});

describe('parseStrategyResponse', () => {
  const validPayload = {
    situationAssessment: { currentPhase: 'active_procurement', keyDrivers: ['cloud migration'], maturityLevel: 'mid' },
    recommendedEntry: { role: 'CIO', rationale: 'Cloud initiative', department: 'IT' },
    firstMeetingObjective: 'discovery',
    conversationAngles: [{ angle: 'Cost optimization', talkingPoints: ['Reduce cloud spend by 30%'] }],
    riskFactors: [{ risk: 'Internal resistance', severity: 'medium', mitigation: 'Show ROI' }],
    priorityScore: 75,
  };

  test('parses valid strategy response', () => {
    const raw = JSON.stringify(validPayload);
    const result = parseStrategyResponse(raw);
    expect(result).not.toBeNull();
    expect(result!.priorityScore).toBe(75);
    expect(result!.conversationAngles).toHaveLength(1);
    expect(result!.riskFactors).toHaveLength(1);
  });

  test('handles markdown-wrapped JSON', () => {
    const raw = '```json\n' + JSON.stringify(validPayload) + '\n```';
    expect(parseStrategyResponse(raw)).not.toBeNull();
  });

  test('returns null for invalid input', () => {
    expect(parseStrategyResponse('not json')).toBeNull();
  });

  test('handles missing optional fields', () => {
    const minimal = {
      situationAssessment: { currentPhase: 'exploration', keyDrivers: [], maturityLevel: 'early' },
      recommendedEntry: { role: 'CTO', rationale: 'Tech lead', department: 'Engineering' },
      firstMeetingObjective: 'discovery',
      conversationAngles: [],
      riskFactors: [],
      priorityScore: 50,
    };
    const result = parseStrategyResponse(JSON.stringify(minimal));
    expect(result).not.toBeNull();
  });

  test('clamps priority score', () => {
    const payload = { ...validPayload, priorityScore: -10 };
    const result = parseStrategyResponse(JSON.stringify(payload));
    expect(result!.priorityScore).toBeGreaterThanOrEqual(0);
  });
});

describe('parseBriefResponse', () => {
  test('parses valid brief response', () => {
    const raw = JSON.stringify({
      narrative: 'Over the past 9 months, the company has moved from exploration to execution in cloud modernization.',
      keyTakeaways: ['Cloud migration is primary initiative', 'New CIO brings cloud-first mindset'],
      strategicImplications: [
        { implication: 'Active procurement phase', impact: 'Window for engagement', action: 'Schedule discovery workshop' },
      ],
    });
    const result = parseBriefResponse(raw);
    expect(result).not.toBeNull();
    expect(result!.keyTakeaways).toHaveLength(2);
    expect(result!.strategicImplications).toHaveLength(1);
  });

  test('returns null for invalid input', () => {
    expect(parseBriefResponse('')).toBeNull();
  });
});

describe('sanitizeString', () => {
  test('returns string for string input', () => {
    expect(sanitizeString('hello world', 100)).toBe('hello world');
  });

  test('truncates long strings', () => {
    const long = 'a'.repeat(200);
    const result = sanitizeString(long, 100);
    // sanitizeString appends '…' after truncating, so length is maxLength + 1
    expect(result.length).toBe(101);
  });

  test('handles non-string input', () => {
    expect(sanitizeString(123, 50)).toBe('123');
    expect(sanitizeString(null, 50)).toBe('');
    expect(sanitizeString(undefined, 50)).toBe('');
  });

  test('removes HTML tags', () => {
    const result = sanitizeString('<script>alert("xss")</script>Hello', 100);
    expect(result).not.toContain('<script>');
  });
});

describe('validateConfidenceScore', () => {
  test('clamps over-100 to 100', () => {
    expect(validateConfidenceScore(150)).toBe(100);
  });

  test('clamps negative to 0', () => {
    expect(validateConfidenceScore(-10)).toBe(0);
  });

  test('keeps valid values unchanged', () => {
    expect(validateConfidenceScore(75)).toBe(75);
    expect(validateConfidenceScore(0)).toBe(0);
    expect(validateConfidenceScore(100)).toBe(100);
  });

  test('handles non-number input', () => {
    expect(validateConfidenceScore(NaN)).toBe(0);
  });
});

describe('validatePriorityScore', () => {
  test('clamps over-100 to 100', () => {
    expect(validatePriorityScore(200)).toBe(100);
  });

  test('clamps negative to 0', () => {
    expect(validatePriorityScore(-5)).toBe(0);
  });

  test('keeps valid values unchanged', () => {
    expect(validatePriorityScore(85)).toBe(85);
    expect(validatePriorityScore(0)).toBe(0);
    expect(validatePriorityScore(100)).toBe(100);
  });
});
