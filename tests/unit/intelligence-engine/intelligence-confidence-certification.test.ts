/**
 * DeepMindQ Enterprise Test Framework — Milestone 3
 * Section: Unit / Intelligence Engine / Confidence Score
 *
 * Tests the 4-dimension confidence computation:
 * Signal Quality (30%) + Evidence Quality (30%) + Capability Fit (25%) + Data Completeness (15%)
 */
import { describe, it, expect } from 'vitest'
import { computeConfidenceScore } from '@/lib/intelligence-confidence'

describe('Intelligence Confidence — Weighted Composite', () => {
  describe('computeConfidenceScore — formula correctness', () => {
    it('should compute correct weighted composite (equal dimensions)', () => {
      const result = computeConfidenceScore({
        signalQuality: 80, evidenceQuality: 80,
        capabilityFit: 80, dataCompleteness: 80,
      });
      expect(result.overall).toBe(80);
    });

    it('should weight signal quality at 30%', () => {
      const result = computeConfidenceScore({
        signalQuality: 100, evidenceQuality: 0,
        capabilityFit: 0, dataCompleteness: 0,
      });
      expect(result.overall).toBe(30);
    });

    it('should weight evidence quality at 30%', () => {
      const result = computeConfidenceScore({
        signalQuality: 0, evidenceQuality: 100,
        capabilityFit: 0, dataCompleteness: 0,
      });
      expect(result.overall).toBe(30);
    });

    it('should weight capability fit at 25%', () => {
      const result = computeConfidenceScore({
        signalQuality: 0, evidenceQuality: 0,
        capabilityFit: 100, dataCompleteness: 0,
      });
      expect(result.overall).toBe(25);
    });

    it('should weight data completeness at 15%', () => {
      const result = computeConfidenceScore({
        signalQuality: 0, evidenceQuality: 0,
        capabilityFit: 0, dataCompleteness: 100,
      });
      expect(result.overall).toBe(15);
    });

    it('should compute correct composite with different values', () => {
      const result = computeConfidenceScore({
        signalQuality: 90, evidenceQuality: 70,
        capabilityFit: 85, dataCompleteness: 60,
      });
      // 90*0.30 + 70*0.30 + 85*0.25 + 60*0.15 = 27 + 21 + 21.25 + 9 = 78.25 -> 78
      expect(result.overall).toBe(78);
    });
  });

  describe('computeConfidenceScore — boundary handling', () => {
    it('should clamp overall score to max 100', () => {
      const result = computeConfidenceScore({
        signalQuality: 200, evidenceQuality: 200,
        capabilityFit: 200, dataCompleteness: 200,
      });
      expect(result.overall).toBeLessThanOrEqual(100);
    });

    it('should clamp overall score to min 0', () => {
      const result = computeConfidenceScore({
        signalQuality: -50, evidenceQuality: -50,
        capabilityFit: -50, dataCompleteness: -50,
      });
      expect(result.overall).toBeGreaterThanOrEqual(0);
    });

    it('should handle all zero inputs', () => {
      const result = computeConfidenceScore({
        signalQuality: 0, evidenceQuality: 0,
        capabilityFit: 0, dataCompleteness: 0,
      });
      expect(result.overall).toBe(0);
    });
  });

  describe('computeConfidenceScore — rounding behavior', () => {
    it('should round individual dimensions', () => {
      const result = computeConfidenceScore({
        signalQuality: 85.6, evidenceQuality: 72.3,
        capabilityFit: 88.9, dataCompleteness: 65.1,
      });
      expect(result.signalQuality).toBe(86);
      expect(result.evidenceQuality).toBe(72);
      expect(result.capabilityFit).toBe(89);
      expect(result.dataCompleteness).toBe(65);
    });
  });
});
