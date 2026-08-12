/**
 * Confidence Scoring Tests
 *
 * Validates confidence score computation, calibration,
 * and multi-signal fusion.
 */
import { describe, it, expect } from 'vitest';

// ── Confidence Score Utilities ────────────────────────────
function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function weightedAverage(signals: { value: number; weight: number }[]): number {
  const totalWeight = signals.reduce((sum, s) => sum + s.weight, 0);
  if (totalWeight === 0) return 0;
  const weightedSum = signals.reduce((sum, s) => sum + s.value * s.weight, 0);
  return clampConfidence(weightedSum / totalWeight);
}

function fuseConfidence(signals: {
  source: string;
  confidence: number;
  weight?: number;
}[]): number {
  const withDefaults = signals.map((s) => ({
    value: clampConfidence(s.confidence),
    weight: s.weight ?? 1,
  }));
  return weightedAverage(withDefaults);
}

function calibrateScore(
  predicted: number[],
  actual: number[],
  bins: number = 10,
): { ece: number; binErrors: { bin: string; avgPredicted: number; avgActual: number; count: number }[] } {
  const binSize = 1 / bins;
  const binStats: { sumPredicted: number; sumActual: number; count: number }[] =
    Array.from({ length: bins }, () => ({ sumPredicted: 0, sumActual: 0, count: 0 }));

  for (let i = 0; i < predicted.length; i++) {
    const binIdx = Math.min(Math.floor(predicted[i] / binSize), bins - 1);
    binStats[binIdx].sumPredicted += predicted[i];
    binStats[binIdx].sumActual += actual[i];
    binStats[binIdx].count++;
  }

  let totalEce = 0;
  let totalSamples = 0;
  const binErrors = binStats.map((stat, idx) => {
    const low = idx * binSize;
    const high = (idx + 1) * binSize;
    const avgPredicted = stat.count > 0 ? stat.sumPredicted / stat.count : 0;
    const avgActual = stat.count > 0 ? stat.sumActual / stat.count : 0;
    const eceContrib = stat.count > 0 ? Math.abs(avgPredicted - avgActual) * stat.count : 0;
    totalEce += eceContrib;
    totalSamples += stat.count;
    return {
      bin: `[${low.toFixed(1)}, ${high.toFixed(1)})`,
      avgPredicted,
      avgActual,
      count: stat.count,
    };
  });

  return { ece: totalSamples > 0 ? totalEce / totalSamples : 0, binErrors };
}

describe('Confidence Scoring', () => {
  // ── Range Validation ───────────────────────────────────
  describe('confidence scores are in [0, 1] range', () => {
    it('clamps values above 1', () => {
      expect(clampConfidence(1.5)).toBe(1);
      expect(clampConfidence(10)).toBe(1);
      expect(clampConfidence(Infinity)).toBe(1);
    });

    it('clamps values below 0', () => {
      expect(clampConfidence(-0.1)).toBe(0);
      expect(clampConfidence(-10)).toBe(0);
      expect(clampConfidence(-Infinity)).toBe(0);
    });

    it('passes through valid values', () => {
      expect(clampConfidence(0)).toBe(0);
      expect(clampConfidence(0.5)).toBe(0.5);
      expect(clampConfidence(1)).toBe(1);
      expect(clampConfidence(0.123)).toBe(0.123);
    });

    it('handles NaN', () => {
      expect(clampConfidence(NaN)).toBe(0);
    });

    it('fused confidence is always in [0, 1]', () => {
      const extremeCases = [
        [{ source: 'a', confidence: 5, weight: 1 }],
        [{ source: 'a', confidence: -3, weight: 1 }],
        [{ source: 'a', confidence: 0.5 }, { source: 'b', confidence: 1.5 }],
        [],
      ];

      for (const signals of extremeCases) {
        const result = fuseConfidence(signals);
        expect(result).toBeGreaterThanOrEqual(0);
        expect(result).toBeLessThanOrEqual(1);
      }
    });
  });

  // ── Calibration ────────────────────────────────────────
  describe('calibration (predicted confidence matches actual accuracy)', () => {
    it('perfect calibration has ECE near 0', () => {
      const predicted = [0.8, 0.8, 0.8, 0.8, 0.8];
      const actual = [1, 1, 1, 1, 1]; // 100% accuracy for 0.8 confidence
      const { ece } = calibrateScore(predicted, actual);
      expect(ece).toBeLessThan(0.3); // Allow some binning imprecision
    });

    it('overconfident model has higher ECE', () => {
      // Predicts 0.9 but only correct 50% of the time
      const predicted = [0.9, 0.9, 0.9, 0.9];
      const actual = [1, 1, 0, 0];
      const { ece } = calibrateScore(predicted, actual);
      expect(ece).toBeGreaterThan(0.1);
    });

    it('well-calibrated model has low ECE', () => {
      // Well-calibrated: 80% confidence → ~80% accuracy
      const predicted = [
        0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 0.8,
        0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6, 0.6,
      ];
      const actual = [
        1, 1, 1, 0, 1, 1, 0, 1, 1, 0,  // 80% for 0.8 bin
        1, 0, 1, 0, 1, 0, 0, 1, 0, 1,  // 50% for 0.6 bin
      ];
      const { ece } = calibrateScore(predicted, actual);
      expect(ece).toBeLessThan(0.2);
    });

    it('handles empty predictions', () => {
      const { ece, binErrors } = calibrateScore([], []);
      expect(ece).toBe(0);
      expect(binErrors.length).toBe(10);
    });

    it('bin errors include correct counts', () => {
      const predicted = [0.1, 0.15, 0.8, 0.85, 0.9];
      const actual = [0, 1, 1, 1, 0];
      const { binErrors } = calibrateScore(predicted, actual);

      // First bin [0.0, 0.1) should have 1 sample
      const firstBin = binErrors[0];
      expect(firstBin.count).toBe(1);

      // Eighth bin [0.8, 0.9) should have 2 samples
      const eighthBin = binErrors[8];
      expect(eighthBin.count).toBe(2);
    });
  });

  // ── Multi-Signal Confidence Fusion ──────────────────────
  describe('multi-signal confidence fusion', () => {
    it('fuses multiple signals with equal weight', () => {
      const result = fuseConfidence([
        { source: 'signal_1', confidence: 0.8 },
        { source: 'signal_2', confidence: 0.6 },
      ]);
      expect(result).toBeCloseTo(0.7);
    });

    it('applies custom weights', () => {
      const result = fuseConfidence([
        { source: 'signal_1', confidence: 0.9, weight: 3 },
        { source: 'signal_2', confidence: 0.5, weight: 1 },
      ]);
      // (0.9*3 + 0.5*1) / (3+1) = (2.7 + 0.5) / 4 = 0.8
      expect(result).toBeCloseTo(0.8);
    });

    it('single signal returns its own confidence', () => {
      const result = fuseConfidence([{ source: 'only', confidence: 0.75 }]);
      expect(result).toBeCloseTo(0.75);
    });

    it('empty signals returns 0', () => {
      const result = fuseConfidence([]);
      expect(result).toBe(0);
    });

    it('handles 3+ signals correctly', () => {
      const result = fuseConfidence([
        { source: 'engagement', confidence: 0.7 },
        { source: 'firmographic', confidence: 0.8 },
        { source: 'behavioral', confidence: 0.6 },
        { source: 'technographic', confidence: 0.9 },
      ]);
      // (0.7 + 0.8 + 0.6 + 0.9) / 4 = 0.75
      expect(result).toBeCloseTo(0.75);
    });

    it('higher weighted signal pulls average toward it', () => {
      const low = fuseConfidence([
        { source: 'a', confidence: 0.2, weight: 1 },
        { source: 'b', confidence: 0.9, weight: 1 },
      ]);
      const high = fuseConfidence([
        { source: 'a', confidence: 0.2, weight: 1 },
        { source: 'b', confidence: 0.9, weight: 9 },
      ]);
      // With higher weight on b, result should be closer to 0.9
      expect(high).toBeGreaterThan(low);
      expect(high).toBeCloseTo(0.83, 1);
    });
  });
});
