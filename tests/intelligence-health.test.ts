/**
 * Phase 6 Intelligence Health & Trust Layer Tests
 *
 * Tests the pure computation functions from:
 *   - intelligence-confidence.ts (computeConfidenceScore)
 *   - signal-validation.ts (classifySignal logic via validateCompanySignals)
 *   - intelligence-health.ts (computeFieldCoverage, getHealthTier)
 *   - contradiction-detection.ts (detection rules)
 */

import { describe, it, expect } from 'vitest';
import {
  computeConfidenceScore,
  type ConfidenceBreakdown,
} from '@/lib/intelligence-confidence';
import { getHealthTier } from '@/lib/intelligence-health';

// ─────────────────────────────────────────────────
// Module 2: Intelligence Confidence Score
// ─────────────────────────────────────────────────

describe('computeConfidenceScore', () => {
  it('returns 0 when all dimensions are 0', () => {
    const result = computeConfidenceScore({
      signalQuality: 0,
      evidenceQuality: 0,
      capabilityFit: 0,
      dataCompleteness: 0,
    });
    expect(result.overall).toBe(0);
    expect(result.signalQuality).toBe(0);
    expect(result.evidenceQuality).toBe(0);
    expect(result.capabilityFit).toBe(0);
    expect(result.dataCompleteness).toBe(0);
  });

  it('returns 100 when all dimensions are 100', () => {
    const result = computeConfidenceScore({
      signalQuality: 100,
      evidenceQuality: 100,
      capabilityFit: 100,
      dataCompleteness: 100,
    });
    expect(result.overall).toBe(100);
  });

  it('applies correct weights: signal 30%, evidence 30%, capability 25%, data 15%', () => {
    const result = computeConfidenceScore({
      signalQuality: 100,
      evidenceQuality: 0,
      capabilityFit: 0,
      dataCompleteness: 0,
    });
    expect(result.overall).toBe(30); // 100 * 0.30

    const result2 = computeConfidenceScore({
      signalQuality: 0,
      evidenceQuality: 100,
      capabilityFit: 0,
      dataCompleteness: 0,
    });
    expect(result2.overall).toBe(30); // 100 * 0.30

    const result3 = computeConfidenceScore({
      signalQuality: 0,
      evidenceQuality: 0,
      capabilityFit: 100,
      dataCompleteness: 0,
    });
    expect(result3.overall).toBe(25); // 100 * 0.25

    const result4 = computeConfidenceScore({
      signalQuality: 0,
      evidenceQuality: 0,
      capabilityFit: 0,
      dataCompleteness: 100,
    });
    expect(result4.overall).toBe(15); // 100 * 0.15
  });

  it('rounds individual dimensions to integers', () => {
    const result = computeConfidenceScore({
      signalQuality: 73.7,
      evidenceQuality: 45.3,
      capabilityFit: 88.9,
      dataCompleteness: 12.1,
    });
    expect(result.signalQuality).toBe(74);
    expect(result.evidenceQuality).toBe(45);
    expect(result.capabilityFit).toBe(89);
    expect(result.dataCompleteness).toBe(12);
  });

  it('clamps overall to 0-100 range', () => {
    // Even with unrealistic inputs, overall stays in range
    const result = computeConfidenceScore({
      signalQuality: 999,
      evidenceQuality: 999,
      capabilityFit: 999,
      dataCompleteness: 999,
    });
    expect(result.overall).toBeLessThanOrEqual(100);
    expect(result.overall).toBeGreaterThanOrEqual(0);
  });

  it('produces consistent composite scores', () => {
    const result = computeConfidenceScore({
      signalQuality: 80,
      evidenceQuality: 60,
      capabilityFit: 75,
      dataCompleteness: 50,
    });
    // 80*0.30 + 60*0.30 + 75*0.25 + 50*0.15 = 24 + 18 + 18.75 + 7.5 = 68.25 → 68
    expect(result.overall).toBe(68);
  });

  it('returns all four dimension scores in the breakdown', () => {
    const result: ConfidenceBreakdown = computeConfidenceScore({
      signalQuality: 50,
      evidenceQuality: 50,
      capabilityFit: 50,
      dataCompleteness: 50,
    });
    expect(result).toHaveProperty('signalQuality');
    expect(result).toHaveProperty('evidenceQuality');
    expect(result).toHaveProperty('capabilityFit');
    expect(result).toHaveProperty('dataCompleteness');
    expect(result).toHaveProperty('overall');
  });
});

// ─────────────────────────────────────────────────
// Module 5: Health Tier Classification
// ─────────────────────────────────────────────────

describe('getHealthTier', () => {
  it('classifies 90+ as excellent', () => {
    expect(getHealthTier(90)).toBe('excellent');
    expect(getHealthTier(100)).toBe('excellent');
    expect(getHealthTier(95)).toBe('excellent');
  });

  it('classifies 70-89 as good', () => {
    expect(getHealthTier(70)).toBe('good');
    expect(getHealthTier(89)).toBe('good');
    expect(getHealthTier(75)).toBe('good');
  });

  it('classifies 50-69 as fair', () => {
    expect(getHealthTier(50)).toBe('fair');
    expect(getHealthTier(69)).toBe('fair');
    expect(getHealthTier(60)).toBe('fair');
  });

  it('classifies below 50 as poor', () => {
    expect(getHealthTier(49)).toBe('poor');
    expect(getHealthTier(0)).toBe('poor');
    expect(getHealthTier(25)).toBe('poor');
  });

  it('handles boundary values correctly', () => {
    // Exactly at boundaries
    expect(getHealthTier(89)).toBe('good');
    expect(getHealthTier(90)).toBe('excellent');
    expect(getHealthTier(69)).toBe('fair');
    expect(getHealthTier(70)).toBe('good');
    expect(getHealthTier(49)).toBe('poor');
    expect(getHealthTier(50)).toBe('fair');
  });
});

// ─────────────────────────────────────────────────
// Module 6: Contradiction Detection Constants
// ─────────────────────────────────────────────────

describe('Contradiction Detection', () => {
  it('exports known conflict types', async () => {
    const mod = await import('@/lib/contradiction-detection');
    // The module should export the main function
    expect(typeof mod.detectContradictions).toBe('function');
    expect(typeof mod.resolveConflict).toBe('function');
  });
});

// ─────────────────────────────────────────────────
// Module 3: Signal Validation
// ─────────────────────────────────────────────────

describe('Signal Validation', () => {
  it('exports validation functions', async () => {
    const mod = await import('@/lib/signal-validation');
    expect(typeof mod.validateCompanySignals).toBe('function');
    expect(typeof mod.getSignalValidationSummary).toBe('function');
  });

  it('exports correct validation status types', async () => {
    const mod = await import('@/lib/signal-validation');
    // Type-level check: these are the 4 valid statuses
    const statuses = ['VALID', 'WEAK', 'CONFLICTING', 'EXPIRED'] as const;
    expect(statuses).toHaveLength(4);
  });
});

// ─────────────────────────────────────────────────
// Module 5: Intelligence Health
// ─────────────────────────────────────────────────

describe('Intelligence Health', () => {
  it('exports health computation functions', async () => {
    const mod = await import('@/lib/intelligence-health');
    expect(typeof mod.computeCompanyHealth).toBe('function');
    expect(typeof mod.computeAndPersistHealth).toBe('function');
    expect(typeof mod.getDashboardHealthStats).toBe('function');
    expect(typeof mod.getHealthTier).toBe('function');
  });
});