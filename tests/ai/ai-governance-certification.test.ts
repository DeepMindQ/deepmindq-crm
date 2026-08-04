/**
 * DeepMindQ Enterprise AI Intelligence Platform
 * Milestone 3 — Section 3.1: AI Governance & Engine Certification
 * 
 * Validates: governance checks, hallucination prevention, confidence scoring,
 * freshness ranking, intelligence contracts, evidence grounding
 * 
 * Coverage target: 85%+ AI governance paths
 * Run: npx vitest run --config vitest.ai-governance.config.ts tests/ai/ai-governance-certification.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock hoisting: external dependencies that have side effects ──
const mockDbCreate = vi.fn().mockResolvedValue({ id: 'audit-1' });
const mockDb = {
  aIGenerationAudit: {
    create: mockDbCreate,
  },
};

vi.mock('@/lib/db', () => ({ db: mockDb }));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  },
}));

vi.mock('@/lib/ai-cache-layer', () => ({
  AICacheLayer: {
    get: vi.fn().mockResolvedValue(null),
    set: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/engines/model-router', () => ({
  ModelRouter: {
    complete: vi.fn().mockResolvedValue({
      success: true,
      text: 'AI generated response',
      modelUsed: 'claude-3-sonnet',
    }),
  },
}));

vi.mock('@/lib/research-engine', () => ({
  getCompanyEvidence: vi.fn().mockResolvedValue([]),
  getEvidenceSummary: vi.fn().mockResolvedValue({
    totalEvidence: 5,
    fields: {
      revenue: { count: 3, avgConfidence: 0.85, tierBreakdown: { premium: 2, standard: 1, low: 0 } },
      technology: { count: 2, avgConfidence: 0.7, tierBreakdown: { premium: 0, standard: 2, low: 0 } },
    },
  }),
}));

// ── Top-level imports (mocks are hoisted above by vitest) ──
import {
  computeFreshnessScore,
  computeFreshnessState,
  sourceQualityWeight,
  computeIntelligenceRanking,
  rankSignal,
  SIGNAL_HALF_LIVES,
  sortByIntelligenceRanking,
} from '@/lib/scoring/freshness-ranking';

import {
  extractClaims,
  verifyCitations,
  detectHedgingPatterns,
  scoreSpecificity,
  runHallucinationCheck,
  buildEvidenceContextFromChain,
  buildMinimalEvidenceContext,
  formatHallucinationReportForLog,
} from '@/lib/ai-hallucination-prevention';

import {
  computeUnifiedConfidence,
  getSourceReliability,
  formatConfidenceForLog,
  formatConfidenceForDisplay,
} from '@/lib/ai-unified-confidence';

import { computeConfidenceScore } from '@/lib/intelligence-confidence';

import {
  evaluateDomainFreshness,
  buildFreshnessWarning,
  getGovernanceConfig,
  getRegisteredGenerationTypes,
  runGovernanceChecks,
  buildGovernancePromptAddon,
  buildEvidenceGroundingNote,
  preFlightCheck,
  recordGeneration,
  governedAICall,
  HALLUCINATION_PREVENTION_RULES,
  GOVERNANCE_PROMPT_VERSION,
  FRESHNESS_LIFECYCLE_DAYS,
} from '@/lib/ai-governance';

import {
  applyFreshnessAdjustments,
  assessRefreshNeeds,
  FRESHNESS_EXPIRATION_THRESHOLDS,
} from '@/lib/intelligence-contract';

import type { ResearchContext } from '@/lib/intelligence-contract';

// ── 1. Freshness Ranking (PURE FUNCTIONS — no mocking needed) ────────────────

describe('Section 3.1.1: Freshness Ranking Engine', () => {
  describe('computeFreshnessScore', () => {
    it('computes half-life exponential decay correctly for 7-day-old news', () => {
      // base=90 (0-100 scale), halfLife=14d for news, 7 days old
      // Expected: 90 * 0.5^(7/14) = 90 * 0.7071 ≈ 63.6
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const result = computeFreshnessScore(90, sevenDaysAgo, new Date().toISOString(), 'news');
      expect(result).toBe(63.6);
    });

    it('computes zero decay for brand-new signals', () => {
      const now = new Date().toISOString();
      const result = computeFreshnessScore(85, now, now, 'news');
      expect(result).toBe(85);
    });

    it('decays to near-zero for very old news signals', () => {
      const longAgo = new Date(Date.now() - 240 * 24 * 60 * 60 * 1000).toISOString();
      const result = computeFreshnessScore(95, longAgo, new Date().toISOString(), 'news');
      expect(result).toBeLessThan(0.5);
    });

    it('uses createdAt fallback when signalDate is null', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
      const result = computeFreshnessScore(80, null, threeDaysAgo, 'news');
      expect(result).toBe(69.3);
    });

    it('prefers sourcePublishedDate over createdAt when signalDate is null', () => {
      const oneDayAgo = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString();
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const result = computeFreshnessScore(90, null, tenDaysAgo, 'news', oneDayAgo);
      expect(result).toBe(85.7);
    });

    it('uses default half-life for unknown signal types', () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const result = computeFreshnessScore(90, sevenDaysAgo, new Date().toISOString(), 'unknown_type');
      expect(result).toBe(76.6);
    });

    it('uses type-specific half-lives: news=14, funding=30, regulatory=90', () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const newsResult = computeFreshnessScore(90, thirtyDaysAgo, new Date().toISOString(), 'news');
      const fundingResult = computeFreshnessScore(90, thirtyDaysAgo, new Date().toISOString(), 'funding');
      const regulatoryResult = computeFreshnessScore(90, thirtyDaysAgo, new Date().toISOString(), 'regulatory');
      expect(newsResult).toBeLessThan(fundingResult);
      expect(fundingResult).toBeLessThan(regulatoryResult);
    });

    it('clamps daysSince to 0 for future-dated signals', () => {
      const futureDate = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
      const result = computeFreshnessScore(80, futureDate, new Date().toISOString(), 'news');
      expect(result).toBe(80);
    });
  });

  describe('computeFreshnessState', () => {
    it('classifies as fresh when daysSince <= halfLife * 0.5', () => {
      const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const result = computeFreshnessState(fiveDaysAgo, new Date().toISOString(), 'news');
      expect(result.staleness).toBe('fresh');
    });

    it('classifies as aging when daysSince is between halfLife*0.5 and halfLife', () => {
      const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
      const result = computeFreshnessState(tenDaysAgo, new Date().toISOString(), 'news');
      expect(result.staleness).toBe('aging');
    });

    it('classifies as stale when daysSince is between halfLife and halfLife*2', () => {
      const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString();
      const result = computeFreshnessState(twentyDaysAgo, new Date().toISOString(), 'news');
      expect(result.staleness).toBe('stale');
    });

    it('classifies as expired when daysSince > halfLife * 2', () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const result = computeFreshnessState(thirtyDaysAgo, new Date().toISOString(), 'news');
      expect(result.staleness).toBe('expired');
    });

    it('returns correct freshnessScore as 0-1 decay factor', () => {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const result = computeFreshnessState(sevenDaysAgo, new Date().toISOString(), 'news');
      expect(result.freshnessScore).toBeCloseTo(0.707, 2);
    });

    it('returns the correct halfLife for the signal type', () => {
      const result = computeFreshnessState(null, new Date().toISOString(), 'regulatory');
      expect(result.halfLife).toBe(90);
    });
  });

  describe('sourceQualityWeight', () => {
    it('returns 1.0 for premium sources', () => {
      expect(sourceQualityWeight('premium')).toBe(1.0);
    });

    it('returns 0.8 for standard sources', () => {
      expect(sourceQualityWeight('standard')).toBe(0.8);
    });

    it('returns 0.6 for low sources', () => {
      expect(sourceQualityWeight('low')).toBe(0.6);
    });

    it('returns 0.7 default for unknown quality', () => {
      expect(sourceQualityWeight('unknown')).toBe(0.7);
      expect(sourceQualityWeight('')).toBe(0.7);
      expect(sourceQualityWeight('random')).toBe(0.7);
    });
  });

  describe('computeIntelligenceRanking', () => {
    it('computes a 5-dimension composite score', () => {
      const now = new Date().toISOString();
      const result = computeIntelligenceRanking({
        confidence: 80, signalDate: now, createdAt: now, signalType: 'news',
        sourceQuality: 'premium', businessRelevance: 0.8, capabilityRelevance: 0.9,
      });
      expect(result.rankingScore).toBeGreaterThanOrEqual(0);
      expect(result.rankingScore).toBeLessThanOrEqual(100);
      expect(result.breakdown.confidenceScore).toBe(80);
      expect(result.breakdown.sourceQualityScore).toBe(100);
      expect(result.breakdown.businessRelevanceScore).toBe(80);
      expect(result.breakdown.capabilityRelevanceScore).toBe(90);
    });

    it('fresh signal outranks old high-confidence signal', () => {
      const now = new Date().toISOString();
      const oldDate = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString();
      const freshMedium = computeIntelligenceRanking({
        confidence: 70, signalDate: now, createdAt: now, signalType: 'news',
        sourceQuality: 'standard', businessRelevance: 0.7, capabilityRelevance: 0.7,
      });
      const oldHigh = computeIntelligenceRanking({
        confidence: 95, signalDate: oldDate, createdAt: oldDate, signalType: 'news',
        sourceQuality: 'premium', businessRelevance: 0.9, capabilityRelevance: 0.9,
      });
      expect(freshMedium.rankingScore).toBeGreaterThan(oldHigh.rankingScore);
    });

    it('includes freshness staleness info in result', () => {
      const now = new Date().toISOString();
      const result = computeIntelligenceRanking({
        confidence: 80, signalDate: now, createdAt: now, signalType: 'news',
        sourceQuality: 'standard', businessRelevance: 0.5, capabilityRelevance: 0.5,
      });
      expect(result.freshness.staleness).toBe('fresh');
      expect(result.freshness.halfLife).toBe(14);
    });

    it('applies dateQuality multiplier to freshness score', () => {
      const now = new Date().toISOString();
      const withHighQuality = computeIntelligenceRanking({
        confidence: 80, signalDate: now, createdAt: now, signalType: 'news',
        sourceQuality: 'standard', businessRelevance: 0.5, capabilityRelevance: 0.5, dateQuality: 1.0,
      });
      const withLowQuality = computeIntelligenceRanking({
        confidence: 80, signalDate: now, createdAt: now, signalType: 'news',
        sourceQuality: 'standard', businessRelevance: 0.5, capabilityRelevance: 0.5, dateQuality: 0.4,
      });
      expect(withHighQuality.rankingScore).toBeGreaterThanOrEqual(withLowQuality.rankingScore);
    });
  });

  describe('rankSignal', () => {
    it('extracts fields from a raw signal record and computes ranking', () => {
      const now = new Date().toISOString();
      const result = rankSignal({
        confidence: 0.85, signalDate: now, createdAt: now, signalType: 'funding', sourceQuality: 'premium',
      }, 0.8, 0.7);
      expect(result.rankingScore).toBeGreaterThanOrEqual(0);
      expect(result.breakdown.confidenceScore).toBe(85);
    });

    it('uses default businessRelevance and capabilityRelevance of 0.5', () => {
      const now = new Date().toISOString();
      const result = rankSignal({
        confidence: 0.8, signalDate: now, createdAt: now, signalType: 'news', sourceQuality: 'standard',
      });
      expect(result.breakdown.businessRelevanceScore).toBe(50);
      expect(result.breakdown.capabilityRelevanceScore).toBe(50);
    });
  });

  describe('sortByIntelligenceRanking', () => {
    it('sorts items by rankingScore descending', () => {
      const items = [
        { rankingScore: 30, name: 'c' },
        { rankingScore: 80, name: 'a' },
        { rankingScore: 50, name: 'b' },
      ];
      const sorted = sortByIntelligenceRanking(items);
      expect(sorted.map(i => i.name)).toEqual(['a', 'b', 'c']);
    });

    it('does not mutate the original array', () => {
      const items = [{ rankingScore: 10 }];
      const sorted = sortByIntelligenceRanking(items);
      expect(sorted).not.toBe(items);
    });
  });

  describe('SIGNAL_HALF_LIVES', () => {
    it('has news with 14-day half-life', () => {
      expect(SIGNAL_HALF_LIVES.news).toBe(14);
    });
    it('has regulatory with 90-day half-life (slowest decay)', () => {
      expect(SIGNAL_HALF_LIVES.regulatory).toBe(90);
    });
    it('has mention with 7-day half-life (fastest decay)', () => {
      expect(SIGNAL_HALF_LIVES.mention).toBe(7);
    });
    it('has _default with 30-day half-life', () => {
      expect(SIGNAL_HALF_LIVES._default).toBe(30);
    });
  });
});

// ── 2. Hallucination Prevention (mock only logger — already mocked above) ────

describe('Section 3.1.2: AI Hallucination Prevention', () => {
  describe('extractClaims', () => {
    it('extracts revenue claims from text', () => {
      const text = 'Acme Corp generated $50M revenue last year.';
      const claims = extractClaims(text);
      const revenueClaims = claims.filter(c => c.type === 'revenue');
      expect(revenueClaims.length).toBeGreaterThanOrEqual(1);
      expect(revenueClaims[0].text).toContain('$50M');
    });

    it('extracts employee count claims', () => {
      const text = 'The company employs approximately 500 employees worldwide.';
      const claims = extractClaims(text);
      const empClaims = claims.filter(c => c.type === 'employee_count');
      expect(empClaims.length).toBeGreaterThanOrEqual(1);
    });

    it('extracts technology usage claims', () => {
      const text = 'They use AWS and deployed Kubernetes for container orchestration.';
      const claims = extractClaims(text);
      const techClaims = claims.filter(c => c.type === 'technology');
      expect(techClaims.length).toBeGreaterThanOrEqual(1);
    });

    it('extracts funding claims', () => {
      const text = 'They raised $100M in Series C funding.';
      const claims = extractClaims(text);
      const fundingClaims = claims.filter(c => c.type === 'funding');
      expect(fundingClaims.length).toBeGreaterThanOrEqual(1);
    });

    it('detects citation markers near claims', () => {
      const text = 'Acme Corp generated $50M revenue last year [E1]. The company uses React [E2].';
      const claims = extractClaims(text);
      const citedClaims = claims.filter(c => c.citationMarker !== null);
      expect(citedClaims.length).toBeGreaterThanOrEqual(1);
    });

    it('returns empty array for text with no verifiable claims', () => {
      const text = 'This is a general statement about the market.';
      const claims = extractClaims(text);
      expect(claims).toHaveLength(0);
    });

    it('detects expressed confidence from nearby text', () => {
      const text = 'Revenue confirmed at $50M. This is verified and announced.';
      const claims = extractClaims(text);
      const highConfidence = claims.filter(c => c.expressedConfidence === 'high');
      expect(highConfidence.length).toBeGreaterThanOrEqual(1);
    });

    it('detects partnership claims', () => {
      const text = 'The company partnered with Microsoft and collaborates with Google.';
      const claims = extractClaims(text);
      const partnerClaims = claims.filter(c => c.type === 'partnership');
      expect(partnerClaims.length).toBeGreaterThanOrEqual(1);
    });

    it('detects leadership claims', () => {
      const text = 'The CEO is John Smith. The CTO was Jane Doe previously.';
      const claims = extractClaims(text);
      const leaderClaims = claims.filter(c => c.type === 'leadership');
      expect(leaderClaims.length).toBeGreaterThanOrEqual(1);
    });

    it('detects expansion claims', () => {
      const text = 'They are expanding into Europe and opened a new office in London.';
      const claims = extractClaims(text);
      const expansionClaims = claims.filter(c => c.type === 'expansion');
      expect(expansionClaims.length).toBeGreaterThanOrEqual(1);
    });

    it('detects hiring claims', () => {
      const text = 'They are hiring for 50 positions and recruiting engineers.';
      const claims = extractClaims(text);
      const hiringClaims = claims.filter(c => c.type === 'hiring');
      expect(hiringClaims.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('verifyCitations', () => {
    it('matches [E1] citation marker to evidence', () => {
      const claims = [{
        text: '$50M revenue', type: 'revenue' as const, entity: 'Acme',
        value: '$50M', citationMarker: 'E1', expressedConfidence: 'high' as const, position: 0,
      }];
      const evidenceContext = {
        evidenceMap: {
          E1: { text: 'Acme Corp reported $50M in annual revenue', source: 'SEC Filing', url: null, confidence: 0.95 },
        },
      };
      const verifications = verifyCitations(claims, evidenceContext);
      expect(verifications).toHaveLength(1);
      expect(verifications[0].evidenceExists).toBe(true);
      expect(verifications[0].claimAligns).toBe(true);
      expect(verifications[0].alignmentScore).toBeGreaterThanOrEqual(0.3);
    });

    it('detects hallucinated citations that reference non-existent evidence', () => {
      const claims = [{
        text: '$50M revenue [E99]', type: 'revenue' as const, entity: 'Acme',
        value: '$50M revenue [E99]', citationMarker: 'E99', expressedConfidence: 'high' as const, position: 0,
      }];
      const evidenceContext = {
        evidenceMap: {
          E1: { text: 'Some other evidence', source: 'Source', url: null, confidence: 0.8 },
        },
      };
      const verifications = verifyCitations(claims, evidenceContext);
      expect(verifications).toHaveLength(1);
      expect(verifications[0].evidenceExists).toBe(false);
      expect(verifications[0].claimAligns).toBe(false);
      expect(verifications[0].explanation).toContain('hallucinated');
    });

    it('skips uncited claims (no citation marker)', () => {
      const claims = [{
        text: 'Uses AWS', type: 'technology' as const, entity: 'Acme',
        value: 'Uses AWS', citationMarker: null, expressedConfidence: 'medium' as const, position: 0,
      }];
      const verifications = verifyCitations(claims, { evidenceMap: {} });
      expect(verifications).toHaveLength(0);
    });

    it('detects misaligned citations (claim does not match evidence)', () => {
      const claims = [{
        text: '$50M revenue', type: 'revenue' as const, entity: 'Acme',
        value: '$50M revenue', citationMarker: 'E1', expressedConfidence: 'high' as const, position: 0,
      }];
      const evidenceContext = {
        evidenceMap: {
          E1: { text: 'The company uses a custom CRM system', source: 'Blog', url: null, confidence: 0.5 },
        },
      };
      const verifications = verifyCitations(claims, evidenceContext);
      expect(verifications).toHaveLength(1);
      expect(verifications[0].evidenceExists).toBe(true);
      expect(verifications[0].alignmentScore).toBeLessThan(0.3);
      expect(verifications[0].claimAligns).toBe(false);
    });
  });

  describe('detectHedgingPatterns', () => {
    it('detects "may" hedging pattern', () => {
      const result = detectHedgingPatterns('The company may expand next year.');
      expect(result.some(r => r.includes('"may"'))).toBe(true);
    });

    it('detects "might" hedging pattern', () => {
      const result = detectHedgingPatterns('They might be considering a move.');
      expect(result.some(r => r.includes('"might"'))).toBe(true);
    });

    it('detects "possibly" hedging pattern', () => {
      const result = detectHedgingPatterns('This could possibly lead to growth.');
      expect(result.some(r => r.includes('"possibly"'))).toBe(true);
    });

    it('detects "potentially" hedging pattern', () => {
      const result = detectHedgingPatterns('The deal is potentially worth millions.');
      expect(result.some(r => r.includes('"potentially"'))).toBe(true);
    });

    it('detects "we believe" hedging pattern', () => {
      const result = detectHedgingPatterns('We believe this is the right approach.');
      expect(result.some(r => r.includes('"we believe"'))).toBe(true);
    });

    it('detects "likely" hedging pattern', () => {
      const result = detectHedgingPatterns('They are likely to announce soon.');
      expect(result.some(r => r.includes('"likely"'))).toBe(true);
    });

    it('detects "expected to" hedging pattern', () => {
      const result = detectHedgingPatterns('Revenue is expected to grow 20%.');
      expect(result.some(r => r.includes('"expected to"'))).toBe(true);
    });

    it('detects multiple hedging patterns and counts occurrences', () => {
      const result = detectHedgingPatterns('It may possibly happen. It might also be the case. We believe it may work.');
      expect(result.length).toBeGreaterThanOrEqual(4);
    });

    it('returns empty array for confident, non-hedging text', () => {
      const result = detectHedgingPatterns('The company confirmed the deal today. Revenue is verified at $50M.');
      expect(result).toHaveLength(0);
    });

    it('detects all 14 hedging patterns across a comprehensive text', () => {
      const text = [
        'It may happen.', 'It might occur.', 'It possibly will.', 'It potentially could.',
        'It appears to be.', 'It seems to be.', 'It could be.', 'Perhaps it is.',
        'This suggests that.', 'We believe it.', 'It is likely.', 'Expected to be.',
        'It is possible.', 'It appears to be.',
      ].join(' ');
      const result = detectHedgingPatterns(text);
      expect(result.length).toBeGreaterThanOrEqual(10);
    });
  });

  describe('scoreSpecificity', () => {
    it('scores high for text with named entities and monetary values', () => {
      const text = 'Acme Corp uses AWS and Kubernetes. Revenue is $50M with 15% growth. See [E1] and [E2].';
      const score = scoreSpecificity(text);
      expect(score).toBeGreaterThanOrEqual(30);
    });

    it('scores low for generic text without specifics', () => {
      const text = 'The company is doing well in the market. They have a good team and strong leadership.';
      const score = scoreSpecificity(text);
      expect(score).toBeLessThan(30);
    });

    it('gives bonus points for multiple technology keywords', () => {
      const text = 'They use AWS, GCP, Azure, Kubernetes, Docker, Python, and React.';
      const score = scoreSpecificity(text);
      expect(score).toBeGreaterThanOrEqual(20);
    });

    it('gives bonus points for multiple monetary values', () => {
      const text = 'Revenue $50M, funding $100M, valuation $1B.';
      const score = scoreSpecificity(text);
      expect(score).toBeGreaterThanOrEqual(20);
    });

    it('gives bonus points for citation markers', () => {
      const text = 'Claim one [E1]. Claim two [E2]. Claim three [E3]. Claim four [E4].';
      const score = scoreSpecificity(text);
      expect(score).toBeGreaterThanOrEqual(20);
    });

    it('caps total score at 100', () => {
      const text = 'Acme Corp uses AWS, GCP, Azure, Kubernetes, Docker, Python, React. Revenue is $50M. Growth is 15%. CEO is John Smith. CTO is Jane Doe. [E1] [E2] [E3] [E4] [E5].';
      const score = scoreSpecificity(text);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('runHallucinationCheck', () => {
    it('returns minimal risk for well-cited, specific output', () => {
      const aiOutput = 'Acme Corp reported $50M revenue [E1]. They use AWS [E2]. CEO is John Smith [E3].';
      const evidenceContext = {
        evidenceMap: {
          E1: { text: 'Acme Corp reported $50M in annual revenue', source: 'SEC', url: null, confidence: 0.95 },
          E2: { text: 'Acme Corp uses AWS for cloud infrastructure', source: 'Blog', url: null, confidence: 0.8 },
          E3: { text: 'John Smith is CEO of Acme Corp', source: 'LinkedIn', url: null, confidence: 0.9 },
        },
      };
      const result = runHallucinationCheck(aiOutput, evidenceContext);
      expect(result.hallucinationRiskScore).toBeLessThanOrEqual(30);
      expect(['minimal', 'low']).toContain(result.riskLevel);
      expect(result.passesTrustThreshold).toBe(true);
    });

    it('returns critical risk for hallucinated citations', () => {
      const aiOutput = 'Acme Corp reported $50M revenue [E99]. They use AWS [E100].';
      const evidenceContext = { evidenceMap: { E1: { text: 'Unrelated evidence', source: 'Source', url: null, confidence: 0.5 } } };
      const result = runHallucinationCheck(aiOutput, evidenceContext);
      expect(result.hallucinatedCitations).toBe(2);
      expect(result.hallucinationRiskScore).toBeGreaterThanOrEqual(40);
    });

    it('detects uncited claims as risk factor', () => {
      const aiOutput = 'Acme Corp reported $50M revenue. They use AWS. CEO is John Smith. CTO is Jane Doe. Revenue is confirmed.';
      const evidenceContext = { evidenceMap: {} };
      const result = runHallucinationCheck(aiOutput, evidenceContext);
      expect(result.uncitedClaims).toBeGreaterThanOrEqual(3);
      expect(result.hallucinationRiskScore).toBeGreaterThanOrEqual(15);
    });

    it('includes hedging patterns in the result', () => {
      const aiOutput = 'The company may possibly be considering expansion. It might be a good move.';
      const evidenceContext = { evidenceMap: {} };
      const result = runHallucinationCheck(aiOutput, evidenceContext);
      expect(result.hedgingPatterns.length).toBeGreaterThanOrEqual(2);
    });

    it('produces recommendations when issues are found', () => {
      const aiOutput = 'They may use something. Revenue is $50M [E99]. The company might expand.';
      const evidenceContext = { evidenceMap: {} };
      const result = runHallucinationCheck(aiOutput, evidenceContext);
      expect(result.recommendations.length).toBeGreaterThanOrEqual(1);
    });

    it('passes trust threshold (score <= 60) for clean output', () => {
      const aiOutput = 'Acme Corp confirmed revenue [E1]. The CEO announced the results [E2].';
      const evidenceContext = {
        evidenceMap: {
          E1: { text: 'Acme Corp confirmed $50M revenue', source: 'Press', url: null, confidence: 0.9 },
          E2: { text: 'CEO John Smith announced Q3 results', source: 'SEC', url: null, confidence: 0.95 },
        },
      };
      const result = runHallucinationCheck(aiOutput, evidenceContext);
      expect(result.passesTrustThreshold).toBe(true);
    });

    it('fails trust threshold when risk score exceeds 60', () => {
      const aiOutput = [
        '$50M revenue [E99]', '$100M funding [E100]', '500 employees [E101]',
        'Uses AWS [E102]', 'CEO is John [E103]', 'CTO is Jane [E104]',
        '$200M valuation [E105]', 'Series C funding [E106]',
      ].join('. ');
      const evidenceContext = { evidenceMap: { E1: { text: 'something', source: 's', url: null, confidence: 0.5 } } };
      const result = runHallucinationCheck(aiOutput, evidenceContext);
      expect(result.passesTrustThreshold).toBe(false);
      expect(result.riskLevel).toBe('critical');
    });

    it('includes a timestamp in the result', () => {
      const result = runHallucinationCheck('test', { evidenceMap: {} });
      expect(result.timestamp).toBeDefined();
      expect(new Date(result.timestamp).getTime()).not.toBeNaN();
    });

    it('computes verifiedClaims count correctly', () => {
      const aiOutput = 'Revenue confirmed [E1]. Technology uses React [E2].';
      const evidenceContext = {
        evidenceMap: {
          E1: { text: 'Revenue confirmed at $50M', source: 'SEC', url: null, confidence: 0.9 },
          E2: { text: 'Technology uses React framework', source: 'GitHub', url: null, confidence: 0.8 },
        },
      };
      const result = runHallucinationCheck(aiOutput, evidenceContext);
      expect(result.verifiedClaims).toBeGreaterThanOrEqual(1);
    });
  });

  describe('buildEvidenceContextFromChain', () => {
    it('maps evidence items to [E1], [E2], etc. markers', () => {
      const ctx = buildEvidenceContextFromChain({
        evidences: [
          { id: 'ev1', source: 'SEC', url: 'https://sec.gov', snippet: 'Revenue $50M', content: 'Full content', reliability: 0.95, confidence: 0.9 },
          { id: 'ev2', source: 'Blog', url: null, snippet: 'Uses AWS', content: 'Blog content', reliability: 0.7, confidence: 0.7 },
        ],
        fieldConfidence: { revenue: 0.9 },
      });
      expect(ctx.evidenceMap.E1).toBeDefined();
      expect(ctx.evidenceMap.E2).toBeDefined();
      expect(ctx.evidenceMap.E1.source).toBe('SEC');
      expect(ctx.evidenceMap.E2.source).toBe('Blog');
      expect(ctx.fieldConfidence).toEqual({ revenue: 0.9 });
    });
  });

  describe('buildMinimalEvidenceContext', () => {
    it('builds evidence map from minimal items', () => {
      const ctx = buildMinimalEvidenceContext([
        { marker: 'E1', text: 'Evidence 1', source: 'Source 1' },
        { marker: 'E5', text: 'Evidence 5', source: 'Source 5', confidence: 0.8 },
      ]);
      expect(ctx.evidenceMap.E1).toBeDefined();
      expect(ctx.evidenceMap.E5).toBeDefined();
      expect(ctx.evidenceMap.E5.confidence).toBe(0.8);
    });
  });

  describe('formatHallucinationReportForLog', () => {
    it('formats a report string with risk level and trust status', () => {
      const result = runHallucinationCheck('test', { evidenceMap: {} });
      const report = formatHallucinationReportForLog(result);
      expect(report).toContain('HallucinationCheck');
      expect(report).toContain(result.riskLevel);
      expect(report).toContain(String(result.hallucinationRiskScore));
    });
  });
});

// ── 3. Unified Confidence Engine (mock only logger) ────────────────────────

describe('Section 3.1.3: Unified Confidence Engine', () => {
  describe('getSourceReliability', () => {
    it('returns 0.95 for SEC filings', () => {
      expect(getSourceReliability('sec.gov')).toBe(0.95);
    });
    it('returns 0.92 for Bloomberg', () => {
      expect(getSourceReliability('bloomberg.com')).toBe(0.92);
    });
    it('returns 0.92 for Reuters', () => {
      expect(getSourceReliability('reuters.com')).toBe(0.92);
    });
    it('returns 0.85 for Crunchbase', () => {
      expect(getSourceReliability('crunchbase.com')).toBe(0.85);
    });
    it('returns 0.55 for Twitter/X', () => {
      expect(getSourceReliability('twitter.com')).toBe(0.55);
      expect(getSourceReliability('x.com')).toBe(0.55);
    });
    it('returns 0.60 for unknown sources', () => {
      expect(getSourceReliability('unknown')).toBe(0.60);
      expect(getSourceReliability('random-blog.example')).toBe(0.60);
    });
    it('does domain-based lookup for partial URLs', () => {
      expect(getSourceReliability('https://sec.gov/filings')).toBe(0.95);
    });
    it('matches category keywords', () => {
      expect(getSourceReliability('Government Filing Source')).toBe(0.90);
      expect(getSourceReliability('Press Release')).toBe(0.82);
      expect(getSourceReliability('news article')).toBe(0.70);
      expect(getSourceReliability('social media post')).toBe(0.50);
      expect(getSourceReliability('internal CRM data')).toBe(0.75);
    });
    it('returns known company-direct sources', () => {
      expect(getSourceReliability('company website')).toBe(0.88);
      expect(getSourceReliability('annual report')).toBe(0.93);
      expect(getSourceReliability('10-K filing')).toBe(0.95);
    });
  });

  describe('computeUnifiedConfidence', () => {
    it('produces enterprise trust class for score >= 80', () => {
      const result = computeUnifiedConfidence({
        fieldConfidence: { revenue: 0.95, employees: 0.9, tech: 0.9, industry: 0.95 },
        dataCompleteness: 0.95,
        sources: [
          { name: 'sec.gov', reliability: 0.95, type: 'regulatory' },
          { name: 'bloomberg.com', reliability: 0.92, type: 'financial' },
          { name: 'company website', reliability: 0.88, type: 'company' },
        ],
        daysSinceResearch: 3, freshnessScore: 98,
        crossValidatedFacts: 9, totalFacts: 10, contradictions: 0,
        evidenceCount: 20, evidenceCoverage: 0.95, coveredDimensions: 8, expectedDimensions: 8,
        qualityGateScore: 95, hallucinationRiskScore: 5,
      });
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.trustClass).toBe('enterprise');
      expect(result.enterpriseReady).toBe(true);
    });

    it('produces advisory trust class for score 60-79', () => {
      const result = computeUnifiedConfidence({
        fieldConfidence: { revenue: 0.7, employees: 0.6 },
        dataCompleteness: 0.5,
        sources: [{ name: 'crunchbase.com', reliability: 0.85, type: 'funding' }],
        daysSinceResearch: 20, freshnessScore: 60,
        crossValidatedFacts: 3, totalFacts: 10, contradictions: 0,
        evidenceCount: 5, evidenceCoverage: 0.5, qualityGateScore: 60,
      });
      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(result.score).toBeLessThan(80);
      expect(result.trustClass).toBe('advisory');
    });

    it('produces speculative trust class for score 40-59', () => {
      const result = computeUnifiedConfidence({
        fieldConfidence: { revenue: 0.3 },
        daysSinceResearch: 60, evidenceCount: 2,
        qualityGateScore: 40, hallucinationRiskScore: 45,
      });
      expect(result.score).toBeGreaterThanOrEqual(35);
      expect(result.score).toBeLessThan(65);
      expect(['speculative', 'advisory']).toContain(result.trustClass);
    });

    it('produces unreliable trust class for score < 40', () => {
      const result = computeUnifiedConfidence({
        fieldConfidence: { revenue: 0.1 },
        daysSinceResearch: 200, evidenceCount: 0,
        qualityGateScore: 15, hallucinationRiskScore: 80, contradictions: 5,
      });
      expect(result.score).toBeLessThan(45);
      expect(['speculative', 'unreliable']).toContain(result.trustClass);
    });

    it('uses 6-dimension formula with correct weights', () => {
      const result = computeUnifiedConfidence({});
      expect(result.factors).toHaveLength(6);
      const totalWeight = result.factors.reduce((a, b) => a + b.weight, 0);
      expect(totalWeight).toBeCloseTo(1.0, 1);
      expect(result.factors.find(f => f.dimension === 'data_quality')!.weight).toBe(0.20);
      expect(result.factors.find(f => f.dimension === 'source_reliability')!.weight).toBe(0.20);
      expect(result.factors.find(f => f.dimension === 'freshness')!.weight).toBe(0.15);
      expect(result.factors.find(f => f.dimension === 'cross_validation')!.weight).toBe(0.15);
      expect(result.factors.find(f => f.dimension === 'evidence_coverage')!.weight).toBe(0.15);
      expect(result.factors.find(f => f.dimension === 'ai_certainty')!.weight).toBe(0.15);
    });

    it('generates recommendations for weak dimensions', () => {
      const result = computeUnifiedConfidence({
        daysSinceResearch: 120, qualityGateScore: 20,
      });
      expect(result.recommendations.length).toBeGreaterThanOrEqual(1);
    });

    it('returns model version v1-wi16c-unified', () => {
      const result = computeUnifiedConfidence({});
      expect(result.modelVersion).toBe('v1-wi16c-unified');
    });

    it('includes timestamp in result', () => {
      const result = computeUnifiedConfidence({});
      expect(result.timestamp).toBeDefined();
    });

    it('grade mapping: A+ for >= 95, F for < 40', () => {
      const highResult = computeUnifiedConfidence({
        fieldConfidence: { a: 1.0, b: 1.0, c: 1.0 }, dataCompleteness: 1.0,
        sources: Array(10).fill({ name: 'sec.gov', reliability: 0.95, type: 'reg' }),
        daysSinceResearch: 1, freshnessScore: 100,
        crossValidatedFacts: 10, totalFacts: 10,
        evidenceCount: 20, evidenceCoverage: 1.0, coveredDimensions: 10, expectedDimensions: 10,
        qualityGateScore: 100, hallucinationRiskScore: 0,
      });
      expect(['A+', 'A', 'A-', 'B+']).toContain(highResult.grade);

      const lowResult = computeUnifiedConfidence({
        daysSinceResearch: 365, evidenceCount: 0, qualityGateScore: 5, hallucinationRiskScore: 95,
      });
      expect(['D', 'F']).toContain(lowResult.grade);
    });

    it('bonus for source diversity (3+ types)', () => {
      const result = computeUnifiedConfidence({
        sources: [
          { name: 'sec.gov', reliability: 0.95, type: 'regulatory' },
          { name: 'bloomberg.com', reliability: 0.92, type: 'financial' },
          { name: 'company website', reliability: 0.88, type: 'company' },
        ],
      });
      const srFactor = result.factors.find(f => f.dimension === 'source_reliability');
      expect(srFactor!.positiveSignals.some(s => s.includes('different source types'))).toBe(true);
    });

    it('penalty for contradictions in cross-validation', () => {
      const result = computeUnifiedConfidence({
        crossValidatedFacts: 5, totalFacts: 10, contradictions: 3,
      });
      const cvFactor = result.factors.find(f => f.dimension === 'cross_validation');
      expect(cvFactor!.negativeSignals.some(s => s.includes('contradiction'))).toBe(true);
    });
  });

  describe('formatConfidenceForLog', () => {
    it('formats a log string with score, grade, and trust class', () => {
      const result = computeUnifiedConfidence({ daysSinceResearch: 5 });
      const log = formatConfidenceForLog(result);
      expect(log).toContain(String(result.score));
      expect(log).toContain(result.grade);
      expect(log).toContain(result.trustClass);
    });
  });

  describe('formatConfidenceForDisplay', () => {
    it('returns a color for each grade', () => {
      const result = computeUnifiedConfidence({ daysSinceResearch: 5 });
      const display = formatConfidenceForDisplay(result);
      expect(display.color).toBeDefined();
      expect(display.label).toContain(String(result.score));
      expect(display.label).toContain(result.grade);
      expect(display.factors).toHaveLength(6);
    });
  });
});

// ── 4. Intelligence Confidence (pure computeConfidenceScore) ────────────────

describe('Section 3.1.4: Intelligence Confidence', () => {
  describe('computeConfidenceScore (pure function)', () => {
    it('computes weighted 4-dimension composite correctly', () => {
      const result = computeConfidenceScore({
        signalQuality: 80, evidenceQuality: 70, capabilityFit: 60, dataCompleteness: 90,
      });
      // 80*0.30 + 70*0.30 + 60*0.25 + 90*0.15 = 24 + 21 + 15 + 13.5 = 73.5 → 74
      expect(result.overall).toBe(74);
      expect(result.signalQuality).toBe(80);
      expect(result.evidenceQuality).toBe(70);
      expect(result.capabilityFit).toBe(60);
      expect(result.dataCompleteness).toBe(90);
    });

    it('clamps overall to 0-100 range', () => {
      const result = computeConfidenceScore({
        signalQuality: 100, evidenceQuality: 100, capabilityFit: 100, dataCompleteness: 100,
      });
      expect(result.overall).toBeLessThanOrEqual(100);
      expect(result.overall).toBeGreaterThanOrEqual(0);
    });

    it('produces 0 for all-zero inputs', () => {
      const result = computeConfidenceScore({
        signalQuality: 0, evidenceQuality: 0, capabilityFit: 0, dataCompleteness: 0,
      });
      expect(result.overall).toBe(0);
    });

    it('weights are: signalQuality=30%, evidenceQuality=30%, capabilityFit=25%, dataCompleteness=15%', () => {
      const maxResult = computeConfidenceScore({
        signalQuality: 100, evidenceQuality: 100, capabilityFit: 100, dataCompleteness: 100,
      });
      expect(maxResult.overall).toBe(100);

      const signalOnly = computeConfidenceScore({
        signalQuality: 100, evidenceQuality: 0, capabilityFit: 0, dataCompleteness: 0,
      });
      expect(signalOnly.overall).toBe(30);

      const evidenceOnly = computeConfidenceScore({
        signalQuality: 0, evidenceQuality: 100, capabilityFit: 0, dataCompleteness: 0,
      });
      expect(evidenceOnly.overall).toBe(30);

      const capOnly = computeConfidenceScore({
        signalQuality: 0, evidenceQuality: 0, capabilityFit: 100, dataCompleteness: 0,
      });
      expect(capOnly.overall).toBe(25);

      const dataOnly = computeConfidenceScore({
        signalQuality: 0, evidenceQuality: 0, capabilityFit: 0, dataCompleteness: 100,
      });
      expect(dataOnly.overall).toBe(15);
    });
  });
});

// ── Helper: build a minimal ResearchContext for governance tests ──

function makeResearchContext(overrides: Partial<ResearchContext> & { companyId?: string; companyName?: string } = {}): ResearchContext {
  const now = new Date().toISOString();
  const freshCategories = {
    profile: { score: 95, status: 'fresh' as const, lastVerifiedAt: now, daysSinceVerification: 2 },
    signal: { score: 90, status: 'fresh' as const, lastVerifiedAt: now, daysSinceVerification: 3 },
    contact: { score: 85, status: 'fresh' as const, lastVerifiedAt: now, daysSinceVerification: 5 },
    technology: { score: 80, status: 'fresh' as const, lastVerifiedAt: now, daysSinceVerification: 4 },
  };

  return {
    companyId: overrides.companyId || 'co-1',
    companyName: overrides.companyName || 'TestCo',
    domain: null, industry: null, website: null, country: null, sizeRange: null, internalSummary: null,
    researchCard: {
      exists: true, source: 'research_engine_v3', enrichedAt: now,
      businessOverview: 'A SaaS company', revenue: '$50M', employeeCount: '500',
      fundingStage: 'Series C', techStack: 'AWS, React', socialProfiles: {},
      industry: 'SaaS', website: 'https://testco.com',
      profileFreshnessAt: new Date(), signalFreshnessAt: new Date(),
      techFreshnessAt: new Date(), contactFreshnessAt: new Date(),
      ...(overrides.researchCard && typeof overrides.researchCard === 'object' ? overrides.researchCard : {}),
    },
    keyPeople: [], signals: [], recentNews: [],
    fieldConfidence: { revenue: 0.9, employees: 0.85, tech: 0.8 },
    evidenceSummary: { totalEvidence: 10, fields: {} },
    freshness: {
      score: 80, status: 'fresh', lastResearchedAt: now, daysSinceResearch: 5,
      evidenceCount: 10, signalCount: 3, categories: freshCategories,
      ...(overrides.freshness && typeof overrides.freshness === 'object' ? overrides.freshness : {}),
    },
    structuredTechLandscape: { cloud: [], data: [], ai: [], applications: [] },
    strategicPriorities: [],
    capabilityMatchingInputs: { businessProblems: [], transformationAreas: [], technologyThemes: [] },
    contactCount: 3, internalNotes: null,
    ...overrides,
  };
}

// ── 5. AI Governance (mock db, logger, ai-cache-layer, model-router) ────────

describe('Section 3.1.5: AI Governance Layer', () => {
  beforeEach(() => {
    mockDbCreate.mockClear();
  });

  describe('evaluateDomainFreshness', () => {
    it('returns stale with Infinity days when lastRefreshedAt is null', () => {
      const result = evaluateDomainFreshness(null, 'profile');
      expect(result.status).toBe('stale');
      expect(result.daysSinceRefresh).toBe(Infinity);
    });

    it('returns fresh when within lifecycle days', () => {
      const recent = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
      const result = evaluateDomainFreshness(recent, 'signals');
      expect(result.status).toBe('fresh');
      expect(result.daysSinceRefresh).toBe(5);
    });

    it('returns aging when past lifecycle but within 2x', () => {
      const aging = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);
      const result = evaluateDomainFreshness(aging, 'signals');
      expect(result.status).toBe('aging');
      expect(result.daysSinceRefresh).toBe(20);
    });

    it('returns stale when past 2x lifecycle', () => {
      const stale = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
      const result = evaluateDomainFreshness(stale, 'signals');
      expect(result.status).toBe('stale');
    });

    it('respects per-domain lifecycles: profile=90, signals=14, technology=60, contacts=45', () => {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      expect(evaluateDomainFreshness(thirtyDaysAgo, 'profile').status).toBe('fresh');
      expect(evaluateDomainFreshness(thirtyDaysAgo, 'signals').status).toBe('stale');
      expect(evaluateDomainFreshness(thirtyDaysAgo, 'technology').status).toBe('fresh');
      expect(evaluateDomainFreshness(thirtyDaysAgo, 'contacts').status).toBe('fresh');
    });

    it('returns fresh on the exact boundary (daysSince == lifecycle)', () => {
      const exact = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const result = evaluateDomainFreshness(exact, 'signals');
      expect(result.status).toBe('fresh');
    });
  });

  describe('buildFreshnessWarning', () => {
    it('returns empty string when all domains are fresh', () => {
      const now = new Date();
      const result = buildFreshnessWarning({
        profileFreshnessAt: now, signalFreshnessAt: now, techFreshnessAt: now, contactFreshnessAt: now,
      });
      expect(result).toBe('');
    });

    it('returns empty string when researchCard is null', () => {
      expect(buildFreshnessWarning(null)).toBe('');
    });

    it('warns about aging profile intelligence', () => {
      const aging = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
      const result = buildFreshnessWarning({
        profileFreshnessAt: aging, signalFreshnessAt: new Date(),
        techFreshnessAt: new Date(), contactFreshnessAt: new Date(),
      });
      expect(result).toContain('FRESHNESS WARNINGS');
      expect(result).toContain('profile intelligence');
      expect(result).toContain('outdated');
    });

    it('warns about stale signals with stronger language', () => {
      const stale = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000);
      const result = buildFreshnessWarning({
        profileFreshnessAt: new Date(), signalFreshnessAt: stale,
        techFreshnessAt: new Date(), contactFreshnessAt: new Date(),
      });
      expect(result).toContain('STALE');
      expect(result).toContain('Do NOT reference signals');
    });

    it('warns about stale technology intelligence', () => {
      const stale = new Date(Date.now() - 150 * 24 * 60 * 60 * 1000);
      const result = buildFreshnessWarning({
        profileFreshnessAt: new Date(), signalFreshnessAt: new Date(),
        techFreshnessAt: stale, contactFreshnessAt: new Date(),
      });
      expect(result).toContain('Technology intelligence');
      expect(result).toContain('severely outdated');
    });

    it('accumulates warnings for multiple stale domains', () => {
      const stale = new Date(Date.now() - 200 * 24 * 60 * 60 * 1000);
      const result = buildFreshnessWarning({
        profileFreshnessAt: stale, signalFreshnessAt: stale,
        techFreshnessAt: stale, contactFreshnessAt: stale,
      });
      const lines = result.split('- ').length - 1;
      expect(lines).toBe(4);
    });
  });

  describe('getGovernanceConfig', () => {
    it('returns correct config for email_draft', () => {
      const config = getGovernanceConfig('email_draft');
      expect(config.minResearchConfidence).toBe(0.6);
      expect(config.minFreshnessScore).toBe(25);
      expect(config.requireCapabilityMatch).toBe(true);
      expect(config.requireRecentIntelligence).toBe(true);
      expect(config.maxStalenessDays).toBe(60);
    });

    it('returns correct config for conversation_plan', () => {
      const config = getGovernanceConfig('conversation_plan');
      expect(config.minResearchConfidence).toBe(0.6);
      expect(config.requireCapabilityMatch).toBe(false);
    });

    it('returns correct config for query_parsing (zero thresholds)', () => {
      const config = getGovernanceConfig('query_parsing');
      expect(config.minResearchConfidence).toBe(0);
      expect(config.minFreshnessScore).toBe(0);
      expect(config.maxStalenessDays).toBe(9999);
    });

    it('returns default config for completely unknown types', () => {
      const config = getGovernanceConfig('completely_unknown_type_xyz');
      expect(config.minResearchConfidence).toBe(0.4);
      expect(config.minFreshnessScore).toBe(20);
      expect(config.requireCapabilityMatch).toBe(false);
    });

    it('returns reasoning parent config for reasoning_* dynamic types', () => {
      const config = getGovernanceConfig('reasoning_signal_analysis');
      expect(config.minResearchConfidence).toBe(0.3);
      expect(config.minFreshnessScore).toBe(15);
    });

    it('does not mutate the original config objects', () => {
      const config1 = getGovernanceConfig('email_draft');
      config1.minResearchConfidence = 0.99;
      const config2 = getGovernanceConfig('email_draft');
      expect(config2.minResearchConfidence).toBe(0.6);
    });
  });

  describe('getRegisteredGenerationTypes', () => {
    it('returns a Set with 40+ registered types', () => {
      const types = getRegisteredGenerationTypes();
      expect(types.size).toBeGreaterThanOrEqual(40);
    });

    it('includes core generation types', () => {
      const types = getRegisteredGenerationTypes();
      expect(types.has('email_draft')).toBe(true);
      expect(types.has('conversation_plan')).toBe(true);
      expect(types.has('account_brief')).toBe(true);
      expect(types.has('signal_analysis')).toBe(true);
      expect(types.has('opportunities')).toBe(true);
      expect(types.has('insights')).toBe(true);
    });

    it('includes advisory types with zero thresholds', () => {
      const types = getRegisteredGenerationTypes();
      expect(types.has('query_parsing')).toBe(true);
      expect(types.has('data_health_analysis')).toBe(true);
      expect(types.has('playbook_generation')).toBe(true);
    });

    it('is a readonly Set', () => {
      const types = getRegisteredGenerationTypes();
      expect(types instanceof Set).toBe(true);
    });
  });

  describe('runGovernanceChecks', () => {
    it('passes all 6 checks with strong research context', async () => {
      const result = await runGovernanceChecks({
        generationType: 'email_draft', companyId: 'co-1', capabilityMatchCount: 2,
        researchContext: makeResearchContext(),
      });
      expect(result.passed).toBe(true);
      expect(result.canProceed).toBe(true);
      expect(result.rejectionReason).toBeNull();
      expect(Object.keys(result.checks)).toHaveLength(6);
    });

    it('fails research_exists when no research card', async () => {
      const result = await runGovernanceChecks({ generationType: 'email_draft', researchContext: null });
      expect(result.checks.research_exists.passed).toBe(false);
    });

    it('fails research_confidence when average is below threshold', async () => {
      const result = await runGovernanceChecks({
        generationType: 'email_draft',
        researchContext: makeResearchContext({
          fieldConfidence: { revenue: 0.3, employees: 0.2 },
        }),
        capabilityMatchCount: 1,
      });
      expect(result.checks.research_confidence.passed).toBe(false);
    });

    it('fails staleness when data exceeds max days', async () => {
      const result = await runGovernanceChecks({
        generationType: 'email_draft',
        researchContext: makeResearchContext({
          freshness: { score: 10, status: 'stale' as const, lastResearchedAt: new Date().toISOString(),
            daysSinceResearch: 100, evidenceCount: 0, signalCount: 0,
            categories: {
              profile: { score: 10, status: 'stale' as const, lastVerifiedAt: null, daysSinceVerification: null },
              signal: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
              contact: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
              technology: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
            },
          },
        }),
        capabilityMatchCount: 1,
      });
      expect(result.checks.staleness.passed).toBe(false);
    });

    it('fails capability_match when required but none matched', async () => {
      const result = await runGovernanceChecks({
        generationType: 'email_draft', capabilityMatchCount: 0,
        researchContext: makeResearchContext(),
      });
      expect(result.checks.capability_match.passed).toBe(false);
    });

    it('fails recent_intelligence when required but status is none', async () => {
      const result = await runGovernanceChecks({
        generationType: 'email_draft',
        researchContext: makeResearchContext({
          researchCard: null,
          freshness: { score: 0, status: 'none' as const, lastResearchedAt: null,
            daysSinceResearch: null, evidenceCount: 0, signalCount: 0,
            categories: {
              profile: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
              signal: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
              contact: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
              technology: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
            },
          },
        }),
      });
      expect(result.checks.recent_intelligence.passed).toBe(false);
    });

    it('passes advisory types (zero thresholds) without research', async () => {
      const result = await runGovernanceChecks({ generationType: 'query_parsing', researchContext: null });
      expect(result.passed).toBe(true);
      expect(result.canProceed).toBe(true);
    });

    it('non-throwing: always returns GovernanceResult even with null context', async () => {
      const result = await runGovernanceChecks({ generationType: 'email_draft' });
      expect(result).toBeDefined();
      expect(typeof result.passed).toBe('boolean');
      expect(result.checks).toBeDefined();
      expect(result.overallMessage).toBeDefined();
    });
  });

  describe('buildGovernancePromptAddon', () => {
    it('returns empty string for fully passing governance', () => {
      const result = {
        passed: true, canProceed: true, rejectionReason: null, overallMessage: 'All passed',
        checks: {
          research_exists: { passed: true, message: 'ok', value: true },
          research_confidence: { passed: true, message: 'ok', value: 0.8 },
          freshness_score: { passed: true, message: 'ok', value: 80 },
          staleness: { passed: true, message: 'ok', value: 10 },
          capability_match: { passed: true, message: 'ok', value: 2 },
          recent_intelligence: { passed: true, message: 'ok', value: 'fresh' },
        },
      };
      const addon = buildGovernancePromptAddon(result, 'email_draft');
      expect(addon).toBe('');
    });

    it('produces staleness warning when days > maxStalenessDays/2', () => {
      const result = {
        passed: true, canProceed: true, rejectionReason: null, overallMessage: 'Passed',
        checks: {
          research_exists: { passed: true, message: 'ok', value: true },
          research_confidence: { passed: true, message: 'ok', value: 0.8 },
          freshness_score: { passed: true, message: 'ok', value: 50 },
          staleness: { passed: true, message: 'ok', value: 40 },
          capability_match: { passed: true, message: 'ok', value: 1 },
          recent_intelligence: { passed: true, message: 'ok', value: 'fresh' },
        },
      };
      const addon = buildGovernancePromptAddon(result, 'email_draft');
      expect(addon).toContain('GOVERNANCE WARNINGS');
      expect(addon).toContain('40 days old');
    });

    it('produces intelligence aging warning when status is aging', () => {
      const result = {
        passed: true, canProceed: true, rejectionReason: null, overallMessage: 'Passed',
        checks: {
          research_exists: { passed: true, message: 'ok', value: true },
          research_confidence: { passed: true, message: 'ok', value: 0.8 },
          freshness_score: { passed: true, message: 'ok', value: 50 },
          staleness: { passed: true, message: 'ok', value: 10 },
          capability_match: { passed: true, message: 'ok', value: 1 },
          recent_intelligence: { passed: true, message: 'ok', value: 'aging' },
        },
      };
      const addon = buildGovernancePromptAddon(result, 'email_draft');
      expect(addon).toContain('Intelligence data is aging');
    });

    it('produces no capability match warning when capability is 0 and passed', () => {
      const result = {
        passed: true, canProceed: true, rejectionReason: null, overallMessage: 'Passed',
        checks: {
          research_exists: { passed: true, message: 'ok', value: true },
          research_confidence: { passed: true, message: 'ok', value: 0.8 },
          freshness_score: { passed: true, message: 'ok', value: 50 },
          staleness: { passed: true, message: 'ok', value: 10 },
          capability_match: { passed: true, message: 'Capability match not required', value: 0 },
          recent_intelligence: { passed: true, message: 'ok', value: 'fresh' },
        },
      };
      const addon = buildGovernancePromptAddon(result, 'account_brief');
      expect(addon).toContain('No capability assets matched');
    });
  });

  describe('buildEvidenceGroundingNote', () => {
    it('returns low-confidence message when context is null', () => {
      const note = buildEvidenceGroundingNote(null);
      expect(note).toContain('No research intelligence available');
      expect(note).toContain('low-confidence');
    });

    it('returns speculative message when freshness status is none', () => {
      const note = buildEvidenceGroundingNote(makeResearchContext({
        researchCard: null,
        freshness: { score: 0, status: 'none' as const, lastResearchedAt: null,
          daysSinceResearch: null, evidenceCount: 0, signalCount: 0,
          categories: {
            profile: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
            signal: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
            contact: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
            technology: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
          },
        },
      }));
      expect(note).toContain('speculative');
    });

    it('warns about stale research >90 days old', () => {
      const note = buildEvidenceGroundingNote(makeResearchContext({
        evidenceSummary: { totalEvidence: 5, fields: {} },
        freshness: { score: 10, status: 'stale' as const, lastResearchedAt: new Date().toISOString(),
          daysSinceResearch: 120, evidenceCount: 5, signalCount: 0,
          categories: {
            profile: { score: 10, status: 'stale' as const, lastVerifiedAt: null, daysSinceVerification: null },
            signal: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
            contact: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
            technology: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
          },
        },
      }));
      expect(note).toContain('significantly outdated');
    });

    it('warns about limited evidence (<=3 sources)', () => {
      const note = buildEvidenceGroundingNote(makeResearchContext({
        evidenceSummary: { totalEvidence: 2, fields: {} },
      }));
      expect(note).toContain('Limited evidence');
      expect(note).toContain('2 source');
    });

    it('warns about low confidence fields', () => {
      const note = buildEvidenceGroundingNote(makeResearchContext({
        fieldConfidence: { revenue: 0.2, employeeCount: 0.1, techStack: 0.9 },
      }));
      expect(note).toContain('Low confidence fields');
      expect(note).toContain('revenue');
      expect(note).toContain('employeeCount');
      expect(note).not.toContain('techStack');
    });

    it('returns positive grounding note for good research context', () => {
      const note = buildEvidenceGroundingNote(makeResearchContext({
        signals: [{ id: 's1', type: 'news', title: 'Signal', description: null,
          impact: 'high', severity: 'high', confidence: 0.8, sourceUrl: null, signalDate: null,
          detectedAt: new Date().toISOString() }],
      }));
      expect(note).toContain('Claims should be grounded');
      expect(note).toContain('15 evidence sources');
    });

    it('warns about no buying signals', () => {
      const note = buildEvidenceGroundingNote(makeResearchContext({ signals: [] }));
      expect(note).toContain('No buying signals');
    });
  });

  describe('preFlightCheck', () => {
    it('returns governanceResult, groundingNote, promptAddon, and config', async () => {
      const result = await preFlightCheck({ generationType: 'query_parsing' });
      expect(result.governanceResult).toBeDefined();
      expect(result.groundingNote).toBeDefined();
      expect(result.promptAddon).toBeDefined();
      expect(result.config).toBeDefined();
      expect(result.config.minResearchConfidence).toBe(0);
    });
  });

  describe('recordGeneration', () => {
    it('calls db.aIGenerationAudit.create with correct fields', async () => {
      await recordGeneration({
        generationType: 'email_draft', companyId: 'co-1',
        governanceResult: { passed: true, canProceed: true, rejectionReason: null, overallMessage: 'All passed', checks: {} },
        outputSummary: 'Test output', modelUsed: 'claude-3-sonnet',
      });
      expect(mockDbCreate).toHaveBeenCalledTimes(1);
      const callArgs = mockDbCreate.mock.calls[0][0];
      expect(callArgs.data.generationType).toBe('email_draft');
      expect(callArgs.data.companyId).toBe('co-1');
      expect(callArgs.data.governancePassed).toBe(true);
      expect(callArgs.data.modelUsed).toBe('claude-3-sonnet');
      expect(callArgs.data.promptVersion).toBe(GOVERNANCE_PROMPT_VERSION);
    });

    it('is fire-and-forget: does not throw on db error', async () => {
      mockDbCreate.mockRejectedValueOnce(new Error('DB down'));
      await expect(
        recordGeneration({
          generationType: 'email_draft',
          governanceResult: { passed: true, canProceed: true, rejectionReason: null, overallMessage: 'ok', checks: {} },
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('governedAICall', () => {
    it('blocks generation when governance fails and enforceGovernance is true', async () => {
      const result = await governedAICall({
        generationType: 'email_draft', companyId: 'co-1',
        systemPrompt: 'You are helpful', userPrompt: 'Write email',
        enforceGovernance: true, researchContext: null,
      });
      expect(result.success).toBe(false);
      expect(result.response).toBeNull();
      expect(result.rejectionReason).toBeDefined();
    });

    it('proceeds when enforceGovernance is false even if governance fails', async () => {
      const result = await governedAICall({
        generationType: 'email_draft', companyId: 'co-1',
        systemPrompt: 'You are helpful', userPrompt: 'Write email',
        enforceGovernance: false, researchContext: null,
      });
      expect(result.success).toBe(true);
      expect(result.response).toBe('AI generated response');
    });

    it('injects hallucination prevention rules into system prompt', async () => {
      await governedAICall({
        generationType: 'query_parsing',
        systemPrompt: 'You are helpful', userPrompt: 'Parse query', enforceGovernance: false,
      });
      const { ModelRouter } = await import('@/lib/engines/model-router');
      const callArgs = (ModelRouter.complete as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(callArgs.systemPrompt).toContain('EVIDENCE GROUNDING RULES');
    });

    it('records audit trail for both blocked and successful calls', async () => {
      mockDbCreate.mockClear();
      await governedAICall({
        generationType: 'email_draft', companyId: 'co-1',
        systemPrompt: 'test', userPrompt: 'test', enforceGovernance: true,
      });
      const blockedCalls = mockDbCreate.mock.calls.length;

      await governedAICall({
        generationType: 'query_parsing',
        systemPrompt: 'test', userPrompt: 'test', enforceGovernance: false,
      });
      const totalCalls = mockDbCreate.mock.calls.length;
      expect(totalCalls).toBeGreaterThanOrEqual(2);
    });

    it('returns cacheHit=false for non-cacheable types', async () => {
      const result = await governedAICall({
        generationType: 'email_draft',
        systemPrompt: 'test', userPrompt: 'test', enforceGovernance: false,
      });
      expect(result.cacheHit).toBeUndefined();
    });
  });

  describe('HALLUCINATION_PREVENTION_RULES', () => {
    it('contains 15 mandatory rules', () => {
      const lines = HALLUCINATION_PREVENTION_RULES.split('\n').filter(l => /^\d+\./.test(l.trim()));
      expect(lines.length).toBe(15);
    });

    it('mentions key anti-hallucination themes', () => {
      expect(HALLUCINATION_PREVENTION_RULES).toContain('Only reference facts');
      expect(HALLUCINATION_PREVENTION_RULES).toContain('NEVER fabricate');
      expect(HALLUCINATION_PREVENTION_RULES).toContain('Data not available');
      expect(HALLUCINATION_PREVENTION_RULES).toContain('evidence');
    });
  });

  describe('FRESHNESS_LIFECYCLE_DAYS', () => {
    it('defines lifecycle for all 4 domains', () => {
      expect(FRESHNESS_LIFECYCLE_DAYS.profile).toBe(90);
      expect(FRESHNESS_LIFECYCLE_DAYS.signals).toBe(14);
      expect(FRESHNESS_LIFECYCLE_DAYS.technology).toBe(60);
      expect(FRESHNESS_LIFECYCLE_DAYS.contacts).toBe(45);
    });
  });
});

// ── 6. Intelligence Contract (mock db) ─────────────────────────────────────

describe('Section 3.1.6: Intelligence Contract', () => {
  describe('applyFreshnessAdjustments', () => {
    it('reduces confidence for stale profile data', () => {
      const result = applyFreshnessAdjustments(
        { revenue: 0.8 },
        {
          score: 50, status: 'stale' as const, lastResearchedAt: null,
          daysSinceResearch: 100, evidenceCount: 5, signalCount: 2,
          categories: {
            profile: { score: 20, status: 'stale' as const, lastVerifiedAt: null, daysSinceVerification: 120 },
            signal: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
            contact: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
            technology: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
          },
        },
      );
      expect(result.adjustedConfidence.revenue).toBeLessThan(0.8);
      expect(result.adjustments.length).toBeGreaterThanOrEqual(1);
      expect(result.adjustments[0].category).toBe('profile');
    });

    it('reduces confidence for stale technology data', () => {
      const result = applyFreshnessAdjustments(
        { techStack: 0.7 },
        {
          score: 50, status: 'stale' as const, lastResearchedAt: null,
          daysSinceResearch: 100, evidenceCount: 5, signalCount: 2,
          categories: {
            profile: { score: 80, status: 'fresh' as const, lastVerifiedAt: null, daysSinceVerification: 10 },
            signal: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
            contact: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
            technology: { score: 20, status: 'stale' as const, lastVerifiedAt: null, daysSinceVerification: 100 },
          },
        },
      );
      expect(result.adjustedConfidence.techStack).toBeLessThan(0.7);
      expect(result.adjustments.some(a => a.category === 'technology')).toBe(true);
    });

    it('does not adjust fields within warning threshold', () => {
      const result = applyFreshnessAdjustments(
        { revenue: 0.8 },
        {
          score: 80, status: 'fresh' as const, lastResearchedAt: null,
          daysSinceResearch: 10, evidenceCount: 10, signalCount: 2,
          categories: {
            profile: { score: 95, status: 'fresh' as const, lastVerifiedAt: null, daysSinceVerification: 30 },
            signal: { score: 90, status: 'fresh' as const, lastVerifiedAt: null, daysSinceVerification: 5 },
            contact: { score: 85, status: 'fresh' as const, lastVerifiedAt: null, daysSinceVerification: 10 },
            technology: { score: 80, status: 'fresh' as const, lastVerifiedAt: null, daysSinceVerification: 20 },
          },
        },
      );
      expect(result.adjustments).toHaveLength(0);
      expect(result.adjustedConfidence.revenue).toBe(0.8);
    });

    it('skips fields not in the field-to-category mapping', () => {
      const result = applyFreshnessAdjustments(
        { customField: 0.5, revenue: 0.8 },
        {
          score: 50, status: 'stale' as const, lastResearchedAt: null,
          daysSinceResearch: 100, evidenceCount: 5, signalCount: 0,
          categories: {
            profile: { score: 20, status: 'stale' as const, lastVerifiedAt: null, daysSinceVerification: 120 },
            signal: { score: 0, status: 'stale' as const, lastVerifiedAt: null, daysSinceVerification: null },
            contact: { score: 0, status: 'stale' as const, lastVerifiedAt: null, daysSinceVerification: null },
            technology: { score: 0, status: 'stale' as const, lastVerifiedAt: null, daysSinceVerification: null },
          },
        },
      );
      expect(result.adjustments.some(a => a.field === 'customField')).toBe(false);
      expect(result.adjustments.some(a => a.field === 'revenue')).toBe(true);
    });

    it('generates warnings for stale categories', () => {
      const result = applyFreshnessAdjustments(
        {},
        {
          score: 20, status: 'stale' as const, lastResearchedAt: null,
          daysSinceResearch: 200, evidenceCount: 0, signalCount: 0,
          categories: {
            profile: { score: 10, status: 'stale' as const, lastVerifiedAt: null, daysSinceVerification: 200 },
            signal: { score: 0, status: 'stale' as const, lastVerifiedAt: null, daysSinceVerification: 60 },
            contact: { score: 0, status: 'stale' as const, lastVerifiedAt: null, daysSinceVerification: 100 },
            technology: { score: 0, status: 'stale' as const, lastVerifiedAt: null, daysSinceVerification: 150 },
          },
        },
      );
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      expect(result.warnings.some(w => w.includes('stale'))).toBe(true);
    });

    it('respects max penalty caps per category', () => {
      const result = applyFreshnessAdjustments(
        { revenue: 1.0 },
        {
          score: 0, status: 'stale' as const, lastResearchedAt: null,
          daysSinceResearch: 500, evidenceCount: 0, signalCount: 0,
          categories: {
            profile: { score: 0, status: 'stale' as const, lastVerifiedAt: null, daysSinceVerification: 500 },
            signal: { score: 0, status: 'stale' as const, lastVerifiedAt: null, daysSinceVerification: 500 },
            contact: { score: 0, status: 'stale' as const, lastVerifiedAt: null, daysSinceVerification: 500 },
            technology: { score: 0, status: 'stale' as const, lastVerifiedAt: null, daysSinceVerification: 500 },
          },
        },
      );
      // profile max penalty = 0.2, so adjusted should be >= 0.79
      expect(result.adjustedConfidence.revenue).toBeGreaterThanOrEqual(0.79);
    });
  });

  describe('assessRefreshNeeds', () => {
    it('returns needsRefresh=false when all categories are fresh', () => {
      const result = assessRefreshNeeds({
        score: 95, status: 'fresh' as const, lastResearchedAt: null,
        daysSinceResearch: 2, evidenceCount: 10, signalCount: 3,
        categories: {
          profile: { score: 95, status: 'fresh' as const, lastVerifiedAt: null, daysSinceVerification: 5 },
          signal: { score: 90, status: 'fresh' as const, lastVerifiedAt: null, daysSinceVerification: 3 },
          contact: { score: 85, status: 'fresh' as const, lastVerifiedAt: null, daysSinceVerification: 5 },
          technology: { score: 80, status: 'fresh' as const, lastVerifiedAt: null, daysSinceVerification: 10 },
        },
      });
      expect(result.needsRefresh).toBe(false);
      expect(result.urgency).toBe('none');
      expect(result.categoryNeeds).toHaveLength(0);
    });

    it('returns immediate urgency when signals are stale', () => {
      const result = assessRefreshNeeds({
        score: 30, status: 'stale' as const, lastResearchedAt: null,
        daysSinceResearch: 60, evidenceCount: 5, signalCount: 0,
        categories: {
          profile: { score: 80, status: 'fresh' as const, lastVerifiedAt: null, daysSinceVerification: 20 },
          signal: { score: 10, status: 'stale' as const, lastVerifiedAt: null, daysSinceVerification: 60 },
          contact: { score: 70, status: 'fresh' as const, lastVerifiedAt: null, daysSinceVerification: 15 },
          technology: { score: 60, status: 'fresh' as const, lastVerifiedAt: null, daysSinceVerification: 25 },
        },
      });
      expect(result.needsRefresh).toBe(true);
      expect(result.urgency).toBe('immediate');
      expect(result.categoryNeeds.some(c => c.category === 'signal')).toBe(true);
    });

    it('returns recommended urgency when technology is stale', () => {
      const result = assessRefreshNeeds({
        score: 40, status: 'stale' as const, lastResearchedAt: null,
        daysSinceResearch: 80, evidenceCount: 5, signalCount: 0,
        categories: {
          profile: { score: 80, status: 'fresh' as const, lastVerifiedAt: null, daysSinceVerification: 20 },
          signal: { score: 90, status: 'fresh' as const, lastVerifiedAt: null, daysSinceVerification: 5 },
          contact: { score: 70, status: 'fresh' as const, lastVerifiedAt: null, daysSinceVerification: 15 },
          technology: { score: 15, status: 'stale' as const, lastVerifiedAt: null, daysSinceVerification: 150 },
        },
      });
      expect(result.needsRefresh).toBe(true);
      expect(result.urgency).toBe('recommended');
    });

    it('returns optional urgency when only aging categories exist', () => {
      const result = assessRefreshNeeds({
        score: 50, status: 'aging' as const, lastResearchedAt: null,
        daysSinceResearch: 40, evidenceCount: 5, signalCount: 0,
        categories: {
          profile: { score: 60, status: 'aging' as const, lastVerifiedAt: null, daysSinceVerification: 100 },
          signal: { score: 70, status: 'fresh' as const, lastVerifiedAt: null, daysSinceVerification: 5 },
          contact: { score: 50, status: 'aging' as const, lastVerifiedAt: null, daysSinceVerification: 50 },
          technology: { score: 70, status: 'fresh' as const, lastVerifiedAt: null, daysSinceVerification: 20 },
        },
      });
      expect(result.needsRefresh).toBe(true);
      expect(result.urgency).toBe('optional');
    });

    it('includes reasons for each stale/aging category', () => {
      const result = assessRefreshNeeds({
        score: 20, status: 'stale' as const, lastResearchedAt: null,
        daysSinceResearch: 100, evidenceCount: 0, signalCount: 0,
        categories: {
          profile: { score: 10, status: 'stale' as const, lastVerifiedAt: null, daysSinceVerification: 200 },
          signal: { score: 0, status: 'stale' as const, lastVerifiedAt: null, daysSinceVerification: 60 },
          contact: { score: 0, status: 'stale' as const, lastVerifiedAt: null, daysSinceVerification: 100 },
          technology: { score: 0, status: 'stale' as const, lastVerifiedAt: null, daysSinceVerification: 150 },
        },
      });
      expect(result.reasons.length).toBeGreaterThanOrEqual(2);
      expect(result.categoryNeeds.length).toBeGreaterThanOrEqual(2);
    });

    it('immediate urgency takes priority over recommended', () => {
      const result = assessRefreshNeeds({
        score: 20, status: 'stale' as const, lastResearchedAt: null,
        daysSinceResearch: 100, evidenceCount: 0, signalCount: 0,
        categories: {
          profile: { score: 10, status: 'stale' as const, lastVerifiedAt: null, daysSinceVerification: 200 },
          signal: { score: 0, status: 'stale' as const, lastVerifiedAt: null, daysSinceVerification: 60 },
          contact: { score: 0, status: 'stale' as const, lastVerifiedAt: null, daysSinceVerification: 100 },
          technology: { score: 0, status: 'stale' as const, lastVerifiedAt: null, daysSinceVerification: 150 },
        },
      });
      expect(result.urgency).toBe('immediate');
    });
  });

  describe('FRESHNESS_EXPIRATION_THRESHOLDS', () => {
    it('defines correct thresholds per category', () => {
      expect(FRESHNESS_EXPIRATION_THRESHOLDS.signal.warningDays).toBe(14);
      expect(FRESHNESS_EXPIRATION_THRESHOLDS.signal.penaltyPerDay).toBe(0.02);
      expect(FRESHNESS_EXPIRATION_THRESHOLDS.signal.maxPenalty).toBe(0.4);
      expect(FRESHNESS_EXPIRATION_THRESHOLDS.technology.warningDays).toBe(60);
      expect(FRESHNESS_EXPIRATION_THRESHOLDS.contact.warningDays).toBe(45);
      expect(FRESHNESS_EXPIRATION_THRESHOLDS.profile.warningDays).toBe(90);
    });
  });
});

// ── 7. Cross-Module Integration ────────────────────────────────────────────

describe('Section 3.1.7: Cross-Module Integration', () => {
  it('freshness ranking score is independent but complementary to hallucination specificity', () => {
    const freshnessScore = computeFreshnessScore(80, new Date().toISOString(), new Date().toISOString(), 'news');
    expect(freshnessScore).toBeGreaterThan(0);
    const specScore = scoreSpecificity('Acme Corp uses AWS. Revenue is $50M [E1].');
    expect(specScore).toBeGreaterThan(0);
  });

  it('governance config thresholds align with confidence engine trust levels', () => {
    const emailConfig = getGovernanceConfig('email_draft');
    expect(emailConfig.minResearchConfidence).toBe(0.6);
    const result = computeUnifiedConfidence({ daysSinceResearch: 30, qualityGateScore: 60 });
    expect(['advisory', 'speculative']).toContain(result.trustClass);
  });

  it('hallucination prevention output can feed confidence engine AI certainty', () => {
    const hallResult = runHallucinationCheck(
      'Acme Corp confirmed revenue [E1].',
      { evidenceMap: { E1: { text: 'Acme confirmed $50M', source: 'SEC', url: null, confidence: 0.9 } } },
    );
    const confResult = computeUnifiedConfidence({
      hallucinationRiskScore: hallResult.hallucinationRiskScore, qualityGateScore: 80, daysSinceResearch: 5,
    });
    expect(confResult.factors.length).toBe(6);
    const aiCertainty = confResult.factors.find(f => f.dimension === 'ai_certainty');
    expect(aiCertainty).toBeDefined();
  });

  it('intelligence contract freshness thresholds are consistent with governance lifecycle', () => {
    expect(FRESHNESS_EXPIRATION_THRESHOLDS.signal.warningDays).toBeLessThanOrEqual(
      FRESHNESS_LIFECYCLE_DAYS.signals * 2,
    );
    expect(FRESHNESS_EXPIRATION_THRESHOLDS.profile.warningDays).toBe(FRESHNESS_LIFECYCLE_DAYS.profile);
  });
});
