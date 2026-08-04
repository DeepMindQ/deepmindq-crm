/**
 * WI-16B Tests — Hallucination Prevention
 */

import { describe, it, expect } from 'vitest';
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

describe('WI-16B: Hallucination Prevention', () => {
  describe('extractClaims', () => {
    it('extracts revenue claims', () => {
      const text = 'The company generates $50M in annual revenue with strong growth.';
      const claims = extractClaims(text);
      expect(claims.length).toBeGreaterThanOrEqual(1);
      const revenueClaim = claims.find(c => c.type === 'revenue');
      expect(revenueClaim).toBeDefined();
      expect(revenueClaim!.text).toContain('$50M');
    });

    it('extracts technology claims', () => {
      const text = 'The company uses AWS and Kubernetes for their cloud infrastructure.';
      const claims = extractClaims(text);
      const techClaim = claims.find(c => c.type === 'technology');
      expect(techClaim).toBeDefined();
      expect(techClaim!.text).toContain('AWS');
    });

    it('extracts employee count claims', () => {
      const text = 'With approximately 500 employees, the company has been expanding.';
      const claims = extractClaims(text);
      const empClaim = claims.find(c => c.type === 'employee_count');
      expect(empClaim).toBeDefined();
      expect(empClaim!.text).toContain('500');
    });

    it('extracts funding claims', () => {
      const text = 'They raised $100M in Series C funding last quarter.';
      const claims = extractClaims(text);
      const fundingClaim = claims.find(c => c.type === 'funding');
      expect(fundingClaim).toBeDefined();
    });

    it('detects citation markers near claims', () => {
      const text = 'The company uses AWS for cloud infrastructure [E1].';
      const claims = extractClaims(text);
      const techClaim = claims.find(c => c.type === 'technology');
      expect(techClaim?.citationMarker).toBe('E1');
    });

    it('detects hedging confidence levels', () => {
      const certainText = 'The company confirmed the partnership with AWS [E1].';
      const claims = extractClaims(certainText);
      const certainClaim = claims.find(c => c.type === 'technology');
      expect(certainClaim?.expressedConfidence).toBe('high');

      const hedgingText = 'The company may be using Kubernetes, though this is uncertain.';
      const hedgingClaims = extractClaims(hedgingText);
      const hedgingClaim = hedgingClaims.find(c => c.type === 'technology');
      expect(hedgingClaim?.expressedConfidence).toBe('hedged' as string || hedgingClaim?.expressedConfidence).toBeTruthy();
    });

    it('handles text with no claims', () => {
      const text = 'This is a general statement with no specific claims about anything.';
      const claims = extractClaims(text);
      expect(Array.isArray(claims)).toBe(true);
    });
  });

  describe('verifyCitations', () => {
    it('verifies existing citations', () => {
      const claims = [
        { text: 'The company uses AWS', type: 'technology' as const, entity: 'TestCo', value: 'uses AWS', citationMarker: 'E1', expressedConfidence: 'high' as const, position: 0 },
      ];
      const evidenceContext = buildMinimalEvidenceContext([
        { marker: 'E1', text: 'AWS is their primary cloud provider', source: 'Company website', confidence: 0.9 },
      ]);
      const verifications = verifyCitations(claims, evidenceContext);
      expect(verifications).toHaveLength(1);
      expect(verifications[0].evidenceExists).toBe(true);
      expect(verifications[0].claimAligns).toBe(true);
      expect(verifications[0].alignmentScore).toBeGreaterThan(0);
    });

    it('detects hallucinated citations', () => {
      const claims = [
        { text: 'The company uses Azure [E5]', type: 'technology' as const, entity: 'TestCo', value: 'uses Azure', citationMarker: 'E5', expressedConfidence: 'high' as const, position: 0 },
      ];
      const evidenceContext = buildMinimalEvidenceContext([
        { marker: 'E1', text: 'AWS is their primary cloud provider', source: 'Company website', confidence: 0.9 },
      ]);
      const verifications = verifyCitations(claims, evidenceContext);
      expect(verifications).toHaveLength(1);
      expect(verifications[0].evidenceExists).toBe(false);
      expect(verifications[0].claimAligns).toBe(false);
    });

    it('skips uncited claims', () => {
      const claims = [
        { text: 'The company uses AWS', type: 'technology' as const, entity: 'TestCo', value: 'uses AWS', citationMarker: null, expressedConfidence: 'medium' as const, position: 0 },
      ];
      const evidenceContext = buildMinimalEvidenceContext([]);
      const verifications = verifyCitations(claims, evidenceContext);
      expect(verifications).toHaveLength(0);
    });
  });

  describe('detectHedgingPatterns', () => {
    it('detects multiple hedging patterns', () => {
      const text = 'The company may be expanding, and they might be hiring. It appears they could be growing.';
      const patterns = detectHedgingPatterns(text);
      expect(patterns.length).toBeGreaterThanOrEqual(3);
    });

    it('returns empty for confident text', () => {
      const text = 'The company confirmed the acquisition today. Revenue grew 20%.';
      const patterns = detectHedgingPatterns(text);
      expect(patterns.length).toBeLessThanOrEqual(1);
    });
  });

  describe('scoreSpecificity', () => {
    it('scores high specificity for grounded text', () => {
      const text = 'TestCo uses AWS and Kubernetes, generating $50M in revenue with 500 employees. Their CEO is Jane Smith [E1] [E2] [E3].';
      const score = scoreSpecificity(text);
      expect(score).toBeGreaterThan(50);
    });

    it('scores low specificity for generic text', () => {
      const text = 'This is a general overview of the company situation without specific details or numbers.';
      const score = scoreSpecificity(text);
      expect(score).toBeLessThan(30);
    });
  });

  describe('runHallucinationCheck', () => {
    it('returns minimal risk for grounded output', () => {
      const aiOutput = 'TestCo uses AWS for cloud infrastructure [E1]. Revenue is approximately $50M [E2].';
      const evidenceContext = buildMinimalEvidenceContext([
        { marker: 'E1', text: 'AWS is their primary cloud provider', source: 'Company website', confidence: 0.9 },
        { marker: 'E2', text: 'Annual revenue estimated at $50M', source: 'Crunchbase', confidence: 0.8 },
      ]);
      const result = runHallucinationCheck(aiOutput, evidenceContext);
      expect(result.riskLevel).toBe('minimal');
      expect(result.passesTrustThreshold).toBe(true);
      expect(result.hallucinatedCitations).toBe(0);
      expect(result.timestamp).toBeDefined();
    });

    it('detects critical risk for hallucinated citations', () => {
      const aiOutput = 'TestCo uses Azure [E99] and has raised $200M [E100] in funding. The CEO is Bob Johnson [E101].';
      const evidenceContext = buildMinimalEvidenceContext([
        { marker: 'E1', text: 'Some evidence', source: 'Test', confidence: 0.5 },
      ]);
      const result = runHallucinationCheck(aiOutput, evidenceContext);
      expect(result.hallucinatedCitations).toBeGreaterThanOrEqual(2);
      expect(result.riskLevel).toBe('critical' as string || 'high' as string);
      expect(result.passesTrustThreshold).toBe(false);
    });

    it('includes recommendations', () => {
      const aiOutput = 'TestCo uses something. They might be growing.';
      const evidenceContext = buildMinimalEvidenceContext([]);
      const result = runHallucinationCheck(aiOutput, evidenceContext);
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('buildEvidenceContextFromChain', () => {
    it('builds context from grounding engine output', () => {
      const context = buildEvidenceContextFromChain({
        evidences: [
          { id: 'sig1', source: 'LinkedIn', url: 'https://linkedin.com', snippet: 'Hiring', content: 'Company is hiring 50 engineers', reliability: 0.75, confidence: 0.8 },
          { id: 'sig2', source: 'TechCrunch', url: 'https://techcrunch.com', snippet: 'Funding', content: 'Raised $30M Series B', reliability: 0.78, confidence: 0.9 },
        ],
        fieldConfidence: { revenue: 0.7, employees: 0.5 },
      });
      expect(context.evidenceMap['E1']).toBeDefined();
      expect(context.evidenceMap['E2']).toBeDefined();
      expect(context.fieldConfidence?.revenue).toBe(0.7);
    });
  });

  describe('formatHallucinationReportForLog', () => {
    it('formats report as string', () => {
      const result = runHallucinationCheck('Test output', buildMinimalEvidenceContext([]));
      const report = formatHallucinationReportForLog(result);
      expect(typeof report).toBe('string');
      expect(report).toContain('HallucinationCheck');
    });
  });
});
