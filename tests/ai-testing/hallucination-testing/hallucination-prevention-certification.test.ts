/**
 * Milestone 3 — Hallucination Prevention Certification Tests
 * Section 3.5: AI Intelligence Testing
 *
 * Validates post-generation hallucination detection:
 * - Claim extraction from AI output
 * - Citation verification against evidence
 * - Hedging pattern detection
 * - Specificity scoring
 * - Hallucination risk scoring
 * - Golden dataset validation
 *
 * Run: npx vitest run --config vitest.ai-governance.config.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// Module Mocks
// ═══════════════════════════════════════════════════════════════

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// ═══════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════

describe('Hallucination Prevention — Claim Extraction', () => {
  it('exports extractClaims function', async () => {
    const { extractClaims } = await import('@/lib/ai-hallucination-prevention');
    expect(typeof extractClaims).toBe('function');
  });

  it('extracts revenue claims from AI output', async () => {
    const { extractClaims } = await import('@/lib/ai-hallucination-prevention');
    const text = 'TechCorp reported $50M in Series C funding led by Sequoia Capital.';
    const claims = extractClaims(text);
    expect(Array.isArray(claims)).toBe(true);
    expect(claims.length).toBeGreaterThanOrEqual(1);
    const hasRelevantClaim = claims.some(c =>
      c.entity === 'TechCorp' || c.value.includes('$50M') || c.value.includes('50M')
    );
    expect(hasRelevantClaim).toBe(true);
  });

  it('extracts partnership claims', async () => {
    const { extractClaims } = await import('@/lib/ai-hallucination-prevention');
    const text = 'AutoWerks GmbH has partnered with TechFront Japan to develop AI supply chain tools.';
    const claims = extractClaims(text);
    expect(claims.length).toBeGreaterThanOrEqual(1);
    const partnershipClaim = claims.find(c => c.type === 'partnership');
    expect(partnershipClaim).toBeDefined();
  });

  it('handles empty text gracefully', async () => {
    const { extractClaims } = await import('@/lib/ai-hallucination-prevention');
    const claims = extractClaims('');
    expect(Array.isArray(claims)).toBe(true);
  });

  it('handles text with no verifiable claims', async () => {
    const { extractClaims } = await import('@/lib/ai-hallucination-prevention');
    const text = 'The company seems to be doing well generally.';
    const claims = extractClaims(text);
    expect(Array.isArray(claims)).toBe(true);
  });
});

describe('Hallucination Prevention — Citation Verification', () => {
  it('exports verifyCitations function', async () => {
    const { verifyCitations } = await import('@/lib/ai-hallucination-prevention');
    expect(typeof verifyCitations).toBe('function');
  });

  it('verifies valid citations against evidence', async () => {
    const { verifyCitations } = await import('@/lib/ai-hallucination-prevention');
    const claims = [
      {
        text: 'Revenue was $2.3B',
        type: 'revenue' as const,
        entity: 'GlobalFin',
        value: '$2.3B',
        citationMarker: '[E1]',
        expressedConfidence: 'high' as const,
        position: 0,
      },
    ];
    const evidences = [
      {
        marker: '[E1]',
        title: 'Q2 Earnings Report',
        source: 'SEC Filing',
        snippet: 'Total revenue of $2.3 billion, representing 23% YoY increase.',
        publishedAt: '2026-07-15',
      },
    ];
    const result = verifyCitations(claims, evidences);
    expect(result.verified).toBeDefined();
    expect(Array.isArray(result.verified)).toBe(true);
  });

  it('detects hallucinated citations (markers not in evidence)', async () => {
    const { verifyCitations } = await import('@/lib/ai-hallucination-prevention');
    const claims = [
      {
        text: 'Revenue was $5B',
        type: 'revenue' as const,
        entity: 'TestCorp',
        value: '$5B',
        citationMarker: '[E99]',
        expressedConfidence: 'high' as const,
        position: 0,
      },
    ];
    const evidences = [
      {
        marker: '[E1]',
        title: 'Q2 Report',
        source: 'Internal',
        snippet: 'Revenue was $2.3B.',
        publishedAt: '2026-07-15',
      },
    ];
    const result = verifyCitations(claims, evidences);
    expect(result.hallucinatedCitations).toBeGreaterThanOrEqual(1);
  });

  it('handles empty claims array', async () => {
    const { verifyCitations } = await import('@/lib/ai-hallucination-prevention');
    const result = verifyCitations([], []);
    expect(result).toBeDefined();
    expect(result.verified.length).toBe(0);
  });
});

describe('Hallucination Prevention — Hedging Pattern Detection', () => {
  it('exports detectHedgingPatterns function', async () => {
    const { detectHedgingPatterns } = await import('@/lib/ai-hallucination-prevention');
    expect(typeof detectHedgingPatterns).toBe('function');
  });

  it('detects common hedging phrases', async () => {
    const { detectHedgingPatterns } = await import('@/lib/ai-hallucination-prevention');
    const text = 'It seems likely that the company might be expanding. We believe this could happen soon.';
    const patterns = detectHedgingPatterns(text);
    expect(Array.isArray(patterns)).toBe(true);
    expect(patterns.length).toBeGreaterThanOrEqual(1);
  });

  it('detects uncertain language', async () => {
    const { detectHedgingPatterns } = await import('@/lib/ai-hallucination-prevention');
    const text = 'It is unclear whether the acquisition will proceed. The outcome remains uncertain.';
    const patterns = detectHedgingPatterns(text);
    expect(patterns.length).toBeGreaterThanOrEqual(1);
  });

  it('returns empty for confident, factual text', async () => {
    const { detectHedgingPatterns } = await import('@/lib/ai-hallucination-prevention');
    const text = 'Revenue increased by 23% to $2.3 billion in Q2 2026.';
    const patterns = detectHedgingPatterns(text);
    expect(patterns.length).toBe(0);
  });
});

describe('Hallucination Prevention — Specificity Scoring', () => {
  it('exports scoreSpecificity function', async () => {
    const { scoreSpecificity } = await import('@/lib/ai-hallucination-prevention');
    expect(typeof scoreSpecificity).toBe('function');
  });

  it('scores specific, factual text higher than vague text', async () => {
    const { scoreSpecificity } = await import('@/lib/ai-hallucination-prevention');
    const specific = 'TechCorp India raised $50M in Series C funding from Sequoia Capital India on July 28, 2026.';
    const vague = 'The company seems to be doing well and might grow soon.';
    const specificScore = scoreSpecificity(specific);
    const vagueScore = scoreSpecificity(vague);
    expect(specificScore).toBeGreaterThan(vagueScore);
  });

  it('scores text with numbers higher than without', async () => {
    const { scoreSpecificity } = await import('@/lib/ai-hallucination-prevention');
    const withNumbers = 'Revenue reached $2.3 billion in Q2, up 23% year-over-year.';
    const withoutNumbers = 'Revenue showed significant growth in the second quarter.';
    expect(scoreSpecificity(withNumbers)).toBeGreaterThan(scoreSpecificity(withoutNumbers));
  });

  it('returns score between 0 and 100', async () => {
    const { scoreSpecificity } = await import('@/lib/ai-hallucination-prevention');
    const score = scoreSpecificity('Some text about a company doing things.');
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
  });
});

describe('Hallucination Prevention — Full Pipeline Check', () => {
  it('exports runHallucinationCheck function', async () => {
    const { runHallucinationCheck } = await import('@/lib/ai-hallucination-prevention');
    expect(typeof runHallucinationCheck).toBe('function');
  });

  it('returns structured result with risk score', async () => {
    const { runHallucinationCheck } = await import('@/lib/ai-hallucination-prevention');
    const result = runHallucinationCheck({
      aiOutput: 'TechCorp raised $50M in Series C funding [E1]. The company plans to expand into Southeast Asia.',
      evidences: [
        {
          marker: '[E1]',
          title: 'Funding News',
          source: 'Economic Times',
          snippet: 'TechCorp India has raised $50 million in Series C funding.',
          publishedAt: '2026-07-28',
        },
      ],
    });
    expect(result.hallucinationRiskScore).toBeDefined();
    expect(typeof result.hallucinationRiskScore).toBe('number');
    expect(result.riskLevel).toBeDefined();
    expect(['minimal', 'low', 'medium', 'high', 'critical']).toContain(result.riskLevel);
    expect(result.claims).toBeDefined();
    expect(result.citationVerifications).toBeDefined();
  });

  it('produces lower risk for well-cited output', async () => {
    const { runHallucinationCheck } = await import('@/lib/ai-hallucination-prevention');
    const wellCited = runHallucinationCheck({
      aiOutput: 'TechCorp raised $50M [E1]. Revenue grew 23% [E2]. CEO Rajesh Mehta confirmed expansion plans [E3].',
      evidences: [
        { marker: '[E1]', title: 'Funding', source: 'ET', snippet: 'Raised $50M Series C', publishedAt: '2026-07-28' },
        { marker: '[E2]', title: 'Earnings', source: 'SEC', snippet: 'Revenue $2.3B, up 23%', publishedAt: '2026-07-15' },
        { marker: '[E3]', title: 'Interview', source: 'Press', snippet: 'Mehta confirmed expansion', publishedAt: '2026-07-30' },
      ],
    });
    const poorlyCited = runHallucinationCheck({
      aiOutput: 'TechCorp raised $500M and plans to acquire three competitors soon. CEO announced at a private event.',
      evidences: [],
    });
    expect(wellCited.hallucinationRiskScore).toBeLessThan(poorlyCited.hallucinationRiskScore);
  });

  it('detects hallucinated citation markers', async () => {
    const { runHallucinationCheck } = await import('@/lib/ai-hallucination-prevention');
    const result = runHallucinationCheck({
      aiOutput: 'TechCorp raised $50M [E1] and acquired StartupX for $200M [E99].',
      evidences: [
        { marker: '[E1]', title: 'Funding', source: 'ET', snippet: 'Raised $50M', publishedAt: '2026-07-28' },
      ],
    });
    expect(result.hallucinatedCitations).toBeGreaterThanOrEqual(1);
  });
});

describe('Hallucination Prevention — Golden Dataset Validation', () => {
  it('validates truthful claims against golden documents', async () => {
    const { runHallucinationCheck } = await import('@/lib/ai-hallucination-prevention');
    const result = runHallucinationCheck({
      aiOutput: 'TechCorp India raised $50 million in Series C funding led by Sequoia Capital India [E1]. The company plans to expand into Southeast Asian markets [E1].',
      evidences: [
        {
          marker: '[E1]',
          title: 'TechCorp Funding',
          source: 'Economic Times',
          snippet: 'TechCorp India has raised $50 million in Series C funding led by Sequoia Capital India. The company plans to expand its AI-powered enterprise intelligence platform across Southeast Asian markets.',
          publishedAt: '2026-07-28',
        },
      ],
    });
    expect(result.riskLevel).not.toBe('critical');
    expect(result.verifiedClaims).toBeGreaterThanOrEqual(1);
  });

  it('detects fabricated numbers in claims', async () => {
    const { runHallucinationCheck } = await import('@/lib/ai-hallucination-prevention');
    const result = runHallucinationCheck({
      aiOutput: 'GlobalFin reported Q2 revenue of $5.7 billion, a 23% increase [E1].',
      evidences: [
        {
          marker: '[E1]',
          title: 'GlobalFin Q2 Report',
          source: 'SEC Filing',
          snippet: 'Total revenue of $2.3 billion, representing a 23% year-over-year increase.',
          publishedAt: '2026-07-15',
        },
      ],
    });
    // $5.7B vs $2.3B — significant mismatch should increase risk
    expect(result.hallucinationRiskScore).toBeGreaterThan(30);
  });
});

describe('Hallucination Prevention — Report Formatting', () => {
  it('exports formatHallucinationReportForLog function', async () => {
    const { formatHallucinationReportForLog } = await import('@/lib/ai-hallucination-prevention');
    expect(typeof formatHallucinationReportForLog).toBe('function');
  });

  it('produces readable log output', async () => {
    const { formatHallucinationReportForLog } = await import('@/lib/ai-hallucination-prevention');
    const report = formatHallucinationReportForLog({
      hallucinationRiskScore: 25,
      riskLevel: 'low',
      claims: [],
      citationVerifications: [],
      verifiedClaims: 3,
      unverifiedClaims: 1,
      uncitedClaims: 0,
      hallucinatedCitations: 0,
      overallAssessment: 'Output is well-grounded with minor gaps.',
      recommendations: ['Add citation for the uncited claim.'],
    });
    expect(typeof report).toBe('string');
    expect(report).toContain('25');
    expect(report).toContain('low');
  });
});
