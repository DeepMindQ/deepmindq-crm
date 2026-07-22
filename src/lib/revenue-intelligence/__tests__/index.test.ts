import { describe, it, expect } from 'vitest';
import {
  matchSignalPatterns,
  getPrimaryCategory,
  type SignalCategory,
} from '../signal-patterns';
import { analyzeSignals, type RawSignal } from '../signal-detector';
import { generateNarrative, calculateBriefConfidence, type BriefFacts } from '../brief-generator';
import { calculateScore, classifyScore } from '../account-scorer';

describe('revenue-intelligence barrel exports', () => {
  it('should export signal-patterns functions', () => {
    const results = matchSignalPatterns('cloud migration');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should export signal-detector functions', () => {
    const signals: RawSignal[] = [{
      id: 's1', signalType: 'tech', title: 'cloud migration', description: null,
      source: 'news', confidence: 0.8, impact: 'high', createdAt: new Date(),
    }];
    const result = analyzeSignals('c1', signals);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should export brief-generator functions', () => {
    const facts: BriefFacts = {
      companyName: 'Test', industry: 'Tech', sizeRange: '50-200', status: 'prospect',
      lifecycleStage: 'discovery', accountScore: 75, scoreCategory: 'WARM_ACCOUNT',
      recentSignals: [], opportunitySignals: [], openOpportunities: 0,
      activePursuits: 0, engagementScore: 50, keyThemes: ['AI'],
      risks: [], recommendations: [],
    };
    expect(generateNarrative(facts)).toContain('Test');
    expect(calculateBriefConfidence(facts)).toBeGreaterThan(0);
  });

  it('should export account-scorer functions', () => {
    expect(calculateScore({ opportunitySignals: [], engagementScore: 50 }).engagement).toBe(10);
    expect(classifyScore(85)).toBe('HOT_ACCOUNT');
  });

  it('should have consistent function signatures', () => {
    // Verify no runtime errors with basic inputs
    const primary = getPrimaryCategory('cloud migration to AWS');
    expect(primary).not.toBeNull();
    expect(primary!.category).toBe('TECHNOLOGY');
  });
});
