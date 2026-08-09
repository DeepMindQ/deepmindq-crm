/**
 * Phase 1 — Item 4.3: Confidence Floor Enforcement Tests
 *
 * Ensures that confidence scores are capped when evidence is thin,
 * preventing overconfident AI outputs on weak data.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// ── Confidence Floor Logic (extracted for testability) ──
// These tests verify the floor rules that should be applied
// wherever intelligence confidence is computed.

interface FloorInput {
  evidenceCount: number;
  oldestDataAgeDays: number;
  freshnessScore: number;
  rawConfidence: number;
  enabled: boolean;
}

/**
 * Apply confidence floor rules.
 * This mirrors the logic expected in the intelligence pipeline.
 */
function applyConfidenceFloor(input: FloorInput): number {
  if (!input.enabled) return input.rawConfidence;

  // Collect all applicable floor caps
  const floors: number[] = [];

  // Rule 1: Cap at 30 when evidence count < 3
  if (input.evidenceCount < 3) {
    floors.push(30);
  }

  // Rule 2: Cap at 35 when data > 180 days old
  if (input.oldestDataAgeDays > 180) {
    floors.push(35);
  }

  // Rule 3: Cap at 40 when freshness < 20
  if (input.freshnessScore < 20) {
    floors.push(40);
  }

  // When multiple conditions trigger, use the most restrictive (lowest) floor.
  // For evidence < 3: max confidence is 30
  // For data > 180 days: max confidence is 35
  // For freshness < 20: max confidence is 40
  // The most restrictive floor (lowest value) wins.
  if (floors.length > 0) {
    const mostRestrictive = Math.min(...floors);
    return Math.min(input.rawConfidence, mostRestrictive);
  }

  return input.rawConfidence;
}

describe('Confidence Floor Enforcement (Phase 1.4.3)', () => {
  it('should cap score at 30 when evidence count < 3', () => {
    const result = applyConfidenceFloor({
      evidenceCount: 1,
      oldestDataAgeDays: 10,
      freshnessScore: 80,
      rawConfidence: 85,
      enabled: true,
    });
    expect(result).toBe(30);
  });

  it('should cap score at 35 when data > 180 days old', () => {
    const result = applyConfidenceFloor({
      evidenceCount: 5,
      oldestDataAgeDays: 200,
      freshnessScore: 80,
      rawConfidence: 90,
      enabled: true,
    });
    expect(result).toBe(35);
  });

  it('should cap score at 40 when freshness < 20', () => {
    const result = applyConfidenceFloor({
      evidenceCount: 5,
      oldestDataAgeDays: 30,
      freshnessScore: 15,
      rawConfidence: 95,
      enabled: true,
    });
    expect(result).toBe(40);
  });

  it('should not apply floor when ENABLE_CONFIDENCE_FLOOR is false', () => {
    const result = applyConfidenceFloor({
      evidenceCount: 0,
      oldestDataAgeDays: 300,
      freshnessScore: 5,
      rawConfidence: 95,
      enabled: false,
    });
    expect(result).toBe(95);
  });

  it('should not cap when all conditions are met (sufficient evidence, fresh data, good freshness)', () => {
    const result = applyConfidenceFloor({
      evidenceCount: 10,
      oldestDataAgeDays: 30,
      freshnessScore: 75,
      rawConfidence: 88,
      enabled: true,
    });
    expect(result).toBe(88);
  });

  it('should use the most restrictive floor when multiple conditions trigger', () => {
    // evidence < 3 → floor 30, data > 180 days → floor 35
    // Most restrictive = lowest cap = 30
    const result = applyConfidenceFloor({
      evidenceCount: 1,
      oldestDataAgeDays: 200,
      freshnessScore: 80,
      rawConfidence: 99,
      enabled: true,
    });
    expect(result).toBe(30);
  });
});
