import { describe, it, expect } from 'vitest';
import { generateNarrative, calculateBriefConfidence } from '../brief-generator';
import type { BriefFacts } from '../brief-generator';

describe('brief-generator', () => {
  const minimalFacts: BriefFacts = {
    companyName: 'Acme Corp',
    industry: 'Technology',
    sizeRange: '50-200',
    status: 'prospect',
    lifecycleStage: 'discovery',
    accountScore: null,
    scoreCategory: null,
    recentSignals: [],
    opportunitySignals: [],
    openOpportunities: 0,
    activePursuits: 0,
    engagementScore: 0,
    keyThemes: [],
    risks: [],
    recommendations: [],
  };

  describe('generateNarrative', () => {
    it('should generate narrative for minimal facts', () => {
      const result = generateNarrative(minimalFacts);
      expect(result).toContain('Acme Corp');
      expect(result).toContain('Technology');
      expect(result).toContain('discovery');
    });

    it('should include score and category when present', () => {
      const facts = { ...minimalFacts, accountScore: 72, scoreCategory: 'HOT_ACCOUNT' };
      const result = generateNarrative(facts);
      expect(result).toContain('72');
      expect(result).toContain('HOT ACCOUNT');
    });

    it('should include opportunity signals', () => {
      const facts = {
        ...minimalFacts,
        opportunitySignals: [{ signalType: 'TECHNOLOGY' as const, title: 'Cloud Migration', score: 75, confidence: 0.9 }],
        recentSignals: [{ signalType: 'tech_change', title: 'AWS', score: 80, source: 'tc' }],
      };
      const result = generateNarrative(facts);
      expect(result).toContain('TECHNOLOGY');
      expect(result).toContain('75');
    });

    it('should include themes when present', () => {
      const facts = { ...minimalFacts, keyThemes: ['cloud migration', 'AI adoption'] };
      const result = generateNarrative(facts);
      expect(result).toContain('cloud migration');
      expect(result).toContain('AI adoption');
    });

    it('should include pipeline info when present', () => {
      const facts = { ...minimalFacts, openOpportunities: 3, activePursuits: 1 };
      const result = generateNarrative(facts);
      expect(result).toContain('3');
      expect(result).toContain('1');
    });

    it('should include risks when present', () => {
      const facts = { ...minimalFacts, risks: [{ risk: 'Legacy system dependency', severity: 'high', evidence: 'tech signal' }] };
      const result = generateNarrative(facts);
      expect(result).toContain('Legacy system dependency');
    });

    it('should include engagement score when > 0', () => {
      const facts = { ...minimalFacts, engagementScore: 65 };
      const result = generateNarrative(facts);
      expect(result).toContain('65');
    });
  });

  describe('calculateBriefConfidence', () => {
    it('should return 0.1 for minimal facts (industry only)', () => {
      const result = calculateBriefConfidence(minimalFacts);
      expect(result).toBe(0.1);
    });

    it('should increase with more data available', () => {
      const minimal = calculateBriefConfidence(minimalFacts);
      const rich = calculateBriefConfidence({
        ...minimalFacts,
        accountScore: 70,
        scoreCategory: 'WARM_ACCOUNT',
        opportunitySignals: [
          { signalType: 'TECHNOLOGY', title: 'Cloud', score: 80, confidence: 0.9 },
          { signalType: 'PAIN', title: 'Legacy', score: 60, confidence: 0.7 },
        ],
        recentSignals: [{ signalType: 'tech', title: 'AWS', score: 90, source: 'tc' }],
        keyThemes: ['cloud'],
        industry: 'Technology',
        recommendations: [{ action: 'Engage', priority: 'high', rationale: 'test' }],
      });
      expect(rich).toBeGreaterThan(minimal);
    });

    it('should never exceed 1', () => {
      const veryRich = calculateBriefConfidence({
        ...minimalFacts,
        accountScore: 90,
        scoreCategory: 'HOT_ACCOUNT',
        opportunitySignals: Array(10).fill({ signalType: 'TECHNOLOGY' as const, title: 'Test', score: 90, confidence: 1 }),
        recentSignals: Array(20).fill({ signalType: 'tech', title: 'X', score: 90, source: 'x' }),
        keyThemes: ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'],
        industry: 'Tech',
        recommendations: Array(5).fill({ action: 'Do', priority: 'high', rationale: 'test' }),
      });
      expect(veryRich).toBeLessThanOrEqual(1);
    });
  });
});
