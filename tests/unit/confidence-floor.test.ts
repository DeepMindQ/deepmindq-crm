/**
 * Phase 1 Enterprise Readiness — Confidence Floor & Calibration Tests
 * ================================================================
 *
 * Tests for confidence floor enforcement, calibration status,
 * and confidence-in-confidence scoring.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { computeUnifiedConfidence } from '@/lib/ai-unified-confidence';

describe('Phase 1 — Confidence Floor', () => {
  const originalFloor = process.env.ENABLE_CONFIDENCE_FLOOR;

  beforeEach(() => {
    process.env.ENABLE_CONFIDENCE_FLOOR = 'true';
  });

  afterEach(() => {
    process.env.ENABLE_CONFIDENCE_FLOOR = originalFloor;
  });

  it('should NOT apply floor when evidence is sufficient', () => {
    const result = computeUnifiedConfidence({
      fieldConfidence: { name: 0.9, industry: 0.8, revenue: 0.7 },
      sources: [
        { name: 'bloomberg.com', reliability: 0.92, type: 'financial' },
        { name: 'linkedin.com', reliability: 0.75, type: 'social' },
      ],
      daysSinceResearch: 5,
      evidenceCount: 10,
      crossValidatedFacts: 8,
      totalFacts: 10,
      contradictions: 0,
      evidenceCoverage: 0.85,
      aiOutputConfidence: 0.8,
    });

    expect(result.confidenceFloorApplied).toBeFalsy();
    expect(result.score).toBeGreaterThan(50);
  });

  it('should apply floor when evidence count < 3', () => {
    const result = computeUnifiedConfidence({
      fieldConfidence: { name: 0.9, industry: 0.8 },
      sources: [{ name: 'linkedin.com', reliability: 0.75, type: 'social' }],
      daysSinceResearch: 5,
      evidenceCount: 2,
    });

    expect(result.confidenceFloorApplied).toBe(true);
    expect(result.floorReason).toContain('2 evidence items');
    expect(result.score).toBeLessThanOrEqual(30);
  });

  it('should apply floor when data is stale (> 180 days)', () => {
    const result = computeUnifiedConfidence({
      fieldConfidence: { name: 0.9, industry: 0.8 },
      sources: [
        { name: 'bloomberg.com', reliability: 0.92, type: 'financial' },
        { name: 'reuters.com', reliability: 0.92, type: 'news' },
        { name: 'linkedin.com', reliability: 0.75, type: 'social' },
      ],
      daysSinceResearch: 200,
      evidenceCount: 5,
    });

    expect(result.confidenceFloorApplied).toBe(true);
    expect(result.floorReason).toContain('200 days old');
    expect(result.score).toBeLessThanOrEqual(35);
  });

  it('should apply floor when freshness score is low', () => {
    const result = computeUnifiedConfidence({
      fieldConfidence: { name: 0.8, industry: 0.7 },
      sources: [{ name: 'bloomberg.com', reliability: 0.92, type: 'financial' }],
      daysSinceResearch: 100,
      evidenceCount: 4,
      freshnessScore: 15,
    });

    expect(result.confidenceFloorApplied).toBe(true);
    expect(result.floorReason).toContain('Freshness score is 15');
    expect(result.score).toBeLessThanOrEqual(40);
  });

  it('should not apply floor when disabled via env', () => {
    process.env.ENABLE_CONFIDENCE_FLOOR = 'false';

    const result = computeUnifiedConfidence({
      evidenceCount: 1,
      daysSinceResearch: 300,
    });

    expect(result.confidenceFloorApplied).toBeFalsy();
  });

  it('should respect floor priority: evidence < stale < freshness', () => {
    // Both evidence < 3 AND stale — evidence floor should win (lower)
    const result = computeUnifiedConfidence({
      evidenceCount: 1,
      daysSinceResearch: 300,
      freshnessScore: 5,
    });

    expect(result.confidenceFloorApplied).toBe(true);
    expect(result.floorReason).toContain('evidence items');
    expect(result.score).toBe(30); // Evidence floor (lowest)
  });
});

describe('Phase 1 — Confidence-in-Confidence', () => {
  it('should return high CiC for rich, fresh data', () => {
    const result = computeUnifiedConfidence({
      evidenceCount: 15,
      daysSinceResearch: 3,
    });

    expect(result.confidenceInConfidence).toBeDefined();
    expect(result.confidenceInConfidence).toBeGreaterThan(70);
  });

  it('should return low CiC for thin, stale data', () => {
    const result = computeUnifiedConfidence({
      evidenceCount: 1,
      daysSinceResearch: 200,
    });

    expect(result.confidenceInConfidence).toBeDefined();
    expect(result.confidenceInConfidence).toBeLessThan(30);
  });

  it('should clamp CiC to 0-100 range', () => {
    const result = computeUnifiedConfidence({
      evidenceCount: 0,
      daysSinceResearch: 500,
    });

    expect(result.confidenceInConfidence).toBeGreaterThanOrEqual(0);
    expect(result.confidenceInConfidence).toBeLessThanOrEqual(100);
  });
});

describe('Phase 1 — Calibration Status', () => {
  it('should return uncalibrated initially', () => {
    const result = computeUnifiedConfidence({
      evidenceCount: 5,
      daysSinceResearch: 10,
    });

    expect(result.calibrationStatus).toBe('uncalibrated');
  });

  it('should include calibration status in all results', () => {
    const result = computeUnifiedConfidence({});
    expect(result.calibrationStatus).toBeDefined();
    expect(['uncalibrated', 'partially_calibrated', 'calibrated']).toContain(result.calibrationStatus);
  });
});
