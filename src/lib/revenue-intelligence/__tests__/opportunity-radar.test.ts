import { describe, it, expect } from 'vitest';
import { calculateScore } from '../account-scorer';

describe('opportunity-radar', () => {
  it('should score dimensions correctly for sample data', () => {
    const now = new Date();
    const result = calculateScore({
      opportunitySignals: [
        { score: 85, createdAt: now, signalType: 'TECHNOLOGY' },
        { score: 75, createdAt: now, signalType: 'GROWTH' },
        { score: 65, createdAt: now, signalType: 'PAIN' },
        { score: 55, createdAt: now, signalType: 'LEADERSHIP' },
      ],
      engagementScore: 60,
    });

    expect(result.signalStrength).toBeGreaterThan(0);
    expect(result.engagement).toBeGreaterThan(0);
    expect(result.opportunityFit).toBeGreaterThan(0);
    expect(result.timing).toBeGreaterThan(0);

    const total = result.signalStrength + result.engagement + result.opportunityFit + result.timing;
    expect(total).toBeGreaterThan(0);
    expect(total).toBeLessThanOrEqual(100);
  });

  it('should reflect higher scores with more signal categories', () => {
    const now = new Date();
    const single = calculateScore({
      opportunitySignals: [{ score: 80, createdAt: now, signalType: 'TECHNOLOGY' }],
      engagementScore: 50,
    });

    const multi = calculateScore({
      opportunitySignals: [
        { score: 80, createdAt: now, signalType: 'TECHNOLOGY' },
        { score: 80, createdAt: now, signalType: 'GROWTH' },
        { score: 80, createdAt: now, signalType: 'PAIN' },
        { score: 80, createdAt: now, signalType: 'LEADERSHIP' },
        { score: 80, createdAt: now, signalType: 'PARTNERSHIP' },
      ],
      engagementScore: 50,
    });

    const totalSingle = single.signalStrength + single.engagement + single.opportunityFit + single.timing;
    const totalMulti = multi.signalStrength + multi.engagement + multi.opportunityFit + multi.timing;
    expect(totalMulti).toBeGreaterThan(totalSingle);
  });
});
