/**
 * MS9 Integration Layer — Briefing Adapter Tests
 * ================================================
 *
 * Tests the core translation function that converts backend
 * intelligence outputs (SynthesisEngine Brief) into MS9
 * StructuredBriefing format.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { adaptBriefToStructuredBriefing } from '@/lib/advisor/briefing-adapter';
import type { BriefingAdapterConfig, BriefingAdapterInput } from '@/lib/advisor/briefing-adapter';
import type { Brief, BriefSection } from '@/lib/engines/synthesis-engine';
import type { AdvisorAccountContext } from '@/types/ms9-advisor';
import { validateBriefing } from '@/types/ms9-advisor';

// ─── Test Fixtures ───────────────────────────────────────────────

function createTestBrief(overrides: Partial<Brief> = {}): Brief {
  return {
    type: 'account_brief',
    content: '## Strategic Situation\nThis company is experiencing rapid growth in the AI sector.\n\n## Key Signals\nRecent funding rounds and key hires indicate expansion plans.',
    sections: [
      {
        heading: 'Strategic Situation',
        body: 'This company is experiencing rapid growth in the AI sector with strong market positioning.',
        confidence: 0.82,
        citations: ['signal:abc123', 'signal:def456'],
      },
      {
        heading: 'Key Signals',
        body: 'Recent $50M Series C funding round led by Accel Partners. Three VP-level hires in the last quarter.',
        confidence: 0.75,
        citations: ['signal:ghi789'],
      },
      {
        heading: 'Technology Indicators',
        body: 'Heavy investment in ML infrastructure. Recently adopted Kubernetes and microservices architecture.',
        confidence: 0.68,
        citations: ['signal:jkl012'],
      },
    ] as BriefSection[],
    citations: [
      { marker: 'E1', evidenceId: 'signal:abc123', snippet: 'Series C funding announcement', url: 'https://example.com/funding' },
      { marker: 'E2', evidenceId: 'signal:def456', snippet: 'VP Engineering hire announcement', url: null },
      { marker: 'E3', evidenceId: 'signal:ghi789', snippet: 'AI sector growth report', url: 'https://example.com/ai-growth' },
    ],
    confidence: 0.78,
    evidenceChain: [{ id: 'chain-1', items: [] } as any, { id: 'chain-2', items: [] } as any],
    gaps: [],
    wordCount: 450,
    modelUsed: 'gpt-4-turbo',
    durationMs: 3200,
    tokensUsed: 2048,
    costUsd: 0.03,
    warnings: [],
    success: true,
    error: null,
    ...overrides,
  };
}

function createTestAccountContext(): AdvisorAccountContext {
  return {
    primaryAccount: {
      companyId: 'company-123',
      companyName: 'Acme Corp',
      domain: 'acme.com',
      industry: 'Technology',
    },
    activeSignals: [
      {
        id: 'sig-1',
        type: 'funding_round',
        title: 'Series C Funding',
        summary: 'Raised $50M',
        severity: 'high',
        detectedAt: '2024-01-15T00:00:00Z',
        source: 'rss',
      },
    ],
    activeSignalCount: 1,
    relatedAccounts: [],
    dataFreshness: [
      { label: 'Company Profile', lastRefreshedAt: '2024-01-15T00:00:00Z', freshnessLabel: 'Fresh', isFresh: true },
    ],
    sourceStatus: { activeSourceCount: 3, sources: [{ name: 'RSS', status: 'active' as const, lastSync: '2024-01-15T00:00:00Z' }], connectionStatus: 'connected' },
  };
}

function createTestConfig(): BriefingAdapterConfig {
  return {
    companyId: 'company-123',
    companyName: 'Acme Corp',
    domain: 'acme.com',
    industry: 'Technology',
  };
}

function createTestInput(brief: Brief = createTestBrief()): BriefingAdapterInput {
  return {
    brief,
    accountContext: createTestAccountContext(),
    query: 'How should we approach this company?',
    durationMs: 3200,
    modelUsed: 'gpt-4-turbo',
    tokensUsed: { prompt: 1024, completion: 1024, total: 2048 },
  };
}

// ─── Tests ─────────────────────────────────────────────────────────

describe('BriefingAdapter', () => {
  describe('adaptBriefToStructuredBriefing', () => {
    it('should produce a valid StructuredBriefing from a complete Brief', () => {
      const brief = createTestBrief();
      const input = createTestInput(brief);
      const config = createTestConfig();

      const result = adaptBriefToStructuredBriefing(input, config);

      // Validate against MS9's own validation
      const validation = validateBriefing(result);
      expect(validation.valid).toBe(true);
    });

    it('should include all required StructuredBriefing fields', () => {
      const input = createTestInput();
      const config = createTestConfig();

      const result = adaptBriefToStructuredBriefing(input, config);

      expect(result.id).toBeTruthy();
      expect(result.title).toContain('Acme Corp');
      expect(result.summary).toBeTruthy();
      expect(result.blocks).toBeInstanceOf(Array);
      expect(result.signalPills).toBeInstanceOf(Array);
      expect(result.trustFooter).toBeDefined();
      expect(result.confidence).toBeDefined();
      expect(result.accountContext).toBeDefined();
      expect(result.generatedAt).toBeTruthy();
      expect(result.modelUsed).toBe('gpt-4-turbo');
      expect(result.processingDurationMs).toBe(3200);
    });

    it('should produce Key Findings block from brief sections', () => {
      const input = createTestInput();
      const config = createTestConfig();

      const result = adaptBriefToStructuredBriefing(input, config);

      const keyFindings = result.blocks.find((b) => b.type === 'key_findings');
      expect(keyFindings).toBeDefined();
      if (keyFindings && keyFindings.content.type === 'key_findings') {
        expect(keyFindings.content.findings.length).toBeGreaterThan(0);
        expect(keyFindings.content.findings[0].headline).toBe('Strategic Situation');
      }
    });

    it('should produce Signals block from brief citations', () => {
      const input = createTestInput();
      const config = createTestConfig();

      const result = adaptBriefToStructuredBriefing(input, config);

      const signals = result.blocks.find((b) => b.type === 'signals');
      expect(signals).toBeDefined();
      if (signals && signals.content.type === 'signals') {
        expect(signals.content.pills.length).toBe(3); // 3 citations
      }
    });

    it('should produce Recommendations block when recommendation is provided', () => {
      const input = createTestInput();
      input.recommendation = {
        score: 85,
        tier: 'HOT_ACCOUNT' as any,
        reasons: [
          { text: 'Strong ICP fit', category: 'icp_fit', strength: 0.9, sourceId: 'sig-1' },
          { text: 'Recent buying signals', category: 'signal', strength: 0.85, sourceId: 'sig-2' },
        ],
        risks: [],
        recommendedAction: 'Reach out to VP of Engineering',
        intelligenceSummary: 'Hot account with strong signals',
        enrichmentSources: [],
        metadata: {},
      } as any;

      const config = createTestConfig();
      const result = adaptBriefToStructuredBriefing(input, config);

      const recs = result.blocks.find((b) => b.type === 'recommendations');
      expect(recs).toBeDefined();
      if (recs && recs.content.type === 'recommendations') {
        expect(recs.content.recommendations.length).toBe(2);
        expect(recs.content.recommendations[0].title).toBe('icp_fit');
      }
    });

    it('should produce Risk Flags block from brief warnings', () => {
      const brief = createTestBrief({
        warnings: ['Hallucinated citation [E99] detected', 'Low evidence for technology claims'],
      });
      const input = createTestInput(brief);
      const config = createTestConfig();

      const result = adaptBriefToStructuredBriefing(input, config);

      const risks = result.blocks.find((b) => b.type === 'risk_flags');
      expect(risks).toBeDefined();
      if (risks && risks.content.type === 'risk_flags') {
        expect(risks.content.flags.length).toBeGreaterThan(0);
      }
    });

    it('should produce Narrative block from brief content', () => {
      const input = createTestInput();
      const config = createTestConfig();

      const result = adaptBriefToStructuredBriefing(input, config);

      const narrative = result.blocks.find((b) => b.type === 'narrative');
      expect(narrative).toBeDefined();
      if (narrative && narrative.content.type === 'narrative') {
        expect(narrative.content.paragraphs.length).toBeGreaterThan(0);
      }
    });

    it('should produce Data Summary block with intelligence metrics', () => {
      const input = createTestInput();
      const config = createTestConfig();

      const result = adaptBriefToStructuredBriefing(input, config);

      const summary = result.blocks.find((b) => b.type === 'data_summary');
      expect(summary).toBeDefined();
      if (summary && summary.content.type === 'data_summary') {
        expect(summary.content.metrics.length).toBe(5);
        expect(summary.content.metrics[0].label).toBe('Evidence Sources');
        expect(summary.content.metrics[0].value).toBe('3');
      }
    });

    it('should generate signal pills from brief sections', () => {
      const input = createTestInput();
      const config = createTestConfig();

      const result = adaptBriefToStructuredBriefing(input, config);

      expect(result.signalPills.length).toBeGreaterThan(0);
      expect(result.signalPills[0]).toHaveProperty('signalId');
      expect(result.signalPills[0]).toHaveProperty('label');
      expect(result.signalPills[0]).toHaveProperty('variant');
      expect(result.signalPills[0]).toHaveProperty('confidenceScore');
    });

    it('should include trust footer with evidence sources', () => {
      const input = createTestInput();
      const config = createTestConfig();

      const result = adaptBriefToStructuredBriefing(input, config);

      expect(result.trustFooter.totalEvidenceCount).toBe(3);
      expect(result.trustFooter.sources.length).toBe(3);
      expect(result.trustFooter.sources[0].sourceName).toBe('E1');
    });

    it('should include confidence footer with correct score', () => {
      const input = createTestInput();
      const config = createTestConfig();

      const result = adaptBriefToStructuredBriefing(input, config);

      expect(result.confidence.score).toBe(78); // 0.78 * 100
      expect(result.confidence.trustTier).toBe('high');
      expect(result.confidence.direction).toBe('stable');
    });

    it('should include inline reasoning chain when includeReasoning is true', () => {
      const input = createTestInput();
      const config = createTestConfig({ ...createTestConfig(), includeReasoning: true });

      const result = adaptBriefToStructuredBriefing(input, config);

      expect(result.inlineReasoning).toBeDefined();
      expect(result.inlineReasoning!.steps.length).toBeGreaterThan(0);
    });

    it('should omit inline reasoning when includeReasoning is false', () => {
      const input = createTestInput();
      const config = createTestConfig();
      config.includeReasoning = false;

      const result = adaptBriefToStructuredBriefing(input, config);

      expect(result.inlineReasoning).toBeUndefined();
    });

    it('should correctly map trust tiers from confidence scores', () => {
      // Test verified tier
      const highBrief = createTestBrief({ confidence: 0.95 });
      let result = adaptBriefToStructuredBriefing(createTestInput(highBrief), createTestConfig());
      expect(result.confidence.trustTier).toBe('verified');

      // Test high tier
      const goodBrief = createTestBrief({ confidence: 0.8 });
      result = adaptBriefToStructuredBriefing(createTestInput(goodBrief), createTestConfig());
      expect(result.confidence.trustTier).toBe('high');

      // Test medium tier
      const medBrief = createTestBrief({ confidence: 0.6 });
      result = adaptBriefToStructuredBriefing(createTestInput(medBrief), createTestConfig());
      expect(result.confidence.trustTier).toBe('medium');

      // Test low tier
      const lowBrief = createTestBrief({ confidence: 0.3 });
      result = adaptBriefToStructuredBriefing(createTestInput(lowBrief), createTestConfig());
      expect(result.confidence.trustTier).toBe('low');
    });

    it('should handle brief with no sections gracefully', () => {
      const emptyBrief = createTestBrief({ sections: [], citations: [], confidence: 0.5 });
      const input = createTestInput(emptyBrief);
      const config = createTestConfig();

      const result = adaptBriefToStructuredBriefing(input, config);

      expect(result.blocks.length).toBeGreaterThan(0); // Should still have data_summary
      expect(result.signalPills.length).toBe(0);
    });

    it('should respect maxEvidenceItems config', () => {
      const input = createTestInput();
      const config = createTestConfig();
      config.maxEvidenceItems = 2;

      const result = adaptBriefToStructuredBriefing(input, config);

      expect(result.trustFooter.sources.length).toBeLessThanOrEqual(2);
    });

    it('should derive confidence from brief when no explicit confidence provided', () => {
      const input = createTestInput();
      delete input.confidence;
      const config = createTestConfig();

      const result = adaptBriefToStructuredBriefing(input, config);

      expect(result.confidence.score).toBe(78);
    });

    it('should generate title including company name and query', () => {
      const input = createTestInput();
      const config = createTestConfig();

      const result = adaptBriefToStructuredBriefing(input, config);

      expect(result.title).toContain('Acme Corp');
      expect(result.title).toContain('How should we approach this company?');
    });
  });
});
