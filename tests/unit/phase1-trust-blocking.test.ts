/**
 * Phase 1 — Item 4.6: Block on Low Trust Tests
 *
 * Ensures that when a company's trust score is below a threshold,
 * the enterpriseReady flag is stripped from API responses to prevent
 * premature enterprise recommendations on unverified accounts.
 */
import { describe, it, expect } from 'vitest';

// ── Trust Blocking Logic (extracted for testability) ──

interface TrustBlockInput {
  trustScore: number;
  enterpriseReady: boolean;
  enableTrustBlocking: boolean;
}

interface TrustBlockOutput {
  trustScore: number;
  enterpriseReady: boolean;
  trustBlocked: boolean;
}

const TRUST_THRESHOLD = 50;

/**
 * Apply trust blocking rules.
 * When trust < 50, enterpriseReady is forced to false.
 */
function applyTrustBlocking(input: TrustBlockInput): TrustBlockOutput {
  if (!input.enableTrustBlocking) {
    return { ...input, trustBlocked: false };
  }

  const trustBlocked = input.trustScore < TRUST_THRESHOLD;
  return {
    trustScore: input.trustScore,
    enterpriseReady: trustBlocked ? false : input.enterpriseReady,
    trustBlocked,
  };
}

describe('Trust Blocking (Phase 1.4.6)', () => {
  it('should strip enterpriseReady when trust < 50', () => {
    const result = applyTrustBlocking({
      trustScore: 35,
      enterpriseReady: true,
      enableTrustBlocking: true,
    });
    expect(result.enterpriseReady).toBe(false);
    expect(result.trustBlocked).toBe(true);
  });

  it('should keep enterpriseReady when trust >= 50', () => {
    const result = applyTrustBlocking({
      trustScore: 72,
      enterpriseReady: true,
      enableTrustBlocking: true,
    });
    expect(result.enterpriseReady).toBe(true);
    expect(result.trustBlocked).toBe(false);
  });

  it('should respect enableTrustBlocking=false option', () => {
    const result = applyTrustBlocking({
      trustScore: 10,
      enterpriseReady: true,
      enableTrustBlocking: false,
    });
    expect(result.enterpriseReady).toBe(true);
    expect(result.trustBlocked).toBe(false);
  });

  it('should handle edge case at exactly trust = 50', () => {
    const result = applyTrustBlocking({
      trustScore: 50,
      enterpriseReady: true,
      enableTrustBlocking: true,
    });
    // 50 is NOT < 50, so it should NOT be blocked
    expect(result.enterpriseReady).toBe(true);
    expect(result.trustBlocked).toBe(false);
  });

  it('should not re-enable enterpriseReady if it was already false', () => {
    const result = applyTrustBlocking({
      trustScore: 80,
      enterpriseReady: false,
      enableTrustBlocking: true,
    });
    expect(result.enterpriseReady).toBe(false);
    expect(result.trustBlocked).toBe(false);
  });
});
