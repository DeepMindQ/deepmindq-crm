/**
 * DeepMindQ Enterprise Test Framework — Milestone 3
 * Section: AI Testing / Golden Dataset / Hallucination Testing
 *
 * Uses the 50 golden companies dataset to validate:
 * - Claim extraction accuracy for known company facts
 * - Citation verification against structured evidence
 * - Hallucination risk scoring for grounded vs ungrounded output
 * - Specificity scoring for rich vs generic intelligence briefs
 *
 * These tests validate that the AI hallucination prevention framework
 * correctly classifies well-grounded enterprise intelligence output.
 */

import { describe, it, expect } from 'vitest'
import {
  extractClaims,
  verifyCitations,
  detectHedgingPatterns,
  scoreSpecificity,
  runHallucinationCheck,
  type EvidenceContext,
} from '@/lib/ai-hallucination-prevention'
import { TEST_COMPANIES } from '../../fixtures/companies'

describe('AI Golden Dataset — Hallucination Testing', () => {
  // ═══ Grounded Intelligence Brief Tests ═══

  describe('Well-grounded intelligence briefs should pass trust threshold', () => {
    const testCases = [
      {
        name: 'Acme Cloud Solutions',
        company: TEST_COMPANIES[0],
        evidence: {
          evidenceMap: {
            '[E1]': { text: 'Acme Cloud Solutions reported $4.2B revenue in FY2024', source: 'SEC Filing', url: null, confidence: 0.95 },
            '[E2]': { text: 'Acme uses AWS, Kubernetes, Go for cloud infrastructure', source: 'Tech Blog', url: null, confidence: 0.9 },
            '[E3]': { text: 'Acme Cloud has 18,500 employees globally', source: 'Annual Report', url: null, confidence: 0.95 },
          },
        },
        output: `Acme Cloud Solutions reported $4.2B revenue [E1]. The company uses AWS and Kubernetes [E2] with 18,500 employees globally [E3].`,
      },
      {
        name: 'QuantumLeap AI',
        company: TEST_COMPANIES[3],
        evidence: {
          evidenceMap: {
            '[E1]': { text: 'QuantumLeap AI generates $2.1B revenue from enterprise AI platform', source: 'SEC Filing', url: null, confidence: 0.95 },
            '[E2]': { text: 'Uses PyTorch and CUDA for AI model training', source: 'Engineering Blog', url: null, confidence: 0.85 },
          },
        },
        output: `QuantumLeap AI confirmed $2.1B revenue [E1]. The company uses PyTorch and CUDA for AI model training [E2].`,
      },
      {
        name: 'DataForge Analytics',
        company: TEST_COMPANIES[1],
        evidence: {
          evidenceMap: {
            '[E1]': { text: 'DataForge provides AI-powered BI for Fortune 500 companies', source: 'Company Website', url: null, confidence: 0.8 },
            '[E2]': { text: 'Revenue of $1.8B in 2024', source: 'Annual Report', url: null, confidence: 0.95 },
          },
        },
        output: `DataForge Analytics provides AI-powered business intelligence for Fortune 500 companies [E1]. Revenue of $1.8B in 2024 [E2].`,
      },
    ]

    it.each(testCases)('should pass trust threshold for $name', ({ output, evidence }) => {
      const result = runHallucinationCheck(output, evidence)
      expect(result.passesTrustThreshold).toBe(true)
      expect(result.hallucinatedCitations).toBe(0)
      expect(result.riskLevel).toMatch(/minimal|low/)
    })
  })

  // ═══ Ungrounded / Hallucinated Output Tests ═══

  describe('Ungrounded output should fail trust threshold', () => {
    it('should flag output with fabricated citations', () => {
      const evidence: EvidenceContext = {
        evidenceMap: {
          '[E1]': { text: 'Acme Cloud reported $4.2B revenue', source: 'SEC Filing', url: null, confidence: 0.95 },
        },
      }

      const hallucinatedOutput = `Acme Cloud raised $500M in Series D funding [E99]. The CEO is definitely Robert Chen [E50]. Revenue confirmed at $10B [E1].`
      const result = runHallucinationCheck(hallucinatedOutput, evidence)

      expect(result.hallucinatedCitations).toBeGreaterThanOrEqual(1)
      expect(result.passesTrustThreshold).toBe(false)
      expect(result.riskLevel).toMatch(/high|critical/)
    })

    it('should flag output with many uncited confident claims', () => {
      const evidence: EvidenceContext = {
        evidenceMap: {
          '[E1]': { text: 'Basic evidence about the company', source: 'Web', url: null, confidence: 0.5 },
        },
      }

      const uncitedOutput = `The company confirmed $5B revenue. They definitely acquired three startups. The CEO announced a 200% growth target. Plans to expand to 15 new markets by Q4.`
      const result = runHallucinationCheck(uncitedOutput, evidence)

      expect(result.uncitedClaims).toBeGreaterThanOrEqual(2)
      expect(result.riskLevel).toMatch(/medium|high|critical/)
    })
  })

  // ═══ Claim Extraction from Golden Company Data ═══

  describe('Claim extraction for golden companies', () => {
    it('should extract technology claims from tech company descriptions', () => {
      const text = 'Acme Cloud uses AWS and Kubernetes for cloud infrastructure management.'
      const claims = extractClaims(text)
      const techClaims = claims.filter(c => c.type === 'technology')
      expect(techClaims.length).toBeGreaterThanOrEqual(1)
    })

    it('should extract revenue claims with dollar amounts', () => {
      const companiesWithRevenue = TEST_COMPANIES.filter(c => c.annualRevenue.includes('$'))
      expect(companiesWithRevenue.length).toBeGreaterThan(40)

      // Use one company's data as test input
      const sample = companiesWithRevenue[0]
      const text = `${sample.name} confirmed ${sample.annualRevenue} in annual revenue.`
      const claims = extractClaims(text)
      const revenueClaims = claims.filter(c => c.type === 'revenue')
      expect(revenueClaims.length).toBeGreaterThanOrEqual(1)
    })

    it('should extract employee count claims', () => {
      const text = 'The company employs approximately 18,500 people worldwide.'
      const claims = extractClaims(text)
      const empClaims = claims.filter(c => c.type === 'employee_count')
      expect(empClaims.length).toBeGreaterThanOrEqual(1)
    })
  })

  // ═══ Specificity Scoring Across Industries ═══

  describe('Specificity scoring for different industries', () => {
    it('tech company brief should score high specificity', () => {
      const brief = `${TEST_COMPANIES[0].name} uses ${TEST_COMPANIES[0].technologies.slice(0, 3).join(', ')} for infrastructure. Revenue of ${TEST_COMPANIES[0].annualRevenue}. [E1] [E2]`
      const score = scoreSpecificity(brief)
      expect(score).toBeGreaterThanOrEqual(25)
    })

    it('generic brief should score low specificity', () => {
      const brief = 'The company is a well-known player in their industry. They have experienced growth and serve many clients.'
      const score = scoreSpecificity(brief)
      expect(score).toBeLessThan(15)
    })

    it('financial company brief should score high with monetary values', () => {
      const brief = `CapitalFlow reported $1.5B revenue [E1]. Processing volume of $50B annually [E2]. Growth rate of 15% YoY.`
      const score = scoreSpecificity(brief)
      expect(score).toBeGreaterThanOrEqual(30)
    })
  })

  // ═══ Hedging Detection in AI Output ═══

  describe('Hedging detection for enterprise intelligence', () => {
    it('should detect excessive hedging in uncertain analysis', () => {
      const text = 'The company may possibly expand into new markets. It seems likely they might consider an acquisition. Revenue could potentially grow by 20%.'
      const patterns = detectHedgingPatterns(text)
      expect(patterns.length).toBeGreaterThanOrEqual(3)
    })

    it('should find no hedging in confident analysis', () => {
      const text = 'Acme Cloud confirmed $4.2B revenue. The CEO announced the acquisition of DataVault Pro. Verified 18,500 employees globally.'
      const patterns = detectHedgingPatterns(text)
      expect(patterns.length).toBe(0)
    })
  })

  // ═══ Golden Dataset Completeness ═══

  describe('Golden dataset completeness', () => {
    it('should have exactly 50 test companies', () => {
      expect(TEST_COMPANIES.length).toBe(50)
    })

    it('all companies should have required fields', () => {
      for (const company of TEST_COMPANIES) {
        expect(company.id).toBeTruthy()
        expect(company.name).toBeTruthy()
        expect(company.domain).toBeTruthy()
        expect(company.industry).toBeTruthy()
        expect(company.size).toBeTruthy()
        expect(company.annualRevenue).toBeTruthy()
        expect(company.employeeCount).toBeGreaterThan(0)
        expect(company.headquarters).toBeTruthy()
        expect(company.technologies.length).toBeGreaterThan(0)
        expect(company.intelligenceScore).toBeGreaterThanOrEqual(0)
        expect(company.intelligenceScore).toBeLessThanOrEqual(100)
      }
    })

    it('should have companies across all sizes', () => {
      const sizes = new Set(TEST_COMPANIES.map(c => c.size))
      expect(sizes.has('enterprise')).toBe(true)
      expect(sizes.has('mid-market')).toBe(true)
    })

    it('should cover multiple industries', () => {
      const industries = new Set(TEST_COMPANIES.map(c => c.industry))
      expect(industries.size).toBeGreaterThanOrEqual(10)
    })
  })
})
