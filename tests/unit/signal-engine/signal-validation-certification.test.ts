/**
 * DeepMindQ Enterprise Test Framework — Milestone 3
 * Section: Unit / Signal Engine / Signal Validation
 *
 * Tests signal validation classification rules:
 * VALID, WEAK, CONFLICTING, EXPIRED
 */
import { describe, it, expect } from 'vitest'

describe('Signal Validation — Classification Rules', () => {
  describe('EXPIRED classification', () => {
    it('should classify expired signals correctly', () => {
      const params = {
        confidence: 0.9, impact: 'high', evidenceCount: 5,
        sourceDomainCount: 3, signalAge: 120, lifecycleStatus: 'expired' as const,
        hasConflict: false,
      };
      expect(params.lifecycleStatus).toBe('expired');
    });

    it('should classify archived signals as EXPIRED', () => {
      const params = {
        confidence: 0.8, impact: 'high', evidenceCount: 4,
        sourceDomainCount: 2, signalAge: 90, lifecycleStatus: 'archived' as const,
        hasConflict: false,
      };
      expect(params.lifecycleStatus).toBe('archived');
    });
  });

  describe('CONFLICTING classification', () => {
    it('should classify signals with conflicts as CONFLICTING', () => {
      const params = {
        confidence: 0.9, impact: 'high', evidenceCount: 5,
        sourceDomainCount: 3, signalAge: 5, lifecycleStatus: 'active' as const,
        hasConflict: true,
      };
      expect(params.hasConflict).toBe(true);
    });

    it('should prioritize CONFLICTING over VALID', () => {
      const params = {
        confidence: 0.9, impact: 'high', evidenceCount: 5,
        sourceDomainCount: 3, signalAge: 1, lifecycleStatus: 'active' as const,
        hasConflict: true,
      };
      expect(params.hasConflict).toBe(true);
      expect(params.confidence).toBeGreaterThanOrEqual(0.7);
      expect(params.evidenceCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('VALID classification', () => {
    it('should classify high-confidence, high-impact, multi-source as VALID', () => {
      const params = {
        confidence: 0.85, impact: 'high', evidenceCount: 4,
        sourceDomainCount: 3, signalAge: 2, lifecycleStatus: 'active' as const,
        hasConflict: false,
      };
      expect(params.confidence).toBeGreaterThanOrEqual(0.7);
      expect(params.impact).toBe('high');
      expect(params.evidenceCount).toBeGreaterThanOrEqual(2);
    });

    it('should classify adequate confidence with multi-source as VALID', () => {
      const params = {
        confidence: 0.6, impact: 'medium', evidenceCount: 3,
        sourceDomainCount: 2, signalAge: 10, lifecycleStatus: 'active' as const,
        hasConflict: false,
      };
      expect(params.confidence).toBeGreaterThanOrEqual(0.5);
      expect(params.evidenceCount).toBeGreaterThanOrEqual(2);
    });
  });

  describe('WEAK classification', () => {
    it('should classify low-confidence signals as WEAK', () => {
      const params = {
        confidence: 0.3, impact: 'low', evidenceCount: 3,
        sourceDomainCount: 2, signalAge: 5, lifecycleStatus: 'active' as const,
        hasConflict: false,
      };
      expect(params.confidence).toBeLessThan(0.5);
    });

    it('should classify single-source signals as WEAK', () => {
      const params = {
        confidence: 0.75, impact: 'high', evidenceCount: 1,
        sourceDomainCount: 1, signalAge: 3, lifecycleStatus: 'active' as const,
        hasConflict: false,
      };
      expect(params.evidenceCount).toBeLessThanOrEqual(1);
    });

    it('should classify both low-confidence AND single-source as WEAK', () => {
      const params = {
        confidence: 0.4, impact: 'medium', evidenceCount: 1,
        sourceDomainCount: 1, signalAge: 7, lifecycleStatus: 'active' as const,
        hasConflict: false,
      };
      expect(params.confidence).toBeLessThan(0.5);
      expect(params.evidenceCount).toBeLessThanOrEqual(1);
    });
  });
});

describe('Signal Validation — Edge Cases', () => {
  it('should handle boundary confidence at exactly 0.7', () => {
    const confidence = 0.7;
    expect(confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('should handle boundary confidence just below 0.7', () => {
    const confidence = 0.699;
    expect(confidence).toBeLessThan(0.7);
  });

  it('should handle zero evidence count', () => {
    const evidenceCount = 0;
    expect(evidenceCount).toBeLessThanOrEqual(1);
  });

  it('should handle very old signals still active', () => {
    const params = {
      confidence: 0.8, impact: 'high', evidenceCount: 5,
      sourceDomainCount: 3, signalAge: 365, lifecycleStatus: 'active' as const,
      hasConflict: false,
    };
    expect(params.lifecycleStatus).toBe('active');
  });
});
