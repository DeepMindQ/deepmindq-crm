import { describe, it, expect } from 'vitest';
import { calculateScore, classifyScore } from '../account-scorer';

describe('account-scorer', () => {
  describe('calculateScore', () => {
    const now = new Date();

    it('should return zeros for empty signals', () => {
      const result = calculateScore({ opportunitySignals: [], engagementScore: 0 });
      expect(result.signalStrength).toBe(0);
      expect(result.engagement).toBe(0);
      expect(result.opportunityFit).toBe(0);
      expect(result.timing).toBe(0);
    });

    it('should calculate signal strength from signals', () => {
      const result = calculateScore({
        opportunitySignals: [
          { score: 80, createdAt: now, signalType: 'TECHNOLOGY' },
          { score: 60, createdAt: now, signalType: 'GROWTH' },
        ],
        engagementScore: 50,
      });
      expect(result.signalStrength).toBeGreaterThan(0);
      expect(result.signalStrength).toBeLessThanOrEqual(30);
    });

    it('should calculate engagement from engagementScore', () => {
      const result100 = calculateScore({ opportunitySignals: [], engagementScore: 100 });
      expect(result100.engagement).toBe(20);

      const result50 = calculateScore({ opportunitySignals: [], engagementScore: 50 });
      expect(result50.engagement).toBe(10);
    });

    it('should calculate opportunity fit from category coverage', () => {
      const result = calculateScore({
        opportunitySignals: [
          { score: 80, createdAt: now, signalType: 'TECHNOLOGY' },
          { score: 70, createdAt: now, signalType: 'GROWTH' },
          { score: 60, createdAt: now, signalType: 'PAIN' },
        ],
        engagementScore: 0,
      });
      expect(result.opportunityFit).toBe(18); // 3 categories * 6
    });

    it('should calculate timing from signal freshness', () => {
      const veryRecent = calculateScore({
        opportunitySignals: [{ score: 80, createdAt: new Date(), signalType: 'TECHNOLOGY' }],
        engagementScore: 0,
      });
      expect(veryRecent.timing).toBe(20);

      const older = calculateScore({
        opportunitySignals: [{ score: 80, createdAt: new Date(Date.now() - 45 * 86400000), signalType: 'TECHNOLOGY' }],
        engagementScore: 0,
      });
      expect(older.timing).toBe(10);
    });

    it('should cap each dimension at max', () => {
      const result = calculateScore({
        opportunitySignals: Array(20).fill({ score: 100, createdAt: now, signalType: 'TECHNOLOGY' }),
        engagementScore: 100,
      });
      expect(result.signalStrength).toBeLessThanOrEqual(30);
      expect(result.engagement).toBeLessThanOrEqual(20);
      expect(result.opportunityFit).toBeLessThanOrEqual(30);
      expect(result.timing).toBeLessThanOrEqual(20);
    });

    it('total should not exceed 100', () => {
      const result = calculateScore({
        opportunitySignals: Array(20).fill({ score: 100, createdAt: now, signalType: 'TECHNOLOGY' }),
        engagementScore: 100,
      });
      const total = result.signalStrength + result.engagement + result.opportunityFit + result.timing;
      expect(total).toBeLessThanOrEqual(100);
    });
  });

  describe('classifyScore', () => {
    it('should classify 80+ as HOT_ACCOUNT', () => {
      expect(classifyScore(85)).toBe('HOT_ACCOUNT');
      expect(classifyScore(80)).toBe('HOT_ACCOUNT');
    });

    it('should classify 60-79 as WARM_ACCOUNT', () => {
      expect(classifyScore(70)).toBe('WARM_ACCOUNT');
      expect(classifyScore(60)).toBe('WARM_ACCOUNT');
    });

    it('should classify 40-59 as NURTURE', () => {
      expect(classifyScore(50)).toBe('NURTURE');
      expect(classifyScore(40)).toBe('NURTURE');
    });

    it('should classify below 40 as AT_RISK', () => {
      expect(classifyScore(30)).toBe('AT_RISK');
      expect(classifyScore(0)).toBe('AT_RISK');
    });
  });
});
