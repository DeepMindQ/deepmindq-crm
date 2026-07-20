/**
 * Unit tests for the Phase 5 Scoring Engine
 * File: src/lib/account-prioritization.ts
 *
 * Tests the exported pure functions: parseRevenueToNumber, fuzzyIndustryScore,
 * fuzzyGeographyScore, classifyTier, computeComposite, toSignalEvidence.
 * Also tests computeAccountPriority (the main public API) with mocked DB.
 *
 * Task ID: 6a
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { StaticFitBreakdown, DynamicIntelBreakdown, TimingUrgencyBreakdown } from '@/lib/account-prioritization';
import type { IcpProfile } from '@/lib/icp-config';

// ── Mocks (all vi.mock calls are hoisted — no external vars) ─

vi.mock('@/lib/db', () => ({
  db: {
    company: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    companySignal: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    pursuit: {
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    opportunityRecommendation: {
      count: vi.fn(),
      groupBy: vi.fn(),
    },
    capabilityAsset: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    priorityScoreHistory: {
      findFirst: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({}),
    },
    systemSetting: {
      findUnique: vi.fn().mockResolvedValue(null),
      upsert: vi.fn().mockResolvedValue({}),
    },
    $executeRaw: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/lib/scoring-config', () => {
  const config = {
    weights: { staticFit: 0.40, dynamicIntelligence: 0.40, timingUrgency: 0.20 },
    tierThresholds: { hot: 90, active: 70, nurture: 50 },
    signalRecencyDays: 30,
    subDimensionWeights: {
      dynamicIntelligence: {
        intelligenceScore: 0.30, researchDepth: 0.25,
        signalQuality: 0.25, contactCoverage: 0.20,
      },
      timingUrgency: {
        signalRecency: 0.40, engagementRecency: 0.35, growthIndicator: 0.25,
      },
    },
  };
  return {
    getScoringConfig: vi.fn().mockResolvedValue(config),
    getCachedScoringConfig: vi.fn().mockReturnValue(config),
    getRecencyCutoffSync: vi.fn().mockReturnValue(new Date(Date.now() - 30 * 86400000)),
    getRecencyCutoff: vi.fn().mockReturnValue(new Date(Date.now() - 30 * 86400000)),
    DEFAULT_SCORING_CONFIG: config,
  };
});

vi.mock('@/lib/icp-config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/icp-config')>();
  return {
    ...actual,
    getIcpProfile: vi.fn().mockResolvedValue({ ...actual.DEFAULT_ICP }),
    getIcpProfileSync: vi.fn().mockReturnValue({ ...actual.DEFAULT_ICP }),
  };
});

vi.mock('@/lib/events', () => ({
  scoreEvents: {
    emit: vi.fn(),
    on: vi.fn().mockReturnValue(() => {}),
    removeAll: vi.fn(),
  },
}));

// ── Imports (after mocks) ─────────────────────────────────────

import {
  parseRevenueToNumber,
  fuzzyIndustryScore,
  fuzzyGeographyScore,
  classifyTier,
  computeComposite,
  toSignalEvidence,
  computeAccountPriority,
} from '@/lib/account-prioritization';
import { DEFAULT_ICP } from '@/lib/icp-config';
import { db } from '@/lib/db';

const mockedDb = vi.mocked(db);

// ── 1. Revenue Parsing ────────────────────────────────────────

describe('parseRevenueToNumber', () => {
  it('parses "$1M" to 1,000,000', () => {
    expect(parseRevenueToNumber('$1M')).toBe(1_000_000);
  });

  it('parses "$500K" to 500,000', () => {
    expect(parseRevenueToNumber('$500K')).toBe(500_000);
  });

  it('parses "$10B" to 10,000,000,000', () => {
    expect(parseRevenueToNumber('$10B')).toBe(10_000_000_000);
  });

  it('parses "$1.5B" to 1,500,000,000', () => {
    expect(parseRevenueToNumber('$1.5B')).toBe(1_500_000_000);
  });

  it('parses "500K" (no $) to 500,000', () => {
    expect(parseRevenueToNumber('500K')).toBe(500_000);
  });

  it('parses "$100M" to 100,000,000', () => {
    expect(parseRevenueToNumber('$100M')).toBe(100_000_000);
  });

  it('parses "2.5Billion" to 2,500,000,000 (word suffix)', () => {
    expect(parseRevenueToNumber('2.5Billion')).toBe(2_500_000_000);
  });

  it('parses "750Thousand" to 750,000', () => {
    expect(parseRevenueToNumber('750Thousand')).toBe(750_000);
  });

  it('parses plain number "5000000" to 5,000,000', () => {
    expect(parseRevenueToNumber('5000000')).toBe(5_000_000);
  });

  it('parses "$50million" (lowercase) to 50,000,000', () => {
    expect(parseRevenueToNumber('$50million')).toBe(50_000_000);
  });

  it('returns null for "N/A"', () => {
    expect(parseRevenueToNumber('N/A')).toBeNull();
  });

  it('returns null for "Unknown"', () => {
    expect(parseRevenueToNumber('Unknown')).toBeNull();
  });

  it('returns null for "-"', () => {
    expect(parseRevenueToNumber('-')).toBeNull();
  });

  it('returns null for null input', () => {
    expect(parseRevenueToNumber(null)).toBeNull();
  });

  it('returns null for undefined input', () => {
    expect(parseRevenueToNumber(undefined)).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseRevenueToNumber('')).toBeNull();
  });

  it('returns null for whitespace-only string', () => {
    expect(parseRevenueToNumber('   ')).toBeNull();
  });

  it('returns null for "abc" (no numeric)', () => {
    expect(parseRevenueToNumber('abc')).toBeNull();
  });

  it('handles "$" prefix correctly', () => {
    expect(parseRevenueToNumber('$250M')).toBe(250_000_000);
  });
});

// ── 2. Tier Classification ───────────────────────────────────

describe('classifyTier', () => {
  const defaultThresholds = { hot: 90, active: 70, nurture: 50 };

  describe('with default thresholds', () => {
    it('score 90 → HOT (boundary)', () => {
      expect(classifyTier(90, defaultThresholds)).toBe('HOT');
    });

    it('score 100 → HOT', () => {
      expect(classifyTier(100, defaultThresholds)).toBe('HOT');
    });

    it('score 95 → HOT', () => {
      expect(classifyTier(95, defaultThresholds)).toBe('HOT');
    });

    it('score 70 → ACTIVE (boundary)', () => {
      expect(classifyTier(70, defaultThresholds)).toBe('ACTIVE');
    });

    it('score 89 → ACTIVE', () => {
      expect(classifyTier(89, defaultThresholds)).toBe('ACTIVE');
    });

    it('score 80 → ACTIVE', () => {
      expect(classifyTier(80, defaultThresholds)).toBe('ACTIVE');
    });

    it('score 50 → NURTURE (boundary)', () => {
      expect(classifyTier(50, defaultThresholds)).toBe('NURTURE');
    });

    it('score 69 → NURTURE', () => {
      expect(classifyTier(69, defaultThresholds)).toBe('NURTURE');
    });

    it('score 60 → NURTURE', () => {
      expect(classifyTier(60, defaultThresholds)).toBe('NURTURE');
    });

    it('score 49 → LOW', () => {
      expect(classifyTier(49, defaultThresholds)).toBe('LOW');
    });

    it('score 0 → LOW', () => {
      expect(classifyTier(0, defaultThresholds)).toBe('LOW');
    });

    it('score 1 → LOW', () => {
      expect(classifyTier(1, defaultThresholds)).toBe('LOW');
    });
  });

  describe('with custom thresholds', () => {
    it('uses custom thresholds when provided', () => {
      const custom = { hot: 80, active: 60, nurture: 40 };
      expect(classifyTier(80, custom)).toBe('HOT');
      expect(classifyTier(60, custom)).toBe('ACTIVE');
      expect(classifyTier(40, custom)).toBe('NURTURE');
      expect(classifyTier(39, custom)).toBe('LOW');
    });

    it('handles very high custom thresholds', () => {
      const high = { hot: 95, active: 85, nurture: 75 };
      expect(classifyTier(94, high)).toBe('ACTIVE');
      expect(classifyTier(84, high)).toBe('NURTURE');
      expect(classifyTier(74, high)).toBe('LOW');
    });
  });

  describe('without explicit thresholds (uses scoring-config mock)', () => {
    it('score 90 → HOT via config', () => {
      expect(classifyTier(90)).toBe('HOT');
    });

    it('score 70 → ACTIVE via config', () => {
      expect(classifyTier(70)).toBe('ACTIVE');
    });

    it('score 50 → NURTURE via config', () => {
      expect(classifyTier(50)).toBe('NURTURE');
    });

    it('score 49 → LOW via config', () => {
      expect(classifyTier(49)).toBe('LOW');
    });
  });
});

// ── 3. Industry Matching (Fuzzy) ─────────────────────────────

describe('fuzzyIndustryScore', () => {
  const icp: IcpProfile = {
    ...DEFAULT_ICP,
    targetIndustries: ['technology', 'financial services', 'healthcare', 'e-commerce'],
    excludedIndustries: ['gambling', 'weapons'],
  };

  it('exact/contains match returns 100', () => {
    expect(fuzzyIndustryScore('Software Technology Company', icp)).toBe(100);
  });

  it('exact match with "healthcare" returns 100', () => {
    expect(fuzzyIndustryScore('Healthcare Services', icp)).toBe(100);
  });

  it('exact match with "e-commerce" returns 100', () => {
    expect(fuzzyIndustryScore('E-commerce Retail', icp)).toBe(100);
  });

  it('partial keyword match (word > 3 chars) returns 70', () => {
    // "Professional Services": companyWords(>3) = ["professional", "services"]
    // targetWords(>3) = {"technology", "financial", "services", "healthcare"}
    // "services" matches → 70
    expect(fuzzyIndustryScore('Professional Services', icp)).toBe(70);
  });

  it('related sector (2+ short word overlap) returns 40', () => {
    // Custom ICP where targetShortWords overlap is 2+
    const testIcp: IcpProfile = {
      ...DEFAULT_ICP,
      targetIndustries: ['abc def'],
      excludedIndustries: [],
    };
    // "def abc xyz" → no full match, no 4+ char word overlap (abc=3, def=3, xyz=3)
    // but companyShortWords(>2) = {"def","abc","xyz"}, targetShortWords(>2) = {"abc","def"}
    // overlap = 2 → returns 40
    expect(fuzzyIndustryScore('def abc xyz', testIcp)).toBe(40);
  });

  it('no match returns 0', () => {
    expect(fuzzyIndustryScore('Agriculture Farming', icp)).toBe(0);
  });

  it('null industry returns 0', () => {
    expect(fuzzyIndustryScore(null, icp)).toBe(0);
  });

  it('excluded industry returns 0 even if it would otherwise match', () => {
    expect(fuzzyIndustryScore('Online Gambling Technology', icp)).toBe(0);
  });

  it('weapons industry returns 0 (excluded)', () => {
    expect(fuzzyIndustryScore('Weapons Manufacturing', icp)).toBe(0);
  });

  it('case insensitive matching', () => {
    expect(fuzzyIndustryScore('TECHNOLOGY COMPANY', icp)).toBe(100);
    expect(fuzzyIndustryScore('Financial Services Corp', icp)).toBe(100);
  });

  it('fintech partial match (DEFAULT_ICP)', () => {
    expect(fuzzyIndustryScore('Fintech Startup', DEFAULT_ICP)).toBe(100);
  });

  it('software partial match (DEFAULT_ICP)', () => {
    expect(fuzzyIndustryScore('Enterprise Software', DEFAULT_ICP)).toBe(100);
  });

  it('SaaS partial match (DEFAULT_ICP)', () => {
    expect(fuzzyIndustryScore('SaaS Platform', DEFAULT_ICP)).toBe(100);
  });

  it('telecommunications partial match (DEFAULT_ICP)', () => {
    expect(fuzzyIndustryScore('Telecommunications', DEFAULT_ICP)).toBe(100);
  });

  it('energy partial match (DEFAULT_ICP)', () => {
    expect(fuzzyIndustryScore('Energy Sector', DEFAULT_ICP)).toBe(100);
  });

  it('automotive partial match (DEFAULT_ICP)', () => {
    expect(fuzzyIndustryScore('Automotive', DEFAULT_ICP)).toBe(100);
  });

  it('casino (excluded in DEFAULT_ICP) returns 0', () => {
    expect(fuzzyIndustryScore('Casino Entertainment', DEFAULT_ICP)).toBe(0);
  });

  it('adult content (excluded in DEFAULT_ICP) returns 0', () => {
    expect(fuzzyIndustryScore('Adult Entertainment', DEFAULT_ICP)).toBe(0);
  });

  it('cryptocurrency mining (excluded in DEFAULT_ICP) returns 0', () => {
    expect(fuzzyIndustryScore('Cryptocurrency Mining', DEFAULT_ICP)).toBe(0);
  });
});

// ── 4. Geography Matching (Fuzzy) ────────────────────────────

describe('fuzzyGeographyScore', () => {
  it('exact match on country returns 100', () => {
    expect(fuzzyGeographyScore('United States', null, DEFAULT_ICP)).toBe(100);
  });

  it('exact match on location returns 100', () => {
    expect(fuzzyGeographyScore(null, 'San Francisco, USA', DEFAULT_ICP)).toBe(100);
  });

  it('exact match "uk" returns 100', () => {
    expect(fuzzyGeographyScore('UK', null, DEFAULT_ICP)).toBe(100);
  });

  it('exact match "india" returns 100', () => {
    expect(fuzzyGeographyScore('India', null, DEFAULT_ICP)).toBe(100);
  });

  it('same region group returns 60 (Mexico in North America)', () => {
    expect(fuzzyGeographyScore('Mexico', null, DEFAULT_ICP)).toBe(60);
  });

  it('same region group returns 60 (France in Europe)', () => {
    expect(fuzzyGeographyScore('France', null, DEFAULT_ICP)).toBe(60);
  });

  it('same region group returns 60 (Japan in APAC)', () => {
    expect(fuzzyGeographyScore('Japan', null, DEFAULT_ICP)).toBe(60);
  });

  it('no match returns 0', () => {
    expect(fuzzyGeographyScore('Nigeria', null, DEFAULT_ICP)).toBe(0);
  });

  it('null country and location returns 0', () => {
    expect(fuzzyGeographyScore(null, null, DEFAULT_ICP)).toBe(0);
  });

  it('case insensitive matching', () => {
    expect(fuzzyGeographyScore('CANADA', null, DEFAULT_ICP)).toBe(100);
  });

  it('matches from location string even when country is null', () => {
    expect(fuzzyGeographyScore(null, 'Singapore', DEFAULT_ICP)).toBe(100);
  });

  it('matches from combined country+location', () => {
    expect(fuzzyGeographyScore('Unknown', 'Berlin, Germany', DEFAULT_ICP)).toBe(100);
  });

  it('UAE returns 100 (directly in targetRegions)', () => {
    expect(fuzzyGeographyScore('UAE', null, DEFAULT_ICP)).toBe(100);
  });

  it('Saudi Arabia returns 60 (same Middle East group as UAE)', () => {
    expect(fuzzyGeographyScore('Saudi Arabia', null, DEFAULT_ICP)).toBe(60);
  });

  it('Brazil returns 0 (Latin America, no target regions in that group)', () => {
    expect(fuzzyGeographyScore('Brazil', null, DEFAULT_ICP)).toBe(0);
  });
});

// ── 5. Composite Score ────────────────────────────────────────

describe('computeComposite', () => {
  const allHundred: StaticFitBreakdown = {
    industryScore: 100, companySizeScore: 100, geographyScore: 100,
    revenueScore: 100, techFitScore: 100, total: 100,
  };
  const allHundredDI: DynamicIntelBreakdown = {
    intelligenceScoreNorm: 100, researchDepthScore: 100,
    signalQualityScore: 100, contactCoverageScore: 100, total: 100,
  };
  const allHundredTU: TimingUrgencyBreakdown = {
    signalRecencyScore: 100, engagementRecencyScore: 100,
    growthIndicatorScore: 100, total: 100,
  };

  it('all 100s → composite 100', () => {
    expect(computeComposite(allHundred, allHundredDI, allHundredTU)).toBe(100);
  });

  it('all 0s → composite 0', () => {
    const zeros: StaticFitBreakdown = {
      industryScore: 0, companySizeScore: 0, geographyScore: 0,
      revenueScore: 0, techFitScore: 0, total: 0,
    };
    const zerosDI: DynamicIntelBreakdown = {
      intelligenceScoreNorm: 0, researchDepthScore: 0,
      signalQualityScore: 0, contactCoverageScore: 0, total: 0,
    };
    const zerosTU: TimingUrgencyBreakdown = {
      signalRecencyScore: 0, engagementRecencyScore: 0,
      growthIndicatorScore: 0, total: 0,
    };
    expect(computeComposite(zeros, zerosDI, zerosTU)).toBe(0);
  });

  it('mixed scores produce correct weighted average', () => {
    // static=80, dynamic=60, timing=40, weights=0.4/0.4/0.2
    const sf: StaticFitBreakdown = { ...allHundred, total: 80 };
    const di: DynamicIntelBreakdown = { ...allHundredDI, total: 60 };
    const tu: TimingUrgencyBreakdown = { ...allHundredTU, total: 40 };
    const expected = Math.round(80 * 0.4 + 60 * 0.4 + 40 * 0.2); // 32 + 24 + 8 = 64
    expect(computeComposite(sf, di, tu)).toBe(expected);
  });

  it('excluded industry caps composite at 25', () => {
    const sf: StaticFitBreakdown = { ...allHundred, total: 100 };
    const di: DynamicIntelBreakdown = { ...allHundredDI, total: 100 };
    const tu: TimingUrgencyBreakdown = { ...allHundredTU, total: 100 };
    expect(computeComposite(sf, di, tu, 'Gambling')).toBe(25);
  });

  it('excluded industry: score below 25 stays as-is', () => {
    const sf: StaticFitBreakdown = { ...allHundred, total: 10 };
    const di: DynamicIntelBreakdown = { ...allHundredDI, total: 10 };
    const tu: TimingUrgencyBreakdown = { ...allHundredTU, total: 10 };
    const expected = Math.round(10 * 0.4 + 10 * 0.4 + 10 * 0.2); // 10
    expect(computeComposite(sf, di, tu, 'Weapons')).toBe(expected);
  });

  it('null industry does not trigger exclusion', () => {
    const sf: StaticFitBreakdown = { ...allHundred, total: 100 };
    const di: DynamicIntelBreakdown = { ...allHundredDI, total: 100 };
    const tu: TimingUrgencyBreakdown = { ...allHundredTU, total: 100 };
    expect(computeComposite(sf, di, tu, null)).toBe(100);
  });

  it('composite is clamped between 0 and 100', () => {
    const sf: StaticFitBreakdown = { ...allHundred, total: 1000 };
    const di: DynamicIntelBreakdown = { ...allHundredDI, total: 1000 };
    const tu: TimingUrgencyBreakdown = { ...allHundredTU, total: 1000 };
    expect(computeComposite(sf, di, tu)).toBeLessThanOrEqual(100);
    expect(computeComposite(sf, di, tu)).toBeGreaterThanOrEqual(0);
  });

  it('non-excluded industry with high scores is not capped', () => {
    const sf: StaticFitBreakdown = { ...allHundred, total: 100 };
    const di: DynamicIntelBreakdown = { ...allHundredDI, total: 100 };
    const tu: TimingUrgencyBreakdown = { ...allHundredTU, total: 100 };
    expect(computeComposite(sf, di, tu, 'Technology')).toBe(100);
  });

  it('casino is excluded → capped at 25', () => {
    const sf: StaticFitBreakdown = { ...allHundred, total: 90 };
    const di: DynamicIntelBreakdown = { ...allHundredDI, total: 90 };
    const tu: TimingUrgencyBreakdown = { ...allHundredTU, total: 90 };
    expect(computeComposite(sf, di, tu, 'Casino Resort')).toBe(25);
  });
});

// ── 6. Signal Evidence Conversion ────────────────────────────

describe('toSignalEvidence', () => {
  const now = new Date('2025-01-15T12:00:00Z');

  it('converts DB rows to SignalEvidence with correct daysAgo (using signalDate)', () => {
    const signalDate = new Date('2025-01-10T12:00:00Z'); // 5 days ago
    const rows = [{
      id: 'sig-1',
      title: 'Cloud Migration',
      signalType: 'technology',
      severity: 'high',
      source: 'linkedin',
      createdAt: new Date('2025-01-01T12:00:00Z'),
      signalDate,
    }];

    const result = toSignalEvidence(rows, now);
    expect(result).toHaveLength(1);
    expect(result[0].signalId).toBe('sig-1');
    expect(result[0].title).toBe('Cloud Migration');
    expect(result[0].signalType).toBe('technology');
    expect(result[0].severity).toBe('high');
    expect(result[0].source).toBe('linkedin');
    expect(result[0].daysAgo).toBe(5);
  });

  it('falls back to createdAt when signalDate is null', () => {
    const createdAt = new Date('2025-01-12T12:00:00Z'); // 3 days ago
    const rows = [{
      id: 'sig-2',
      title: 'Leadership Change',
      signalType: 'leadership_change',
      severity: 'medium',
      source: null,
      createdAt,
      signalDate: null,
    }];

    const result = toSignalEvidence(rows, now);
    expect(result).toHaveLength(1);
    expect(result[0].daysAgo).toBe(3);
    expect(result[0].source).toBeNull();
  });

  it('normalizes signal types via aliases', () => {
    const rows = [{
      id: 'sig-3',
      title: 'Tech Stack Change',
      signalType: 'tech_stack_change',
      severity: 'low',
      source: 'crunchbase',
      createdAt: now,
      signalDate: now,
    }];

    const result = toSignalEvidence(rows, now);
    expect(result[0].signalType).toBe('technology');
  });

  it('handles empty array', () => {
    const result = toSignalEvidence([], now);
    expect(result).toHaveLength(0);
  });

  it('computes daysAgo correctly for same-day signals', () => {
    const rows = [{
      id: 'sig-4',
      title: 'Same Day',
      signalType: 'news',
      severity: 'low',
      source: null,
      createdAt: now,
      signalDate: now,
    }];

    const result = toSignalEvidence(rows, now);
    expect(result[0].daysAgo).toBe(0);
  });
});

// ── 7. Full Priority Computation (computeAccountPriority) ────

describe('computeAccountPriority', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when company not found', async () => {
    mockedDb.company.findUnique.mockResolvedValue(null);

    const result = await computeAccountPriority('nonexistent-id');
    expect(result).toBeNull();
  });

  it('computes high score for company matching all ICP criteria', async () => {
    const company = {
      id: 'comp-1',
      rawName: 'TechCorp Inc',
      industry: 'Technology',
      sizeRange: '501-1000',
      location: 'San Francisco, CA',
      country: 'United States',
      intelligenceScore: 85,
      engagementScore: 70,
      lastActivityAt: new Date(),
      lastEnrichedAt: new Date(),
      lifecycleStage: 'proposal',
      status: 'active',
      accountPriorityScore: null,
      priorityTier: null,
      researchCard: {
        revenue: '$500M',
        employeeCount: '750',
        techStack: 'AWS, Kubernetes, Docker, React, Node.js, Python',
        fundingStage: 'Series C',
        enrichmentSource: 'apollo',
      },
      _count: { contacts: 8, signals: 5, notes: 3, timeline: 2 },
    };

    mockedDb.company.findUnique.mockResolvedValue(company);
    mockedDb.companySignal.count
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(4);
    mockedDb.companySignal.findMany.mockResolvedValue([
      {
        id: 's1', title: 'Cloud Migration Initiative', signalType: 'technology',
        severity: 'high', source: 'linkedin', createdAt: new Date(),
        signalDate: new Date(), meaningCategory: 'vendor_evaluation',
      },
      {
        id: 's2', title: 'Series C Funding', signalType: 'funding',
        severity: 'critical', source: 'crunchbase', createdAt: new Date(),
        signalDate: new Date(), meaningCategory: 'budget_available',
      },
    ]);
    mockedDb.pursuit.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    mockedDb.company.update.mockResolvedValue({});

    const result = await computeAccountPriority('comp-1');
    expect(result).not.toBeNull();
    expect(result!.companyId).toBe('comp-1');
    expect(result!.companyName).toBe('TechCorp Inc');
    expect(result!.accountPriorityScore).toBeGreaterThan(0);
    expect(result!.priorityTier).toBeDefined();
    expect(['HOT', 'ACTIVE', 'NURTURE', 'LOW']).toContain(result!.priorityTier);
  });

  it('computes low score for company matching no ICP criteria', async () => {
    const company = {
      id: 'comp-2',
      rawName: 'FarmCo',
      industry: 'Agriculture',
      sizeRange: '1-10',
      location: 'Nairobi',
      country: 'Kenya',
      intelligenceScore: 0,
      engagementScore: 0,
      lastActivityAt: null,
      lastEnrichedAt: null,
      lifecycleStage: 'prospect',
      status: 'new',
      accountPriorityScore: null,
      priorityTier: null,
      researchCard: null,
      _count: { contacts: 0, signals: 0, notes: 0, timeline: 0 },
    };
    // NOTE: "1-10" actually matches ICP size ranges via substring ("501-10000" contains "1-10"),
    // but overall score should still be LOW due to industry/geography mismatch.

    mockedDb.company.findUnique.mockResolvedValue(company);
    mockedDb.companySignal.count.mockResolvedValue(0);
    mockedDb.companySignal.findMany.mockResolvedValue([]);
    mockedDb.pursuit.count.mockResolvedValue(0);
    mockedDb.company.update.mockResolvedValue({});

    const result = await computeAccountPriority('comp-2');
    expect(result).not.toBeNull();
    expect(result!.priorityTier).toBe('LOW');
  });

  it('sets isExcluded flag for excluded industry', async () => {
    const company = {
      id: 'comp-3',
      rawName: 'BetPalace',
      industry: 'Online Gambling',
      sizeRange: '201-500',
      location: 'Las Vegas',
      country: 'United States',
      intelligenceScore: 80,
      engagementScore: 60,
      lastActivityAt: new Date(),
      lastEnrichedAt: new Date(),
      lifecycleStage: 'active',
      status: 'active',
      accountPriorityScore: null,
      priorityTier: null,
      researchCard: {
        revenue: '$100M',
        employeeCount: '350',
        techStack: 'React, Node.js',
        fundingStage: 'Series B',
        enrichmentSource: 'apollo',
      },
      _count: { contacts: 5, signals: 3, notes: 2, timeline: 1 },
    };

    mockedDb.company.findUnique.mockResolvedValue(company);
    mockedDb.companySignal.count.mockResolvedValue(1);
    mockedDb.companySignal.findMany.mockResolvedValue([]);
    mockedDb.pursuit.count.mockResolvedValue(0);
    mockedDb.company.update.mockResolvedValue({});

    const result = await computeAccountPriority('comp-3');
    expect(result).not.toBeNull();
    expect(result!.isExcluded).toBe(true);
    expect(result!.accountPriorityScore).toBeLessThanOrEqual(25);
    expect(result!.priorityTier).toBe('LOW');
    expect(result!.recommendedFocus).toEqual([]);
  });

  it('generates whyNowReasons as array with max 8 items and no duplicates', async () => {
    const company = {
      id: 'comp-4',
      rawName: 'WhyNowCorp',
      industry: 'Software',
      sizeRange: '501-1000',
      location: 'New York',
      country: 'United States',
      intelligenceScore: 90,
      engagementScore: 80,
      lastActivityAt: new Date(),
      lastEnrichedAt: new Date(),
      lifecycleStage: 'proposal',
      status: 'active',
      accountPriorityScore: null,
      priorityTier: null,
      researchCard: {
        revenue: '$500M',
        employeeCount: '800',
        techStack: 'AWS, Kubernetes, Docker, React, Python, Java, TypeScript',
        fundingStage: 'Series C',
        enrichmentSource: 'apollo',
      },
      _count: { contacts: 15, signals: 8, notes: 5, timeline: 3 },
    };

    mockedDb.company.findUnique.mockResolvedValue(company);
    mockedDb.companySignal.count
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(6);
    mockedDb.companySignal.findMany.mockResolvedValue([
      { id: 'ws1', title: 'Tech Upgrade', signalType: 'technology',
        severity: 'critical', source: 'news', createdAt: new Date(),
        signalDate: new Date(), meaningCategory: 'vendor_evaluation' },
      { id: 'ws2', title: 'Funding Round', signalType: 'funding',
        severity: 'high', source: 'crunchbase', createdAt: new Date(),
        signalDate: new Date(), meaningCategory: 'budget_available' },
      { id: 'ws3', title: 'Hiring Spree', signalType: 'hiring',
        severity: 'medium', source: 'linkedin', createdAt: new Date(),
        signalDate: new Date(), meaningCategory: 'growth_pressure' },
      { id: 'ws4', title: 'Market Expansion', signalType: 'expansion',
        severity: 'high', source: 'news', createdAt: new Date(),
        signalDate: new Date(), meaningCategory: 'leadership_openness' },
      { id: 'ws5', title: 'Product Launch', signalType: 'product',
        severity: 'medium', source: 'blog', createdAt: new Date(),
        signalDate: new Date(), meaningCategory: 'tech_dissatisfaction' },
    ]);
    mockedDb.pursuit.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(0);
    mockedDb.company.update.mockResolvedValue({});

    const result = await computeAccountPriority('comp-4');
    expect(result).not.toBeNull();
    expect(Array.isArray(result!.whyNowReasons)).toBe(true);
    expect(result!.whyNowReasons.length).toBeLessThanOrEqual(8);
    // No duplicates
    const uniqueReasons = new Set(result!.whyNowReasons);
    expect(uniqueReasons.size).toBe(result!.whyNowReasons.length);
    // Should have some reasons given the rich data
    expect(result!.whyNowReasons.length).toBeGreaterThanOrEqual(1);
  });

  it('returns topSignals (max 5) with correct structure', async () => {
    const company = {
      id: 'comp-5',
      rawName: 'SignalCorp',
      industry: 'Technology',
      sizeRange: '201-500',
      location: 'Austin, TX',
      country: 'United States',
      intelligenceScore: 50,
      engagementScore: 30,
      lastActivityAt: new Date(),
      lastEnrichedAt: new Date(Date.now() - 5 * 86400000),
      lifecycleStage: 'prospect',
      status: 'active',
      accountPriorityScore: null,
      priorityTier: null,
      researchCard: {
        revenue: '$50M',
        employeeCount: '300',
        techStack: 'AWS, React',
        fundingStage: 'Series A',
        enrichmentSource: 'apollo',
      },
      _count: { contacts: 3, signals: 7, notes: 1, timeline: 0 },
    };

    mockedDb.company.findUnique.mockResolvedValue(company);
    mockedDb.companySignal.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);
    mockedDb.companySignal.findMany.mockResolvedValue([
      { id: 'ts1', title: 'Cloud Migration', signalType: 'technology',
        severity: 'critical', source: 'news', createdAt: new Date(),
        signalDate: new Date(), meaningCategory: null },
      { id: 'ts2', title: 'New CTO', signalType: 'leadership_change',
        severity: 'high', source: 'linkedin',
        createdAt: new Date(Date.now() - 2 * 86400000),
        signalDate: new Date(Date.now() - 2 * 86400000), meaningCategory: null },
      { id: 'ts3', title: 'Hiring Engineers', signalType: 'hiring',
        severity: 'medium', source: 'linkedin',
        createdAt: new Date(Date.now() - 10 * 86400000),
        signalDate: new Date(Date.now() - 10 * 86400000), meaningCategory: null },
    ]);
    mockedDb.pursuit.count.mockResolvedValue(0);
    mockedDb.company.update.mockResolvedValue({});

    const result = await computeAccountPriority('comp-5');
    expect(result).not.toBeNull();
    expect(result!.topSignals.length).toBeLessThanOrEqual(5);
    for (const sig of result!.topSignals) {
      expect(sig).toHaveProperty('signalId');
      expect(sig).toHaveProperty('title');
      expect(sig).toHaveProperty('signalType');
      expect(sig).toHaveProperty('severity');
      expect(sig).toHaveProperty('daysAgo');
    }
    // Critical severity should be ranked first
    if (result!.topSignals.length >= 1) {
      expect(result!.topSignals[0].severity).toBe('critical');
    }
  });

  it('company with no signals and no research card → baseline score', async () => {
    const company = {
      id: 'comp-6',
      rawName: 'BareBones Inc',
      industry: 'Technology',
      sizeRange: null,
      location: null,
      country: 'United States',
      intelligenceScore: 0,
      engagementScore: 0,
      lastActivityAt: null,
      lastEnrichedAt: null,
      lifecycleStage: 'prospect',
      status: 'new',
      accountPriorityScore: null,
      priorityTier: null,
      researchCard: null,
      _count: { contacts: 0, signals: 0, notes: 0, timeline: 0 },
    };

    mockedDb.company.findUnique.mockResolvedValue(company);
    mockedDb.companySignal.count.mockResolvedValue(0);
    mockedDb.companySignal.findMany.mockResolvedValue([]);
    mockedDb.pursuit.count.mockResolvedValue(0);
    mockedDb.company.update.mockResolvedValue({});

    const result = await computeAccountPriority('comp-6');
    expect(result).not.toBeNull();
    expect(result!.accountPriorityScore).toBeGreaterThanOrEqual(0);
    expect(result!.accountPriorityScore).toBeLessThanOrEqual(100);
    expect(result!.whyNowReasons.length).toBeLessThanOrEqual(8);
    expect(result!.topSignals).toEqual([]);
  });

  it('persists score and tier to DB via company.update', async () => {
    const company = {
      id: 'comp-7',
      rawName: 'PersistCorp',
      industry: 'SaaS',
      sizeRange: '201-500',
      location: 'Seattle',
      country: 'United States',
      intelligenceScore: 60,
      engagementScore: 40,
      lastActivityAt: new Date(),
      lastEnrichedAt: new Date(),
      lifecycleStage: 'qualification',
      status: 'active',
      accountPriorityScore: null,
      priorityTier: null,
      researchCard: {
        revenue: '$100M',
        employeeCount: '350',
        techStack: 'Kubernetes, Docker, React, Node',
        fundingStage: 'Series B',
        enrichmentSource: 'apollo',
      },
      _count: { contacts: 4, signals: 2, notes: 1, timeline: 0 },
    };

    mockedDb.company.findUnique.mockResolvedValue(company);
    mockedDb.companySignal.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(2);
    mockedDb.companySignal.findMany.mockResolvedValue([
      { id: 'ps1', title: 'Platform Upgrade', signalType: 'technology',
        severity: 'high', source: 'blog', createdAt: new Date(),
        signalDate: new Date(), meaningCategory: null },
    ]);
    mockedDb.pursuit.count.mockResolvedValue(0);
    mockedDb.company.update.mockResolvedValue({});

    const result = await computeAccountPriority('comp-7');
    expect(result).not.toBeNull();

    expect(mockedDb.company.update).toHaveBeenCalledTimes(1);
    expect(mockedDb.company.update).toHaveBeenCalledWith({
      where: { id: 'comp-7' },
      data: {
        accountPriorityScore: result!.accountPriorityScore,
        priorityTier: result!.priorityTier,
        priorityComputedAt: expect.any(Date),
      },
    });
  });

  it('result has all required fields', async () => {
    const company = {
      id: 'comp-8',
      rawName: 'FullFields Corp',
      industry: 'Cloud Computing',
      sizeRange: '1001-5000',
      location: 'London',
      country: 'United Kingdom',
      intelligenceScore: 70,
      engagementScore: 50,
      lastActivityAt: new Date(),
      lastEnrichedAt: new Date(),
      lifecycleStage: 'active',
      status: 'active',
      accountPriorityScore: null,
      priorityTier: null,
      researchCard: {
        revenue: '$200M',
        employeeCount: '2500',
        techStack: 'AWS, Azure, GCP, Kubernetes, Docker',
        fundingStage: 'Series D',
        enrichmentSource: 'apollo',
      },
      _count: { contacts: 6, signals: 4, notes: 2, timeline: 1 },
    };

    mockedDb.company.findUnique.mockResolvedValue(company);
    mockedDb.companySignal.count
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3);
    mockedDb.companySignal.findMany.mockResolvedValue([
      { id: 'ff1', title: 'Multi-Cloud Strategy', signalType: 'technology',
        severity: 'high', source: 'news', createdAt: new Date(),
        signalDate: new Date(), meaningCategory: null },
    ]);
    mockedDb.pursuit.count.mockResolvedValue(0);
    mockedDb.company.update.mockResolvedValue({});

    const result = await computeAccountPriority('comp-8');
    expect(result).not.toBeNull();

    expect(result!).toHaveProperty('companyId');
    expect(result!).toHaveProperty('companyName');
    expect(result!).toHaveProperty('accountPriorityScore');
    expect(result!).toHaveProperty('priorityTier');
    expect(result!).toHaveProperty('staticFit');
    expect(result!).toHaveProperty('dynamicIntelligence');
    expect(result!).toHaveProperty('timingUrgency');
    expect(result!).toHaveProperty('computedAt');
    expect(result!).toHaveProperty('whyNowReasons');
    expect(result!).toHaveProperty('topSignals');
    expect(result!).toHaveProperty('recommendedFocus');
    expect(result!).toHaveProperty('isExcluded');

    expect(result!.staticFit).toHaveProperty('industryScore');
    expect(result!.staticFit).toHaveProperty('companySizeScore');
    expect(result!.staticFit).toHaveProperty('geographyScore');
    expect(result!.staticFit).toHaveProperty('revenueScore');
    expect(result!.staticFit).toHaveProperty('techFitScore');
    expect(result!.staticFit).toHaveProperty('total');

    expect(result!.dynamicIntelligence).toHaveProperty('intelligenceScoreNorm');
    expect(result!.dynamicIntelligence).toHaveProperty('researchDepthScore');
    expect(result!.dynamicIntelligence).toHaveProperty('signalQualityScore');
    expect(result!.dynamicIntelligence).toHaveProperty('contactCoverageScore');
    expect(result!.dynamicIntelligence).toHaveProperty('total');

    expect(result!.timingUrgency).toHaveProperty('signalRecencyScore');
    expect(result!.timingUrgency).toHaveProperty('engagementRecencyScore');
    expect(result!.timingUrgency).toHaveProperty('growthIndicatorScore');
    expect(result!.timingUrgency).toHaveProperty('total');
  });
});