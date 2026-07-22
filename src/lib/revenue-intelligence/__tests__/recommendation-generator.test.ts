import { describe, it, expect } from 'vitest';
import { calculateScore, classifyScore } from '../account-scorer';

describe('recommendation-generator', () => {
  it('should classify high score as HOT_ACCOUNT', () => {
    expect(classifyScore(85)).toBe('HOT_ACCOUNT');
  });

  it('should classify low score as AT_RISK', () => {
    expect(classifyScore(20)).toBe('AT_RISK');
  });

  it('should score correctly for real scenario', () => {
    const now = new Date();
    // Company with strong signals across 4 categories + high engagement
    const result = calculateScore({
      opportunitySignals: [
        { score: 85, createdAt: now, signalType: 'TECHNOLOGY' },
        { score: 80, createdAt: now, signalType: 'GROWTH' },
        { score: 75, createdAt: now, signalType: 'PAIN' },
        { score: 70, createdAt: now, signalType: 'LEADERSHIP' },
      ],
      engagementScore: 75,
    });

    const total = result.signalStrength + result.engagement + result.opportunityFit + result.timing;
    expect(total).toBeGreaterThanOrEqual(60); // Should be WARM or HOT
    expect(classifyScore(total)).toMatch(/WARM_ACCOUNT|HOT_ACCOUNT/);
  });

  it('should score low for weak signals', () => {
    const old = new Date(Date.now() - 100 * 86400000);
    const result = calculateScore({
      opportunitySignals: [
        { score: 30, createdAt: old, signalType: 'TECHNOLOGY' },
      ],
      engagementScore: 5,
    });

    const total = result.signalStrength + result.engagement + result.opportunityFit + result.timing;
    expect(total).toBeLessThan(40);
    expect(classifyScore(total)).toBe('AT_RISK');
  });

  it('should calculate all breakdown dimensions', () => {
    const result = calculateScore({
      opportunitySignals: [{ score: 70, createdAt: new Date(), signalType: 'TECHNOLOGY' }],
      engagementScore: 50,
    });

    expect(result).toHaveProperty('signalStrength');
    expect(result).toHaveProperty('engagement');
    expect(result).toHaveProperty('opportunityFit');
    expect(result).toHaveProperty('timing');
    expect(typeof result.signalStrength).toBe('number');
    expect(typeof result.engagement).toBe('number');
    expect(typeof result.opportunityFit).toBe('number');
    expect(typeof result.timing).toBe('number');
  });
});
