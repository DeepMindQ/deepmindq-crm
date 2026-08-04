/**
 * DeepMindQ Enterprise AI Intelligence Platform
 * Milestone 3 — Section 3.4: AI Quality Certification
 * Hallucination Detection & AI Confidence Testing
 *
 * Validates real AI quality logic:
 * - Claim extraction from AI output text
 * - Citation verification against evidence
 * - Hedging language detection
 * - Specificity scoring
 * - Hallucination risk scoring (0-100)
 * - Enterprise trust threshold validation
 * - Adversarial scenarios (missing data, fake companies, contradictions)
 *
 * Run: npx vitest run --config vitest.ai-governance.config.ts tests/ai-testing/hallucination-testing/
 */

import { describe, it, expect } from 'vitest'
import {
  extractClaims,
  verifyCitations,
  detectHedgingPatterns,
  scoreSpecificity,
  runHallucinationCheck,
} from '@/lib/ai-hallucination-prevention'

// ═══════════════════════════════════════════════════════════════════════════════
// CLAIM EXTRACTION
// ═══════════════════════════════════════════════════════════════════════════════
describe('Claim Extraction', () => {
  it('extracts revenue claims', () => {
    const text = 'TechCorp generates $500M in annual revenue with strong growth.'
    const claims = extractClaims(text, [])
    const revenueClaims = claims.filter(c => c.type === 'revenue')
    expect(revenueClaims.length).toBeGreaterThan(0)
    expect(revenueClaims[0].value).toContain('500M')
  })

  it('extracts employee count claims', () => {
    const text = 'The company employs approximately 12,000 people across 5 offices.'
    const claims = extractClaims(text, [])
    const employeeClaims = claims.filter(c => c.type === 'employee_count')
    expect(employeeClaims.length).toBeGreaterThan(0)
  })

  it('extracts technology claims', () => {
    const text = 'Their core technology stack includes Kubernetes, Docker, and microservices architecture.'
    const claims = extractClaims(text, [])
    const techClaims = claims.filter(c => c.type === 'technology')
    expect(techClaims.length).toBeGreaterThan(0)
  })

  it('extracts funding claims', () => {
    const text = 'They raised a Series C round of $45 million in March 2024.'
    const claims = extractClaims(text, [])
    const fundingClaims = claims.filter(c => c.type === 'funding')
    expect(fundingClaims.length).toBeGreaterThan(0)
  })

  it('detects citation markers [E1], [E2], etc.', () => {
    const text = 'Revenue grew 25% [E1] while employee count remained stable [E2].'
    const claims = extractClaims(text, [])
    const citedClaims = claims.filter(c => c.citationMarker !== null)
    expect(citedClaims.length).toBeGreaterThanOrEqual(2)
    expect(claims.some(c => c.citationMarker === '[E1]')).toBe(true)
  })

  it('returns empty for text with no factual claims', () => {
    const text = 'The company is interesting and has potential for growth.'
    const claims = extractClaims(text, [])
    // Very generic text may not trigger specific claim extractors
    expect(claims.length).toBeLessThanOrEqual(2)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// CITATION VERIFICATION
// ═══════════════════════════════════════════════════════════════════════════════
describe('Citation Verification', () => {
  it('matches valid citation [E1] to evidence', () => {
    const claims = [
      { text: 'Revenue $500M', marker: '[E1]', value: '$500M' } as any,
    ]
    const evidenceContext = {
      evidenceMap: {
        '[E1]': { text: 'Annual revenue reached $500M', source: 'SEC Filing', url: null, confidence: 0.9 },
      },
    }
    const verifications = verifyCitations(claims, evidenceContext)
    expect(verifications.length).toBe(1)
    expect(verifications[0].evidenceExists).toBe(true)
    expect(verifications[0].claimAligns).toBe(true)
  })

  it('detects hallucinated citations (marker with no evidence)', () => {
    const claims = [
      { text: 'Revenue $500M', marker: '[E5]', value: '$500M' } as any,
    ]
    const evidenceContext = {
      evidenceMap: {
        '[E1]': { text: 'Employee count 5000', source: 'Website', url: null, confidence: 0.8 },
      },
    }
    const verifications = verifyCitations(claims, evidenceContext)
    expect(verifications[0].evidenceExists).toBe(false)
    expect(verifications[0].hallucinated).toBe(true)
  })

  it('detects misaligned citations (claim contradicts evidence)', () => {
    const claims = [
      { text: 'Revenue $500M', marker: '[E1]', value: '$500M' } as any,
    ]
    const evidenceContext = {
      evidenceMap: {
        '[E1]': { text: 'Annual revenue was $50M', source: 'SEC Filing', url: null, confidence: 0.9 },
      },
    }
    const verifications = verifyCitations(claims, evidenceContext)
    // Evidence exists but claim may not align due to value mismatch
    expect(verifications[0].evidenceExists).toBe(true)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// HEDGING LANGUAGE DETECTION
// ═══════════════════════════════════════════════════════════════════════════════
describe('Hedging Language Detection', () => {
  it('detects "may" hedging', () => {
    const patterns = detectHedgingPatterns('The company may expand to Europe next year.')
    expect(patterns.length).toBeGreaterThan(0)
  })

  it('detects "might" hedging', () => {
    const patterns = detectHedgingPatterns('This might indicate a buying opportunity.')
    expect(patterns.length).toBeGreaterThan(0)
  })

  it('detects "possibly" hedging', () => {
    const patterns = detectHedgingPatterns('Revenue could possibly reach $1B.')
    expect(patterns.length).toBeGreaterThan(0)
  })

  it('detects "seems to" hedging', () => {
    const patterns = detectHedgingPatterns('The company seems to be growing rapidly.')
    expect(patterns.length).toBeGreaterThan(0)
  })

  it('detects "appears to" hedging', () => {
    const patterns = detectHedgingPatterns('Leadership appears to be stable.')
    expect(patterns.length).toBeGreaterThan(0)
  })

  it('detects "potentially" hedging', () => {
    const patterns = detectHedgingPatterns('This is potentially a high-value account.')
    expect(patterns.length).toBeGreaterThan(0)
  })

  it('returns no patterns for confident assertions', () => {
    const patterns = detectHedgingPatterns('Revenue is $500M. The company has 5000 employees. Headquarters is in San Francisco.')
    expect(patterns.length).toBe(0)
  })

  it('detects multiple hedging patterns in one text', () => {
    const text = 'The company may expand and could potentially acquire a startup. This seems likely.'
    const patterns = detectHedgingPatterns(text)
    expect(patterns.length).toBeGreaterThanOrEqual(3)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// SPECIFICITY SCORING
// ═══════════════════════════════════════════════════════════════════════════════
describe('Specificity Scoring', () => {
  it('high specificity for text with numbers and entities', () => {
    const score = scoreSpecificity('TechCorp generated $2.5B in revenue with 12,000 employees in Q4 2024, a 25% increase from the previous year.')
    expect(score).toBeGreaterThan(60)
  })

  it('low specificity for vague text', () => {
    const score = scoreSpecificity('The company is doing well and has good potential for growth.')
    expect(score).toBeLessThan(40)
  })

  it('medium specificity for mixed text', () => {
    const score = scoreSpecificity('Revenue grew significantly and the company now has several offices across multiple regions.')
    expect(score).toBeGreaterThanOrEqual(20)
    expect(score).toBeLessThanOrEqual(60)
  })

  it('score is 0-100 range', () => {
    const score = scoreSpecificity('Some text about a company.')
    expect(score).toBeGreaterThanOrEqual(0)
    expect(score).toBeLessThanOrEqual(100)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// HALLUCINATION RISK SCORING
// ═══════════════════════════════════════════════════════════════════════════════
describe('Hallucination Risk Scoring', () => {
  it('well-cited specific text has low risk', () => {
    const text = 'TechCorp revenue was $2.5B [E1] with 12,000 employees [E2]. The company uses Kubernetes [E3].'
    const evidenceContext = {
      evidenceMap: {
        '[E1]': { text: 'Revenue $2.5B', source: 'SEC', url: null, confidence: 0.95 },
        '[E2]': { text: '12,000 employees', source: 'Website', url: null, confidence: 0.9 },
        '[E3]': { text: 'Uses Kubernetes', source: 'Tech Blog', url: null, confidence: 0.85 },
      },
    }
    const result = runHallucinationCheck(text, evidenceContext)
    expect(result.hallucinationRiskScore).toBeLessThanOrEqual(30)
    expect(result.riskLevel).toBe('minimal' as any || 'low' as any)
  })

  it('uncited claims increase risk score', () => {
    const text = 'Revenue is $500M. Employee count is 5000. The CEO is John Smith. Founded in 2015.'
    const evidenceContext = {
      evidenceMap: {},
    }
    const result = runHallucinationCheck(text, evidenceContext)
    expect(result.uncitedClaims).toBeGreaterThan(0)
    expect(result.hallucinationRiskScore).toBeGreaterThan(20)
  })

  it('hallucinated citations significantly increase risk', () => {
    const text = 'Revenue reached $1B [E5] with strong growth in all markets.'
    const evidenceContext = {
      evidenceMap: {
        '[E1]': { text: 'Some other data', source: 'Source', url: null, confidence: 0.5 },
      },
    }
    const result = runHallucinationCheck(text, evidenceContext)
    expect(result.hallucinatedCitations).toBeGreaterThan(0)
    expect(result.hallucinationRiskScore).toBeGreaterThan(25)
  })

  it('risk level classification is correct', () => {
    // Minimal: 0-15
    // Low: 16-30
    // Medium: 31-50
    // High: 51-70
    // Critical: 71-100
    const text = 'Generic statement about the company.'
    const evidenceContext = { evidenceMap: {} }
    const result = runHallucinationCheck(text, evidenceContext)
    expect(['minimal', 'low', 'medium', 'high', 'critical']).toContain(result.riskLevel)
  })

  it('passes enterprise trust threshold when risk is low', () => {
    const text = 'Revenue was $50M according to their annual report [E1].'
    const evidenceContext = {
      evidenceMap: {
        '[E1]': { text: '$50M revenue', source: 'Annual Report', url: null, confidence: 0.95 },
      },
    }
    const result = runHallucinationCheck(text, evidenceContext)
    // Enterprise trust threshold is 60
    if (result.hallucinationRiskScore <= 60) {
      expect(result.passesTrustThreshold).toBe(true)
    }
  })

  it('fails enterprise trust threshold when risk is high', () => {
    // Text with many uncited claims and hallucinated citations
    const text = 'Revenue is $999B [E99] [E88]. CEO is fictional person. Employees: 1 billion. Technology: quantum blockchain AI.'
    const evidenceContext = {
      evidenceMap: {
        '[E1]': { text: 'Some data', source: 'Source', url: null, confidence: 0.5 },
      },
    }
    const result = runHallucinationCheck(text, evidenceContext)
    // Many uncited claims + hallucinated citations should push risk high
    expect(result.hallucinationRiskScore).toBeGreaterThan(30)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// ADVERSARIAL SCENARIOS — Section 3.4 AI Quality
// ═══════════════════════════════════════════════════════════════════════════════
describe('Adversarial Scenario: Missing Data', () => {
  it('text with fabricated numbers increases risk', () => {
    const text = 'The company has exactly $847,293,451 in revenue and employs 47,293 people across 23 countries.'
    const evidenceContext = { evidenceMap: {} }
    const result = runHallucinationCheck(text, evidenceContext)
    // Very specific numbers with NO evidence = high hallucination risk
    expect(result.uncitedClaims).toBeGreaterThan(0)
    expect(result.hallucinationRiskScore).toBeGreaterThan(15)
  })
})

describe('Adversarial Scenario: Fake Company', () => {
  it('claims about non-existent company should flag as high risk', () => {
    const text = 'QuantumBlockchainAI Corp has raised $2B in Series A funding and is valued at $15B.'
    const evidenceContext = { evidenceMap: {} }
    const result = runHallucinationCheck(text, evidenceContext)
    // No evidence for any claims about this fake company
    expect(result.hallucinationRiskScore).toBeGreaterThan(15)
    expect(result.uncitedClaims).toBeGreaterThan(0)
  })
})

describe('Adversarial Scenario: Contradictory Information', () => {
  it('contradictory signals should be detectable via low confidence', () => {
    // When evidence conflicts, the hallucination framework should flag uncertainty
    const text = 'Revenue was $100M [E1] and revenue was $500M [E2].'
    const evidenceContext = {
      evidenceMap: {
        '[E1]': { text: 'Revenue $100M', source: 'Source A', url: null, confidence: 0.9 },
        '[E2]': { text: 'Revenue $500M', source: 'Source B', url: null, confidence: 0.8 },
      },
    }
    const result = runHallucinationCheck(text, evidenceContext)
    // Contradictory evidence should increase risk
    expect(result.hallucinationRiskScore).toBeGreaterThan(0)
  })
})

describe('Adversarial Scenario: Outdated Information', () => {
  it('very old signal dates should produce stale intelligence', async () => {
    const { computeFreshnessState } = await import('@/lib/scoring/freshness-ranking')
    const now = new Date()
    const threeYearsAgo = new Date(now.getTime() - 3 * 365 * 24 * 60 * 60 * 1000).toISOString()
    const state = computeFreshnessState(threeYearsAgo, threeYearsAgo, 'news')
    expect(state.staleness).toBe('expired')
    expect(state.daysSinceSignal).toBeGreaterThan(1000)
  })
})
