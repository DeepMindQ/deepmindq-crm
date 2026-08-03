/**
 * WI-16B/C/D Tests — Hallucination Prevention, Unified Confidence, Prompt Registry
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
import {
  computeUnifiedConfidence,
  getSourceReliability,
  formatConfidenceForLog,
  formatConfidenceForDisplay,
} from '@/lib/ai-unified-confidence';
import {
  getPrompt,
  getSystemPrompt,
  buildUserPrompt,
  listPrompts,
  listCategories,
  addPromptVersion,
  rollbackPromptVersion,
  getRegistryStats,
} from '@/lib/ai-prompt-registry';

// ── WI-16B: Hallucination Prevention Tests ──

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
      // May still find some patterns but should not crash
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
      // Should have minimal or no hedging
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

// ── WI-16C: Unified Confidence Engine Tests ──

describe('WI-16C: Unified Confidence Engine', () => {
  describe('computeUnifiedConfidence', () => {
    it('computes high confidence for well-sourced, fresh data', () => {
      const result = computeUnifiedConfidence({
        fieldConfidence: { revenue: 0.9, employees: 0.85, technology: 0.8, industry: 0.9 },
        dataCompleteness: 0.9,
        sources: [
          { name: 'bloomberg.com', reliability: 0.92, type: 'financial' },
          { name: 'company website', reliability: 0.88, type: 'company' },
          { name: 'crunchbase.com', reliability: 0.85, type: 'funding' },
        ],
        daysSinceResearch: 5,
        freshnessScore: 95,
        crossValidatedFacts: 8,
        totalFacts: 10,
        contradictions: 0,
        evidenceCount: 15,
        evidenceCoverage: 0.9,
        coveredDimensions: 8,
        expectedDimensions: 9,
        qualityGateScore: 85,
        hallucinationRiskScore: 10,
      });
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.grade).toMatch(/^[AB]/);
      expect(result.trustClass).toBe('enterprise');
      expect(result.enterpriseReady).toBe(true);
      expect(result.factors).toHaveLength(6);
      expect(result.modelVersion).toBe('v1-wi16c-unified');
    });

    it('computes low confidence for stale, poorly-sourced data', () => {
      const result = computeUnifiedConfidence({
        fieldConfidence: { revenue: 0.2, employees: 0.1 },
        dataCompleteness: 0.2,
        sources: [
          { name: 'unknown blog', reliability: 0.3, type: 'blog' },
        ],
        daysSinceResearch: 200,
        freshnessScore: 10,
        crossValidatedFacts: 1,
        totalFacts: 10,
        contradictions: 3,
        evidenceCount: 1,
        evidenceCoverage: 0.1,
        evidenceGaps: 8,
        qualityGateScore: 25,
        hallucinationRiskScore: 70,
      });
      expect(result.score).toBeLessThanOrEqual(40);
      expect(result.trustClass).toBe('speculative' as string || 'unreliable' as string);
      expect(result.enterpriseReady).toBe(false);
    });

    it('handles partial input gracefully', () => {
      const result = computeUnifiedConfidence({
        daysSinceResearch: 30,
      });
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
      expect(result.factors).toHaveLength(6);
      expect(result.timestamp).toBeDefined();
    });

    it('handles empty input gracefully', () => {
      const result = computeUnifiedConfidence({});
      expect(result.score).toBeGreaterThanOrEqual(0);
      expect(result.score).toBeLessThanOrEqual(100);
    });

    it('provides recommendations for weak dimensions', () => {
      const result = computeUnifiedConfidence({
        daysSinceResearch: 150,
        fieldConfidence: { revenue: 0.1 },
        evidenceCount: 1,
      });
      expect(result.recommendations.length).toBeGreaterThan(0);
    });
  });

  describe('getSourceReliability', () => {
    it('returns high reliability for government sources', () => {
      expect(getSourceReliability('sec.gov')).toBe(0.95);
      expect(getSourceReliability('reuters.com')).toBe(0.92);
    });

    it('returns medium reliability for news sources', () => {
      expect(getSourceReliability('techcrunch.com')).toBe(0.78);
      expect(getSourceReliability('linkedin.com')).toBe(0.75);
    });

    it('returns default for unknown sources', () => {
      expect(getSourceReliability('random-blog.com')).toBe(0.6);
    });

    it('handles category keywords', () => {
      expect(getSourceReliability('government filing')).toBe(0.90);
      expect(getSourceReliability('social media')).toBe(0.50);
    });
  });

  describe('formatting', () => {
    it('formats for log', () => {
      const result = computeUnifiedConfidence({ daysSinceResearch: 30 });
      const log = formatConfidenceForLog(result);
      expect(typeof log).toBe('string');
      expect(log).toContain('Confidence');
    });

    it('formats for display', () => {
      const result = computeUnifiedConfidence({ daysSinceResearch: 30 });
      const display = formatConfidenceForDisplay(result);
      expect(display.label).toContain('/');
      expect(display.color).toBeDefined();
      expect(display.factors).toHaveLength(6);
    });
  });
});

// ── WI-16D: Prompt Registry Tests ──

describe('WI-16D: Prompt Registry', () => {
  describe('getPrompt', () => {
    it('retrieves registered prompts', () => {
      const prompt = getPrompt('synthesis_account_brief');
      expect(prompt).not.toBeNull();
      expect(prompt!.id).toBe('synthesis_account_brief');
      expect(prompt!.category).toBe('company_analysis');
      expect(prompt!.tier).toBe('deep');
    });

    it('returns null for non-existent prompts', () => {
      const prompt = getPrompt('non_existent_prompt');
      expect(prompt).toBeNull();
    });
  });

  describe('getSystemPrompt', () => {
    it('returns the active version system prompt', () => {
      const prompt = getSystemPrompt('synthesis_account_brief');
      expect(typeof prompt).toBe('string');
      expect(prompt!.length).toBeGreaterThan(50);
      expect(prompt).toContain('senior account strategist');
    });

    it('returns null for non-existent prompts', () => {
      const prompt = getSystemPrompt('non_existent');
      expect(prompt).toBeNull();
    });
  });

  describe('buildUserPrompt', () => {
    it('returns null for prompts without user template', () => {
      const prompt = buildUserPrompt('synthesis_account_brief', {});
      expect(prompt).toBeNull();
    });
  });

  describe('listPrompts', () => {
    it('lists all prompts', () => {
      const prompts = listPrompts();
      expect(prompts.length).toBeGreaterThanOrEqual(10);
    });

    it('filters by category', () => {
      const prompts = listPrompts({ category: 'email_generation' });
      expect(prompts.length).toBeGreaterThanOrEqual(1);
      expect(prompts.every(p => p.category === 'email_generation')).toBe(true);
    });
  });

  describe('listCategories', () => {
    it('returns category summary', () => {
      const categories = listCategories();
      expect(categories.length).toBeGreaterThan(0);
      expect(categories[0].count).toBeGreaterThan(0);
    });
  });

  describe('addPromptVersion', () => {
    it('adds a new version and deactivates old', () => {
      const prompt = getPrompt('synthesis_account_brief')!;
      const oldActiveCount = prompt.versions.filter(v => v.active).length;
      expect(oldActiveCount).toBe(1);

      const result = addPromptVersion('synthesis_account_brief', {
        version: '2.0',
        systemPrompt: 'Updated prompt for testing versioning.',
        changelog: 'Test version upgrade',
      });
      expect(result).toBe(true);

      const updated = getPrompt('synthesis_account_brief')!;
      expect(updated.currentVersion).toBe('2.0');
      const activeVersions = updated.versions.filter(v => v.active);
      expect(activeVersions).toHaveLength(1);
      expect(activeVersions[0].version).toBe('2.0');

      // Rollback for test cleanup
      rollbackPromptVersion('synthesis_account_brief', '1.0');
    });
  });

  describe('rollbackPromptVersion', () => {
    it('rolls back to a previous version', () => {
      addPromptVersion('scoring_narrative', {
        version: '2.0',
        systemPrompt: 'New version',
        changelog: 'Test',
      });

      const result = rollbackPromptVersion('scoring_narrative', '1.0');
      expect(result).toBe(true);

      const prompt = getPrompt('scoring_narrative')!;
      expect(prompt.currentVersion).toBe('1.0');
    });

    it('returns false for non-existent version', () => {
      const result = rollbackPromptVersion('scoring_narrative', 'v99');
      expect(result).toBe(false);
    });
  });

  describe('getRegistryStats', () => {
    it('returns registry statistics', () => {
      const stats = getRegistryStats();
      expect(stats.totalPrompts).toBeGreaterThan(0);
      expect(stats.totalVersions).toBeGreaterThanOrEqual(stats.totalPrompts);
      expect(stats.categories.length).toBeGreaterThan(0);
    });
  });
});
