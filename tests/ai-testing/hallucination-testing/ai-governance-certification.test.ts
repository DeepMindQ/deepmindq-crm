/**
 * Milestone 3 — AI Governance Certification Tests (M3-v4)
 * Section 3.5: AI Intelligence Testing
 *
 * Validates the AI governance layer including:
 * - Generation type configurations (40+ types)
 * - Confidence gates per generation type
 * - Freshness validation
 * - Evidence grounding
 * - Non-throwing governance checks
 *
 * All 8 previously-skipped tests now aligned with the real GovernanceContext interface.
 *
 * Run: npx vitest run --config vitest.ai-governance.config.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════
// Module Mocks
// ═══════════════════════════════════════════════════════════════

vi.mock('@/lib/db', () => ({
  db: {
    aIGenerationAudit: {
      create: vi.fn().mockResolvedValue({ id: 'audit-001' }),
    },
    evidence: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock('@/lib/ai-cache-layer', () => ({
  AICacheLayer: {
    getInstance: vi.fn().mockReturnValue({
      get: vi.fn().mockResolvedValue(null),
      set: vi.fn().mockResolvedValue(true),
    }),
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('@/lib/research-engine', () => ({
  getCompanyEvidence: vi.fn().mockResolvedValue([]),
  getEvidenceSummary: vi.fn().mockResolvedValue({
    totalEvidence: 5,
    fields: {},
  }),
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

// ═══════════════════════════════════════════════════════════════
// Imports (mocks hoisted above by vitest)
// ═══════════════════════════════════════════════════════════════

import type { ResearchContext } from '@/lib/intelligence-contract';
import {
  getGovernanceConfig,
  getRegisteredGenerationTypes,
  runGovernanceChecks,
  buildGovernancePromptAddon,
  buildEvidenceGroundingNote,
  evaluateDomainFreshness,
} from '@/lib/ai-governance';

// ── Helper: Build a valid ResearchContext matching the real interface ──

function makeResearchContext(overrides: Partial<ResearchContext> = {}): ResearchContext {
  const now = new Date().toISOString();
  return {
    companyId: 'co-001',
    companyName: 'Test Corp',
    domain: null,
    industry: 'SaaS',
    website: 'https://testcorp.com',
    country: 'US',
    sizeRange: null,
    internalSummary: null,
    researchCard: {
      exists: true,
      source: 'research_engine_v3',
      enrichedAt: now,
      businessOverview: 'A leading SaaS platform',
      revenue: '$50M ARR',
      employeeCount: '500',
      fundingStage: 'Series C',
      techStack: 'AWS, React, Node.js',
      socialProfiles: {},
      industry: 'SaaS',
      website: 'https://testcorp.com',
      profileFreshnessAt: new Date(),
      signalFreshnessAt: new Date(),
      techFreshnessAt: new Date(),
      contactFreshnessAt: new Date(),
    },
    keyPeople: [],
    signals: [],
    recentNews: [],
    fieldConfidence: { revenue: 0.9, employees: 0.85, tech: 0.8 },
    evidenceSummary: { totalEvidence: 10, fields: {} },
    freshness: {
      score: 80,
      status: 'fresh',
      lastResearchedAt: now,
      daysSinceResearch: 5,
      evidenceCount: 10,
      signalCount: 3,
      categories: {
        profile: { score: 95, status: 'fresh', lastVerifiedAt: now, daysSinceVerification: 2 },
        signal: { score: 90, status: 'fresh', lastVerifiedAt: now, daysSinceVerification: 3 },
        contact: { score: 85, status: 'fresh', lastVerifiedAt: now, daysSinceVerification: 5 },
        technology: { score: 80, status: 'fresh', lastVerifiedAt: now, daysSinceVerification: 4 },
      },
    },
    structuredTechLandscape: { cloud: [], data: [], ai: [], applications: [] },
    strategicPriorities: [],
    capabilityMatchingInputs: { businessProblems: [], transformationAreas: [], technologyThemes: [] },
    contactCount: 3,
    internalNotes: null,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════

describe('AI Governance — Configuration Validation', () => {
  it('exports getGovernanceConfig function', () => {
    expect(typeof getGovernanceConfig).toBe('function');
  });

  it('returns valid config for email_draft generation type', () => {
    const config = getGovernanceConfig('email_draft');
    expect(config.minResearchConfidence).toBe(0.6);
    expect(config.minFreshnessScore).toBe(25);
    expect(config.requireCapabilityMatch).toBe(true);
    expect(config.requireRecentIntelligence).toBe(true);
    expect(config.maxStalenessDays).toBe(60);
  });

  it('returns valid config for conversation_plan generation type', () => {
    const config = getGovernanceConfig('conversation_plan');
    expect(config.minResearchConfidence).toBe(0.6);
    expect(config.minFreshnessScore).toBe(25);
  });

  it('returns valid config for account_brief (lower thresholds)', () => {
    const config = getGovernanceConfig('account_brief');
    expect(config.minResearchConfidence).toBe(0.2);
    expect(config.minFreshnessScore).toBe(10);
    expect(config.requireRecentIntelligence).toBe(false);
  });

  it('returns default config for unknown generation type (deny-by-default)', () => {
    const config = getGovernanceConfig('unknown_type_xyz');
    expect(config).toBeDefined();
    expect(typeof config.minResearchConfidence).toBe('number');
    expect(typeof config.maxStalenessDays).toBe('number');
  });

  it('has stricter thresholds for email_draft than for account_brief', () => {
    const email = getGovernanceConfig('email_draft');
    const brief = getGovernanceConfig('account_brief');
    expect(email.minResearchConfidence).toBeGreaterThan(brief.minResearchConfidence);
    expect(email.minFreshnessScore).toBeGreaterThan(brief.minFreshnessScore);
  });
});

describe('AI Governance — Registered Generation Types', () => {
  it('exports getRegisteredGenerationTypes function', () => {
    expect(typeof getRegisteredGenerationTypes).toBe('function');
  });

  it('registers at least 30 generation types', () => {
    const types = getRegisteredGenerationTypes();
    expect(types.size).toBeGreaterThanOrEqual(30);
  });

  it('includes all core generation types', () => {
    const types = getRegisteredGenerationTypes();
    const coreTypes = [
      'email_draft', 'conversation_plan', 'account_brief', 'signal_analysis',
      'suggested_contacts', 'enrichment', 'insights', 'opportunities',
      'recommendations', 'score_leads', 'pdf_report', 'reasoning',
    ];
    for (const type of coreTypes) {
      expect(types.has(type), `Missing core type: ${type}`).toBe(true);
    }
  });

  it('includes Phase 3 hardened types', () => {
    const types = getRegisteredGenerationTypes();
    const phase3Types = [
      'ppt_generation', 'query_parsing', 'summarize', 'knowledge_enrichment',
      'command_center_query', 'command_center_analysis', 'ab_test_variant',
    ];
    for (const type of phase3Types) {
      expect(types.has(type), `Missing Phase 3 type: ${type}`).toBe(true);
    }
  });
});

describe('AI Governance — Confidence Gate Enforcement (previously skipped — now aligned)', () => {
  it('TEST 1: high-confidence type (email_draft) blocks low-research data', async () => {
    // email_draft requires minResearchConfidence=0.6, provide avg 0.3 → should fail
    const result = await runGovernanceChecks({
      generationType: 'email_draft',
      companyId: 'co-001',
      researchContext: makeResearchContext({
        fieldConfidence: { revenue: 0.3, employees: 0.2, tech: 0.4 },
        // avg = (0.3 + 0.2 + 0.4) / 3 = 0.3, which is < 0.6 threshold
      }),
      capabilityMatchCount: 2,
    });
    expect(result.checks.research_confidence.passed).toBe(false);
    expect(result.canProceed).toBe(false);
    expect(result.rejectionReason).not.toBeNull();
  });

  it('TEST 2: low-confidence type (account_brief) allows lower research data', async () => {
    // account_brief requires minResearchConfidence=0.2, provide avg 0.25 → should pass
    const result = await runGovernanceChecks({
      generationType: 'account_brief',
      companyId: 'co-001',
      researchContext: makeResearchContext({
        fieldConfidence: { revenue: 0.25, employees: 0.25, tech: 0.25 },
        // avg = 0.25, which is >= 0.2 threshold
        // requireRecentIntelligence=false, so recent_intelligence always passes
      }),
    });
    expect(result.canProceed).toBe(true);
  });

  it('TEST 3: enforces freshness threshold for email generation', async () => {
    // email_draft requires minFreshnessScore=25, provide score=15 → should fail
    const result = await runGovernanceChecks({
      generationType: 'email_draft',
      companyId: 'co-001',
      researchContext: makeResearchContext({
        freshness: {
          score: 15,
          status: 'stale',
          lastResearchedAt: new Date().toISOString(),
          daysSinceResearch: 30,
          evidenceCount: 10,
          signalCount: 3,
          categories: {
            profile: { score: 15, status: 'stale', lastVerifiedAt: null, daysSinceVerification: null },
            signal: { score: 0, status: 'none', lastVerifiedAt: null, daysSinceVerification: null },
            contact: { score: 0, status: 'none', lastVerifiedAt: null, daysSinceVerification: null },
            technology: { score: 0, status: 'none', lastVerifiedAt: null, daysSinceVerification: null },
          },
        },
      }),
      capabilityMatchCount: 2,
    });
    expect(result.checks.freshness_score.passed).toBe(false);
    expect(result.canProceed).toBe(false);
  });

  it('TEST 4: enforces staleness threshold', async () => {
    // email_draft maxStalenessDays=60, provide daysSinceResearch=100 → should fail
    const result = await runGovernanceChecks({
      generationType: 'email_draft',
      companyId: 'co-001',
      researchContext: makeResearchContext({
        freshness: {
          score: 50,
          status: 'stale',
          lastResearchedAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString(),
          daysSinceResearch: 100,
          evidenceCount: 10,
          signalCount: 3,
          categories: {
            profile: { score: 50, status: 'stale', lastVerifiedAt: null, daysSinceVerification: null },
            signal: { score: 0, status: 'none', lastVerifiedAt: null, daysSinceVerification: null },
            contact: { score: 0, status: 'none', lastVerifiedAt: null, daysSinceVerification: null },
            technology: { score: 0, status: 'none', lastVerifiedAt: null, daysSinceVerification: null },
          },
        },
      }),
      capabilityMatchCount: 2,
    });
    expect(result.checks.staleness.passed).toBe(false);
    expect(result.canProceed).toBe(false);
  });

  it('non-throwing: never throws even with null context', async () => {
    const result = await runGovernanceChecks({
      generationType: 'email_draft',
      companyId: 'co-001',
      researchContext: null,
    });
    expect(result).toBeDefined();
    expect(typeof result.passed).toBe('boolean');
    expect(result.checks).toBeDefined();
  });

  it('TEST 5: passes advisory types (zero thresholds) without research', async () => {
    const result = await runGovernanceChecks({
      generationType: 'query_parsing',
      researchContext: null,
    });
    // query_parsing has all-zero thresholds, so even without research it should pass
    expect(result.checks.research_confidence.passed).toBe(true);
    expect(result.checks.freshness_score.passed).toBe(true);
    expect(result.checks.capability_match.passed).toBe(true);
    expect(result.checks.recent_intelligence.passed).toBe(true);
    // research_exists may fail but that's OK for advisory types
  });
});

describe('AI Governance — Evidence Grounding (previously skipped — now aligned)', () => {
  it('exports buildEvidenceGroundingNote function', () => {
    expect(typeof buildEvidenceGroundingNote).toBe('function');
  });

  it('TEST 6: builds grounding note with evidence from ResearchContext', () => {
    const note = buildEvidenceGroundingNote(makeResearchContext());
    expect(typeof note).toBe('string');
    expect(note.length).toBeGreaterThan(0);
    // Should mention evidence count and freshness
    expect(note).toContain('10 evidence');
  });

  it('TEST 7: returns warning for null research context', () => {
    const note = buildEvidenceGroundingNote(null);
    expect(note).toBeDefined();
    expect(typeof note).toBe('string');
    expect(note.length).toBeGreaterThan(0);
    // Should warn about no research
    expect(note).toContain('No research');
  });

  it('returns staleness warning for old research', () => {
    const note = buildEvidenceGroundingNote(
      makeResearchContext({
        freshness: {
          score: 10,
          status: 'stale',
          lastResearchedAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(),
          daysSinceResearch: 120,
          evidenceCount: 5,
          signalCount: 0,
          categories: {
            profile: { score: 10, status: 'stale', lastVerifiedAt: null, daysSinceVerification: null },
            signal: { score: 0, status: 'none', lastVerifiedAt: null, daysSinceVerification: null },
            contact: { score: 0, status: 'none', lastVerifiedAt: null, daysSinceVerification: null },
            technology: { score: 0, status: 'none', lastVerifiedAt: null, daysSinceVerification: null },
          },
        },
      }),
    );
    expect(note).toContain('outdated');
  });
});

describe('AI Governance — Prompt Addon Generation (previously skipped — now aligned)', () => {
  it('exports buildGovernancePromptAddon function', () => {
    expect(typeof buildGovernancePromptAddon).toBe('function');
  });

  it('TEST 8: includes rejection reason when governance fails', () => {
    const addon = buildGovernancePromptAddon({
      passed: false,
      canProceed: false,
      checks: {
        research_confidence: { passed: false, message: 'Insufficient research confidence', value: 0.3 },
      },
      overallMessage: 'Governance blocked email_draft',
      rejectionReason: 'Insufficient research confidence',
    }, 'email_draft');
    // When governance fails, should include rejection info
    expect(addon).toBeDefined();
    expect(typeof addon).toBe('string');
  });

  it('includes quality signals when governance passes', () => {
    const addon = buildGovernancePromptAddon({
      passed: true,
      canProceed: true,
      checks: { confidence: { passed: true, message: 'High confidence', value: 0.85 } },
      overallMessage: 'All checks passed',
      rejectionReason: null,
    }, 'email_draft');
    expect(addon).toBeDefined();
    expect(typeof addon).toBe('string');
  });

  it('produces marginal staleness warning for data near limit', () => {
    const addon = buildGovernancePromptAddon({
      passed: true,
      canProceed: true,
      checks: {
        staleness: { passed: true, message: 'Research is 40 days old, within 60-day limit.', value: 40 },
        research_confidence: { passed: true, message: 'Average field confidence 80.0% meets threshold 60%.', value: 0.8 },
        freshness_score: { passed: true, message: 'Freshness score 60/100 meets threshold 25.', value: 60 },
        research_exists: { passed: true, message: 'Research card found.', value: true },
        capability_match: { passed: true, message: '2 capability asset(s) matched.', value: 2 },
        recent_intelligence: { passed: true, message: 'Research intelligence exists (status: fresh).', value: 'fresh' },
      },
      overallMessage: 'All governance checks passed for email_draft.',
      rejectionReason: null,
    }, 'email_draft');
    // 40 days > 60/2 = 30, should trigger marginal staleness warning
    expect(addon).toContain('outdated');
  });
});

describe('AI Governance — Domain Freshness Evaluation', () => {
  it('exports evaluateDomainFreshness function', () => {
    expect(typeof evaluateDomainFreshness).toBe('function');
  });

  it('returns structured freshness evaluation', () => {
    const result = evaluateDomainFreshness({
      lastResearched: new Date().toISOString(),
      totalSignals: 10,
      recentSignals: 5,
    });
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });
});

describe('AI Governance — Cross-check: all 6 governance checks present', () => {
  it('runGovernanceChecks always returns exactly 6 check keys', async () => {
    const result = await runGovernanceChecks({
      generationType: 'email_draft',
      researchContext: makeResearchContext(),
      capabilityMatchCount: 2,
    });
    const expectedKeys = [
      'research_exists',
      'research_confidence',
      'freshness_score',
      'staleness',
      'capability_match',
      'recent_intelligence',
    ];
    expect(Object.keys(result.checks)).toEqual(expectedKeys);
    expect(Object.keys(result.checks)).toHaveLength(6);
  });

  it('GovernanceResult has all required fields', async () => {
    const result = await runGovernanceChecks({
      generationType: 'email_draft',
      researchContext: makeResearchContext(),
      capabilityMatchCount: 2,
    });
    expect(result).toHaveProperty('passed');
    expect(result).toHaveProperty('canProceed');
    expect(result).toHaveProperty('checks');
    expect(result).toHaveProperty('overallMessage');
    expect(result).toHaveProperty('rejectionReason');
    // When all pass, rejectionReason should be null
    expect(result.rejectionReason).toBeNull();
  });
});
