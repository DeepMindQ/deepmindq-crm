/**
 * AI Governance Tests
 *
 * Tests for confidence gates, governance checks, hallucination prevention,
 * evidence grounding, and weak intelligence detection.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (hoisted for vi.mock) ──

const { mockCallLLM, mockDb } = vi.hoisted(() => {
  const db = {
    aIGenerationAudit: {
      create: vi.fn(),
    },
  };
  return {
    mockCallLLM: vi.fn(),
    mockDb: db,
  };
});

vi.mock('@/lib/zai-helpers', () => ({
  callLLM: (...args: unknown[]) => mockCallLLM(...args),
}));

vi.mock('@/lib/db', () => ({ db: mockDb }));

// ── Imports after mocks ──

import {
  getGovernanceConfig,
  runGovernanceChecks,
  evaluateDomainFreshness,
  buildFreshnessWarning,
  buildEvidenceGroundingNote,
  buildGovernancePromptAddon,
  HALLUCINATION_PREVENTION_RULES,
  GOVERNANCE_PROMPT_VERSION,
  governedAICall,
  governedAICallAggregate,
  recordGeneration,
  preFlightCheck,
  FRESHNESS_LIFECYCLE_DAYS,
  type GovernanceConfig,
} from '@/lib/ai-governance';

// ── Helpers ──

function makeResearchContext(overrides: Record<string, unknown> = {}) {
  return {
    companyId: 'c1',
    companyName: 'Acme Corp',
    domain: 'acme.com',
    industry: 'Technology',
    website: 'https://acme.com',
    country: 'US',
    sizeRange: '501-1000',
    internalSummary: 'A tech company',
    researchCard: {
      exists: true,
      source: 'research_engine_v3',
      enrichedAt: new Date().toISOString(),
      businessOverview: 'Acme makes software',
      revenue: '$50M',
      employeeCount: '750',
      fundingStage: 'Series C',
      techStack: 'AWS, React',
      socialProfiles: {},
      industry: 'Technology',
      website: 'https://acme.com',
      profileFreshnessAt: new Date(),
      signalFreshnessAt: new Date(),
      techFreshnessAt: new Date(),
      contactFreshnessAt: new Date(),
    },
    keyPeople: [{ name: 'Jane', title: 'CTO' }],
    signals: [
      { id: 's1', type: 'funding', title: 'Funding', description: 'Raised', impact: 'high', severity: 'high', confidence: 0.9, sourceUrl: null, signalDate: null, detectedAt: new Date().toISOString() },
    ],
    recentNews: [],
    fieldConfidence: { revenue: 0.8, employeeCount: 0.85, techStack: 0.7, industry: 0.9, businessOverview: 0.6, fundingStage: 0.75 },
    evidenceSummary: {
      totalEvidence: 15,
      fields: {
        revenue: { count: 5, avgConfidence: 0.8, tierBreakdown: { premium: 3, standard: 2, low: 0 } },
      },
    },
    freshness: {
      score: 85,
      status: 'fresh' as const,
      lastResearchedAt: new Date().toISOString(),
      daysSinceResearch: 2,
      evidenceCount: 15,
      signalCount: 3,
      categories: {
        profile: { score: 100, status: 'fresh' as const, lastVerifiedAt: new Date().toISOString(), daysSinceVerification: 2 },
        signal: { score: 100, status: 'fresh' as const, lastVerifiedAt: new Date().toISOString(), daysSinceVerification: 1 },
        contact: { score: 100, status: 'fresh' as const, lastVerifiedAt: new Date().toISOString(), daysSinceVerification: 5 },
        technology: { score: 100, status: 'fresh' as const, lastVerifiedAt: new Date().toISOString(), daysSinceVerification: 3 },
      },
    },
    structuredTechLandscape: { cloud: ['AWS'], data: [], ai: [], applications: ['React'] },
    strategicPriorities: [],
    capabilityMatchingInputs: { businessProblems: [], transformationAreas: [], technologyThemes: [] },
    contactCount: 3,
    internalNotes: null,
    ...overrides,
  };
}

// ── Governance Config Tests ──

describe('getGovernanceConfig', () => {
  it('should return email_draft config with strict thresholds', () => {
    const config = getGovernanceConfig('email_draft');
    expect(config.minResearchConfidence).toBe(0.6);
    expect(config.minFreshnessScore).toBe(25);
    expect(config.requireCapabilityMatch).toBe(true);
    expect(config.requireRecentIntelligence).toBe(true);
    expect(config.maxStalenessDays).toBe(60);
  });

  it('should return account_brief config with relaxed thresholds', () => {
    const config = getGovernanceConfig('account_brief');
    expect(config.minResearchConfidence).toBe(0.2);
    expect(config.minFreshnessScore).toBe(10);
    expect(config.requireCapabilityMatch).toBe(false);
    expect(config.requireRecentIntelligence).toBe(false);
  });

  it('should return query_parsing config with zero thresholds (non-company)', () => {
    const config = getGovernanceConfig('query_parsing');
    expect(config.minResearchConfidence).toBe(0);
    expect(config.minFreshnessScore).toBe(0);
    expect(config.maxStalenessDays).toBe(9999);
  });

  it('should return default config for unknown generation type', () => {
    const config = getGovernanceConfig('totally_unknown_type');
    expect(config.minResearchConfidence).toBe(0.4);
    expect(config.minFreshnessScore).toBe(20);
    expect(config.requireCapabilityMatch).toBe(false);
  });

  it('should return a copy for default config (not a shared reference)', () => {
    const config1 = getGovernanceConfig('unknown');
    const config2 = getGovernanceConfig('unknown');
    config1.minResearchConfidence = 0.99;
    expect(config2.minResearchConfidence).toBe(0.4);
  });
});

// ── Governance Checks Tests ──

describe('runGovernanceChecks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should pass all checks for fresh company with high confidence', async () => {
    const result = await runGovernanceChecks({
      generationType: 'email_draft',
      companyId: 'c1',
      researchContext: makeResearchContext(),
      capabilityMatchCount: 2,
    });

    expect(result.passed).toBe(true);
    expect(result.canProceed).toBe(true);
    expect(result.rejectionReason).toBeNull();
    expect(result.checks.research_exists.passed).toBe(true);
    expect(result.checks.research_confidence.passed).toBe(true);
    expect(result.checks.freshness_score.passed).toBe(true);
    expect(result.checks.capability_match.passed).toBe(true);
    expect(result.checks.recent_intelligence.passed).toBe(true);
  });

  it('should fail research_confidence when average is below threshold', async () => {
    const lowConfidenceContext = makeResearchContext({
      fieldConfidence: { revenue: 0.1, employeeCount: 0.2, techStack: 0.1 },
    });

    const result = await runGovernanceChecks({
      generationType: 'email_draft', // threshold 0.6
      researchContext: lowConfidenceContext,
      capabilityMatchCount: 2,
    });

    expect(result.passed).toBe(false);
    expect(result.canProceed).toBe(false);
    expect(result.checks.research_confidence.passed).toBe(false);
    expect(result.rejectionReason).toContain('below threshold');
  });

  it('should fail freshness_score when score is too low', async () => {
    const staleContext = makeResearchContext({
      freshness: {
        score: 10,
        status: 'stale' as const,
        lastResearchedAt: new Date(Date.now() - 120 * 86400000).toISOString(),
        daysSinceResearch: 120,
        evidenceCount: 2,
        signalCount: 0,
        categories: {
          profile: { score: 10, status: 'stale' as const, lastVerifiedAt: new Date(Date.now() - 120 * 86400000).toISOString(), daysSinceVerification: 120 },
          signal: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
          contact: { score: 10, status: 'stale' as const, lastVerifiedAt: new Date(Date.now() - 100 * 86400000).toISOString(), daysSinceVerification: 100 },
          technology: { score: 20, status: 'stale' as const, lastVerifiedAt: new Date(Date.now() - 80 * 86400000).toISOString(), daysSinceVerification: 80 },
        },
      },
    });

    const result = await runGovernanceChecks({
      generationType: 'email_draft', // minFreshnessScore: 25
      researchContext: staleContext,
      capabilityMatchCount: 2,
    });

    expect(result.passed).toBe(false);
    expect(result.checks.freshness_score.passed).toBe(false);
  });

  it('should fail staleness check when days exceed maxStalenessDays', async () => {
    const oldContext = makeResearchContext({
      freshness: {
        score: 50,
        status: 'stale' as const,
        lastResearchedAt: new Date(Date.now() - 100 * 86400000).toISOString(),
        daysSinceResearch: 100,
        evidenceCount: 5,
        signalCount: 1,
        categories: {
          profile: { score: 50, status: 'stale' as const, lastVerifiedAt: new Date(Date.now() - 100 * 86400000).toISOString(), daysSinceVerification: 100 },
          signal: { score: 50, status: 'stale' as const, lastVerifiedAt: new Date(Date.now() - 60 * 86400000).toISOString(), daysSinceVerification: 60 },
          contact: { score: 50, status: 'stale' as const, lastVerifiedAt: new Date(Date.now() - 80 * 86400000).toISOString(), daysSinceVerification: 80 },
          technology: { score: 50, status: 'stale' as const, lastVerifiedAt: new Date(Date.now() - 70 * 86400000).toISOString(), daysSinceVerification: 70 },
        },
      },
    });

    const result = await runGovernanceChecks({
      generationType: 'email_draft', // maxStalenessDays: 60
      researchContext: oldContext,
      capabilityMatchCount: 2,
    });

    expect(result.passed).toBe(false);
    expect(result.checks.staleness.passed).toBe(false);
    expect(result.checks.staleness.message).toContain('exceeds');
  });

  it('should fail capability_match when required but count is 0', async () => {
    const result = await runGovernanceChecks({
      generationType: 'email_draft', // requireCapabilityMatch: true
      researchContext: makeResearchContext(),
      capabilityMatchCount: 0,
    });

    expect(result.passed).toBe(false);
    expect(result.checks.capability_match.passed).toBe(false);
    expect(result.checks.capability_match.message).toContain('No capability assets matched');
  });

  it('should skip capability_match check when not required', async () => {
    const result = await runGovernanceChecks({
      generationType: 'account_brief', // requireCapabilityMatch: false
      researchContext: makeResearchContext(),
      capabilityMatchCount: 0,
    });

    expect(result.checks.capability_match.passed).toBe(true);
    expect(result.checks.capability_match.message).toContain('not required');
  });

  it('should fail when no research context provided at all', async () => {
    const result = await runGovernanceChecks({
      generationType: 'email_draft',
      researchContext: null,
    });

    expect(result.passed).toBe(false);
    expect(result.checks.research_exists.passed).toBe(false);
    expect(result.checks.research_confidence.passed).toBe(false);
    expect(result.checks.freshness_score.passed).toBe(false);
  });

  it('should fail recent_intelligence when freshness status is none', async () => {
    const noResearchContext = makeResearchContext({
      researchCard: null,
      freshness: {
        score: 0, status: 'none' as const,
        lastResearchedAt: null, daysSinceResearch: null,
        evidenceCount: 0, signalCount: 0,
        categories: {
          profile: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
          signal: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
          contact: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
          technology: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
        },
      },
      fieldConfidence: {},
      signals: [],
    });

    const result = await runGovernanceChecks({
      generationType: 'email_draft', // requireRecentIntelligence: true
      researchContext: noResearchContext,
    });

    expect(result.passed).toBe(false);
    expect(result.checks.recent_intelligence.passed).toBe(false);
  });
});

// ── Confidence Gate Tests ──

describe('confidence gate enforcement', () => {
  it('should reject email generation with 40% confidence (below 60% threshold)', async () => {
    const ctx = makeResearchContext({
      fieldConfidence: { revenue: 0.35, employeeCount: 0.4, techStack: 0.45 },
    });

    const result = await runGovernanceChecks({
      generationType: 'email_draft',
      researchContext: ctx,
      capabilityMatchCount: 1,
    });

    // Average = (0.35 + 0.4 + 0.45) / 3 = 0.4 < 0.6
    expect(result.canProceed).toBe(false);
    expect(result.rejectionReason).toContain('confidence');
  });

  it('should accept email generation with 70% confidence (above 60% threshold)', async () => {
    const ctx = makeResearchContext({
      fieldConfidence: { revenue: 0.7, employeeCount: 0.7, techStack: 0.7 },
    });

    const result = await runGovernanceChecks({
      generationType: 'email_draft',
      researchContext: ctx,
      capabilityMatchCount: 1,
    });

    expect(result.canProceed).toBe(true);
  });

  it('should accept account_brief with low confidence (threshold only 20%)', async () => {
    const ctx = makeResearchContext({
      fieldConfidence: { revenue: 0.25, employeeCount: 0.15, techStack: 0.2 },
    });

    const result = await runGovernanceChecks({
      generationType: 'account_brief', // minResearchConfidence: 0.2
      researchContext: ctx,
    });

    // Average = 0.2 >= 0.2, so research_confidence passes
    expect(result.checks.research_confidence.passed).toBe(true);
  });

  it('should have stricter thresholds for opportunities than account_brief', () => {
    const emailConfig = getGovernanceConfig('email_draft');
    const briefConfig = getGovernanceConfig('account_brief');

    expect(emailConfig.minResearchConfidence).toBeGreaterThan(briefConfig.minResearchConfidence);
    expect(emailConfig.minFreshnessScore).toBeGreaterThan(briefConfig.minFreshnessScore);
  });
});

// ── Hallucination Prevention Tests ──

describe('hallucination prevention', () => {
  it('HALLUCINATION_PREVENTION_RULES should contain key anti-hallucination instructions', () => {
    expect(HALLUCINATION_PREVENTION_RULES).toContain('Only reference facts');
    expect(HALLUCINATION_PREVENTION_RULES).toContain('NEVER fabricate');
    expect(HALLUCINATION_PREVENTION_RULES).toContain('Not found');
    expect(HALLUCINATION_PREVENTION_RULES).toContain('EVIDENCE GROUNDING RULES');
  });

  it('HALLUCINATION_PREVENTION_RULES should have at least 10 rules', () => {
    const rules = HALLUCINATION_PREVENTION_RULES.split('\n').filter(line => /^\d+\./.test(line.trim()));
    expect(rules.length).toBeGreaterThanOrEqual(10);
  });

  it('should inject hallucination rules into governed AI call system prompt', async () => {
    mockCallLLM.mockResolvedValue('LLM response');
    mockDb.aIGenerationAudit.create.mockResolvedValue({});

    await governedAICallAggregate({
      generationType: 'signal_detection',
      systemPrompt: 'Analyze signals',
      userPrompt: 'Company: Acme',
    });

    const calledSystemPrompt = mockCallLLM.mock.calls[0][0] as string;
    expect(calledSystemPrompt).toContain('EVIDENCE GROUNDING RULES');
  });

  it('GOVERNANCE_PROMPT_VERSION should be a non-empty string', () => {
    expect(GOVERNANCE_PROMPT_VERSION).toBeTruthy();
    expect(typeof GOVERNANCE_PROMPT_VERSION).toBe('string');
  });
});

// ── Evidence Grounding Tests ──

describe('buildEvidenceGroundingNote', () => {
  it('should return low-confidence warning when no research context', () => {
    const note = buildEvidenceGroundingNote(null);
    expect(note).toContain('No research intelligence available');
    expect(note).toContain('low-confidence');
  });

  it('should return speculative warning when freshness status is none', () => {
    const ctx = makeResearchContext({
      freshness: {
        score: 0, status: 'none' as const,
        lastResearchedAt: null, daysSinceResearch: null,
        evidenceCount: 0, signalCount: 0,
        categories: {
          profile: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
          signal: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
          contact: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
          technology: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
        },
      },
      evidenceSummary: { totalEvidence: 0, fields: {} },
      signals: [],
      fieldConfidence: {},
    });

    const note = buildEvidenceGroundingNote(ctx);
    expect(note).toContain('speculative');
  });

  it('should warn about outdated research when >90 days old', () => {
    const ctx = makeResearchContext({
      freshness: {
        ...makeResearchContext().freshness,
        score: 15,
        status: 'stale' as const,
        daysSinceResearch: 120,
      },
    });

    const note = buildEvidenceGroundingNote(ctx);
    expect(note).toContain('120 days old');
    expect(note).toContain('significantly outdated');
  });

  it('should warn about limited evidence when <=3 sources', () => {
    const ctx = makeResearchContext({
      evidenceSummary: { totalEvidence: 2, fields: {} },
    });

    const note = buildEvidenceGroundingNote(ctx);
    expect(note).toContain('Limited evidence');
    expect(note).toContain('2 source');
  });

  it('should warn about no buying signals', () => {
    const ctx = makeResearchContext({
      signals: [],
      freshness: { ...makeResearchContext().freshness, signalCount: 0 },
    });

    const note = buildEvidenceGroundingNote(ctx);
    expect(note).toContain('No buying signals detected');
    expect(note).toContain('fabricate');
  });

  it('should flag low confidence fields', () => {
    const ctx = makeResearchContext({
      fieldConfidence: { revenue: 0.2, techStack: 0.3, industry: 0.8 },
    });

    const note = buildEvidenceGroundingNote(ctx);
    expect(note).toContain('Low confidence fields');
    expect(note).toContain('revenue');
    expect(note).toContain('techStack');
    expect(note).not.toContain('industry');
  });

  it('should return healthy grounding note for good research', () => {
    const note = buildEvidenceGroundingNote(makeResearchContext());
    expect(note).toContain('Research data available');
    expect(note).toContain('15 evidence sources');
    expect(note).toContain('85/100');
  });
});

// ── Domain Freshness Evaluation Tests ──

describe('evaluateDomainFreshness', () => {
  it('should return stale with Infinity days when lastRefreshedAt is null', () => {
    const result = evaluateDomainFreshness(null, 'profile');
    expect(result.status).toBe('stale');
    expect(result.daysSinceRefresh).toBe(Infinity);
  });

  it('should return fresh when within lifecycle days', () => {
    const recent = new Date(Date.now() - 5 * 86400000);
    const result = evaluateDomainFreshness(recent, 'profile'); // lifecycle: 90 days
    expect(result.status).toBe('fresh');
    expect(result.daysSinceRefresh).toBe(5);
  });

  it('should return aging when past lifecycle but within 2x', () => {
    const aging = new Date(Date.now() - 120 * 86400000);
    const result = evaluateDomainFreshness(aging, 'profile'); // lifecycle: 90, 2x: 180
    expect(result.status).toBe('aging');
  });

  it('should return stale when past 2x lifecycle', () => {
    const stale = new Date(Date.now() - 200 * 86400000);
    const result = evaluateDomainFreshness(stale, 'profile'); // 2x: 180
    expect(result.status).toBe('stale');
  });

  it('should use correct lifecycle for each domain', () => {
    const tenDaysAgo = new Date(Date.now() - 10 * 86400000);

    // Signals: 14-day lifecycle → 10 days is fresh
    expect(evaluateDomainFreshness(tenDaysAgo, 'signals').status).toBe('fresh');

    // Signals: 14-day lifecycle → 10 days is fresh
    expect(evaluateDomainFreshness(tenDaysAgo, 'signals').status).toBe('fresh');

    // But 10 days is > 50% of 14-day signal lifecycle, so signals age fast
    const fifteenDaysAgo = new Date(Date.now() - 15 * 86400000);
    expect(evaluateDomainFreshness(fifteenDaysAgo, 'signals').status).toBe('aging');

    // Profile: 90-day lifecycle → 15 days is fresh
    expect(evaluateDomainFreshness(fifteenDaysAgo, 'profile').status).toBe('fresh');
  });

  it('FRESHNESS_LIFECYCLE_DAYS should have all four domains', () => {
    expect(FRESHNESS_LIFECYCLE_DAYS).toHaveProperty('profile');
    expect(FRESHNESS_LIFECYCLE_DAYS).toHaveProperty('signals');
    expect(FRESHNESS_LIFECYCLE_DAYS).toHaveProperty('technology');
    expect(FRESHNESS_LIFECYCLE_DAYS).toHaveProperty('contacts');
    expect(FRESHNESS_LIFECYCLE_DAYS.signals).toBeLessThan(FRESHNESS_LIFECYCLE_DAYS.profile);
  });
});

// ── Freshness Warning Tests ──

describe('buildFreshnessWarning', () => {
  it('should return empty string for fresh research card', () => {
    const card = {
      profileFreshnessAt: new Date(),
      signalFreshnessAt: new Date(),
      techFreshnessAt: new Date(),
      contactFreshnessAt: new Date(),
    };

    const warning = buildFreshnessWarning(card);
    expect(warning).toBe('');
  });

  it('should warn about stale signals', () => {
    const card = {
      profileFreshnessAt: new Date(),
      signalFreshnessAt: new Date(Date.now() - 40 * 86400000), // 2x signal lifecycle (28)
      techFreshnessAt: new Date(),
      contactFreshnessAt: new Date(),
    };

    const warning = buildFreshnessWarning(card);
    expect(warning).toContain('FRESHNESS WARNINGS');
    expect(warning).toContain('Buying signals are severely outdated');
  });

  it('should warn about aging technology', () => {
    const card = {
      profileFreshnessAt: new Date(),
      signalFreshnessAt: new Date(),
      techFreshnessAt: new Date(Date.now() - 80 * 86400000), // past 60, within 120
      contactFreshnessAt: new Date(),
    };

    const warning = buildFreshnessWarning(card);
    expect(warning).toContain('Technology intelligence is');
    expect(warning).toContain('outdated');
  });

  it('should return empty string for null research card', () => {
    expect(buildFreshnessWarning(null)).toBe('');
  });
});

// ── Governance Prompt Addon Tests ──

describe('buildGovernancePromptAddon', () => {
  it('should return empty string when all checks pass cleanly', () => {
    const result = {
      passed: true,
      checks: {
        research_exists: { passed: true, message: 'OK', value: true },
        research_confidence: { passed: true, message: 'OK', value: 0.9 },
        freshness_score: { passed: true, message: 'OK', value: 80 },
        staleness: { passed: true, message: 'OK', value: 5 },
        capability_match: { passed: true, message: 'Not required', value: 0 },
        recent_intelligence: { passed: true, message: 'OK', value: 'fresh' },
      },
      overallMessage: 'All passed',
      canProceed: true,
      rejectionReason: null,
    };

    const addon = buildGovernancePromptAddon(result);
    expect(addon).toBe('');
  });

  it('should warn about stale data when staleness > 30 days', () => {
    const result = {
      passed: true,
      checks: {
        staleness: { passed: true, message: 'OK', value: 45 },
        research_exists: { passed: true, message: 'OK', value: true },
        research_confidence: { passed: true, message: 'OK', value: 0.8 },
        freshness_score: { passed: true, message: 'OK', value: 50 },
        capability_match: { passed: true, message: 'OK', value: 0 },
        recent_intelligence: { passed: true, message: 'OK', value: 'fresh' },
      },
      overallMessage: 'All passed',
      canProceed: true,
      rejectionReason: null,
    };

    const addon = buildGovernancePromptAddon(result);
    expect(addon).toContain('GOVERNANCE WARNINGS');
    expect(addon).toContain('45 days old');
  });

  it('should warn about low signal confidence < 0.6', () => {
    const result = {
      passed: true,
      checks: {
        research_confidence: { passed: true, message: 'OK', value: 0.4 },
        research_exists: { passed: true, message: 'OK', value: true },
        freshness_score: { passed: true, message: 'OK', value: 60 },
        staleness: { passed: true, message: 'OK', value: 10 },
        capability_match: { passed: true, message: 'OK', value: 1 },
        recent_intelligence: { passed: true, message: 'OK', value: 'fresh' },
      },
      overallMessage: 'All passed',
      canProceed: true,
      rejectionReason: null,
    };

    const addon = buildGovernancePromptAddon(result);
    expect(addon).toContain('below 60%');
  });

  it('should warn about no capability matches even when not required', () => {
    const result = {
      passed: true,
      checks: {
        capability_match: { passed: false, message: 'No capability assets matched. At least one is required for this generation type.', value: 0 },
        research_exists: { passed: true, message: 'OK', value: true },
        research_confidence: { passed: true, message: 'OK', value: 0.8 },
        freshness_score: { passed: true, message: 'OK', value: 70 },
        staleness: { passed: true, message: 'OK', value: 5 },
        recent_intelligence: { passed: true, message: 'OK', value: 'fresh' },
      },
      overallMessage: 'All passed',
      canProceed: true,
      rejectionReason: null,
    };

    const addon = buildGovernancePromptAddon(result);
    expect(addon).toContain('No capability assets matched');
    expect(addon).toContain('generic');
  });
});

// ── Governed AI Call Tests ──

describe('governedAICallAggregate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.aIGenerationAudit.create.mockResolvedValue({});
  });

  it('should call LLM and return successful response', async () => {
    mockCallLLM.mockResolvedValue('Generated analysis result');

    const result = await governedAICallAggregate({
      generationType: 'signal_detection',
      systemPrompt: 'Analyze signals',
      userPrompt: 'Company: Acme',
    });

    expect(result.success).toBe(true);
    expect(result.response).toBe('Generated analysis result');
    expect(result.rejectionReason).toBeNull();
    expect(mockDb.aIGenerationAudit.create).toHaveBeenCalledTimes(1);
  });

  it('should return failure when LLM throws', async () => {
    mockCallLLM.mockRejectedValue(new Error('API rate limit'));

    const result = await governedAICallAggregate({
      generationType: 'signal_detection',
      systemPrompt: 'Test',
      userPrompt: 'Test',
    });

    expect(result.success).toBe(false);
    expect(result.response).toBeNull();
    expect(result.rejectionReason).toContain('LLM call failed');
  });

  it('should inject hallucination prevention rules into system prompt', async () => {
    mockCallLLM.mockResolvedValue('OK');

    await governedAICallAggregate({
      generationType: 'test',
      systemPrompt: 'Base prompt',
      userPrompt: 'User prompt',
    });

    const systemPrompt = mockCallLLM.mock.calls[0][0] as string;
    expect(systemPrompt).toContain('Base prompt');
    expect(systemPrompt).toContain('EVIDENCE GROUNDING RULES');
  });
});

// ── Governed AI Call (company-specific) Tests ──

describe('governedAICall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.aIGenerationAudit.create.mockResolvedValue({});
  });

  it('should block call when governance fails and enforceGovernance is true', async () => {
    const result = await governedAICall({
      generationType: 'email_draft', // strict config
      companyId: 'c1',
      researchContext: null, // no research = governance fails
      systemPrompt: 'Write email',
      userPrompt: 'To Acme',
      enforceGovernance: true,
    });

    expect(result.success).toBe(false);
    expect(result.response).toBeNull();
    expect(result.rejectionReason).toContain('No research card');
    expect(mockCallLLM).not.toHaveBeenCalled();
  });

  it('should proceed when governance fails but enforceGovernance is false', async () => {
    mockCallLLM.mockResolvedValue('Result');

    const result = await governedAICall({
      generationType: 'email_draft',
      companyId: 'c1',
      researchContext: null,
      systemPrompt: 'Write email',
      userPrompt: 'To Acme',
      enforceGovernance: false,
    });

    expect(result.success).toBe(true);
    expect(result.response).toBe('Result');
    expect(mockCallLLM).toHaveBeenCalled();
  });

  it('should record audit trail for blocked generation', async () => {
    await governedAICall({
      generationType: 'email_draft',
      researchContext: null,
      systemPrompt: 'Test',
      userPrompt: 'Test',
      enforceGovernance: true,
    });

    expect(mockDb.aIGenerationAudit.create).toHaveBeenCalledTimes(1);
    const auditCall = mockDb.aIGenerationAudit.create.mock.calls[0][0];
    expect(auditCall.data.governancePassed).toBe(false);
    expect(auditCall.data.outputSummary).toContain('BLOCKED');
  });

  it('should add staleness warning when intelligence domains are stale', async () => {
    mockCallLLM.mockResolvedValue('Result');

    const staleContext = makeResearchContext({
      freshness: {
        ...makeResearchContext().freshness,
        score: 10,
        status: 'stale' as const,
        categories: {
          profile: { score: 5, status: 'stale' as const, lastVerifiedAt: null, daysSinceVerification: 200 },
          signal: { score: 0, status: 'stale' as const, lastVerifiedAt: null, daysSinceVerification: 40 },
          contact: { score: 100, status: 'fresh' as const, lastVerifiedAt: new Date().toISOString(), daysSinceVerification: 1 },
          technology: { score: 100, status: 'fresh' as const, lastVerifiedAt: new Date().toISOString(), daysSinceVerification: 1 },
        },
      },
      researchCard: {
        ...makeResearchContext().researchCard!,
        profileFreshnessAt: new Date(Date.now() - 200 * 86400000),
        signalFreshnessAt: new Date(Date.now() - 40 * 86400000),
        techFreshnessAt: new Date(),
        contactFreshnessAt: new Date(),
      },
    });

    await governedAICall({
      generationType: 'account_brief', // relaxed config, will pass
      researchContext: staleContext,
      systemPrompt: 'Brief',
      userPrompt: 'Acme',
    });

    const sysPrompt = mockCallLLM.mock.calls[0][0] as string;
    // Should include staleness modifier warning in system prompt
    expect(sysPrompt).toContain('staleness');
  });
});

// ── Record Generation (Audit) Tests ──

describe('recordGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.aIGenerationAudit.create.mockResolvedValue({});
  });

  it('should create audit record with all required fields', async () => {
    const governanceResult = {
      passed: true,
      checks: { test: { passed: true, message: 'OK', value: 1 } },
      overallMessage: 'OK',
      canProceed: true,
      rejectionReason: null,
    };

    await recordGeneration({
      generationType: 'email_draft',
      companyId: 'c1',
      contactId: 'contact-1',
      researchContext: makeResearchContext(),
      evidenceIds: ['e1', 'e2'],
      signalIds: ['s1'],
      capabilityAssetIds: ['cap-1'],
      governanceResult,
      outputSummary: 'Generated email',
      inputParams: { tone: 'professional' },
    });

    expect(mockDb.aIGenerationAudit.create).toHaveBeenCalledTimes(1);
    const data = mockDb.aIGenerationAudit.create.mock.calls[0][0].data;
    expect(data.generationType).toBe('email_draft');
    expect(data.companyId).toBe('c1');
    expect(data.contactId).toBe('contact-1');
    expect(data.evidenceIdsUsed).toBe(JSON.stringify(['e1', 'e2']));
    expect(data.signalIdsUsed).toBe(JSON.stringify(['s1']));
    expect(data.capabilityAssetIdsUsed).toBe(JSON.stringify(['cap-1']));
    expect(data.governancePassed).toBe(true);
    expect(data.outputSummary).toBe('Generated email');
    expect(data.promptVersion).toBe(GOVERNANCE_PROMPT_VERSION);
  });

  it('should not throw even if database write fails', async () => {
    mockDb.aIGenerationAudit.create.mockRejectedValue(new Error('DB connection error'));

    await expect(
      recordGeneration({
        generationType: 'test',
        governanceResult: { passed: true, checks: {}, overallMessage: '', canProceed: true, rejectionReason: null },
      }),
    ).resolves.not.toThrow();
  });
});

// ── Pre-Flight Check Tests ──

describe('preFlightCheck', () => {
  it('should return all required fields', async () => {
    const result = await preFlightCheck({
      generationType: 'account_brief',
      researchContext: makeResearchContext(),
    });

    expect(result).toHaveProperty('governanceResult');
    expect(result).toHaveProperty('groundingNote');
    expect(result).toHaveProperty('promptAddon');
    expect(result).toHaveProperty('config');
    expect(result.config).toHaveProperty('minResearchConfidence');
  });

  it('should pass governance for account_brief with good context', async () => {
    const result = await preFlightCheck({
      generationType: 'account_brief',
      researchContext: makeResearchContext(),
    });

    expect(result.governanceResult.canProceed).toBe(true);
    expect(result.groundingNote).toContain('Research data available');
  });
});