/**
 * DeepMindQ Enterprise Test Framework — Milestone 3
 * Section: Unit / AI Governance / Hallucination Prevention Certification
 *
 * Tests the AI hallucination prevention framework (src/lib/ai-hallucination-prevention.ts).
 * Validates claim extraction, citation verification, hedging detection,
 * specificity scoring, and composite hallucination risk scoring.
 *
 * These are PURE FUNCTION tests — no DB or LLM mocking required.
 */

import { describe, it, expect } from 'vitest'
import {
  extractClaims,
  verifyCitations,
  detectHedgingPatterns,
  scoreSpecificity,
  runHallucinationCheck,
  type EvidenceContext,
  type ExtractedClaim,
} from '@/lib/ai-hallucination-prevention'

describe('AI Hallucination Prevention — Certification', () => {
  // ── Claim Extraction ────────────────────────────────────────────

  describe('extractClaims — verifiable claim detection', () => {
    it('should extract revenue claims with dollar amounts', () => {
      const text = 'TechCorp Global reported $2.5B revenue in Q4 2024.'
      const claims = extractClaims(text)
      const revenueClaims = claims.filter(c => c.type === 'revenue')
      expect(revenueClaims.length).toBeGreaterThanOrEqual(1)
      expect(revenueClaims[0].text).toContain('$2.5B')
    })

    it('should extract employee count claims', () => {
      const text = 'The company employs approximately 12,000 people worldwide.'
      const claims = extractClaims(text)
      const empClaims = claims.filter(c => c.type === 'employee_count')
      expect(empClaims.length).toBeGreaterThanOrEqual(1)
    })

    it('should extract technology claims', () => {
      const text = 'They use AWS and Kubernetes for their infrastructure.'
      const claims = extractClaims(text)
      const techClaims = claims.filter(c => c.type === 'technology')
      expect(techClaims.length).toBeGreaterThanOrEqual(1)
    })

    it('should extract funding claims', () => {
      const text = 'They raised $100M in Series C funding.'
      const claims = extractClaims(text)
      const fundingClaims = claims.filter(c => c.type === 'funding')
      expect(fundingClaims.length).toBeGreaterThanOrEqual(1)
    })

    it('should extract leadership claims', () => {
      const text = 'The CEO is Jane Smith and the CTO is John Doe.'
      const claims = extractClaims(text)
      const leadershipClaims = claims.filter(c => c.type === 'leadership')
      expect(leadershipClaims.length).toBeGreaterThanOrEqual(1)
    })

    it('should detect citation markers near claims', () => {
      const text = 'TechCorp reported $500M revenue [E1]. The CEO is Sarah Johnson [E2].'
      const claims = extractClaims(text)
      const citedClaims = claims.filter(c => c.citationMarker !== null)
      expect(citedClaims.length).toBeGreaterThanOrEqual(1)
    })

    it('should return empty array for text with no verifiable claims', () => {
      const text = 'This is a general paragraph about business strategy and market trends.'
      const claims = extractClaims(text)
      expect(claims).toHaveLength(0)
    })
  })

  // ── Citation Verification ──────────────────────────────────────

  describe('verifyCitations — evidence grounding', () => {
    const baseEvidence: EvidenceContext = {
      evidenceMap: {
        '[E1]': { text: 'TechCorp reported $500M in annual revenue for fiscal year 2024', source: 'SEC Filing', url: 'https://sec.gov/filing', confidence: 0.95 },
        '[E2]': { text: 'Sarah Johnson was appointed CEO of TechCorp in March 2023', source: 'Press Release', url: null, confidence: 0.9 },
        '[E3]': { text: 'TechCorp uses AWS and Azure for cloud infrastructure', source: 'Tech Blog', url: 'https://techcorp.com/blog', confidence: 0.85 },
      },
    }

    it('should verify claims that align with evidence', () => {
      const claims: ExtractedClaim[] = [
        { text: '$500M revenue', type: 'revenue', entity: 'TechCorp', value: '$500M', citationMarker: '[E1]', expressedConfidence: 'high', position: 0 },
      ]
      const results = verifyCitations(claims, baseEvidence)
      expect(results).toHaveLength(1)
      expect(results[0].evidenceExists).toBe(true)
      expect(results[0].claimAligns).toBe(true)
    })

    it('should detect hallucinated citations (marker not in evidence)', () => {
      const claims: ExtractedClaim[] = [
        { text: 'confirmed partnership', type: 'partnership', entity: 'TechCorp', value: 'confirmed', citationMarker: '[E99]', expressedConfidence: 'high', position: 0 },
      ]
      const results = verifyCitations(claims, baseEvidence)
      expect(results).toHaveLength(1)
      expect(results[0].evidenceExists).toBe(false)
      expect(results[0].claimAligns).toBe(false)
      expect(results[0].explanation).toContain('hallucinated')
    })

    it('should skip claims without citation markers', () => {
      const claims: ExtractedClaim[] = [
        { text: 'uses AWS', type: 'technology', entity: 'TechCorp', value: 'uses AWS', citationMarker: null, expressedConfidence: 'medium', position: 0 },
      ]
      const results = verifyCitations(claims, baseEvidence)
      expect(results).toHaveLength(0)
    })

    it('should detect misaligned citations (evidence exists but claim contradicts)', () => {
      const claims: ExtractedClaim[] = [
        { text: 'CEO is Robert Chen', type: 'leadership', entity: 'TechCorp', value: 'Robert Chen', citationMarker: '[E2]', expressedConfidence: 'high', position: 0 },
      ]
      const results = verifyCitations(claims, baseEvidence)
      expect(results).toHaveLength(1)
      expect(results[0].evidenceExists).toBe(true)
      // The claim says "Robert Chen" but evidence says "Sarah Johnson" — alignment should be low
      expect(results[0].alignmentScore).toBeLessThan(0.5)
    })
  })

  // ── Hedging Detection ──────────────────────────────────────────

  describe('detectHedgingPatterns — uncertainty language', () => {
    it('should detect "may" hedging', () => {
      const results = detectHedgingPatterns('The company may expand into European markets.')
      expect(results.some(r => r.includes('"may"'))).toBe(true)
    })

    it('should detect "might" hedging', () => {
      const results = detectHedgingPatterns('They might consider an acquisition.')
      expect(results.some(r => r.includes('"might"'))).toBe(true)
    })

    it('should detect "possibly" hedging', () => {
      const results = detectHedgingPatterns('This could possibly impact their revenue.')
      expect(results.some(r => r.includes('"possibly"'))).toBe(true)
    })

    it('should detect multiple hedging patterns', () => {
      const text = 'The company may potentially expand, and it seems likely they will.'
      const results = detectHedgingPatterns(text)
      expect(results.length).toBeGreaterThanOrEqual(3)
    })

    it('should return empty for confident, factual text', () => {
      const text = 'TechCorp confirmed the acquisition. The CEO announced the deal.'
      const results = detectHedgingPatterns(text)
      expect(results).toHaveLength(0)
    })

    it('should count multiple occurrences of the same pattern', () => {
      const text = 'They may enter market A. They may also enter market B.'
      const results = detectHedgingPatterns(text)
      const mayResults = results.filter(r => r.includes('"may"'))
      expect(mayResults[0]).toContain('2x')
    })
  })

  // ── Specificity Scoring ────────────────────────────────────────

  describe('scoreSpecificity — output groundedness', () => {
    it('should score high for specific, cited output', () => {
      const text = 'TechCorp reported $500M revenue [E1]. CEO Sarah Johnson [E2]. Uses AWS [E3].'
      const score = scoreSpecificity(text)
      expect(score).toBeGreaterThanOrEqual(30)
    })

    it('should score low for generic, unspecific output', () => {
      const text = 'The company is doing well in the market and has good growth potential.'
      const score = scoreSpecificity(text)
      expect(score).toBeLessThan(20)
    })

    it('should detect monetary values for specificity', () => {
      const withMoney = 'Revenue of $2.5B and funding of $100M'
      const withoutMoney = 'Revenue is significant and funding is substantial'
      expect(scoreSpecificity(withMoney)).toBeGreaterThan(scoreSpecificity(withoutMoney))
    })

    it('should detect technology names for specificity', () => {
      const withTech = 'Built on Kubernetes using React and PostgreSQL'
      const withoutTech = 'Built on modern technology and frameworks'
      expect(scoreSpecificity(withTech)).toBeGreaterThan(scoreSpecificity(withoutTech))
    })

    it('should never exceed 100', () => {
      const maxText = '$100M AWS $200B GCP Kubernetes React [E1] [E2] [E3] John Smith Jane Doe'
      expect(scoreSpecificity(maxText)).toBeLessThanOrEqual(100)
    })
  })

  // ── Composite Hallucination Check ──────────────────────────────

  describe('runHallucinationCheck — comprehensive analysis', () => {
    const solidEvidence: EvidenceContext = {
      evidenceMap: {
        '[E1]': { text: 'TechCorp Global reported $2.5B revenue in 2024', source: 'SEC Filing', url: null, confidence: 0.95 },
        '[E2]': { text: 'Sarah Johnson is the CEO of TechCorp Global', source: 'Press Release', url: null, confidence: 0.9 },
        '[E3]': { text: 'TechCorp uses AWS and Kubernetes', source: 'Tech Blog', url: null, confidence: 0.85 },
      },
      knownFacts: { 'TechCorp Global revenue': '$2.5B', 'TechCorp Global CEO': 'Sarah Johnson' },
    }

    it('should return minimal risk for well-cited, grounded output', () => {
      const goodOutput = 'TechCorp Global reported $2.5B revenue [E1]. The CEO is Sarah Johnson [E2]. They use AWS [E3].'
      const result = runHallucinationCheck(goodOutput, solidEvidence)
      expect(result.riskLevel).toBe('minimal')
      expect(result.passesTrustThreshold).toBe(true)
      expect(result.hallucinatedCitations).toBe(0)
    })

    it('should flag high risk for hallucinated citations', () => {
      const badOutput = 'TechCorp raised $1B in funding [E99]. CEO is Unknown Person [E50].'
      const result = runHallucinationCheck(badOutput, solidEvidence)
      expect(result.hallucinatedCitations).toBeGreaterThanOrEqual(1)
      expect(result.riskLevel).toMatch(/high|critical/)
      expect(result.passesTrustThreshold).toBe(false)
    })

    it('should flag uncited confident claims as risk factor', () => {
      const uncitedOutput = 'TechCorp confirmed $5B revenue. The CEO is definitely Sarah Johnson.'
      const result = runHallucinationCheck(uncitedOutput, solidEvidence)
      expect(result.uncitedClaims).toBeGreaterThanOrEqual(1)
    })

    it('should include all analysis fields in result', () => {
      const result = runHallucinationCheck('Test output', solidEvidence)
      expect(result).toHaveProperty('hallucinationRiskScore')
      expect(result).toHaveProperty('riskLevel')
      expect(result).toHaveProperty('claims')
      expect(result).toHaveProperty('citationVerifications')
      expect(result).toHaveProperty('verifiedClaims')
      expect(result).toHaveProperty('unverifiedClaims')
      expect(result).toHaveProperty('uncitedClaims')
      expect(result).toHaveProperty('hallucinatedCitations')
      expect(result).toHaveProperty('hedgingPatterns')
      expect(result).toHaveProperty('specificityScore')
      expect(result).toHaveProperty('recommendations')
      expect(result).toHaveProperty('passesTrustThreshold')
      expect(result).toHaveProperty('timestamp')
    })

    it('should clamp risk score between 0 and 100', () => {
      const result = runHallucinationCheck('minimal output', solidEvidence)
      expect(result.hallucinationRiskScore).toBeGreaterThanOrEqual(0)
      expect(result.hallucinationRiskScore).toBeLessThanOrEqual(100)
    })

    it('should classify risk levels correctly', () => {
      // Minimal: 0-15, Low: 16-30, Medium: 31-50, High: 51-70, Critical: 71+
      const result = runHallucinationCheck(
        'TechCorp confirmed [E1]. CEO Sarah Johnson [E2]. Uses AWS [E3].',
        solidEvidence
      )
      expect(['minimal', 'low', 'medium', 'high', 'critical']).toContain(result.riskLevel)
    })
  })
})
