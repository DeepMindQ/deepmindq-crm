import { describe, it, expect } from 'vitest';
import {
  matchSignalPatterns,
  getPrimaryCategory,
  type SignalCategory,
} from '../signal-patterns';
import { generateNarrative, calculateBriefConfidence, type BriefFacts } from '../brief-generator';

describe('revenue-intelligence barrel exports', () => {
  it('should export signal-patterns functions', () => {
    const results = matchSignalPatterns('cloud migration');
    expect(results.length).toBeGreaterThan(0);
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

  it('should have consistent function signatures', () => {
    // Verify no runtime errors with basic inputs
    const primary = getPrimaryCategory('cloud migration to AWS');
    expect(primary).not.toBeNull();
    expect(primary!.category).toBe('TECHNOLOGY');
  });
});
