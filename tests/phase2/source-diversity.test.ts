/**
 * Source Diversity Scoring — Phase 2 Tests
 *
 * Tests Shannon entropy computation, tier classification,
 * concentration ratio, penalty application, and edge cases.
 */

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock db
jest.mock('@/lib/db', () => ({
  db: {},
}));

import { SourceReliabilityEngine, type SourceDiversityScore } from '@/lib/scoring/source-reliability-engine';

describe('Source Diversity Scoring', () => {
  // ════════════════════════════════════════════════════════════
  // Empty sources
  // ════════════════════════════════════════════════════════════

  describe('empty sources', () => {
    it('should return score 0 for empty sources array', () => {
      const result = SourceReliabilityEngine.computeSourceDiversity([]);
      expect(result.diversityScore).toBe(0);
      expect(result.tier).toBe('single_source');
      expect(result.uniqueSourceCount).toBe(0);
      expect(result.totalEvidenceCount).toBe(0);
    });

    it('should return concentration ratio of 1 for empty sources', () => {
      const result = SourceReliabilityEngine.computeSourceDiversity([]);
      expect(result.concentrationRatio).toBe(1);
    });

    it('should recommend gathering evidence for empty sources', () => {
      const result = SourceReliabilityEngine.computeSourceDiversity([]);
      expect(result.recommendation).toContain('No evidence sources');
    });
  });

  // ════════════════════════════════════════════════════════════
  // Single source
  // ════════════════════════════════════════════════════════════

  describe('single source', () => {
    it('should classify as single_source tier', () => {
      const sources = ['sec.gov', 'sec.gov', 'sec.gov', 'sec.gov', 'sec.gov'];
      const result = SourceReliabilityEngine.computeSourceDiversity(sources);
      expect(result.tier).toBe('single_source');
      expect(result.diversityScore).toBe(0);
      expect(result.uniqueSourceCount).toBe(1);
    });

    it('should name the dominant source in recommendation', () => {
      const sources = ['linkedin.com', 'linkedin.com'];
      const result = SourceReliabilityEngine.computeSourceDiversity(sources);
      expect(result.recommendation).toContain('linkedin.com');
    });
  });

  // ════════════════════════════════════════════════════════════
  // Even distribution → diverse
  // ════════════════════════════════════════════════════════════

  describe('even distribution (diverse)', () => {
    it('should classify as diverse when evenly distributed', () => {
      // 5 sources each appearing 3 times = very even
      const sources = [
        'sec.gov', 'sec.gov', 'sec.gov',
        'reuters.com', 'reuters.com', 'reuters.com',
        'crunchbase.com', 'crunchbase.com', 'crunchbase.com',
        'bloomberg.com', 'bloomberg.com', 'bloomberg.com',
        'linkedin.com', 'linkedin.com', 'linkedin.com',
      ];
      const result = SourceReliabilityEngine.computeSourceDiversity(sources);
      expect(result.tier).toBe('diverse');
      expect(result.diversityScore).toBeGreaterThanOrEqual(0.7);
    });

    it('should have low concentration ratio for diverse sources', () => {
      const sources = [
        'a.com', 'b.com', 'c.com', 'd.com',
        'a.com', 'b.com', 'c.com', 'd.com',
      ];
      const result = SourceReliabilityEngine.computeSourceDiversity(sources);
      expect(result.concentrationRatio).toBeLessThanOrEqual(0.3);
    });
  });

  // ════════════════════════════════════════════════════════════
  // Concentrated → concentrated tier
  // ════════════════════════════════════════════════════════════

  describe('concentrated distribution', () => {
    it('should classify as concentrated when one source dominates', () => {
      const sources = [
        'twitter.com', 'twitter.com', 'twitter.com', 'twitter.com',
        'twitter.com', 'twitter.com', 'twitter.com', 'twitter.com',
        'twitter.com', 'twitter.com', 'twitter.com', 'twitter.com',
        'twitter.com', 'twitter.com', 'twitter.com', 'twitter.com',
        'twitter.com', 'twitter.com',
        'sec.gov', 'reuters.com',
      ];
      const result = SourceReliabilityEngine.computeSourceDiversity(sources);
      expect(result.tier).toBe('concentrated');
      expect(result.diversityScore).toBeLessThan(0.4);
    });

    it('should have high concentration ratio for concentrated sources', () => {
      const sources = [
        'twitter.com', 'twitter.com', 'twitter.com', 'twitter.com',
        'twitter.com', 'twitter.com', 'twitter.com', 'twitter.com',
        'twitter.com', 'twitter.com', 'twitter.com', 'twitter.com',
        'twitter.com', 'twitter.com', 'twitter.com', 'twitter.com',
        'twitter.com', 'twitter.com',
        'sec.gov', 'reuters.com',
      ];
      const result = SourceReliabilityEngine.computeSourceDiversity(sources);
      expect(result.concentrationRatio).toBeGreaterThan(0.6);
    });
  });

  // ════════════════════════════════════════════════════════════
  // Shannon entropy computation
  // ════════════════════════════════════════════════════════════

  describe('Shannon entropy', () => {
    it('should produce diversityScore of 1.0 for perfectly uniform distribution', () => {
      // All sources appear the same number of times
      const sources = ['a.com', 'b.com', 'c.com', 'd.com'];
      const result = SourceReliabilityEngine.computeSourceDiversity(sources);
      expect(result.diversityScore).toBeCloseTo(1.0, 5);
    });

    it('should produce diversityScore of 0 for single source', () => {
      const sources = ['only.com', 'only.com', 'only.com'];
      const result = SourceReliabilityEngine.computeSourceDiversity(sources);
      expect(result.diversityScore).toBe(0);
    });
  });

  // ════════════════════════════════════════════════════════════
  // Source breakdown
  // ════════════════════════════════════════════════════════════

  describe('source breakdown', () => {
    it('should list each unique source with correct count and percentage', () => {
      const sources = ['a.com', 'a.com', 'b.com'];
      const result = SourceReliabilityEngine.computeSourceDiversity(sources);
      expect(result.sourceBreakdown).toHaveLength(2);
      expect(result.sourceBreakdown[0].source).toBe('a.com');
      expect(result.sourceBreakdown[0].count).toBe(2);
      expect(result.sourceBreakdown[0].percentage).toBeCloseTo(2 / 3, 5);
      expect(result.sourceBreakdown[1].source).toBe('b.com');
      expect(result.sourceBreakdown[1].count).toBe(1);
    });

    it('should sort breakdown by count descending', () => {
      const sources = ['c', 'a', 'a', 'b', 'b', 'b'];
      const result = SourceReliabilityEngine.computeSourceDiversity(sources);
      expect(result.sourceBreakdown[0].source).toBe('b');
      expect(result.sourceBreakdown[1].source).toBe('a');
      expect(result.sourceBreakdown[2].source).toBe('c');
    });
  });

  // ════════════════════════════════════════════════════════════
  // Diversity penalty applied to composite score
  // ════════════════════════════════════════════════════════════

  describe('diversity penalty in composite', () => {
    it('should apply -10 penalty for single_source tier', async () => {
      const result = await SourceReliabilityEngine.getCompositeReliability({
        sourceType: 'verified_api',
        evidenceSources: ['only-source.com', 'only-source.com'],
      });
      expect(result.diversity).toBeDefined();
      expect(result.diversity?.tier).toBe('single_source');
      expect(result.diversityPenalty).toBe(-10);
    });

    it('should apply no penalty for diverse tier', async () => {
      const sources = ['a.com', 'b.com', 'c.com', 'd.com', 'e.com'];
      const result = await SourceReliabilityEngine.getCompositeReliability({
        sourceType: 'verified_api',
        evidenceSources: sources,
      });
      expect(result.diversity).toBeDefined();
      expect(result.diversity?.tier).toBe('diverse');
      // When penalty is 0, the field is set to undefined
      expect(result.diversityPenalty).toBeUndefined();
    });

    it('should apply -5 penalty for concentrated tier', async () => {
      const sources = [
        'dominant.com', 'dominant.com', 'dominant.com', 'dominant.com',
        'dominant.com', 'dominant.com', 'dominant.com', 'dominant.com',
        'dominant.com', 'dominant.com', 'dominant.com', 'dominant.com',
        'dominant.com', 'dominant.com', 'dominant.com', 'dominant.com',
        'dominant.com', 'dominant.com',
        'other.com', 'another.com',
      ];
      const result = await SourceReliabilityEngine.getCompositeReliability({
        sourceType: 'web_intelligence',
        evidenceSources: sources,
      });
      expect(result.diversity?.tier).toBe('concentrated');
      expect(result.diversityPenalty).toBe(-5);
    });
  });
});
