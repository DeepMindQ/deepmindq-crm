/**
 * M5 Phase 3 — Trust Metadata Framework Unit Tests
 *
 * Tests the core TRUST computation, aggregation, builders, and decorators.
 * All tests are pure computation — no database access required.
 */

import { describe, it, expect } from 'vitest';
import {
  computeTrustScore,
  aggregateTrust,
  verifiedApiTrust,
  customerDataTrust,
  aiInferenceTrust,
  platformComputedTrust,
  webIntelligenceTrust,
  withTrust,
  withTrustBatch,
  SOURCE_RELIABILITY_SCORES,
  CONFIDENCE_SCORES,
  getReliabilityScore,
  type TrustMetadata,
  type TrustSource,
} from '@/lib/intelligence-sources/trust-metadata';

// ─── computeTrustScore ──────────────────────────────────────────

describe('computeTrustScore', () => {
  it('should compute high score for verified API data', () => {
    const metadata = verifiedApiTrust('revenue', 'clearbit', '$1.2B');
    const score = computeTrustScore(metadata);
    expect(score.score).toBeGreaterThanOrEqual(85);
    expect(score.grade).toMatch(/^[A+]$/);
  });

  it('should compute low score for AI inference data', () => {
    const metadata = aiInferenceTrust('revenue', 'AI estimate from context', 0, 'low');
    const score = computeTrustScore(metadata);
    expect(score.score).toBeLessThan(70);
  });

  it('should decay freshness over time', () => {
    const now = new Date();
    const recent = verifiedApiTrust('employees', 'clearbit', '1000');
    const old = verifiedApiTrust('employees', 'clearbit', '1000');
    old.freshness = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000).toISOString(); // 180 days ago

    const recentScore = computeTrustScore(recent, { now });
    const oldScore = computeTrustScore(old, { now, maxAgeDays: 90 });

    expect(recentScore.dimensions.freshness).toBeGreaterThan(oldScore.dimensions.freshness);
  });

  it('should grade A+ for score >= 95', () => {
    const metadata: TrustMetadata = {
      source: 'verified_api',
      confidence: 'high',
      freshness: new Date().toISOString(),
      reasoning: 'test',
      evidenceCount: 5,
    };
    const score = computeTrustScore(metadata);
    // verified_api(95)*0.30 + high(90)*0.25 + fresh(100)*0.25 + evidence(100)*0.20 = 28.5+22.5+25+20 = 96
    expect(score.grade).toBe('A+');
  });

  it('should grade F for score < 40', () => {
    const metadata: TrustMetadata = {
      source: 'ai_inference',
      confidence: 'low',
      freshness: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      reasoning: 'very old AI guess',
      evidenceCount: 0,
    };
    const score = computeTrustScore(metadata, { maxAgeDays: 90 });
    expect(score.score).toBeLessThan(40);
    expect(score.grade).toBe('F');
  });

  it('should grade B for score 70-84', () => {
    const metadata: TrustMetadata = {
      source: 'platform_computed',
      confidence: 'medium',
      freshness: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      reasoning: 'computed 30 days ago',
      evidenceCount: 2,
    };
    const score = computeTrustScore(metadata, { maxAgeDays: 90 });
    // 80*0.30 + 65*0.25 + 67*0.25 + 70*0.20 = 24+16.25+16.75+14 = 71
    expect(score.score).toBeGreaterThanOrEqual(70);
    expect(score.score).toBeLessThan(85);
    expect(score.grade).toBe('B');
  });

  it('should include dimensional breakdown', () => {
    const metadata = verifiedApiTrust('test', 'clearbit', 'value');
    const score = computeTrustScore(metadata);
    expect(score.dimensions).toHaveProperty('source');
    expect(score.dimensions).toHaveProperty('confidence');
    expect(score.dimensions).toHaveProperty('freshness');
    expect(score.dimensions).toHaveProperty('evidence');
    expect(Object.values(score.dimensions).every(v => v >= 0 && v <= 100)).toBe(true);
  });

  it('should handle missing evidenceCount (default to 1)', () => {
    const metadata: TrustMetadata = {
      source: 'verified_api',
      confidence: 'high',
      freshness: new Date().toISOString(),
      reasoning: 'no evidence count provided',
    };
    const score = computeTrustScore(metadata);
    // evidence score = min(100, 50 + 1*10) = 60
    expect(score.dimensions.evidence).toBe(60);
  });
});

// ─── aggregateTrust ────────────────────────────────────────────

describe('aggregateTrust', () => {
  it('should return low confidence for empty array', () => {
    const result = aggregateTrust([]);
    expect(result.source).toBe('ai_inference');
    expect(result.confidence).toBe('low');
    expect(result.reasoning).toContain('No trust metadata');
  });

  it('should return the single item unchanged for 1-element array', () => {
    const metadata = verifiedApiTrust('test', 'clearbit', 'value');
    const result = aggregateTrust([metadata]);
    expect(result).toEqual(metadata);
  });

  it('should boost confidence with multiple sources', () => {
    const items: TrustMetadata[] = [
      verifiedApiTrust('revenue', 'clearbit', '$1B'),
      customerDataTrust('employees', '1000'),
    ];
    const result = aggregateTrust(items);
    expect(result.confidence).toBe('high');
    expect(result.verificationStatus).toBe('cross_referenced');
  });

  it('should choose highest-priority source type', () => {
    const items: TrustMetadata[] = [
      aiInferenceTrust('x', 'AI guess', 0, 'low'),
      customerDataTrust('y', 'value'),
      webIntelligenceTrust('z', 'https://example.com', 'web data', 'medium'),
    ];
    const result = aggregateTrust(items);
    expect(result.source).toBe('customer_data'); // highest priority after verified_api
  });

  it('should set low confidence with single AI source', () => {
    const items: TrustMetadata[] = [
      aiInferenceTrust('x', 'AI guess', 1, 'low'),
    ];
    const result = aggregateTrust(items);
    // Single source without verified_api or customer_data stays low
    expect(result.confidence).toBe('low');
  });

  it('should aggregate evidence counts', () => {
    const items: TrustMetadata[] = [
      { ...verifiedApiTrust('a', 'clearbit', '1'), evidenceCount: 3 },
      { ...customerDataTrust('b', '2'), evidenceCount: 5 },
    ];
    const result = aggregateTrust(items);
    expect(result.evidenceCount).toBe(8);
  });

  it('should use newest freshness date', () => {
    const items: TrustMetadata[] = [
      { ...verifiedApiTrust('a', 'clearbit', '1'), freshness: '2024-01-01T00:00:00Z' },
      { ...customerDataTrust('b', '2'), freshness: '2024-06-01T00:00:00Z' },
    ];
    const result = aggregateTrust(items);
    expect(result.freshness).toBe('2024-06-01T00:00:00Z');
  });
});

// ─── Builder Functions ──────────────────────────────────────────

describe('Builder Functions', () => {
  describe('verifiedApiTrust', () => {
    it('should create trust metadata with verified_api source', () => {
      const trust = verifiedApiTrust('revenue', 'clearbit', '$1.2B');
      expect(trust.source).toBe('verified_api');
      expect(trust.confidence).toBe('high');
      expect(trust.verificationStatus).toBe('verified');
      expect(trust.provider).toBe('clearbit');
      expect(trust.field).toBe('revenue');
      expect(trust.originalValue).toBe('$1.2B');
    });
  });

  describe('customerDataTrust', () => {
    it('should create trust metadata with customer_data source', () => {
      const trust = customerDataTrust('employees', '500');
      expect(trust.source).toBe('customer_data');
      expect(trust.confidence).toBe('high');
      expect(trust.verificationStatus).toBe('verified');
      expect(trust.originalValue).toBe('500');
    });
  });

  describe('aiInferenceTrust', () => {
    it('should create trust metadata with ai_inference source and low default confidence', () => {
      const trust = aiInferenceTrust('industry', 'Guessed from name');
      expect(trust.source).toBe('ai_inference');
      expect(trust.confidence).toBe('low');
      expect(trust.verificationStatus).toBe('inferred');
      expect(trust.evidenceCount).toBe(0);
    });

    it('should set cross_referenced with 2+ evidence items', () => {
      const trust = aiInferenceTrust('industry', 'Cross-verified', 3, 'medium');
      expect(trust.verificationStatus).toBe('cross_referenced');
      expect(trust.confidence).toBe('medium');
    });
  });

  describe('platformComputedTrust', () => {
    it('should create trust metadata with platform_computed source', () => {
      const trust = platformComputedTrust('score', 'Account scoring', 2, 'medium');
      expect(trust.source).toBe('platform_computed');
      expect(trust.confidence).toBe('medium');
      expect(trust.evidenceCount).toBe(2);
    });
  });

  describe('webIntelligenceTrust', () => {
    it('should create trust metadata with web_intelligence source', () => {
      const trust = webIntelligenceTrust('news', 'https://example.com/news', 'News article found');
      expect(trust.source).toBe('web_intelligence');
      expect(trust.originalValue).toBe('https://example.com/news');
      expect(trust.verificationStatus).toBe('unverified');
    });
  });
});

// ─── withTrust / withTrustBatch Decorators ───────────────────

describe('withTrust decorator', () => {
  it('should attach _trust to data object', () => {
    const data = { name: 'Microsoft', revenue: '$1.2B' };
    const trust = verifiedApiTrust('revenue', 'clearbit', '$1.2B');
    const result = withTrust(data, trust);
    expect(result.name).toBe('Microsoft');
    expect(result._trust).toBeDefined();
    expect(result._trust.source).toBe('verified_api');
  });

  it('should preserve original data fields', () => {
    const data = { a: 1, b: 'test', c: [1, 2, 3] };
    const trust = aiInferenceTrust('test', 'reasoning');
    const result = withTrust(data, trust);
    expect(result.a).toBe(1);
    expect(result.b).toBe('test');
    expect(result.c).toEqual([1, 2, 3]);
  });
});

describe('withTrustBatch decorator', () => {
  it('should attach _trust to each item', () => {
    const items = [{ id: 1 }, { id: 2 }, { id: 3 }];
    const trusts = [
      verifiedApiTrust('a', 'clearbit', '1'),
      customerDataTrust('b', '2'),
      aiInferenceTrust('c', 'reasoning'),
    ];
    const result = withTrustBatch(items, trusts);
    expect(result).toHaveLength(3);
    expect(result[0]._trust.source).toBe('verified_api');
    expect(result[1]._trust.source).toBe('customer_data');
    expect(result[2]._trust.source).toBe('ai_inference');
  });

  it('should use fallback for missing trust metadata', () => {
    const items = [{ id: 1 }, { id: 2 }];
    const trusts = [verifiedApiTrust('a', 'clearbit', '1')]; // only 1 trust for 2 items
    const result = withTrustBatch(items, trusts);
    expect(result[0]._trust.source).toBe('verified_api');
    expect(result[1]._trust.source).toBe('ai_inference');
    expect(result[1]._trust.confidence).toBe('low');
  });

  it('should handle empty arrays', () => {
    const result = withTrustBatch([], []);
    expect(result).toHaveLength(0);
  });
});

// ─── getReliabilityScore (Consolidated Source of Truth) ────────

describe('getReliabilityScore', () => {
  it('should return correct score for TrustSource values', () => {
    expect(getReliabilityScore('verified_api')).toBe(95);
    expect(getReliabilityScore('customer_data')).toBe(90);
    expect(getReliabilityScore('ai_inference')).toBe(55);
    expect(getReliabilityScore('web_intelligence')).toBe(70);
  });

  it('should map SourceType values to TrustSource equivalents', () => {
    expect(getReliabilityScore('clearbit')).toBe(95);     // → verified_api
    expect(getReliabilityScore('apollo')).toBe(95);       // → verified_api
    expect(getReliabilityScore('csv')).toBe(90);          // → customer_data
    expect(getReliabilityScore('excel')).toBe(90);        // → customer_data
    expect(getReliabilityScore('document')).toBe(85);     // → internal_document
    expect(getReliabilityScore('website')).toBe(70);     // → web_intelligence
    expect(getReliabilityScore('rss')).toBe(70);         // → web_intelligence
  });

  it('should return fallback score for unknown source types', () => {
    // Unknown sources default to ai_inference score (55)
    const score = getReliabilityScore('unknown_source');
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

// ─── Constants ─────────────────────────────────────────────────

describe('TRUST Constants', () => {
  it('SOURCE_RELIABILITY_SCORES should have all 6 source types', () => {
    expect(Object.keys(SOURCE_RELIABILITY_SCORES)).toHaveLength(6);
    expect(SOURCE_RELIABILITY_SCORES.verified_api).toBe(95);
    expect(SOURCE_RELIABILITY_SCORES.ai_inference).toBe(55);
  });

  it('CONFIDENCE_SCORES should have high > medium > low', () => {
    expect(CONFIDENCE_SCORES.high).toBeGreaterThan(CONFIDENCE_SCORES.medium);
    expect(CONFIDENCE_SCORES.medium).toBeGreaterThan(CONFIDENCE_SCORES.low);
  });
});
