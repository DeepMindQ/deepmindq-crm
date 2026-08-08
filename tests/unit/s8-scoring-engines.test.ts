/**
 * Session 8 — Scoring Engines Comprehensive Test Suite
 *
 * Covers Component 4.1 (DataCompletenessEngine),
 * Component 4.2 (FreshnessDecayEngine), and
 * Component 4.3 (SourceReliabilityEngine).
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DataCompletenessEngine, toGrade } from '@/lib/scoring/data-completeness-engine';
import type {
  CompanyWithRelations,
  ContactWithFields,
} from '@/lib/scoring/data-completeness-engine';
import { FreshnessDecayEngine } from '@/lib/scoring/freshness-decay-engine';

// ─── Mocks for Source Reliability Engine (4.3) ─────────────────────

const mockFindMany = vi.fn();
const mockFindUnique = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    evidenceSourceReliability: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      findUnique: (...args: unknown[]) => mockFindUnique(...args),
    },
  },
}));

vi.mock('@/lib/source-reliability', () => ({
  getSourceReliability: vi.fn().mockResolvedValue(0.5),
}));

// Import AFTER mocks are defined
import { SourceReliabilityEngine } from '@/lib/scoring/source-reliability-engine';

// ═══════════════════════════════════════════════════════════════════════
// 4.1 — Data Completeness Engine
// ═══════════════════════════════════════════════════════════════════════

describe('DataCompletenessEngine', () => {
  // ─── Helpers ──────────────────────────────────────────────────────

  /** Build a fully populated company for maximum score. */
  function makeFullCompany(overrides?: Partial<CompanyWithRelations>): CompanyWithRelations {
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
    return {
      id: 'co-1',
      rawName: 'Acme Corp',
      normalizedName: 'acme corp',
      domain: 'acme.com',
      website: 'https://acme.com',
      industry: 'SaaS',
      location: 'San Francisco, CA',
      sizeRange: '201-500',
      internalSummary: 'Enterprise SaaS company',
      lastEnrichedAt: threeDaysAgo,
      lastActivityAt: threeDaysAgo,
      researchCard: {
        revenue: '$50M',
        employeeCount: '350',
        fundingStage: 'Series C',
        techStack: ['React', 'Node.js', 'PostgreSQL'],
        businessOverview: 'Leading provider of cloud solutions',
      },
      contacts: [{ id: 'c-1' }, { id: 'c-2' }, { id: 'c-3' }],
      signals: [
        { id: 's-1', status: 'active' },
        { id: 's-2', status: 'active' },
        { id: 's-3', status: 'active' },
      ],
      ...overrides,
    };
  }

  /** Build an empty company (no fields populated). */
  function makeEmptyCompany(): CompanyWithRelations {
    return {
      id: 'co-empty',
      rawName: '',
      normalizedName: '',
      domain: null,
      website: null,
      industry: null,
      location: null,
      sizeRange: null,
      internalSummary: null,
      lastEnrichedAt: null,
      lastActivityAt: null,
      researchCard: null,
      contacts: [],
      signals: [],
    };
  }

  /** Build a fully populated contact for maximum score. */
  function makeFullContact(): ContactWithFields {
    return {
      id: 'ct-1',
      rawName: 'Jane Smith',
      normalizedName: 'jane smith',
      email: 'jane@acme.com',
      linkedinUrl: 'https://linkedin.com/in/janesmith',
      title: 'VP of Engineering',
      role: 'decision_maker',
      phone: '+1-555-0100',
      location: 'San Francisco, CA',
      companyFitScore: 85,
      engagementScore: 70,
      enrichmentScore: 90,
      enrichmentData: { source: 'clearbit' },
      source: 'clearbit',
      consentStatus: 'opted_in',
    };
  }

  // ─── scoreCompany ─────────────────────────────────────────────────

  describe('scoreCompany', () => {
    it('returns 100 for a fully populated company', () => {
      const result = DataCompletenessEngine.scoreCompany(makeFullCompany());
      expect(result.overallScore).toBe(100);
      expect(result.entityId).toBe('co-1');
      expect(result.entityType).toBe('company');
    });

    it('returns 0 for an empty company (no fields)', () => {
      const result = DataCompletenessEngine.scoreCompany(makeEmptyCompany());
      expect(result.overallScore).toBe(0);
      expect(result.grade).toBe('F');
    });

    it('weights Core Identity at 25%', () => {
      const result = DataCompletenessEngine.scoreCompany(makeFullCompany());
      const dim = result.dimensions.find((d) => d.name === 'Core Identity');
      expect(dim).toBeDefined();
      expect(dim!.weight).toBe(0.25);
    });

    it('weights Financial at 20%', () => {
      const result = DataCompletenessEngine.scoreCompany(makeFullCompany());
      const dim = result.dimensions.find((d) => d.name === 'Financial');
      expect(dim).toBeDefined();
      expect(dim!.weight).toBe(0.20);
    });

    it('weights Intelligence at 20%', () => {
      const result = DataCompletenessEngine.scoreCompany(makeFullCompany());
      const dim = result.dimensions.find((d) => d.name === 'Intelligence');
      expect(dim).toBeDefined();
      expect(dim!.weight).toBe(0.20);
    });

    it('weights Relationships at 20%', () => {
      const result = DataCompletenessEngine.scoreCompany(makeFullCompany());
      const dim = result.dimensions.find((d) => d.name === 'Relationships');
      expect(dim).toBeDefined();
      expect(dim!.weight).toBe(0.20);
    });

    it('weights Activity at 15%', () => {
      const result = DataCompletenessEngine.scoreCompany(makeFullCompany());
      const dim = result.dimensions.find((d) => d.name === 'Activity');
      expect(dim).toBeDefined();
      expect(dim!.weight).toBe(0.15);
    });

    it('returns grade A for score >= 90', () => {
      expect(toGrade(90)).toBe('A');
      expect(toGrade(95)).toBe('A');
      expect(toGrade(100)).toBe('A');
    });

    it('returns grade B for score >= 75', () => {
      expect(toGrade(75)).toBe('B');
      expect(toGrade(89)).toBe('B');
    });

    it('returns grade C for score >= 60', () => {
      expect(toGrade(60)).toBe('C');
      expect(toGrade(74)).toBe('C');
    });

    it('returns grade D for score >= 40', () => {
      expect(toGrade(40)).toBe('D');
      expect(toGrade(59)).toBe('D');
    });

    it('returns grade F for score < 40', () => {
      expect(toGrade(39)).toBe('F');
      expect(toGrade(0)).toBe('F');
    });

    it('activity dimension: scores 100 for recently enriched (<7 days)', () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const company = makeFullCompany({
        lastEnrichedAt: threeDaysAgo,
        lastActivityAt: threeDaysAgo,
      });
      const result = DataCompletenessEngine.scoreCompany(company);
      const activityDim = result.dimensions.find((d) => d.name === 'Activity');
      expect(activityDim).toBeDefined();
      expect(activityDim!.score).toBe(100);
    });

    it('activity dimension: scores 0 for never enriched (>=180 days)', () => {
      const company = makeEmptyCompany();
      const result = DataCompletenessEngine.scoreCompany(company);
      const activityDim = result.dimensions.find((d) => d.name === 'Activity');
      expect(activityDim).toBeDefined();
      expect(activityDim!.score).toBe(0);
    });
  });

  // ─── scoreContact ─────────────────────────────────────────────────

  describe('scoreContact', () => {
    it('returns 100 for a fully populated contact', () => {
      const result = DataCompletenessEngine.scoreContact(makeFullContact());
      expect(result.overallScore).toBe(100);
      expect(result.grade).toBe('A');
      expect(result.entityType).toBe('contact');
    });

    it('returns non-zero for a minimal contact (at least name)', () => {
      const minimal: ContactWithFields = {
        id: 'ct-min',
        rawName: 'John Doe',
        normalizedName: 'john doe',
        email: 'john@example.com',
        linkedinUrl: null,
        title: null,
        role: null,
        phone: null,
        location: null,
        companyFitScore: 0,
        engagementScore: 0,
        enrichmentScore: 0,
        enrichmentData: null,
        source: null,
        consentStatus: 'unknown',
      };
      const result = DataCompletenessEngine.scoreContact(minimal);
      // Identity: 3/3 fields present → score 100, weighted 25
      // All other dimensions: 0
      expect(result.overallScore).toBeGreaterThan(0);
      expect(result.overallScore).toBeLessThan(100);
    });
  });

  // ─── scorePortfolio ───────────────────────────────────────────────

  describe('scorePortfolio', () => {
    it('returns average score across companies', () => {
      const full = makeFullCompany();
      const empty = makeEmptyCompany();
      // Full scores 100, empty scores 0 → average 50
      const report = DataCompletenessEngine.scorePortfolio([full, empty]);
      expect(report.averageScore).toBe(50);
    });

    it('returns grade distribution counts', () => {
      const report = DataCompletenessEngine.scorePortfolio([makeFullCompany()]);
      expect(report.gradeDistribution.A).toBe(1);
      expect(report.gradeDistribution.B).toBe(0);
      expect(report.gradeDistribution.C).toBe(0);
      expect(report.gradeDistribution.D).toBe(0);
      expect(report.gradeDistribution.F).toBe(0);
    });

    it('returns median score', () => {
      const full = makeFullCompany();   // score 100
      const empty = makeEmptyCompany(); // score 0
      const report = DataCompletenessEngine.scorePortfolio([full, empty]);
      // Median of [100, 0] = (100+0)/2 = 50
      expect(report.medianScore).toBe(50);
    });

    it('handles empty company array', () => {
      const report = DataCompletenessEngine.scorePortfolio([]);
      expect(report.totalCompanies).toBe(0);
      expect(report.averageScore).toBe(0);
      expect(report.medianScore).toBe(0);
      expect(report.companyScores).toHaveLength(0);
    });
  });

  // ─── identifyGaps ─────────────────────────────────────────────────

  describe('identifyGaps', () => {
    it('identifies critical gaps for missing domain', () => {
      const company = makeFullCompany({ domain: null, website: 'https://acme.com' });
      const gaps = DataCompletenessEngine.identifyGaps(company);
      const domainGap = gaps.find((g) => g.field === 'domain');
      expect(domainGap).toBeDefined();
      expect(domainGap!.importance).toBe('critical');
      expect(domainGap!.currentStatus).toBe('missing');
    });

    it('identifies gaps for missing industry', () => {
      const company = makeFullCompany({ industry: null });
      const gaps = DataCompletenessEngine.identifyGaps(company);
      const industryGap = gaps.find((g) => g.field === 'industry');
      expect(industryGap).toBeDefined();
      expect(industryGap!.importance).toBe('high');
    });

    it('returns correct importance levels', () => {
      const company: CompanyWithRelations = {
        id: 'co-gaps',
        rawName: 'Test',
        normalizedName: 'test',
        domain: null,           // critical
        website: null,          // critical
        industry: null,         // high
        location: null,         // high
        sizeRange: null,        // high
        internalSummary: null,  // low
        lastEnrichedAt: null,
        lastActivityAt: null,
        researchCard: null,     // revenue: high, fundingStage: medium, techStack: medium, businessOverview: medium
        contacts: [],           // high
        signals: [],            // medium
      };
      const gaps = DataCompletenessEngine.identifyGaps(company);

      const criticalGaps = gaps.filter((g) => g.importance === 'critical');
      const highGaps = gaps.filter((g) => g.importance === 'high');
      const mediumGaps = gaps.filter((g) => g.importance === 'medium');
      const lowGaps = gaps.filter((g) => g.importance === 'low');

      // Critical: domain, website
      expect(criticalGaps.length).toBeGreaterThanOrEqual(2);
      // High: industry, location, sizeRange, revenue, contacts
      expect(highGaps.length).toBeGreaterThanOrEqual(5);
      // Medium: fundingStage, techStack, businessOverview, signals
      expect(mediumGaps.length).toBeGreaterThanOrEqual(4);
      // Low: internalSummary
      expect(lowGaps.length).toBeGreaterThanOrEqual(1);

      // Gaps are sorted: critical first
      expect(gaps[0]!.importance).toBe('critical');
    });

    it('suggests enrich_clearbit for missing domain', () => {
      const company = makeFullCompany({ domain: null });
      const gaps = DataCompletenessEngine.identifyGaps(company);
      const domainGap = gaps.find((g) => g.field === 'domain');
      expect(domainGap!.suggestedAction).toBe('enrich_clearbit');
    });

    it('suggests import_crm for missing contacts', () => {
      const company = makeFullCompany({ contacts: [] });
      const gaps = DataCompletenessEngine.identifyGaps(company);
      const contactsGap = gaps.find((g) => g.field === 'contacts');
      expect(contactsGap).toBeDefined();
      expect(contactsGap!.suggestedAction).toBe('import_crm');
    });
  });

  // ─── getEnrichmentPriority ────────────────────────────────────────

  describe('getEnrichmentPriority', () => {
    it('ranks low-completeness companies higher', () => {
      const lowCompany = makeEmptyCompany(); // score 0, opportunity high
      const highCompany = makeFullCompany();  // score 100, opportunity 0
      const priorities = DataCompletenessEngine.getEnrichmentPriority([lowCompany, highCompany]);
      // Low completeness should be first (higher opportunityScore)
      expect(priorities[0]!.companyId).toBe('co-empty');
      expect(priorities[0]!.opportunityScore).toBeGreaterThan(priorities[1]!.opportunityScore);
    });

    it('applies enterprise value multiplier (1.5x)', () => {
      const enterpriseCompany = makeEmptyCompany();
      // Set employee count to 1500 → enterprise tier, multiplier 1.5
      enterpriseCompany.researchCard = {
        revenue: null,
        employeeCount: '1500',
        fundingStage: null,
        techStack: null,
        businessOverview: null,
      };
      const priorities = DataCompletenessEngine.getEnrichmentPriority([enterpriseCompany]);
      expect(priorities[0]!.valueTier).toBe('enterprise');
      expect(priorities[0]!.valueMultiplier).toBe(1.5);
      // Opportunity = (100 - 0) * 1.5 = 150
      expect(priorities[0]!.opportunityScore).toBe(150);
    });

    it('applies mid-market value multiplier (1.2x)', () => {
      const midMarketCompany = makeEmptyCompany();
      // Set employee count to 500 → mid-market tier, multiplier 1.2
      midMarketCompany.researchCard = {
        revenue: null,
        employeeCount: '500',
        fundingStage: null,
        techStack: null,
        businessOverview: null,
      };
      const priorities = DataCompletenessEngine.getEnrichmentPriority([midMarketCompany]);
      expect(priorities[0]!.valueTier).toBe('mid-market');
      expect(priorities[0]!.valueMultiplier).toBe(1.2);
      // Opportunity = (100 - 0) * 1.2 = 120
      expect(priorities[0]!.opportunityScore).toBe(120);
    });

    it('returns empty array for empty input', () => {
      const priorities = DataCompletenessEngine.getEnrichmentPriority([]);
      expect(priorities).toHaveLength(0);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4.2 — Freshness Decay Engine
// ═══════════════════════════════════════════════════════════════════════

describe('FreshnessDecayEngine', () => {
  let dateNowSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    dateNowSpy?.mockRestore();
  });

  /** Freeze Date.now() to a specific timestamp. */
  function freezeTime(ms: number) {
    dateNowSpy?.mockRestore();
    dateNowSpy = vi.spyOn(Date, 'now').mockReturnValue(ms);
  }

  // ─── HALF_LIVES ───────────────────────────────────────────────────

  describe('HALF_LIVES', () => {
    it('has correct half-life for news (14 days)', () => {
      expect(FreshnessDecayEngine.HALF_LIVES.news).toBe(14);
    });

    it('has correct half-life for mention (7 days)', () => {
      expect(FreshnessDecayEngine.HALF_LIVES.mention).toBe(7);
    });

    it('has default half-life (30 days)', () => {
      expect(FreshnessDecayEngine.HALF_LIVES._default).toBe(30);
    });
  });

  // ─── THRESHOLDS ───────────────────────────────────────────────────

  describe('THRESHOLDS', () => {
    it('fresh threshold is 0.70', () => {
      expect(FreshnessDecayEngine.THRESHOLDS.fresh).toBe(0.70);
    });

    it('stale threshold is 0.20', () => {
      expect(FreshnessDecayEngine.THRESHOLDS.stale).toBe(0.20);
    });
  });

  // ─── computeSignalFreshness ───────────────────────────────────────

  describe('computeSignalFreshness', () => {
    it('returns 1.0 for a signal created today', () => {
      const now = new Date('2025-06-15T12:00:00Z').getTime();
      freezeTime(now);

      const result = FreshnessDecayEngine.computeSignalFreshness({
        baseConfidence: 1.0,
        createdAt: new Date(now),
        signalType: 'news',
      });

      expect(result.freshnessScore).toBe(1.0);
      expect(result.daysSinceCapture).toBe(0);
      expect(result.halfLifeUsed).toBe(14);
    });

    it('returns ~0.5 for a signal at its half-life', () => {
      const now = new Date('2025-06-15T12:00:00Z').getTime();
      freezeTime(now);

      const result = FreshnessDecayEngine.computeSignalFreshness({
        baseConfidence: 1.0,
        createdAt: new Date(now - 14 * 24 * 60 * 60 * 1000), // 14 days ago
        signalType: 'news',
      });

      expect(result.freshnessScore).toBeCloseTo(0.5, 1);
      expect(result.daysSinceCapture).toBe(14);
    });

    it('returns ~0.25 for a signal at 2x half-life', () => {
      const now = new Date('2025-06-15T12:00:00Z').getTime();
      freezeTime(now);

      const result = FreshnessDecayEngine.computeSignalFreshness({
        baseConfidence: 1.0,
        createdAt: new Date(now - 28 * 24 * 60 * 60 * 1000), // 28 days = 2x14
        signalType: 'news',
      });

      expect(result.freshnessScore).toBeCloseTo(0.25, 1);
    });

    it('floors at 0.05 for very old signals', () => {
      const now = new Date('2025-06-15T12:00:00Z').getTime();
      freezeTime(now);

      const result = FreshnessDecayEngine.computeSignalFreshness({
        baseConfidence: 1.0,
        createdAt: new Date(now - 1000 * 24 * 60 * 60 * 1000), // 1000 days ago
        signalType: 'mention',
      });

      expect(result.freshnessScore).toBe(0.05);
    });

    it('uses signalDate when provided (priority over createdAt)', () => {
      const now = new Date('2025-06-15T12:00:00Z').getTime();
      freezeTime(now);

      const result = FreshnessDecayEngine.computeSignalFreshness({
        baseConfidence: 1.0,
        signalDate: new Date(now),                       // today → fresh
        createdAt: new Date(now - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        signalType: 'news',
      });

      // Should use signalDate (today), so daysSinceCapture = 0
      expect(result.freshnessScore).toBe(1.0);
      expect(result.daysSinceCapture).toBe(0);
    });

    it('uses sourcePublishedDate when signalDate missing', () => {
      const now = new Date('2025-06-15T12:00:00Z').getTime();
      freezeTime(now);

      const result = FreshnessDecayEngine.computeSignalFreshness({
        baseConfidence: 1.0,
        signalDate: null,
        sourcePublishedDate: new Date(now),                       // today
        createdAt: new Date(now - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        signalType: 'news',
      });

      // Should use sourcePublishedDate (today)
      expect(result.freshnessScore).toBe(1.0);
      expect(result.daysSinceCapture).toBe(0);
    });

    it('returns correct staleness classification', () => {
      const now = new Date('2025-06-15T12:00:00Z').getTime();
      freezeTime(now);

      // Fresh: within 0.5× half-life → daysSince <= 7 for news (HL=14)
      const fresh = FreshnessDecayEngine.computeSignalFreshness({
        baseConfidence: 1.0,
        createdAt: new Date(now - 5 * 24 * 60 * 60 * 1000),
        signalType: 'news',
      });
      expect(fresh.stalenessLevel).toBe('fresh');

      // Stale: within 2.0× half-life → daysSince <= 28 for news
      const stale = FreshnessDecayEngine.computeSignalFreshness({
        baseConfidence: 1.0,
        createdAt: new Date(now - 21 * 24 * 60 * 60 * 1000),
        signalType: 'news',
      });
      expect(stale.stalenessLevel).toBe('stale');

      // Expired: beyond 2.0× half-life → daysSince > 28 for news
      const expired = FreshnessDecayEngine.computeSignalFreshness({
        baseConfidence: 1.0,
        createdAt: new Date(now - 35 * 24 * 60 * 60 * 1000),
        signalType: 'news',
      });
      expect(expired.stalenessLevel).toBe('expired');
    });

    it('different signal types use different half-lives', () => {
      const now = new Date('2025-06-15T12:00:00Z').getTime();
      freezeTime(now);

      const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000);

      // mention (HL=7): 7 days = 1 half-life → ~0.5
      const mentionResult = FreshnessDecayEngine.computeSignalFreshness({
        baseConfidence: 1.0,
        createdAt: sevenDaysAgo,
        signalType: 'mention',
      });

      // news (HL=14): 7 days = 0.5 half-life → ~0.707
      const newsResult = FreshnessDecayEngine.computeSignalFreshness({
        baseConfidence: 1.0,
        createdAt: sevenDaysAgo,
        signalType: 'news',
      });

      // news should be fresher than mention for the same age
      expect(newsResult.freshnessScore).toBeGreaterThan(mentionResult.freshnessScore);
      expect(mentionResult.halfLifeUsed).toBe(7);
      expect(newsResult.halfLifeUsed).toBe(14);
    });
  });

  // ─── computeCompanyFreshness ──────────────────────────────────────

  describe('computeCompanyFreshness', () => {
    it('returns 0 for company with no signals', () => {
      const now = new Date('2025-06-15T12:00:00Z').getTime();
      freezeTime(now);

      const result = FreshnessDecayEngine.computeCompanyFreshness(
        [],    // no signals
        null,  // no profile
        null,  // no contacts
        null,  // no technology
      );

      expect(result.overallScore).toBe(0);
      expect(result.stalenessLevel).toBe('expired');
      expect(result.signalCount).toBe(0);
      expect(result.dimensionScores.signals).toBeNull();
    });

    it('weights signals dimension at 40%', () => {
      const now = new Date('2025-06-15T12:00:00Z').getTime();
      freezeTime(now);

      // Provide only signals — all weight should redistribute to signals (100%)
      const result = FreshnessDecayEngine.computeCompanyFreshness(
        [
          {
            signalType: 'news',
            latestDate: new Date(now),
            count: 5,
            avgConfidence: 0.9,
          },
        ],
        null, // no profile
        null, // no contacts
        null, // no technology
      );

      // With only signals, weight redistributes fully → overall = signal score
      expect(result.overallScore).toBeGreaterThan(0);
      expect(result.dimensionScores.signals).not.toBeNull();
      // The overall should equal the signal dimension score (100% weight redistribution)
      expect(result.overallScore).toBeCloseTo(result.dimensionScores.signals!, 3);
    });

    it('redistributes weights when dimensions are null', () => {
      const now = new Date('2025-06-15T12:00:00Z').getTime();
      freezeTime(now);

      // Signals + profile — weights redistribute from 40%/25% to 40/(40+25) and 25/(40+25)
      const result = FreshnessDecayEngine.computeCompanyFreshness(
        [
          {
            signalType: 'news',
            latestDate: new Date(now),
            count: 1,
            avgConfidence: 1.0,
          },
        ],
        5,    // profile: 5 days old
        null, // no contacts
        null, // no technology
      );

      // Both signals and profile should have scores
      expect(result.dimensionScores.signals).not.toBeNull();
      expect(result.dimensionScores.profile).not.toBeNull();
      // Contacts and technology should be null
      expect(result.dimensionScores.contacts).toBeNull();
      expect(result.dimensionScores.technology).toBeNull();
      // Overall should be a blend of signals + profile (not just signals)
      expect(result.overallScore).toBeGreaterThan(0);
    });

    it('returns correct staleness level', () => {
      const now = new Date('2025-06-15T12:00:00Z').getTime();
      freezeTime(now);

      // Fresh signal → company should be fresh
      const freshResult = FreshnessDecayEngine.computeCompanyFreshness(
        [
          {
            signalType: 'news',
            latestDate: new Date(now),
            count: 3,
            avgConfidence: 1.0,
          },
        ],
        null, null, null,
      );
      expect(freshResult.stalenessLevel).toBe('fresh');

      // Very old signal → company should be expired
      const expiredResult = FreshnessDecayEngine.computeCompanyFreshness(
        [
          {
            signalType: 'news',
            latestDate: new Date(now - 200 * 24 * 60 * 60 * 1000),
            count: 1,
            avgConfidence: 1.0,
          },
        ],
        null, null, null,
      );
      expect(expiredResult.stalenessLevel).toBe('expired');
    });
  });

  // ─── classifyStaleness ────────────────────────────────────────────

  describe('classifyStaleness', () => {
    it('returns fresh for score >= 0.70', () => {
      expect(FreshnessDecayEngine.classifyStaleness(0.70)).toBe('fresh');
      expect(FreshnessDecayEngine.classifyStaleness(0.85)).toBe('fresh');
      expect(FreshnessDecayEngine.classifyStaleness(1.0)).toBe('fresh');
    });

    it('returns aging for score >= 0.40', () => {
      expect(FreshnessDecayEngine.classifyStaleness(0.40)).toBe('aging');
      expect(FreshnessDecayEngine.classifyStaleness(0.55)).toBe('aging');
      expect(FreshnessDecayEngine.classifyStaleness(0.69)).toBe('aging');
    });

    it('returns stale for score >= 0.20', () => {
      expect(FreshnessDecayEngine.classifyStaleness(0.20)).toBe('stale');
      expect(FreshnessDecayEngine.classifyStaleness(0.35)).toBe('stale');
    });

    it('returns expired for score < 0.20', () => {
      expect(FreshnessDecayEngine.classifyStaleness(0.19)).toBe('expired');
      expect(FreshnessDecayEngine.classifyStaleness(0.0)).toBe('expired');
      expect(FreshnessDecayEngine.classifyStaleness(0.05)).toBe('expired');
    });
  });

  // ─── getRefreshSchedule ───────────────────────────────────────────

  describe('getRefreshSchedule', () => {
    it('returns low priority for fresh signals', () => {
      const freshnessResult = FreshnessDecayEngine.computeCompanyFreshness([], 1, null, null);
      // Override to guarantee fresh
      freshnessResult.overallScore = 0.85;
      freshnessResult.stalenessLevel = 'fresh';

      const schedule = FreshnessDecayEngine.getRefreshSchedule(freshnessResult);
      expect(schedule.priority).toBe('low');
      expect(schedule.refreshInDays).toBe(7);
    });

    it('returns medium priority for aging signals', () => {
      const freshnessResult = FreshnessDecayEngine.computeCompanyFreshness([], null, null, null);
      freshnessResult.overallScore = 0.55;
      freshnessResult.stalenessLevel = 'aging';

      const schedule = FreshnessDecayEngine.getRefreshSchedule(freshnessResult);
      expect(schedule.priority).toBe('medium');
      expect(schedule.refreshInDays).toBeGreaterThanOrEqual(1);
      expect(schedule.refreshInDays).toBeLessThanOrEqual(3);
    });

    it('returns high priority for stale signals', () => {
      const freshnessResult = FreshnessDecayEngine.computeCompanyFreshness([], null, null, null);
      freshnessResult.overallScore = 0.30;
      freshnessResult.stalenessLevel = 'stale';

      const schedule = FreshnessDecayEngine.getRefreshSchedule(freshnessResult);
      expect(schedule.priority).toBe('high');
      expect(schedule.refreshInDays).toBe(0);
    });

    it('returns critical priority for expired signals', () => {
      const freshnessResult = FreshnessDecayEngine.computeCompanyFreshness([], null, null, null);
      freshnessResult.overallScore = 0.10;
      freshnessResult.stalenessLevel = 'expired';

      const schedule = FreshnessDecayEngine.getRefreshSchedule(freshnessResult);
      expect(schedule.priority).toBe('critical');
      expect(schedule.refreshInDays).toBe(0);
    });

    it('returns correct refreshInDays values', () => {
      // Fresh → 7 days
      const fresh = FreshnessDecayEngine.computeCompanyFreshness([], 1, null, null);
      fresh.overallScore = 0.70;
      fresh.stalenessLevel = 'fresh';
      expect(FreshnessDecayEngine.getRefreshSchedule(fresh).refreshInDays).toBe(7);

      // Stale → 0 days
      const stale = FreshnessDecayEngine.computeCompanyFreshness([], 1, null, null);
      stale.overallScore = 0.20;
      stale.stalenessLevel = 'stale';
      expect(FreshnessDecayEngine.getRefreshSchedule(stale).refreshInDays).toBe(0);

      // Expired → 0 days
      const expired = FreshnessDecayEngine.computeCompanyFreshness([], 1, null, null);
      expired.overallScore = 0.10;
      expired.stalenessLevel = 'expired';
      expect(FreshnessDecayEngine.getRefreshSchedule(expired).refreshInDays).toBe(0);

      // Aging close to fresh threshold → closer to 3 days
      const agingHigh = FreshnessDecayEngine.computeCompanyFreshness([], 1, null, null);
      agingHigh.overallScore = 0.65;
      agingHigh.stalenessLevel = 'aging';
      const agingHighSchedule = FreshnessDecayEngine.getRefreshSchedule(agingHigh);
      expect(agingHighSchedule.refreshInDays).toBeGreaterThanOrEqual(2);

      // Aging close to stale threshold → closer to 1 day
      const agingLow = FreshnessDecayEngine.computeCompanyFreshness([], 1, null, null);
      agingLow.overallScore = 0.42;
      agingLow.stalenessLevel = 'aging';
      const agingLowSchedule = FreshnessDecayEngine.getRefreshSchedule(agingLow);
      expect(agingLowSchedule.refreshInDays).toBeLessThanOrEqual(2);
    });
  });

  // ─── computeConfidenceDecay ───────────────────────────────────────

  describe('computeConfidenceDecay', () => {
    it('returns baseConfidence for day 0', () => {
      const result = FreshnessDecayEngine.computeConfidenceDecay(0.9, 0, 'news');
      expect(result).toBe(0.9);
    });

    it('returns ~half confidence at half-life', () => {
      // news halfLife=14, at 14 days → 0.5^(14/14) = 0.5
      const result = FreshnessDecayEngine.computeConfidenceDecay(1.0, 14, 'news');
      expect(result).toBeCloseTo(0.5, 1);
    });

    it('floors at 0.05', () => {
      // Very old signal → should floor at 0.05
      const result = FreshnessDecayEngine.computeConfidenceDecay(1.0, 1000, 'mention');
      expect(result).toBe(0.05);
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════
// 4.3 — Source Reliability Engine
// ═══════════════════════════════════════════════════════════════════════

describe('SourceReliabilityEngine', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── getBaseReliability ───────────────────────────────────────────

  describe('getBaseReliability', () => {
    it('returns 95 for verified_api', () => {
      expect(SourceReliabilityEngine.getBaseReliability('verified_api')).toBe(95);
    });

    it('returns 90 for customer_data', () => {
      expect(SourceReliabilityEngine.getBaseReliability('customer_data')).toBe(90);
    });

    it('returns 70 for web_intelligence', () => {
      expect(SourceReliabilityEngine.getBaseReliability('web_intelligence')).toBe(70);
    });

    it('returns 55 for ai_inference', () => {
      expect(SourceReliabilityEngine.getBaseReliability('ai_inference')).toBe(55);
    });

    it('returns default for unknown source type', () => {
      const score = SourceReliabilityEngine.getBaseReliability('totally_unknown_type');
      // Unknown types fall back to 55 (same as ai_inference)
      expect(score).toBe(55);
    });
  });

  // ─── getSourceQualityTier ─────────────────────────────────────────

  describe('getSourceQualityTier', () => {
    it('returns premium for score >= 90', () => {
      expect(SourceReliabilityEngine.getSourceQualityTier(90)).toBe('premium');
      expect(SourceReliabilityEngine.getSourceQualityTier(100)).toBe('premium');
    });

    it('returns standard for score >= 70', () => {
      expect(SourceReliabilityEngine.getSourceQualityTier(70)).toBe('standard');
      expect(SourceReliabilityEngine.getSourceQualityTier(89)).toBe('standard');
    });

    it('returns low for score < 70', () => {
      expect(SourceReliabilityEngine.getSourceQualityTier(69)).toBe('low');
      expect(SourceReliabilityEngine.getSourceQualityTier(0)).toBe('low');
    });
  });

  // ─── getCompositeReliability (sync via overrides) ─────────────────

  describe('getCompositeReliability', () => {
    it('returns static score when no feedback data', async () => {
      const result = await SourceReliabilityEngine.getCompositeReliability({
        sourceType: 'verified_api',
      });

      expect(result.compositeScore).toBe(95);
      expect(result.staticScore).toBe(95);
      expect(result.feedbackScore).toBeNull();
      expect(result.staticWeight).toBe(1.0);
      expect(result.feedbackWeight).toBe(0.0);
      expect(result.hasFeedbackData).toBe(false);
      expect(result.deviation).toBeNull();
      expect(result.deviationStatus).toBeNull();
    });

    it('uses feedback when provided (staticWeight 0.6)', async () => {
      const result = await SourceReliabilityEngine.getCompositeReliability({
        sourceType: 'verified_api',
        domainReliability: 0.80,
        domainFeedbackCount: 10,
      });

      // static=95, feedback=Math.round(0.80*100)=80, deviation=15
      expect(result.staticScore).toBe(95);
      expect(result.feedbackScore).toBe(80);
      expect(result.hasFeedbackData).toBe(true);
      expect(result.staticWeight).toBe(0.6);
      expect(result.feedbackWeight).toBe(0.4);
      expect(result.deviation).toBe(15);
      // composite = round(0.6*95 + 0.4*80) = round(57+32) = 89
      expect(result.compositeScore).toBe(89);
    });

    it('flags deviation > 20 points', async () => {
      const result = await SourceReliabilityEngine.getCompositeReliability({
        sourceType: 'verified_api',
        domainReliability: 0.65,
        domainFeedbackCount: 10,
      });

      // static=95, feedback=65, deviation=30
      expect(result.deviation).toBe(30);
      expect(result.deviationStatus).toBe('drift');
    });

    it('uses feedback as primary when deviation > 40', async () => {
      const result = await SourceReliabilityEngine.getCompositeReliability({
        sourceType: 'verified_api',
        domainReliability: 0.40,
        domainFeedbackCount: 10,
      });

      // static=95, feedback=40, deviation=55
      expect(result.deviation).toBe(55);
      expect(result.deviationStatus).toBe('critical');
      // composite = round(0.6*0.3*95 + (1-0.6*0.3)*40) = round(17.1 + 32.8) = 50
      expect(result.compositeScore).toBe(50);
      // Composite should be much closer to feedback than static
      expect(result.compositeScore).toBeLessThan(result.staticScore);
    });

    it('normalizes feedback from 0-1 to 0-100', async () => {
      const result = await SourceReliabilityEngine.getCompositeReliability({
        sourceType: 'verified_api',
        domainReliability: 0.75,
        domainFeedbackCount: 10,
      });

      // 0.75 * 100 = 75
      expect(result.feedbackScore).toBe(75);
    });
  });

  // ─── validateSourceScores (mocked DB) ─────────────────────────────

  describe('validateSourceScores', () => {
    it('returns empty result when no domains have enough feedback', async () => {
      mockFindMany.mockResolvedValue([]);

      const result = await SourceReliabilityEngine.validateSourceScores({ minFeedbackSamples: 5 });

      expect(result.evaluated).toBe(0);
      expect(result.aligned).toBe(0);
      expect(result.drift).toBe(0);
      expect(result.mismatch).toBe(0);
      expect(result.critical).toBe(0);
      expect(result.details).toHaveLength(0);
    });

    it('classifies aligned domains (≤15 deviation)', async () => {
      mockFindMany.mockResolvedValue([
        {
          domain: 'reliable-tech.com',
          reliabilityScore: 0.65, // observed = 65
          totalEvidence: 10,
        },
      ]);

      const result = await SourceReliabilityEngine.validateSourceScores({ minFeedbackSamples: 5 });

      // static = web_intelligence = 70, observed = 65, deviation = 5 → aligned
      expect(result.evaluated).toBe(1);
      expect(result.aligned).toBe(1);
      expect(result.details[0]!.status).toBe('aligned');
      expect(result.details[0]!.deviation).toBe(5);
    });

    it('classifies drift domains (15-30 deviation)', async () => {
      mockFindMany.mockResolvedValue([
        {
          domain: 'somewhat-reliable.com',
          reliabilityScore: 0.45, // observed = 45
          totalEvidence: 8,
        },
      ]);

      const result = await SourceReliabilityEngine.validateSourceScores({ minFeedbackSamples: 5 });

      // static = 70, observed = 45, deviation = 25 → drift
      expect(result.evaluated).toBe(1);
      expect(result.drift).toBe(1);
      expect(result.details[0]!.status).toBe('drift');
      expect(result.details[0]!.deviation).toBe(25);
    });

    it('classifies mismatch domains (30-50 deviation)', async () => {
      mockFindMany.mockResolvedValue([
        {
          domain: 'unreliable-source.com',
          reliabilityScore: 0.25, // observed = 25
          totalEvidence: 12,
        },
      ]);

      const result = await SourceReliabilityEngine.validateSourceScores({ minFeedbackSamples: 5 });

      // static = 70, observed = 25, deviation = 45 → mismatch
      expect(result.evaluated).toBe(1);
      expect(result.mismatch).toBe(1);
      expect(result.details[0]!.status).toBe('mismatch');
      expect(result.details[0]!.deviation).toBe(45);
    });

    it('classifies critical domains (>50 deviation)', async () => {
      mockFindMany.mockResolvedValue([
        {
          domain: 'completely-wrong.com',
          reliabilityScore: 0.10, // observed = 10
          totalEvidence: 20,
        },
      ]);

      const result = await SourceReliabilityEngine.validateSourceScores({ minFeedbackSamples: 5 });

      // static = 70, observed = 10, deviation = 60 → critical
      expect(result.evaluated).toBe(1);
      expect(result.critical).toBe(1);
      expect(result.details[0]!.status).toBe('critical');
      expect(result.details[0]!.deviation).toBe(60);
    });

    it('returns correct counts', async () => {
      mockFindMany.mockResolvedValue([
        { domain: 'a.com', reliabilityScore: 0.65, totalEvidence: 10 },  // aligned (dev=5)
        { domain: 'b.com', reliabilityScore: 0.45, totalEvidence: 8 },   // drift (dev=25)
        { domain: 'c.com', reliabilityScore: 0.25, totalEvidence: 12 },  // mismatch (dev=45)
        { domain: 'd.com', reliabilityScore: 0.10, totalEvidence: 20 },  // critical (dev=60)
      ]);

      const result = await SourceReliabilityEngine.validateSourceScores({ minFeedbackSamples: 5 });

      expect(result.evaluated).toBe(4);
      expect(result.aligned).toBe(1);
      expect(result.drift).toBe(1);
      expect(result.mismatch).toBe(1);
      expect(result.critical).toBe(1);
      expect(result.details).toHaveLength(4);
    });
  });

  // ─── computeTrustScore ────────────────────────────────────────────

  describe('computeTrustScore', () => {
    it('returns composite score using 4 dimensions', () => {
      const result = SourceReliabilityEngine.computeTrustScore({
        source: 'verified_api',
        confidence: 80,
        freshnessAge: 10,
        evidenceCount: 2,
      });

      // Verify all 4 dimension scores are present and in range
      expect(result.sourceScore).toBe(95);
      expect(result.confidenceScore).toBe(80);
      expect(result.freshnessScore).toBeGreaterThanOrEqual(0);
      expect(result.freshnessScore).toBeLessThanOrEqual(100);
      expect(result.evidenceScore).toBe(70); // 50 + 2*10

      // Verify composite is in range
      expect(result.compositeScore).toBeGreaterThanOrEqual(0);
      expect(result.compositeScore).toBeLessThanOrEqual(100);

      // Verify breakdown matches dimension scores
      expect(result.breakdown.source).toBe(result.sourceScore);
      expect(result.breakdown.confidence).toBe(result.confidenceScore);
      expect(result.breakdown.freshness).toBe(result.freshnessScore);
      expect(result.breakdown.evidence).toBe(result.evidenceScore);
    });

    it('returns grade A+ for score >= 95', () => {
      const result = SourceReliabilityEngine.computeTrustScore({
        source: 'verified_api',  // 95
        confidence: 100,
        freshnessAge: 0,        // 100
        evidenceCount: 5,       // 100
      });

      // 95*0.30 + 100*0.25 + 100*0.25 + 100*0.20 = 28.5+25+25+20 = 98.5 → 99
      expect(result.compositeScore).toBeGreaterThanOrEqual(95);
      expect(result.grade).toBe('A+');
    });

    it('returns grade F for score < 40', () => {
      const result = SourceReliabilityEngine.computeTrustScore({
        source: 'ai_inference',  // 55
        confidence: 0,
        freshnessAge: 90,       // 0 (max decay)
        evidenceCount: 1,       // 60
      });

      // 55*0.30 + 0*0.25 + 0*0.25 + 60*0.20 = 16.5+0+0+12 = 28.5 → 29
      expect(result.compositeScore).toBeLessThan(40);
      expect(result.grade).toBe('F');
    });

    it('evidence score increases with evidence count', () => {
      const low = SourceReliabilityEngine.computeTrustScore({
        source: 'verified_api', confidence: 80, evidenceCount: 1,
      });
      const high = SourceReliabilityEngine.computeTrustScore({
        source: 'verified_api', confidence: 80, evidenceCount: 5,
      });

      // evidenceCount=1 → 60, evidenceCount=5 → 100
      expect(low.evidenceScore).toBe(60);
      expect(high.evidenceScore).toBe(100);
      expect(high.evidenceScore).toBeGreaterThan(low.evidenceScore);
    });

    it('freshness score decreases with age', () => {
      const fresh = SourceReliabilityEngine.computeTrustScore({
        source: 'verified_api', confidence: 80, freshnessAge: 0,
      });
      const old = SourceReliabilityEngine.computeTrustScore({
        source: 'verified_api', confidence: 80, freshnessAge: 45,
      });

      // freshnessAge=0 → 100, freshnessAge=45 → round((1-45/90)*100) = 50
      expect(fresh.freshnessScore).toBe(100);
      expect(old.freshnessScore).toBe(50);
      expect(fresh.freshnessScore).toBeGreaterThan(old.freshnessScore);
    });
  });
});
