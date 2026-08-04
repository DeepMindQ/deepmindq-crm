/**
 * WI-16C Tests — Unified Confidence Engine
 */

import { describe, it, expect } from 'vitest';
import {
  computeUnifiedConfidence,
  getSourceReliability,
  formatConfidenceForLog,
  formatConfidenceForDisplay,
} from '@/lib/ai-unified-confidence';

describe('WI-16C: Unified Confidence Engine', () => {
  describe('computeUnifiedConfidence', () => {
    it('computes high confidence for well-sourced, fresh data', () => {
      const result = computeUnifiedConfidence({
        fieldConfidence: { revenue: 0.9, employees: 0.85, technology: 0.8, industry: 0.9 },
        dataCompleteness: 0.9,
        sources: [
          { name: 'bloomberg.com', reliability: 0.92, type: 'financial' },
          { name: 'company website', reliability: 0.88, type: 'company' },
          { name: 'crunchbase.com', reliability: 0.85, type: 'funding' },
        ],
        daysSinceResearch: 5,
        freshnessScore: 95,
        crossValidatedFacts: 8,
        totalFacts: 10,
        contradictions: 0,
        evidenceCount: 15,
        evidenceCoverage: 0.9,
        coveredDimensions: 8,
        expectedDimensions: 9,
        qualityGateScore: 85,
        hallucinationRiskScore: 10,
      });
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.grade).toMatch(/^[AB]/);
      expect(result.trustClass).toBe('enterprise');
      expect(result.enterpriseReady).toBe(true);
      expect(result.factors).toHaveLength(6);
      expect(result.modelVersion).toBe('v1-wi16c-unified');
    });

    it('computes low confidence for stale, poorly-sourced data', () => {
      const result = computeUnifiedConfidence({
        fieldConfidence: { revenue: 0.2, employees: 0.1 },
        dataCompleteness: 0.2,
        sources: [
          { name: 'unknown blog', reliability: 0.3, type: 'blog' },
        ],
        daysSinceResearch: 200,
        freshnessScore: 10,
        crossValidatedFacts: 1,
        totalFacts: 10,
        contradictions: 3,
        evidenceCount: 1,
        evidenceCoverage: 0.1,
        evidenceGaps: 8,
        qualityGateScore: 25,
        hallucinationRiskScore: 70,
      });
      expect(result.score).toBeLessThanOrEqual(40);
      expect(['speculative', 'unreliable']).toContain(result.trustClass);
      expect(result.enterpriseReady).toBe(false);
    });

    it('handles partial input gracefully', () => {
      const result = computeUnifiedConfidence({
        daysSinceResearch: 30,
      });
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.factors).toHaveLength(6);
      expect(result.timestamp).toBeDefined();
    });

    it('handles empty input gracefully', () => {
      const result = computeUnifiedConfidence({});
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('provides recommendations for weak dimensions', () => {
      const result = computeUnifiedConfidence({
        daysSinceResearch: 150,
        fieldConfidence: { revenue: 0.1 },
        evidenceCount: 1,
      });
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('getSourceReliability', () => {
    it('returns high reliability for government sources', () => {
      expect(getSourceReliability('sec.gov')).toBe(0.95);
      expect(getSourceReliability('reuters.com')).toBe(0.92);
    });

    it('returns medium reliability for news sources', () => {
      expect(getSourceReliability('techcrunch.com')).toBe(0.78);
      expect(getSourceReliability('linkedin.com')).toBe(0.75);
    });

    it('returns default for unknown sources', () => {
      expect(getSourceReliability('random-blog.com')).toBeGreaterThanOrEqual(0.5);
    });

    it('handles category keywords', () => {
      expect(getSourceReliability('government filing')).toBe(0.90);
      expect(getSourceReliability('social media')).toBe(0.50);
    });
  });

  describe('formatting', () => {
    it('formats for log', () => {
      const result = computeUnifiedConfidence({ daysSinceResearch: 30 });
      const log = formatConfidenceForLog(result);
      expect(typeof log).toBe('string');
      expect(log).toContain('Confidence');
    });

    it('formats for display', () => {
      const result = computeUnifiedConfidence({ daysSinceResearch: 30 });
      const display = formatConfidenceForDisplay(result);
      expect(display.label).toContain('/');
      expect(display.color).toBeDefined();
      expect(display.factors).toHaveLength(6);
    });
  });
});
