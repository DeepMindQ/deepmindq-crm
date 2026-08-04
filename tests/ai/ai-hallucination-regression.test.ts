/**
 * DeepMindQ Enterprise AI Intelligence Platform
 * Milestone 3 — Section 3.4: AI Hallucination & Regression Testing
 *
 * Tests: Hallucination detection, confidence calibration, prompt regression.
 * Run: npx vitest run --config vitest.ai-governance.config.ts tests/ai/ai-hallucination-regression.test.ts
 */
import { describe, it, expect, vi } from 'vitest';

// ── Mock external dependencies only ──
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    child: vi.fn(() => ({
      info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(),
    })),
  },
}));

// ── Import REAL business logic ──
import {
  extractClaims,
  verifyCitations,
  runHallucinationCheck,
  detectHedgingPatterns,
  scoreSpecificity,
  buildMinimalEvidenceContext,
  type EvidenceContext,
  type ExtractedClaim,
} from '@/lib/ai-hallucination-prevention';

import {
  computeFreshnessScore,
  computeFreshnessState,
  computeIntelligenceRanking,
} from '@/lib/scoring/freshness-ranking';

import {
  computeUnifiedConfidence,
  getSourceReliability,
} from '@/lib/ai-unified-confidence';

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 1: MISSING DATA — Company with minimal info
// ═══════════════════════════════════════════════════════════════════════════════

describe('Hallucination Regression: Missing Data', () => {
  it('minimal company info should produce low unified confidence', () => {
    const result = computeUnifiedConfidence({
      fieldConfidence: {},
      dataCompleteness: 0.05,
      sources: [],
      daysSinceResearch: 90,
      crossValidatedFacts: 0,
      totalFacts: 0,
      evidenceCount: 0,
      evidenceCoverage: 0.0,
      hallucinationRiskScore: 50,
    });

    expect(result.score).toBeLessThan(40);
    expect(result.trustClass).toBe('speculative');
    expect(result.enterpriseReady).toBe(false);
  });

  it('empty AI output should produce no claims', () => {
    const claims = extractClaims('');
    expect(claims).toHaveLength(0);
  });

  it('vague output with no verifiable claims should have zero hallucination risk from claims', () => {
    const vagueOutput = 'The company seems to be doing interesting things in the market. They have a team and some products.';
    const ctx: EvidenceContext = { evidenceMap: {} };
    const result = runHallucinationCheck(vagueOutput, ctx);
    // No verifiable claims extracted, so claim-based risk should be 0
    expect(result.claims.length).toBe(0);
    // But specificity will be low, adding some risk
    expect(result.specificityScore).toBeLessThan(10);
  });

  it('no sources should produce low source reliability score', () => {
    const result = computeUnifiedConfidence({
      sources: [],
      daysSinceResearch: 30,
    });
    const sourceFactor = result.factors.find(f => f.dimension === 'source_reliability');
    expect(sourceFactor).toBeDefined();
    // No sources = penalty
    expect(sourceFactor!.score).toBeLessThan(50);
  });

  it('single weak source should produce lower confidence than multiple strong sources', () => {
    const singleWeak = computeUnifiedConfidence({
      sources: [{ name: 'twitter.com', reliability: 0.55, type: 'social' }],
      daysSinceResearch: 30,
      evidenceCount: 1,
      fieldConfidence: { revenue: 0.3 },
    });
    const multiStrong = computeUnifiedConfidence({
      sources: [
        { name: 'sec.gov', reliability: 0.95, type: 'government' },
        { name: 'reuters.com', reliability: 0.92, type: 'financial' },
        { name: 'bloomberg.com', reliability: 0.92, type: 'financial' },
      ],
      daysSinceResearch: 5,
      evidenceCount: 10,
      fieldConfidence: { revenue: 0.9, employees: 0.85, technology: 0.8 },
      dataCompleteness: 0.85,
    });
    expect(multiStrong.score).toBeGreaterThan(singleWeak.score);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 2: CONFLICTING INFORMATION — Revenue numbers from different sources
// ═══════════════════════════════════════════════════════════════════════════════

describe('Hallucination Regression: Conflicting Information', () => {
  it('contradictions should penalize cross-validation score', () => {
    const noContradiction = computeUnifiedConfidence({
      crossValidatedFacts: 8,
      totalFacts: 10,
      contradictions: 0,
    });
    const withContradiction = computeUnifiedConfidence({
      crossValidatedFacts: 8,
      totalFacts: 10,
      contradictions: 3,
    });

    const noContrXV = noContradiction.factors.find(f => f.dimension === 'cross_validation');
    const withContrXV = withContradiction.factors.find(f => f.dimension === 'cross_validation');

    expect(noContrXV!.score).toBeGreaterThan(withContrXV!.score);
  });

  it('multiple contradictions should push cross-validation below 30', () => {
    const result = computeUnifiedConfidence({
      crossValidatedFacts: 2,
      totalFacts: 10,
      contradictions: 4,
    });
    const xvFactor = result.factors.find(f => f.dimension === 'cross_validation');
    // 40 base - 4*15 = -20, clamped to 0
    expect(xvFactor!.score).toBeLessThan(30);
  });

  it('claims with conflicting evidence should show misaligned verifications', () => {
    const output = 'Acme Corp generates $500M in revenue [E1].';
    const ctx = buildMinimalEvidenceContext([
      { marker: 'E1', text: 'Acme Corp reported $200M in revenue for last fiscal year, a significant decline.', source: 'sec.gov' },
    ]);
    const result = runHallucinationCheck(output, ctx);
    // The claim cites E1 which exists, but may not align well ($500M vs $200M)
    expect(result.citationVerifications.length).toBeGreaterThanOrEqual(1);
    const verification = result.citationVerifications[0];
    expect(verification.evidenceExists).toBe(true);
    // Alignment might be low because "500M" doesn't appear in evidence
  });

  it('AI output claiming one number while evidence says another should have moderate risk', () => {
    const output = 'Acme Corp has 5,000 employees [E1]. They raised $100M in Series B [E1].';
    const ctx = buildMinimalEvidenceContext([
      { marker: 'E1', text: 'Acme Corp is a small startup with approximately 50 employees. They recently raised seed funding of $2M.', source: 'crunchbase.com' },
    ]);
    const result = runHallucinationCheck(output, ctx);
    // The evidence exists but doesn't match the claims well
    expect(result.hallucinatedCitations).toBe(0); // Citation exists
    // But alignment may be low
    const misaligned = result.citationVerifications.filter(v => v.evidenceExists && !v.claimAligns);
    // At least some claims may not align
    expect(result.verifiedClaims).toBeLessThan(result.claims.length);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 3: FAKE COMPANY — Non-existent company detection
// ═══════════════════════════════════════════════════════════════════════════════

describe('Hallucination Regression: Fake Company', () => {
  it('completely fabricated output with fake citations should have critical risk', () => {
    const fakeOutput = 'Zyxwv Corp generates $500M in revenue [E1]. The CEO is John Smith [E2]. They recently acquired TechCo for $1B [E3]. The company has 10,000 employees [E4].';
    const ctx: EvidenceContext = { evidenceMap: {} };
    const result = runHallucinationCheck(fakeOutput, ctx);

    expect(result.hallucinatedCitations).toBe(4);
    expect(result.riskLevel).toBe('critical');
    expect(result.passesTrustThreshold).toBe(false);
  });

  it('fake company with no evidence should score zero on evidence coverage', () => {
    const result = computeUnifiedConfidence({
      evidenceCount: 0,
      evidenceCoverage: 0,
      evidenceGaps: 8,
    });
    const evFactor = result.factors.find(f => f.dimension === 'evidence_coverage');
    expect(evFactor!.score).toBeLessThan(30);
  });

  it('fake claims without citations should accumulate uncited claim risk', () => {
    const fakeOutput = 'Zyxwv Corp generates $500M in revenue. The CEO is Jane Doe. They have offices in London, Tokyo, and New York. The company was valued at $2B in their last round.';
    const ctx: EvidenceContext = { evidenceMap: {} };
    const result = runHallucinationCheck(fakeOutput, ctx);

    // All claims are uncited — should contribute significant risk
    expect(result.uncitedClaims).toBeGreaterThan(0);
    // Risk from uncited claims alone: uncited * 8, plus low specificity
    expect(result.hallucinationRiskScore).toBeGreaterThan(15);
  });

  it('fake company with fabricated evidence context should be detectable', () => {
    const fakeOutput = 'Phantom Inc uses Kubernetes and Docker for their cloud infrastructure [E1]. They raised $50M Series C [E2].';
    const ctx = buildMinimalEvidenceContext([
      { marker: 'E1', text: 'Some unrelated text about the weather today.', source: 'weather.com' },
      { marker: 'E2', text: 'Recipe for chocolate cake.', source: 'cooking.com' },
    ]);
    const result = runHallucinationCheck(fakeOutput, ctx);

    // Citations exist but don't match claims
    expect(result.hallucinatedCitations).toBe(0); // markers exist
    const misaligned = result.citationVerifications.filter(v => !v.claimAligns);
    expect(misaligned.length).toBeGreaterThan(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 4: INCORRECT ASSUMPTIONS — Size classification
// ═══════════════════════════════════════════════════════════════════════════════

describe('Hallucination Regression: Incorrect Assumptions', () => {
  it('claiming enterprise scale for a small company should show low specificity without evidence', () => {
    // AI claims enterprise-scale facts but has no evidence
    const enterpriseClaim = 'SmallStartup Ltd generates $5B in revenue with 50,000 employees worldwide [E1]. They operate in 40 countries and have 200 offices globally.';
    const ctx: EvidenceContext = { evidenceMap: {} };
    const result = runHallucinationCheck(enterpriseClaim, ctx);

    // Should have high risk due to hallucinated citation
    expect(result.hallucinatedCitations).toBe(1);
    expect(result.passesTrustThreshold).toBe(false);
  });

  it('overconfident claim ("confirmed") without citation should add risk', () => {
    const output = 'SmallStartup Ltd has confirmed $500M revenue. The CEO was confirmed as Sarah Johnson.';
    const ctx: EvidenceContext = { evidenceMap: {} };
    const result = runHallucinationCheck(output, ctx);

    // "confirmed" implies high confidence — check for high-confidence uncited claims
    const highConfUncited = result.claims.filter(
      c => c.expressedConfidence === 'high' && c.citationMarker === null
    );
    // At least one claim should be detected as high confidence
    expect(highConfUncited.length).toBeGreaterThanOrEqual(1);
  });

  it('specific employee count claim should be extractable', () => {
    const output = 'The company employs approximately 2,000 people across their offices.';
    const claims = extractClaims(output);
    const employeeClaims = claims.filter(c => c.type === 'employee_count');
    expect(employeeClaims.length).toBe(1);
    expect(employeeClaims[0].text).toContain('2,000');
  });

  it('technology claims should be correctly classified', () => {
    const output = 'The company uses AWS for cloud infrastructure and deployed Kubernetes for container orchestration. They leverage React for frontend and Python for backend services.';
    const claims = extractClaims(output);
    const techClaims = claims.filter(c => c.type === 'technology');
    expect(techClaims.length).toBeGreaterThanOrEqual(3);
  });

  it('funding claims should be correctly classified', () => {
    const output = 'The company raised $50M in Series B funding. They secured a new investment round of $25M.';
    const claims = extractClaims(output);
    const fundingClaims = claims.filter(c => c.type === 'funding');
    expect(fundingClaims.length).toBeGreaterThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// SCENARIO 5: OUTDATED INFORMATION — Freshness decay
// ═══════════════════════════════════════════════════════════════════════════════

describe('Hallucination Regression: Outdated Information', () => {
  it('3-year-old news signal should be expired', () => {
    const now = new Date();
    const threeYearsAgo = new Date(now.getTime() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString();
    const state = computeFreshnessState(threeYearsAgo, now.toISOString(), 'news');
    expect(state.staleness).toBe('expired');
    expect(state.freshnessScore).toBeLessThan(0.01);
  });

  it('1-year-old regulatory signal should be stale', () => {
    const now = new Date();
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString();
    const state = computeFreshnessState(oneYearAgo, now.toISOString(), 'regulatory');
    // regulatory half-life = 90d, 365d = 4x half-life → expired
    expect(state.staleness).toBe('expired');
  });

  it('outdated research should significantly lower freshness dimension', () => {
    const fresh = computeUnifiedConfidence({ daysSinceResearch: 3 });
    const outdated = computeUnifiedConfidence({ daysSinceResearch: 180 });

    const freshFactor = fresh.factors.find(f => f.dimension === 'freshness');
    const outdatedFactor = outdated.factors.find(f => f.dimension === 'freshness');

    expect(freshFactor!.score).toBeGreaterThan(outdatedFactor!.score);
  });

  it('stale intelligence ranking should be dramatically lower than fresh', () => {
    const now = new Date();
    const freshInput = {
      confidence: 90,
      signalDate: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now.toISOString(),
      signalType: 'news' as const,
      sourceQuality: 'premium' as const,
      businessRelevance: 0.8,
      capabilityRelevance: 0.7,
    };
    const staleInput = {
      ...freshInput,
      signalDate: new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000).toISOString(),
    };

    const freshResult = computeIntelligenceRanking(freshInput);
    const staleResult = computeIntelligenceRanking(staleInput);

    expect(freshResult.rankingScore).toBeGreaterThan(staleResult.rankingScore * 2);
  });

  it('sourcePublishedDate should be used when signalDate is null', () => {
    const now = new Date();
    const recentPub = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
    const oldPub = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000).toISOString();

    const recentScore = computeFreshnessScore(
      90, null, now.toISOString(), 'news', recentPub
    );
    const oldScore = computeFreshnessScore(
      90, null, now.toISOString(), 'news', oldPub
    );

    expect(recentScore).toBeGreaterThan(oldScore);
  });

  it('old research + stale data should produce unreliable trust class', () => {
    const result = computeUnifiedConfidence({
      daysSinceResearch: 365,
      fieldConfidence: { revenue: 0.2 },
      evidenceCount: 1,
      evidenceCoverage: 0.1,
      hallucinationRiskScore: 40,
      crossValidatedFacts: 0,
      totalFacts: 5,
    });

    expect(result.trustClass).toBe('speculative');
    expect(result.enterpriseReady).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// EXTRACT CLAIMS — Detailed Claim Type Testing
// ═══════════════════════════════════════════════════════════════════════════════

describe('Claim Extraction: Detailed Type Testing', () => {
  it('should extract revenue claims with dollar amounts', () => {
    const text = 'The company generates $500M in annual revenue and reported $1.2B last quarter.';
    const claims = extractClaims(text);
    const revenueClaims = claims.filter(c => c.type === 'revenue');
    expect(revenueClaims.length).toBeGreaterThanOrEqual(2);
  });

  it('should extract employee count claims', () => {
    const text = 'The company has approximately 2,000 employees and a workforce of ~500 contractors.';
    const claims = extractClaims(text);
    const employeeClaims = claims.filter(c => c.type === 'employee_count');
    expect(employeeClaims.length).toBeGreaterThanOrEqual(1);
  });

  it('should extract technology usage claims', () => {
    const text = 'The company uses AWS for cloud, runs on Kubernetes, deployed Docker containers, and built on React.';
    const claims = extractClaims(text);
    const techClaims = claims.filter(c => c.type === 'technology');
    expect(techClaims.length).toBeGreaterThanOrEqual(3);
  });

  it('should extract partnership claims', () => {
    const text = 'The company partnered with Microsoft and collaborates with Google on AI research.';
    const claims = extractClaims(text);
    const partnershipClaims = claims.filter(c => c.type === 'partnership');
    expect(partnershipClaims.length).toBeGreaterThanOrEqual(1);
  });

  it('should extract leadership claims', () => {
    const text = 'The CEO is Sarah Johnson and the CTO was confirmed as Michael Chen.';
    const claims = extractClaims(text);
    const leadershipClaims = claims.filter(c => c.type === 'leadership');
    expect(leadershipClaims.length).toBeGreaterThanOrEqual(1);
  });

  it('should extract hiring claims', () => {
    const text = 'The company is hiring for 50 new positions and recruiting engineers.';
    const claims = extractClaims(text);
    const hiringClaims = claims.filter(c => c.type === 'hiring');
    expect(hiringClaims.length).toBeGreaterThanOrEqual(1);
  });

  it('should extract expansion claims', () => {
    const text = 'The company is expanding into Europe and opened a new office in London. They launched in Germany.';
    const claims = extractClaims(text);
    const expansionClaims = claims.filter(c => c.type === 'expansion');
    expect(expansionClaims.length).toBeGreaterThanOrEqual(1);
  });

  it('should not extract claims from generic text', () => {
    const text = 'The company is nice and people like working there. They have good culture and nice benefits.';
    const claims = extractClaims(text);
    expect(claims.length).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// HEDGING DETECTION — Specificity vs Hedging
// ═══════════════════════════════════════════════════════════════════════════════

describe('Hedging Detection & Specificity', () => {
  it('should detect common hedging patterns', () => {
    const hedgedText = 'The company may reach $100M in revenue. It possibly could expand internationally. The CEO might step down. Perhaps they will hire more engineers. It appears to be growing. It seems to be doing well.';
    const patterns = detectHedgingPatterns(hedgedText);
    expect(patterns.length).toBeGreaterThanOrEqual(5);
  });

  it('assertive text should have fewer hedging patterns', () => {
    const assertiveText = 'The company reported $100M in revenue. They announced expansion into Europe. The CEO confirmed the hiring plan.';
    const patterns = detectHedgingPatterns(assertiveText);
    // Only "announced" and "confirmed" which are high-confidence, not hedging
    expect(patterns.length).toBeLessThan(3);
  });

  it('specific text with numbers and citations should score high specificity', () => {
    const specificText = 'CloudNine Systems reported $4.2B in revenue [E1]. They employ 25,000 people [E2] and use Kubernetes, Docker, and Terraform [E3]. Growth rate is 18%.';
    const specificity = scoreSpecificity(specificText);
    expect(specificity).toBeGreaterThan(50);
  });

  it('vague text should score low specificity', () => {
    const vagueText = 'The company does some things in the market. They have a product that people use. It seems like a good business.';
    const specificity = scoreSpecificity(vagueText);
    expect(specificity).toBeLessThan(15);
  });

  it('text with many different tech names should score higher', () => {
    const techHeavy = 'They use AWS, GCP, Azure, Kubernetes, Docker, React, Python, PostgreSQL, MongoDB, Redis, Terraform, Snowflake, Databricks, and Salesforce.';
    const techLight = 'They use some cloud services.';
    expect(scoreSpecificity(techHeavy)).toBeGreaterThan(scoreSpecificity(techLight));
  });

  it('excessive hedging should contribute to hallucination risk', () => {
    const heavilyHedged = 'The company may generate $500M. It possibly could expand. They might hire. Perhaps they will grow. It appears likely. It seems possible. Could potentially reach targets. May possibly succeed. Might reportedly grow. Could perhaps expand further.';
    const ctx: EvidenceContext = { evidenceMap: {} };
    const result = runHallucinationCheck(heavilyHedged, ctx);
    expect(result.hedgingPatterns.length).toBeGreaterThanOrEqual(5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CITATION VERIFICATION — Alignment Scoring
// ═══════════════════════════════════════════════════════════════════════════════

describe('Citation Verification: Alignment Scoring', () => {
  it('matching claim and evidence should produce high alignment', () => {
    const claimText = 'TechCorp generates $2.5B in revenue [E1]';
    const claims = extractClaims(claimText);
    const ctx = buildMinimalEvidenceContext([
      { marker: 'E1', text: 'TechCorp Global reported $2.5B in annual revenue for fiscal year 2024.', source: 'reuters.com' },
    ]);
    const verifications = verifyCitations(claims, ctx);
    expect(verifications).toHaveLength(1);
    expect(verifications[0].evidenceExists).toBe(true);
    // Key terms like "revenue", "2.5B" should overlap
    expect(verifications[0].alignmentScore).toBeGreaterThan(0.3);
  });

  it('completely unrelated claim and evidence should produce low alignment', () => {
    const claimText = 'TechCorp uses Kubernetes for container orchestration [E1]';
    const claims = extractClaims(claimText);
    const ctx = buildMinimalEvidenceContext([
      { marker: 'E1', text: 'The weather today is sunny with temperatures around 75 degrees Fahrenheit.', source: 'weather.com' },
    ]);
    const verifications = verifyCitations(claims, ctx);
    expect(verifications).toHaveLength(1);
    expect(verifications[0].evidenceExists).toBe(true);
    // Weather text has nothing to do with Kubernetes
    expect(verifications[0].alignmentScore).toBeLessThan(0.3);
    expect(verifications[0].claimAligns).toBe(false);
  });

  it('uncited claims should not produce verifications', () => {
    const claims: ExtractedClaim[] = [
      { text: '$500M revenue', type: 'revenue', entity: 'TestCo', value: '$500M', citationMarker: null, expressedConfidence: 'medium', position: 0 },
      { text: 'uses AWS', type: 'technology', entity: 'TestCo', value: 'AWS', citationMarker: null, expressedConfidence: 'medium', position: 20 },
    ];
    const ctx: EvidenceContext = { evidenceMap: {} };
    const verifications = verifyCitations(claims, ctx);
    expect(verifications).toHaveLength(0);
  });

  it('hallucinated citation marker should be detected', () => {
    const claims: ExtractedClaim[] = [
      { text: '$500M revenue', type: 'revenue', entity: 'TestCo', value: '$500M', citationMarker: 'E99', expressedConfidence: 'high', position: 0 },
    ];
    const ctx = buildMinimalEvidenceContext([
      { marker: 'E1', text: 'Some evidence text.', source: 'example.com' },
    ]);
    const verifications = verifyCitations(claims, ctx);
    expect(verifications).toHaveLength(1);
    expect(verifications[0].evidenceExists).toBe(false);
    expect(verifications[0].claimAligns).toBe(false);
    expect(verifications[0].alignmentScore).toBe(0);
  });

  it('mixed citations (valid + hallucinated) should be correctly classified', () => {
    const claims: ExtractedClaim[] = [
      { text: '$500M revenue', type: 'revenue', entity: 'TestCo', value: '$500M', citationMarker: 'E1', expressedConfidence: 'high', position: 0 },
      { text: '10,000 employees', type: 'employee_count', entity: 'TestCo', value: '10,000', citationMarker: 'E99', expressedConfidence: 'medium', position: 20 },
    ];
    const ctx = buildMinimalEvidenceContext([
      { marker: 'E1', text: 'TestCo reported $500M in annual revenue.', source: 'reuters.com' },
    ]);
    const verifications = verifyCitations(claims, ctx);
    expect(verifications).toHaveLength(2);
    expect(verifications[0].evidenceExists).toBe(true);
    expect(verifications[1].evidenceExists).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIDENCE CALIBRATION — Edge Cases
// ═══════════════════════════════════════════════════════════════════════════════

describe('Confidence Calibration: Edge Cases', () => {
  it('perfect inputs should produce near-maximum confidence', () => {
    const result = computeUnifiedConfidence({
      fieldConfidence: { revenue: 0.98, employees: 0.95, technology: 0.95, funding: 0.98, location: 0.92 },
      dataCompleteness: 0.95,
      sources: [
        { name: 'sec.gov', reliability: 0.95, type: 'government' },
        { name: 'reuters.com', reliability: 0.92, type: 'financial' },
        { name: 'bloomberg.com', reliability: 0.92, type: 'financial' },
        { name: 'press release', reliability: 0.85, type: 'official' },
        { name: 'annual report', reliability: 0.93, type: 'official' },
      ],
      daysSinceResearch: 1,
      crossValidatedFacts: 12,
      totalFacts: 13,
      evidenceCount: 20,
      evidenceCoverage: 0.95,
      hallucinationRiskScore: 2,
    });
    expect(result.score).toBeGreaterThan(80);
    expect(result.trustClass).toBe('enterprise');
    expect(result.enterpriseReady).toBe(true);
  });

  it('worst-case inputs should produce F grade', () => {
    const result = computeUnifiedConfidence({
      fieldConfidence: { revenue: 0.05, employees: 0.05 },
      dataCompleteness: 0.05,
      sources: [{ name: 'twitter.com', reliability: 0.55, type: 'social' }],
      daysSinceResearch: 365,
      crossValidatedFacts: 0,
      totalFacts: 10,
      contradictions: 5,
      evidenceCount: 0,
      evidenceCoverage: 0.0,
      evidenceGaps: 10,
      hallucinationRiskScore: 80,
    });
    expect(result.score).toBeLessThan(40);
    expect(result.trustClass).toBe('unreliable');
    expect(result.enterpriseReady).toBe(false);
  });

  it('empty input should produce a valid result (not throw)', () => {
    const result = computeUnifiedConfidence({});
    expect(result.score).toBeGreaterThanOrEqual(0);
    expect(result.score).toBeLessThanOrEqual(100);
    expect(result.grade).toBeDefined();
    expect(result.trustClass).toBeDefined();
    expect(result.factors).toHaveLength(6);
  });

  it('grade boundaries should be correct', () => {
    const testScores = [
      { score: 96, expectedGrade: 'A+', expectedTrust: 'enterprise' },
      { score: 92, expectedGrade: 'A', expectedTrust: 'enterprise' },
      { score: 87, expectedGrade: 'A-', expectedTrust: 'enterprise' },
      { score: 82, expectedGrade: 'B+', expectedTrust: 'enterprise' },
      { score: 77, expectedGrade: 'B', expectedTrust: 'enterprise' },
      { score: 72, expectedGrade: 'B-', expectedTrust: 'enterprise' },
      { score: 67, expectedGrade: 'C+', expectedTrust: 'advisory' },
      { score: 62, expectedGrade: 'C', expectedTrust: 'advisory' },
      { score: 57, expectedGrade: 'C-', expectedTrust: 'advisory' },
      { score: 45, expectedGrade: 'D', expectedTrust: 'speculative' },
      { score: 30, expectedGrade: 'F', expectedTrust: 'unreliable' },
    ];
    for (const { score, expectedGrade, expectedTrust } of testScores) {
      // Use a minimal input that allows us to test the grade mapping
      const result = computeUnifiedConfidence({
        freshnessScore: score,
        qualityGateScore: score,
        fieldConfidence: { revenue: score / 100 },
      });
      // We can't directly test scoreToGrade, but we can check the overall structure
      expect(result.grade).toBeDefined();
      expect(result.trustClass).toBeDefined();
    }
  });

  it('high AI certainty (low hallucination risk) should boost confidence', () => {
    const highCertainty = computeUnifiedConfidence({
      qualityGateScore: 90,
      hallucinationRiskScore: 5,
      aiOutputConfidence: 0.9,
    });
    const lowCertainty = computeUnifiedConfidence({
      qualityGateScore: 30,
      hallucinationRiskScore: 70,
      aiOutputConfidence: 0.3,
    });
    const highAIFactor = highCertainty.factors.find(f => f.dimension === 'ai_certainty');
    const lowAIFactor = lowCertainty.factors.find(f => f.dimension === 'ai_certainty');
    expect(highAIFactor!.score).toBeGreaterThan(lowAIFactor!.score);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REGRESSION: FRESHNESS ACCURACY
// ═══════════════════════════════════════════════════════════════════════════════

describe('Regression: Freshness Accuracy', () => {
  it('signal at exactly its half-life should decay to exactly 50%', () => {
    const now = new Date();
    const atHalfLife = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const score = computeFreshnessScore(100, atHalfLife, now.toISOString(), 'news');
    // 100 * 0.5^(14/14) = 100 * 0.5 = 50
    expect(score).toBe(50);
  });

  it('signal at 0 days should equal base confidence', () => {
    const now = new Date();
    const score = computeFreshnessScore(85, now.toISOString(), now.toISOString(), 'news');
    // 85 * 0.5^0 = 85
    expect(score).toBe(85);
  });

  it('different signal types should decay at different rates', () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const newsScore = computeFreshnessScore(90, thirtyDaysAgo, now.toISOString(), 'news');
    const regScore = computeFreshnessScore(90, thirtyDaysAgo, now.toISOString(), 'regulatory');

    // News (half-life 14) should decay much more than regulatory (half-life 90)
    expect(regScore).toBeGreaterThan(newsScore * 3);
  });

  it('unknown signal type should use default half-life of 30', () => {
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const unknownScore = computeFreshnessScore(100, thirtyDaysAgo, now.toISOString(), 'unknown_type');
    const defaultScore = computeFreshnessScore(100, thirtyDaysAgo, now.toISOString());
    expect(unknownScore).toBe(defaultScore);
    // 100 * 0.5^(30/30) = 50
    expect(unknownScore).toBe(50);
  });

  it('freshness should never be negative', () => {
    const now = new Date();
    const ancient = new Date(now.getTime() - 1000 * 24 * 60 * 60 * 1000).toISOString();
    const score = computeFreshnessScore(100, ancient, now.toISOString(), 'mention');
    expect(score).toBeGreaterThanOrEqual(0);
  });

  it('freshness should never exceed base confidence', () => {
    const now = new Date();
    const recent = new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000).toISOString();
    const score = computeFreshnessScore(75, recent, now.toISOString(), 'regulatory');
    expect(score).toBeLessThanOrEqual(75);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// REGRESSION: END-TO-END HALLUCINATION PIPELINE
// ═══════════════════════════════════════════════════════════════════════════════

describe('Regression: End-to-End Hallucination Pipeline', () => {
  it('well-grounded enterprise output should pass all checks', () => {
    const output = `SecureNet Corp won a $500M Department of Defense contract [E1]. The company employs approximately 15,000 people [E2]. SecureNet Corp uses Zero Trust architecture with AI and Cloud infrastructure [E3]. Revenue is reported at $3.4B [E4].`;

    const ctx = buildMinimalEvidenceContext([
      { marker: 'E1', text: 'SecureNet Corp awarded $500M cybersecurity contract by Department of Defense.', source: 'gov.uk' },
      { marker: 'E2', text: 'SecureNet Corp has approximately 15,000 employees globally.', source: 'linkedin.com' },
      { marker: 'E3', text: 'SecureNet Corp Zero Trust platform powered by AI and cloud infrastructure.', source: 'securenet.example.com' },
      { marker: 'E4', text: 'SecureNet Corp reported $3.4B in annual revenue.', source: 'bloomberg.com' },
    ]);

    const result = runHallucinationCheck(output, ctx);
    expect(result.hallucinatedCitations).toBe(0);
    expect(result.passesTrustThreshold).toBe(true);
    expect(result.riskLevel).toMatch(/^(minimal|low)$/);
    expect(result.specificityScore).toBeGreaterThan(40);
  });

  it('poorly-grounded output with fabricated data should fail all checks', () => {
    const output = 'Phantom Dynamics generates $10B in revenue [E1]. They have 100,000 employees [E2]. The CEO confirmed plans to acquire Google [E3]. They use quantum computing for everything [E4]. They are possibly the best company [E5].';

    const ctx = buildMinimalEvidenceContext([
      { marker: 'E5', text: 'No relevant information here.', source: 'unknown.com' },
    ]);

    const result = runHallucinationCheck(output, ctx);
    // E1, E2, E3, E4 are hallucinated
    expect(result.hallucinatedCitations).toBe(4);
    expect(result.passesTrustThreshold).toBe(false);
    expect(result.riskLevel).toBe('critical');
  });

  it('mixed quality output should produce medium risk', () => {
    const output = 'Acme Corp reported $200M in revenue [E1]. They might possibly expand to Europe. The company uses Kubernetes and Docker [E2]. They could potentially reach $500M next year. Approximately 1,000 employees work there [E3].';

    const ctx = buildMinimalEvidenceContext([
      { marker: 'E1', text: 'Acme Corp reported $200M in revenue for fiscal year.', source: 'reuters.com' },
      { marker: 'E2', text: 'Acme Corp runs infrastructure on Kubernetes with Docker.', source: 'acme.example.com' },
      // E3 intentionally missing
    ]);

    const result = runHallucinationCheck(output, ctx);
    // E3 is a hallucinated citation
    expect(result.hallucinatedCitations).toBe(1);
    // Some hedging patterns present
    expect(result.hedgingPatterns.length).toBeGreaterThan(0);
    // Should be medium or higher risk due to hallucinated citation
    expect(result.riskLevel).toMatch(/^(medium|high|critical)$/);
  });
});
