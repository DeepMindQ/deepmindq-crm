/**
 * Intelligence Contract Tests
 *
 * Tests for the single source of truth for company intelligence consumption.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (hoisted for vi.mock) ──

const { mockDb, mockGetCompanyEvidence, mockGetEvidenceSummary } = vi.hoisted(() => {
  const db = {
    company: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
    },
    companyResearchCard: {
      findUnique: vi.fn(),
    },
    companySignal: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
      aggregate: vi.fn(),
    },
    contact: {
      count: vi.fn(),
    },
    companyNote: {
      findFirst: vi.fn(),
    },
    $queryRaw: vi.fn(),
  };
  return {
    mockDb: db,
    mockGetCompanyEvidence: vi.fn(),
    mockGetEvidenceSummary: vi.fn(),
  };
});

vi.mock('@/lib/db', () => ({ db: mockDb }));

vi.mock('@/lib/research-engine', () => ({
  getCompanyEvidence: (...args: unknown[]) => mockGetCompanyEvidence(...args),
  getEvidenceSummary: (...args: unknown[]) => mockGetEvidenceSummary(...args),
}));

// ── Imports after mocks ──

import {
  getResearchContext,
  getAccountIntelligence,
  getSignalMetrics,
  applyFreshnessAdjustments,
  assessRefreshNeeds,
  buildResearchContextText,
  type ResearchContext,
} from '@/lib/intelligence-contract';

// ── Helpers ──

const THREE_DAYS_AGO = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
const SIXTY_DAYS_AGO = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);

const minimalCompany = {
  id: 'company-1',
  rawName: 'Acme Corp',
  normalizedName: 'acme corp',
  domain: 'acme.com',
  industry: 'Technology',
  website: 'https://acme.com',
  country: 'US',
  sizeRange: '501-1000',
  internalSummary: 'A tech company',
  intelligenceScore: 50,
  engagementScore: 40,
  status: 'active',
};

const minimalEvidenceSummary = {
  totalEvidence: 10,
  fields: {
    revenue: { count: 3, avgConfidence: 0.8, tierBreakdown: { premium: 2, standard: 1, low: 0 } },
    techStack: { count: 4, avgConfidence: 0.7, tierBreakdown: { premium: 1, standard: 2, low: 1 } },
    industry: { count: 2, avgConfidence: 0.9, tierBreakdown: { premium: 2, standard: 0, low: 0 } },
    businessOverview: { count: 1, avgConfidence: 0.6, tierBreakdown: { premium: 0, standard: 1, low: 0 } },
    employeeCount: { count: 2, avgConfidence: 0.85, tierBreakdown: { premium: 1, standard: 1, low: 0 } },
    fundingStage: { count: 2, avgConfidence: 0.75, tierBreakdown: { premium: 1, standard: 1, low: 0 } },
  },
};

function makeResearchCard(overrides: Record<string, unknown> = {}) {
  return {
    id: 'rc-1',
    companyId: 'company-1',
    enrichmentSource: 'research_engine_v3',
    enrichmentDate: THREE_DAYS_AGO,
    businessOverview: 'Acme Corp is a technology company',
    revenue: '$50M',
    employeeCount: '750',
    fundingStage: 'Series C',
    techStack: 'AWS, React, Node.js',
    industry: 'Technology',
    website: 'https://acme.com',
    socialProfiles: JSON.stringify({ linkedin: 'https://linkedin.com/company/acme' }),
    keyPeople: JSON.stringify([{ name: 'Jane Doe', title: 'CTO' }]),
    recentNews: JSON.stringify([{ title: 'Acme raises Series C', snippet: '...', source: 'TechCrunch', url: 'https://...', signalType: 'funding', impact: 'high' }]),
    fieldConfidence: JSON.stringify({ revenue: 0.8, employeeCount: 0.85, fundingStage: 0.75, techStack: 0.7, industry: 0.9, businessOverview: 0.6, website: 0.95 }),
    structuredTechLandscape: JSON.stringify({ cloud: ['AWS'], data: ['Snowflake'], ai: [], applications: ['React'] }),
    strategicPriorities: JSON.stringify([{ priority: 'Cloud migration', description: 'Moving to cloud', evidence: '...', confidence: 0.8 }]),
    businessProblems: JSON.stringify(['Legacy system modernization']),
    transformationAreas: JSON.stringify(['Cloud migration']),
    technologyThemes: JSON.stringify(['AWS', 'Kubernetes']),
    profileFreshnessAt: THREE_DAYS_AGO,
    signalFreshnessAt: THREE_DAYS_AGO,
    techFreshnessAt: THREE_DAYS_AGO,
    contactFreshnessAt: THREE_DAYS_AGO,
    ...overrides,
  };
}

function setupGetResearchContext(overrides: Record<string, unknown> = {}) {
  const researchCard = 'researchCard' in overrides ? overrides.researchCard : makeResearchCard();

  const signals = 'signals' in overrides ? overrides.signals : [
    { id: 'sig-1', signalType: 'funding', title: 'Series C funding', description: 'Raised $50M', impact: 'high', severity: 'high', confidence: 0.9, sourceUrl: 'https://...', signalDate: THREE_DAYS_AGO, createdAt: THREE_DAYS_AGO },
    { id: 'sig-2', signalType: 'hiring', title: 'Hiring engineers', description: 'Looking for 50 engineers', impact: 'medium', severity: 'medium', confidence: 0.7, sourceUrl: null, signalDate: null, createdAt: THREE_DAYS_AGO },
  ];

  const company = 'company' in overrides ? overrides.company : minimalCompany;

  mockDb.company.findUnique.mockResolvedValue(company);
  mockDb.companyResearchCard.findUnique.mockResolvedValue(researchCard);
  mockDb.companySignal.findMany.mockResolvedValue(signals);
  mockGetEvidenceSummary.mockResolvedValue('evidenceSummary' in overrides ? overrides.evidenceSummary : minimalEvidenceSummary);
  mockDb.contact.count.mockResolvedValue('contactCount' in overrides ? overrides.contactCount : 3);
  mockDb.companyNote.findFirst.mockResolvedValue('pinnedNote' in overrides ? overrides.pinnedNote : { body: 'Key account - follow up Q1' });
}

// ── Tests ──

describe('getResearchContext', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should throw if company not found', async () => {
    mockDb.company.findUnique.mockResolvedValue(null);
    await expect(getResearchContext('nonexistent')).rejects.toThrow('not found');
  });

  it('should return context with null researchCard when no research card exists', async () => {
    setupGetResearchContext({ researchCard: null });
    const ctx = await getResearchContext('company-1');

    expect(ctx.companyId).toBe('company-1');
    expect(ctx.companyName).toBe('Acme Corp');
    expect(ctx.researchCard).toBeNull();
    expect(ctx.signals).toEqual([]);
    expect(ctx.keyPeople).toEqual([]);
    expect(ctx.fieldConfidence).toEqual({});
    expect(ctx.freshness.status).toBe('none');
    expect(ctx.freshness.score).toBe(0);
  });

  it('should return full context when company has research card and signals', async () => {
    setupGetResearchContext();
    const ctx = await getResearchContext('company-1');

    expect(ctx.companyId).toBe('company-1');
    expect(ctx.companyName).toBe('Acme Corp');
    expect(ctx.domain).toBe('acme.com');
    expect(ctx.industry).toBe('Technology');
    expect(ctx.researchCard).not.toBeNull();
    expect(ctx.researchCard!.exists).toBe(true);
    expect(ctx.researchCard!.source).toBe('research_engine_v3');
    expect(ctx.researchCard!.businessOverview).toBe('Acme Corp is a technology company');
    expect(ctx.researchCard!.revenue).toBe('$50M');
    expect(ctx.signals).toHaveLength(2);
    expect(ctx.signals[0].type).toBe('funding');
    expect(ctx.signals[0].impact).toBe('high');
    expect(ctx.keyPeople).toHaveLength(1);
    expect(ctx.keyPeople[0].name).toBe('Jane Doe');
    expect(ctx.evidenceSummary.totalEvidence).toBe(10);
    expect(ctx.contactCount).toBe(3);
    expect(ctx.internalNotes).toBe('Key account - follow up Q1');
  });

  it('should parse structured tech landscape from research card JSON', async () => {
    setupGetResearchContext();
    const ctx = await getResearchContext('company-1');

    expect(ctx.structuredTechLandscape.cloud).toContain('AWS');
    expect(ctx.structuredTechLandscape.data).toContain('Snowflake');
    expect(ctx.structuredTechLandscape.applications).toContain('React');
  });

  it('should parse capability matching inputs from research card', async () => {
    setupGetResearchContext();
    const ctx = await getResearchContext('company-1');

    expect(ctx.capabilityMatchingInputs.businessProblems).toContain('Legacy system modernization');
    expect(ctx.capabilityMatchingInputs.transformationAreas).toContain('Cloud migration');
    expect(ctx.capabilityMatchingInputs.technologyThemes).toContain('AWS');
  });

  it('should handle malformed JSON fields gracefully by using empty defaults', async () => {
    const malformedCard = makeResearchCard({
      keyPeople: 'NOT VALID JSON',
      recentNews: '{broken',
      fieldConfidence: 'bad',
      socialProfiles: '',
      structuredTechLandscape: null,
      strategicPriorities: '[]',
      businessProblems: null,
      transformationAreas: null,
      technologyThemes: null,
      profileFreshnessAt: null,
      signalFreshnessAt: null,
      techFreshnessAt: null,
      contactFreshnessAt: null,
    });

    setupGetResearchContext({ researchCard: malformedCard, signals: [] });
    const ctx = await getResearchContext('company-1');

    expect(ctx.keyPeople).toEqual([]);
    expect(ctx.recentNews).toEqual([]);
    expect(ctx.fieldConfidence).toEqual({});
    expect(ctx.socialProfiles).toEqual({});
  });

  it('should compute freshness correctly for fresh research', async () => {
    setupGetResearchContext();
    const ctx = await getResearchContext('company-1');

    // 3 days ago -> should be fresh (score >= 80)
    expect(ctx.freshness.score).toBeGreaterThanOrEqual(80);
    expect(ctx.freshness.status).toBe('fresh');
    expect(ctx.freshness.daysSinceResearch).toBeLessThanOrEqual(4);
  });

  it('should compute freshness as stale for old research', async () => {
    const oldResearchCard = makeResearchCard({
      enrichmentDate: SIXTY_DAYS_AGO,
      profileFreshnessAt: SIXTY_DAYS_AGO,
      signalFreshnessAt: SIXTY_DAYS_AGO,
      techFreshnessAt: SIXTY_DAYS_AGO,
      contactFreshnessAt: SIXTY_DAYS_AGO,
    });

    setupGetResearchContext({ researchCard: oldResearchCard, signals: [] });
    const ctx = await getResearchContext('company-1');

    expect(ctx.freshness.status).toBe('stale');
    expect(ctx.freshness.score).toBeLessThan(60);
  });

  it('should include category-specific freshness in the response', async () => {
    setupGetResearchContext();
    const ctx = await getResearchContext('company-1');

    expect(ctx.freshness.categories).toHaveProperty('profile');
    expect(ctx.freshness.categories).toHaveProperty('signal');
    expect(ctx.freshness.categories).toHaveProperty('contact');
    expect(ctx.freshness.categories).toHaveProperty('technology');
    // All fresh (3 days ago) — profile/tech/contact should be 100 (within 10% of halfLife),
    // signals: 3 days is past 10% of 14=1.4 days, so score = 100 - (3/14)*40 ≈ 91
    expect(ctx.freshness.categories.profile.score).toBe(100);
    expect(ctx.freshness.categories.contact.score).toBe(100);
    expect(ctx.freshness.categories.technology.score).toBe(100);
    expect(ctx.freshness.categories.signal.score).toBe(91);
    for (const cat of Object.values(ctx.freshness.categories)) {
      expect(cat.status).toBe('fresh');
    }
  });
});

describe('getAccountIntelligence', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return a valid intelligence score between 0 and 100', async () => {
    setupGetResearchContext();
    const result = await getAccountIntelligence('company-1');

    expect(result.companyId).toBe('company-1');
    expect(result.companyName).toBe('Acme Corp');
    expect(result.intelligenceScore).toBeGreaterThanOrEqual(0);
    expect(result.intelligenceScore).toBeLessThanOrEqual(100);
  });

  it('should return unknown tier for company with no research card', async () => {
    setupGetResearchContext({ researchCard: null, signals: [], contactCount: 0 });
    mockDb.company.findUnique
      .mockResolvedValueOnce(minimalCompany)
      .mockResolvedValueOnce({ engagementScore: 0, intelligenceScore: 0 });
    mockDb.companyNote.findFirst.mockResolvedValue(null);

    const result = await getAccountIntelligence('company-1');

    expect(result.tier).toBe('unknown');
    expect(result.components.dataCompleteness).toBe(0);
  });

  it('should compute signal strength correctly based on high/medium impact signals', async () => {
    setupGetResearchContext({
      signals: [
        { id: 's1', signalType: 'funding', title: 'Funding', description: 'Raised', impact: 'high', severity: 'high', confidence: 0.9, sourceUrl: null, signalDate: null, createdAt: THREE_DAYS_AGO },
        { id: 's2', signalType: 'funding', title: 'More funding', description: 'Raised more', impact: 'high', severity: 'high', confidence: 0.8, sourceUrl: null, signalDate: null, createdAt: THREE_DAYS_AGO },
        { id: 's3', signalType: 'hiring', title: 'Hiring', description: 'Looking', impact: 'medium', severity: 'medium', confidence: 0.7, sourceUrl: null, signalDate: null, createdAt: THREE_DAYS_AGO },
      ],
    });

    const result = await getAccountIntelligence('company-1');

    // highImpactSignals * 25 + mediumImpactSignals * 10 + (3 signals > 2 => +10)
    // = 2*25 + 1*10 + 10 = 70
    expect(result.components.signalStrength).toBe(70);
  });

  it('should include meaningful score factors', async () => {
    setupGetResearchContext();
    const result = await getAccountIntelligence('company-1');

    expect(result.scoreFactors.length).toBeGreaterThan(0);
    expect(result.scoreFactors.some(f => f.includes('high-impact'))).toBe(true);
  });

  it('should use weighted composite for intelligence score', async () => {
    setupGetResearchContext();
    const result = await getAccountIntelligence('company-1');

    const { dataCompleteness, evidenceQuality, freshnessScore, signalStrength, contactCoverage, engagementScore } = result.components;
    const expected = Math.round(
      dataCompleteness * 0.25 +
      evidenceQuality * 0.20 +
      freshnessScore * 0.15 +
      signalStrength * 0.20 +
      contactCoverage * 0.10 +
      engagementScore * 0.10
    );
    expect(result.intelligenceScore).toBe(expected);
  });

  it('should return computedAt as a valid ISO date string', async () => {
    setupGetResearchContext();
    const result = await getAccountIntelligence('company-1');

    expect(result.computedAt).toBeTruthy();
    expect(new Date(result.computedAt).getTime()).not.toBeNaN();
  });
});

describe('getSignalMetrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return aggregated signal metrics', async () => {
    mockDb.companySignal.count.mockResolvedValue(100);
    mockDb.companySignal.groupBy
      .mockResolvedValueOnce([
        { signalType: 'funding', _count: { id: 20 } },
        { signalType: 'hiring', _count: { id: 30 } },
        { signalType: 'technology', _count: { id: 50 } },
      ])
      .mockResolvedValueOnce([
        { impact: 'high', _count: { id: 15 } },
        { impact: 'medium', _count: { id: 55 } },
        { impact: 'low', _count: { id: 30 } },
      ])
      .mockResolvedValueOnce([
        { severity: 'high', _count: { id: 10 } },
        { severity: 'medium', _count: { id: 60 } },
        { severity: 'low', _count: { id: 30 } },
      ])
      .mockResolvedValueOnce([
        { companyId: 'c1', _count: { id: 25 } },
        { companyId: 'c2', _count: { id: 15 } },
      ]);
    mockDb.$queryRaw.mockResolvedValue([
      { day: '2024-01-15', count: 10n },
      { day: '2024-01-16', count: 15n },
    ]);
    mockDb.companySignal.aggregate
      .mockResolvedValueOnce({ _avg: { confidence: 0.85 }, _count: { id: 20 } })
      .mockResolvedValueOnce({ _avg: { confidence: 0.72 }, _count: { id: 30 } })
      .mockResolvedValueOnce({ _avg: { confidence: 0.68 }, _count: { id: 50 } });
    mockDb.companySignal.count
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(12);
    mockDb.company.findMany.mockResolvedValue([
      { id: 'c1', normalizedName: 'Acme Corp' },
      { id: 'c2', normalizedName: 'Beta Inc' },
    ]);

    const metrics = await getSignalMetrics({ daysBack: 30, limit: 5 });

    expect(metrics.totalSignals).toBe(100);
    expect(metrics.byType.funding).toBe(20);
    expect(metrics.byType.hiring).toBe(30);
    expect(metrics.byImpact.high).toBe(15);
    expect(metrics.byImpact.medium).toBe(55);
    expect(metrics.byImpact.low).toBe(30);
    expect(metrics.dailyTrend).toHaveLength(2);
    expect(metrics.topCompanies).toHaveLength(2);
    expect(metrics.typeDetails).toHaveLength(3);
    expect(metrics.typeDetails[0].avgConfidence).toBe(0.85);
  });

  it('should handle empty signal data gracefully', async () => {
    mockDb.companySignal.count.mockResolvedValue(0);
    mockDb.companySignal.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mockDb.$queryRaw.mockResolvedValue([]);
    mockDb.company.findMany.mockResolvedValue([]);

    const metrics = await getSignalMetrics();

    expect(metrics.totalSignals).toBe(0);
    expect(metrics.byImpact).toEqual({ high: 0, medium: 0, low: 0 });
    expect(metrics.dailyTrend).toEqual([]);
    expect(metrics.topCompanies).toEqual([]);
    expect(metrics.typeDetails).toEqual([]);
  });

  it('should respect daysBack parameter for date filtering', async () => {
    mockDb.companySignal.count.mockResolvedValue(0);
    mockDb.companySignal.groupBy
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    mockDb.$queryRaw.mockResolvedValue([]);
    mockDb.company.findMany.mockResolvedValue([]);

    await getSignalMetrics({ daysBack: 7 });

    expect(mockDb.companySignal.groupBy).toHaveBeenCalledTimes(4);
  });
});

describe('applyFreshnessAdjustments', () => {
  it('should not adjust confidence for fresh data', () => {
    const fieldConfidence = { revenue: 0.8, techStack: 0.7 };
    const freshness = {
      score: 90, status: 'fresh' as const, lastResearchedAt: new Date().toISOString(),
      daysSinceResearch: 2, evidenceCount: 10, signalCount: 3,
      categories: {
        profile: { score: 100, status: 'fresh' as const, lastVerifiedAt: new Date().toISOString(), daysSinceVerification: 5 },
        signal: { score: 100, status: 'fresh' as const, lastVerifiedAt: new Date().toISOString(), daysSinceVerification: 2 },
        contact: { score: 100, status: 'fresh' as const, lastVerifiedAt: new Date().toISOString(), daysSinceVerification: 10 },
        technology: { score: 100, status: 'fresh' as const, lastVerifiedAt: new Date().toISOString(), daysSinceVerification: 8 },
      },
    };

    const result = applyFreshnessAdjustments(fieldConfidence, freshness);

    expect(result.adjustments).toHaveLength(0);
    expect(result.adjustedConfidence.revenue).toBe(0.8);
    expect(result.warnings).toHaveLength(0);
  });

  it('should penalize profile fields when profile is stale', () => {
    const fieldConfidence = { revenue: 0.8, employeeCount: 0.9 };
    const freshness = {
      score: 20, status: 'stale' as const, lastResearchedAt: new Date(Date.now() - 120 * 86400000).toISOString(),
      daysSinceResearch: 120, evidenceCount: 5, signalCount: 0,
      categories: {
        profile: { score: 10, status: 'stale' as const, lastVerifiedAt: new Date(Date.now() - 120 * 86400000).toISOString(), daysSinceVerification: 120 },
        signal: { score: 100, status: 'fresh' as const, lastVerifiedAt: new Date().toISOString(), daysSinceVerification: 1 },
        contact: { score: 100, status: 'fresh' as const, lastVerifiedAt: new Date().toISOString(), daysSinceVerification: 5 },
        technology: { score: 100, status: 'fresh' as const, lastVerifiedAt: new Date().toISOString(), daysSinceVerification: 10 },
      },
    };

    const result = applyFreshnessAdjustments(fieldConfidence, freshness);

    expect(result.adjustments.length).toBeGreaterThan(0);
    expect(result.adjustedConfidence.revenue).toBeLessThan(0.8);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some(w => w.includes('profile'))).toBe(true);
  });

  it('should cap penalty at maxPenalty', () => {
    const fieldConfidence = { revenue: 0.9 };
    // 500 days since profile verification - penalty would be huge, but capped at 0.2 (maxPenalty)
    const freshness = {
      score: 0, status: 'stale' as const, lastResearchedAt: new Date(Date.now() - 500 * 86400000).toISOString(),
      daysSinceResearch: 500, evidenceCount: 0, signalCount: 0,
      categories: {
        profile: { score: 0, status: 'stale' as const, lastVerifiedAt: new Date(Date.now() - 500 * 86400000).toISOString(), daysSinceVerification: 500 },
        signal: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
        contact: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
        technology: { score: 0, status: 'none' as const, lastVerifiedAt: null, daysSinceVerification: null },
      },
    };

    const result = applyFreshnessAdjustments(fieldConfidence, freshness);

    // maxPenalty for profile is 0.2, so adjusted should be 0.9 - 0.2 = 0.7
    expect(result.adjustedConfidence.revenue).toBe(0.7);
  });
});

describe('assessRefreshNeeds', () => {
  it('should return needsRefresh=false when all categories are fresh', () => {
    const freshness = {
      score: 95, status: 'fresh' as const, lastResearchedAt: new Date().toISOString(),
      daysSinceResearch: 1, evidenceCount: 20, signalCount: 5,
      categories: {
        profile: { score: 100, status: 'fresh' as const, lastVerifiedAt: new Date().toISOString(), daysSinceVerification: 1 },
        signal: { score: 100, status: 'fresh' as const, lastVerifiedAt: new Date().toISOString(), daysSinceVerification: 1 },
        contact: { score: 100, status: 'fresh' as const, lastVerifiedAt: new Date().toISOString(), daysSinceVerification: 1 },
        technology: { score: 100, status: 'fresh' as const, lastVerifiedAt: new Date().toISOString(), daysSinceVerification: 1 },
      },
    };

    const result = assessRefreshNeeds(freshness);
    expect(result.needsRefresh).toBe(false);
    expect(result.urgency).toBe('none');
    expect(result.categoryNeeds).toHaveLength(0);
  });

  it('should return immediate urgency when signals are stale', () => {
    const freshness = {
      score: 20, status: 'stale' as const, lastResearchedAt: new Date(Date.now() - 60 * 86400000).toISOString(),
      daysSinceResearch: 60, evidenceCount: 5, signalCount: 0,
      categories: {
        profile: { score: 80, status: 'fresh' as const, lastVerifiedAt: new Date(Date.now() - 30 * 86400000).toISOString(), daysSinceVerification: 30 },
        signal: { score: 0, status: 'stale' as const, lastVerifiedAt: new Date(Date.now() - 60 * 86400000).toISOString(), daysSinceVerification: 60 },
        contact: { score: 90, status: 'fresh' as const, lastVerifiedAt: new Date(Date.now() - 10 * 86400000).toISOString(), daysSinceVerification: 10 },
        technology: { score: 85, status: 'fresh' as const, lastVerifiedAt: new Date(Date.now() - 20 * 86400000).toISOString(), daysSinceVerification: 20 },
      },
    };

    const result = assessRefreshNeeds(freshness);
    expect(result.needsRefresh).toBe(true);
    expect(result.urgency).toBe('immediate');
    expect(result.categoryNeeds.some(c => c.category === 'signal')).toBe(true);
  });

  it('should return recommended urgency when technology is aging', () => {
    const freshness = {
      score: 50, status: 'aging' as const, lastResearchedAt: new Date(Date.now() - 45 * 86400000).toISOString(),
      daysSinceResearch: 45, evidenceCount: 8, signalCount: 2,
      categories: {
        profile: { score: 100, status: 'fresh' as const, lastVerifiedAt: new Date().toISOString(), daysSinceVerification: 5 },
        signal: { score: 100, status: 'fresh' as const, lastVerifiedAt: new Date(Date.now() - 5 * 86400000).toISOString(), daysSinceVerification: 5 },
        contact: { score: 80, status: 'fresh' as const, lastVerifiedAt: new Date(Date.now() - 20 * 86400000).toISOString(), daysSinceVerification: 20 },
        technology: { score: 40, status: 'aging' as const, lastVerifiedAt: new Date(Date.now() - 90 * 86400000).toISOString(), daysSinceVerification: 90 },
      },
    };

    const result = assessRefreshNeeds(freshness);
    expect(result.needsRefresh).toBe(true);
    expect(['optional', 'recommended']).toContain(result.urgency);
    expect(result.categoryNeeds.some(c => c.category === 'technology')).toBe(true);
  });
});

describe('buildResearchContextText', () => {
  it('should return no-data message for empty context', () => {
    const ctx: ResearchContext = {
      companyId: 'c1', companyName: 'Test', domain: null, industry: null, website: null,
      country: null, sizeRange: null, internalSummary: null,
      researchCard: null, keyPeople: [], signals: [], recentNews: [],
      fieldConfidence: {}, evidenceSummary: { totalEvidence: 0, fields: {} },
      freshness: { score: 0, status: 'none', lastResearchedAt: null, daysSinceResearch: null, evidenceCount: 0, signalCount: 0, categories: { profile: { score: 0, status: 'none', lastVerifiedAt: null, daysSinceVerification: null }, signal: { score: 0, status: 'none', lastVerifiedAt: null, daysSinceVerification: null }, contact: { score: 0, status: 'none', lastVerifiedAt: null, daysSinceVerification: null }, technology: { score: 0, status: 'none', lastVerifiedAt: null, daysSinceVerification: null } } },
      structuredTechLandscape: { cloud: [], data: [], ai: [], applications: [] },
      strategicPriorities: [],
      capabilityMatchingInputs: { businessProblems: [], transformationAreas: [], technologyThemes: [] },
      contactCount: 0, internalNotes: null,
    };

    const text = buildResearchContextText(ctx);
    expect(text).toContain('No research data available');
  });

  it('should include business overview and signals when present', () => {
    const ctx: ResearchContext = {
      companyId: 'c1', companyName: 'Test', domain: 'test.com', industry: 'Tech', website: 'https://test.com',
      country: 'US', sizeRange: '501-1000', internalSummary: null,
      researchCard: {
        exists: true, source: 'research_engine_v3', enrichedAt: new Date().toISOString(),
        businessOverview: 'A great tech company', revenue: '$100M', employeeCount: '500',
        fundingStage: 'Series B', techStack: 'React, AWS', socialProfiles: {},
        industry: 'Tech', website: 'https://test.com',
        profileFreshnessAt: null, signalFreshnessAt: null, techFreshnessAt: null, contactFreshnessAt: null,
      },
      keyPeople: [{ name: 'John', title: 'CEO' }],
      signals: [{ id: 's1', type: 'funding', title: 'Raised $50M', description: 'Series B', impact: 'high', severity: 'high', confidence: 0.9, sourceUrl: null, signalDate: null, detectedAt: new Date().toISOString() }],
      recentNews: [],
      fieldConfidence: { revenue: 0.8 },
      evidenceSummary: { totalEvidence: 15, fields: { revenue: { count: 3, avgConfidence: 0.8, tierBreakdown: { premium: 2, standard: 1, low: 0 } } } },
      freshness: { score: 90, status: 'fresh', lastResearchedAt: new Date().toISOString(), daysSinceResearch: 1, evidenceCount: 15, signalCount: 1, categories: { profile: { score: 100, status: 'fresh', lastVerifiedAt: new Date().toISOString(), daysSinceVerification: 1 }, signal: { score: 100, status: 'fresh', lastVerifiedAt: new Date().toISOString(), daysSinceVerification: 1 }, contact: { score: 100, status: 'fresh', lastVerifiedAt: new Date().toISOString(), daysSinceVerification: 1 }, technology: { score: 100, status: 'fresh', lastVerifiedAt: new Date().toISOString(), daysSinceVerification: 1 } } },
      structuredTechLandscape: { cloud: ['AWS'], data: [], ai: [], applications: ['React'] },
      strategicPriorities: [],
      capabilityMatchingInputs: { businessProblems: [], transformationAreas: [], technologyThemes: [] },
      contactCount: 2, internalNotes: null,
    };

    const text = buildResearchContextText(ctx);
    expect(text).toContain('A great tech company');
    expect(text).toContain('Revenue: $100M');
    expect(text).toContain('Raised $50M');
    expect(text).toContain('John, CEO');
    expect(text).toContain('Technology Landscape');
  });
});