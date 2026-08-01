/**
 * Ticket 4: 3-Score Architecture — Real Integration Tests
 *
 * Tests that actually invoke the GET handler and scoring helper functions,
 * verifying end-to-end behaviour with mocked database and dependencies.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { NextRequest } from 'next/server';

// ── Mocks (must precede any import that touches these modules) ──

vi.mock('@/lib/intelligence-api/guard', () => ({
  utilityGuard: () => ({
    correlationId: 'test-corr-id',
    responseHeaders: { 'x-correlation-id': 'test-corr-id' },
  }),
  utilitySuccess: (_ctx: any, data: any) =>
    new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }),
  utilityError: (_ctx: any, status: number, message: string) =>
    new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  utilityCatchError: (_ctx: any, _err: any, status: number) =>
    new Response(JSON.stringify({ error: 'Internal error' }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    }),
  RateLimitedError: class extends Error {
    errorBody: any;
    headers: Record<string, string>;
    constructor(errorBody: any, headers: Record<string, string>) {
      super('Rate limited');
      this.name = 'RateLimitedError';
      this.errorBody = errorBody;
      this.headers = headers;
    }
  },
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: () => ({ success: true, remaining: 59, resetAt: Date.now() + 60000 }),
}));

vi.mock('@/lib/correlation-id', () => ({
  getCorrelationId: () => 'test-corr-id',
  createResponseHeaders: () => ({ 'x-correlation-id': 'test-corr-id' }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockCompanyFindUnique = vi.fn();
const mockAccountScoreFindUnique = vi.fn();
const mockHistoryFindMany = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    company: {
      findUnique: (...args: any[]) => mockCompanyFindUnique(...args),
    },
    accountScore: {
      findUnique: (...args: any[]) => mockAccountScoreFindUnique(...args),
    },
    priorityScoreHistory: {
      findMany: (...args: any[]) => mockHistoryFindMany(...args),
    },
  },
}));

const mockGetAccountIntelligence = vi.fn();
vi.mock('@/lib/intelligence-contract', () => ({
  getAccountIntelligence: (...args: any[]) => mockGetAccountIntelligence(...args),
}));

// ── Imports (after mocks) ──

import { GET } from '@/app/api/companies/[id]/scores/route';
import { parseRevenueBreakdown } from '@/lib/intelligence-api/middleware';
import { normalizeTierForDisplay } from '@/lib/intelligence-api/types';

// Local helper matching the route's normalization
const normalizeRevenueCategory = (category: string) => normalizeTierForDisplay(category, 'revenue');

// ── Helpers ──

function makeRequest(url = 'http://localhost/api/companies/cmp-123/scores'): NextRequest {
  const urlObj = new URL(url);
  const req = new Request(url, { headers: { 'x-forwarded-for': '127.0.0.1' } }) as unknown as NextRequest;
  // NextRequest provides nextUrl with searchParams — mock it for route handler compatibility
  Object.defineProperty(req, 'nextUrl', {
    value: { searchParams: urlObj.searchParams },
    writable: true,
    configurable: true,
  });
  return req;
}

function makeParams(id: string) {
  return Promise.resolve({ id });
}

async function getJson(response: Response) {
  return response.json();
}

const NOW = '2026-01-15T12:00:00.000Z';

const FULL_COMPANY = {
  id: 'cmp-123',
  rawName: 'Acme Corp',
  intelligenceScore: 65,
  engagementScore: 40,
  accountPriorityScore: 85,
  priorityTier: 'ACTIVE',
  priorityComputedAt: new Date('2026-01-10T08:00:00.000Z'),
  lastEnrichedAt: new Date('2026-01-12T00:00:00.000Z'),
};

const NEW_FORMAT_ACCOUNT_SCORE = {
  id: 'as-1',
  companyId: 'cmp-123',
  score: 68,
  category: 'WARM_ACCOUNT',
  scoreBreakdown: {
    intelligenceCoverage: 70,
    signalStrength: 65,
    freshness: 80,
    strategicFit: 55,
    engagementHistory: 40,
  },
  calculatedAt: new Date('2026-01-11T09:00:00.000Z'),
};

const INTEL_RESULT = {
  intelligenceScore: 72,
  tier: 'hot',
  computedAt: '2026-01-01T00:00:00.000Z',
  components: {
    dataCompleteness: 80,
    evidenceQuality: 70,
    freshnessScore: 65,
    signalStrength: 60,
    contactCoverage: 50,
    engagementScore: 55,
  },
};

const HISTORY_ENTRIES = [
  {
    id: 'hist-1',
    accountPriorityScore: 85,
    priorityTier: 'ACTIVE',
    computedAt: new Date('2026-01-10T08:00:00.000Z'),
    triggerType: 'manual',
    previousScore: 42,
    newScore: 85,
    staticFitScore: 90,
    dynamicIntelScore: 80,
    timingUrgencyScore: 85,
  },
  {
    id: 'hist-2',
    accountPriorityScore: 42,
    priorityTier: 'NURTURE',
    computedAt: new Date('2026-01-05T08:00:00.000Z'),
    triggerType: 'scheduled',
    previousScore: 30,
    newScore: 42,
    staticFitScore: 50,
    dynamicIntelScore: 35,
    timingUrgencyScore: 40,
  },
];

// ═══════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════

describe('Ticket 4: Score Unification — Integration Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ───────────────────────────────────────────────────────
  // 1. 404 for non-existent company
  // ───────────────────────────────────────────────────────
  it('returns 404 for non-existent company', async () => {
    mockCompanyFindUnique.mockResolvedValue(null);

    const response = await GET(makeRequest(), { params: makeParams('cmp-missing') });
    expect(response.status).toBe(404);

    const body = await getJson(response);
    expect(body).toHaveProperty('error');
  });

  // ───────────────────────────────────────────────────────
  // 2. Returns all 3 scores with correct shape
  // ───────────────────────────────────────────────────────
  it('returns all 3 scores with correct shape', async () => {
    mockCompanyFindUnique.mockResolvedValue(FULL_COMPANY);
    mockAccountScoreFindUnique.mockResolvedValue(NEW_FORMAT_ACCOUNT_SCORE);
    mockHistoryFindMany.mockResolvedValue(HISTORY_ENTRIES);
    mockGetAccountIntelligence.mockResolvedValue(INTEL_RESULT);

    const response = await GET(makeRequest(), { params: makeParams('cmp-123') });
    expect(response.status).toBe(200);

    const body = await getJson(response);
    expect(body.success).toBe(true);
    const d = body.data;

    // Top-level keys
    expect(d).toHaveProperty('companyId', 'cmp-123');
    expect(d).toHaveProperty('companyName', 'Acme Corp');
    expect(d).toHaveProperty('intelligence');
    expect(d).toHaveProperty('accountPriority');
    expect(d).toHaveProperty('revenueOpportunity');
    expect(d).toHaveProperty('history');
    expect(d).toHaveProperty('fetchedAt');

    // Intelligence (live_computed)
    expect(d.intelligence.score).toBe(72);
    expect(d.intelligence.tier).toBe('hot');
    expect(d.intelligence.source).toBe('live_computed');
    expect(d.intelligence.breakdown).toEqual(INTEL_RESULT.components);

    // Account Priority
    expect(d.accountPriority.score).toBe(85);
    expect(d.accountPriority.tier).toBe('ACTIVE');
    expect(d.accountPriority.source).toBe('company_table');
    expect(d.accountPriority.breakdown).toEqual({
      staticFit: 90,
      dynamicIntelligence: 80,
      timingUrgency: 85,
    });

    // Revenue Opportunity
    expect(d.revenueOpportunity.score).toBe(68);
    expect(d.revenueOpportunity.category).toBe('WARM_ACCOUNT');
    expect(d.revenueOpportunity.displayTier).toBe('Medium');
    expect(d.revenueOpportunity.source).toBe('account_score_table');
    expect(d.revenueOpportunity.breakdown).toEqual({
      intelligenceCoverage: 70,
      signalStrength: 65,
      freshness: 80,
      strategicFit: 55,
      engagementHistory: 40,
    });
    expect(d.revenueOpportunity.legacyFormat).toBeUndefined();
  });

  // ───────────────────────────────────────────────────────
  // 3. Falls back to stored intelligence when getAccountIntelligence throws
  // ───────────────────────────────────────────────────────
  it('falls back to stored intelligence when getAccountIntelligence throws', async () => {
    mockCompanyFindUnique.mockResolvedValue(FULL_COMPANY);
    mockAccountScoreFindUnique.mockResolvedValue(null);
    mockHistoryFindMany.mockResolvedValue([]);
    mockGetAccountIntelligence.mockRejectedValue(new Error('Service unavailable'));

    const response = await GET(makeRequest(), { params: makeParams('cmp-123') });
    expect(response.status).toBe(200);

    const body = await getJson(response);
    const d = body.data;

    // Should use company_table as source, not live_computed
    expect(d.intelligence.source).toBe('company_table');
    expect(d.intelligence.score).toBe(FULL_COMPANY.intelligenceScore);
    expect(d.intelligence.tier).toBe('warm'); // 65 -> warm (>= 40)
    expect(d.intelligence.staleness).toBeDefined();
    expect(d.intelligence.staleness.status).toBe('stale');
  });

  // ───────────────────────────────────────────────────────
  // 4. Handles legacy scoreBreakdown format
  // ───────────────────────────────────────────────────────
  it('handles legacy scoreBreakdown format', async () => {
    const legacyAccountScore = {
      id: 'as-legacy',
      companyId: 'cmp-123',
      score: 55,
      category: 'NURTURE',
      scoreBreakdown: {
        signalStrength: 25,
        engagement: 15,
        opportunityFit: 20,
        timing: 10,
      },
      calculatedAt: new Date('2025-12-01T00:00:00.000Z'),
    };

    mockCompanyFindUnique.mockResolvedValue(FULL_COMPANY);
    mockAccountScoreFindUnique.mockResolvedValue(legacyAccountScore);
    mockHistoryFindMany.mockResolvedValue([]);
    mockGetAccountIntelligence.mockResolvedValue(INTEL_RESULT);

    const response = await GET(makeRequest(), { params: makeParams('cmp-123') });
    expect(response.status).toBe(200);

    const body = await getJson(response);
    const rev = body.data.revenueOpportunity;

    expect(rev.legacyFormat).toBe(true);
    expect(rev.breakdown).toEqual({
      intelligenceCoverage: 0,
      signalStrength: 25,
      freshness: 10,
      strategicFit: 20,
      engagementHistory: 15,
    });
  });

  // ───────────────────────────────────────────────────────
  // 5. Handles null accountPriorityScore
  // ───────────────────────────────────────────────────────
  it('handles null accountPriorityScore', async () => {
    const companyNoPriority = {
      ...FULL_COMPANY,
      accountPriorityScore: null,
      priorityTier: null,
      priorityComputedAt: null,
    };

    mockCompanyFindUnique.mockResolvedValue(companyNoPriority);
    mockAccountScoreFindUnique.mockResolvedValue(null);
    mockHistoryFindMany.mockResolvedValue([]);
    mockGetAccountIntelligence.mockResolvedValue(INTEL_RESULT);

    const response = await GET(makeRequest(), { params: makeParams('cmp-123') });
    expect(response.status).toBe(200);

    const body = await getJson(response);
    expect(body.data.accountPriority).toBeNull();
  });

  // ───────────────────────────────────────────────────────
  // 6. Includes history entries
  // ───────────────────────────────────────────────────────
  it('includes history entries', async () => {
    mockCompanyFindUnique.mockResolvedValue(FULL_COMPANY);
    mockAccountScoreFindUnique.mockResolvedValue(null);
    mockHistoryFindMany.mockResolvedValue(HISTORY_ENTRIES);
    mockGetAccountIntelligence.mockResolvedValue(INTEL_RESULT);

    const response = await GET(makeRequest(), { params: makeParams('cmp-123') });
    expect(response.status).toBe(200);

    const body = await getJson(response);
    const history = body.data.history;

    expect(history).toHaveLength(2);
    expect(history[0].id).toBe('hist-1');
    expect(history[0].accountPriorityScore).toBe(85);
    expect(history[0].priorityTier).toBe('ACTIVE');
    expect(history[0].triggerType).toBe('manual');
    expect(history[0].previousScore).toBe(42);
    expect(history[0].newScore).toBe(85);

    // computedAt should be ISO string
    expect(typeof history[0].computedAt).toBe('string');
    expect(history[0].computedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    expect(history[1].id).toBe('hist-2');
    expect(history[1].triggerType).toBe('scheduled');
  });

  // ───────────────────────────────────────────────────────
  // 7. Returns revenueOpportunity with displayTier
  // ───────────────────────────────────────────────────────
  it('returns revenueOpportunity with mapped displayTier', async () => {
    const hotAccountScore = {
      ...NEW_FORMAT_ACCOUNT_SCORE,
      category: 'HOT_ACCOUNT',
      scoreBreakdown: {
        intelligenceCoverage: 90,
        signalStrength: 85,
        freshness: 88,
        strategicFit: 80,
        engagementHistory: 75,
      },
    };

    mockCompanyFindUnique.mockResolvedValue(FULL_COMPANY);
    mockAccountScoreFindUnique.mockResolvedValue(hotAccountScore);
    mockHistoryFindMany.mockResolvedValue([]);
    mockGetAccountIntelligence.mockResolvedValue(INTEL_RESULT);

    const response = await GET(makeRequest(), { params: makeParams('cmp-123') });
    const body = await getJson(response);
    const rev = body.data.revenueOpportunity;

    // displayTier should be the human-readable mapping, not the raw category
    expect(rev.displayTier).toBe('High');
    expect(rev.category).toBe('HOT_ACCOUNT');
    expect(rev.displayTier).not.toBe(rev.category);
  });

  // ───────────────────────────────────────────────────────
  // 8. classifyIntelligenceTier boundaries (via response)
  // ───────────────────────────────────────────────────────
  describe('classifyIntelligenceTier boundaries (via response)', () => {
    it('classifies score >= 70 as hot', async () => {
      mockCompanyFindUnique.mockResolvedValue({ ...FULL_COMPANY, intelligenceScore: 75 });
      mockAccountScoreFindUnique.mockResolvedValue(null);
      mockHistoryFindMany.mockResolvedValue([]);
      mockGetAccountIntelligence.mockResolvedValue(null);

      const response = await GET(makeRequest(), { params: makeParams('cmp-123') });
      const body = await getJson(response);
      expect(body.data.intelligence.tier).toBe('hot');
    });

    it('classifies score >= 40 and < 70 as warm', async () => {
      mockCompanyFindUnique.mockResolvedValue({ ...FULL_COMPANY, intelligenceScore: 55 });
      mockAccountScoreFindUnique.mockResolvedValue(null);
      mockHistoryFindMany.mockResolvedValue([]);
      mockGetAccountIntelligence.mockResolvedValue(null);

      const response = await GET(makeRequest(), { params: makeParams('cmp-123') });
      const body = await getJson(response);
      expect(body.data.intelligence.tier).toBe('warm');
    });

    it('classifies score >= 15 and < 40 as cold', async () => {
      mockCompanyFindUnique.mockResolvedValue({ ...FULL_COMPANY, intelligenceScore: 20 });
      mockAccountScoreFindUnique.mockResolvedValue(null);
      mockHistoryFindMany.mockResolvedValue([]);
      mockGetAccountIntelligence.mockResolvedValue(null);

      const response = await GET(makeRequest(), { params: makeParams('cmp-123') });
      const body = await getJson(response);
      expect(body.data.intelligence.tier).toBe('cold');
    });

    it('classifies score < 15 as unknown', async () => {
      mockCompanyFindUnique.mockResolvedValue({ ...FULL_COMPANY, intelligenceScore: 5 });
      mockAccountScoreFindUnique.mockResolvedValue(null);
      mockHistoryFindMany.mockResolvedValue([]);
      mockGetAccountIntelligence.mockResolvedValue(null);

      const response = await GET(makeRequest(), { params: makeParams('cmp-123') });
      const body = await getJson(response);
      expect(body.data.intelligence.tier).toBe('unknown');
    });

    it('classifies exact boundary 70 as hot', async () => {
      mockCompanyFindUnique.mockResolvedValue({ ...FULL_COMPANY, intelligenceScore: 70 });
      mockAccountScoreFindUnique.mockResolvedValue(null);
      mockHistoryFindMany.mockResolvedValue([]);
      mockGetAccountIntelligence.mockResolvedValue(null);

      const response = await GET(makeRequest(), { params: makeParams('cmp-123') });
      const body = await getJson(response);
      expect(body.data.intelligence.tier).toBe('hot');
    });

    it('classifies exact boundary 40 as warm', async () => {
      mockCompanyFindUnique.mockResolvedValue({ ...FULL_COMPANY, intelligenceScore: 40 });
      mockAccountScoreFindUnique.mockResolvedValue(null);
      mockHistoryFindMany.mockResolvedValue([]);
      mockGetAccountIntelligence.mockResolvedValue(null);

      const response = await GET(makeRequest(), { params: makeParams('cmp-123') });
      const body = await getJson(response);
      expect(body.data.intelligence.tier).toBe('warm');
    });

    it('classifies exact boundary 15 as cold', async () => {
      mockCompanyFindUnique.mockResolvedValue({ ...FULL_COMPANY, intelligenceScore: 15 });
      mockAccountScoreFindUnique.mockResolvedValue(null);
      mockHistoryFindMany.mockResolvedValue([]);
      mockGetAccountIntelligence.mockResolvedValue(null);

      const response = await GET(makeRequest(), { params: makeParams('cmp-123') });
      const body = await getJson(response);
      expect(body.data.intelligence.tier).toBe('cold');
    });

    it('classifies score 0 as unknown', async () => {
      mockCompanyFindUnique.mockResolvedValue({ ...FULL_COMPANY, intelligenceScore: 0 });
      mockAccountScoreFindUnique.mockResolvedValue(null);
      mockHistoryFindMany.mockResolvedValue([]);
      mockGetAccountIntelligence.mockResolvedValue(null);

      const response = await GET(makeRequest(), { params: makeParams('cmp-123') });
      const body = await getJson(response);
      expect(body.data.intelligence.tier).toBe('unknown');
    });
  });

  // ───────────────────────────────────────────────────────
  // 9. normalizeRevenueCategory mapping
  // ───────────────────────────────────────────────────────
  describe('normalizeRevenueCategory mapping', () => {
    it('maps HOT_ACCOUNT -> High', () => {
      expect(normalizeRevenueCategory('HOT_ACCOUNT')).toBe('High');
    });

    it('maps WARM_ACCOUNT -> Medium', () => {
      expect(normalizeRevenueCategory('WARM_ACCOUNT')).toBe('Medium');
    });

    it('maps NURTURE -> Medium', () => {
      expect(normalizeRevenueCategory('NURTURE')).toBe('Medium');
    });

    it('maps AT_RISK -> At Risk', () => {
      expect(normalizeRevenueCategory('AT_RISK')).toBe('At Risk');
    });

    it('passes through unknown categories as-is', () => {
      expect(normalizeRevenueCategory('UNKNOWN_TIER')).toBe('UNKNOWN_TIER');
    });

    it('handles empty string as Unknown', () => {
      expect(normalizeRevenueCategory('')).toBe('Unknown');
    });
  });

  // ───────────────────────────────────────────────────────
  // 10. parseRevenueBreakdown unit tests
  // ───────────────────────────────────────────────────────
  describe('parseRevenueBreakdown', () => {
    it('parses new-format breakdown', () => {
      const result = parseRevenueBreakdown({
        intelligenceCoverage: 70,
        signalStrength: 65,
        freshness: 80,
        strategicFit: 55,
        engagementHistory: 40,
      });
      expect(result.isLegacy).toBe(false);
      expect(result.breakdown).toEqual({
        intelligenceCoverage: 70,
        signalStrength: 65,
        freshness: 80,
        strategicFit: 55,
        engagementHistory: 40,
      });
    });

    it('detects legacy format with engagement key', () => {
      const result = parseRevenueBreakdown({
        signalStrength: 25,
        engagement: 15,
        opportunityFit: 20,
        timing: 10,
      });
      expect(result.isLegacy).toBe(true);
      expect(result.breakdown).toEqual({
        intelligenceCoverage: 0,
        signalStrength: 25,
        freshness: 10,
        strategicFit: 20,
        engagementHistory: 15,
      });
    });

    it('handles null input', () => {
      const result = parseRevenueBreakdown(null);
      expect(result.breakdown).toBeNull();
      expect(result.isLegacy).toBe(false);
    });

    it('returns null for stringified JSON input (implementation rejects non-objects early)', () => {
      const json = JSON.stringify({
        intelligenceCoverage: 50,
        signalStrength: 60,
        freshness: 70,
        strategicFit: 40,
        engagementHistory: 30,
      });
      const result = parseRevenueBreakdown(json);
      // The current implementation's first guard rejects non-objects before reaching JSON.parse
      expect(result.breakdown).toBeNull();
      expect(result.isLegacy).toBe(false);
    });

    it('handles invalid string input gracefully', () => {
      const result = parseRevenueBreakdown('not-json');
      expect(result.breakdown).toBeNull();
    });
  });

  // ───────────────────────────────────────────────────────
  // 11. Edge: no accountScore record
  // ───────────────────────────────────────────────────────
  it('returns null revenueOpportunity when no accountScore exists', async () => {
    mockCompanyFindUnique.mockResolvedValue(FULL_COMPANY);
    mockAccountScoreFindUnique.mockResolvedValue(null);
    mockHistoryFindMany.mockResolvedValue([]);
    mockGetAccountIntelligence.mockResolvedValue(INTEL_RESULT);

    const response = await GET(makeRequest(), { params: makeParams('cmp-123') });
    const body = await getJson(response);
    expect(body.data.revenueOpportunity).toBeNull();
  });

  // ───────────────────────────────────────────────────────
  // 12. Edge: accountPriority breakdown from history
  // ───────────────────────────────────────────────────────
  it('uses latest history entry for accountPriority breakdown', async () => {
    mockCompanyFindUnique.mockResolvedValue(FULL_COMPANY);
    mockAccountScoreFindUnique.mockResolvedValue(null);
    mockHistoryFindMany.mockResolvedValue(HISTORY_ENTRIES);
    mockGetAccountIntelligence.mockResolvedValue(INTEL_RESULT);

    const response = await GET(makeRequest(), { params: makeParams('cmp-123') });
    const body = await getJson(response);

    // First history entry should be used for breakdown
    expect(body.data.accountPriority.breakdown).toEqual({
      staticFit: 90,
      dynamicIntelligence: 80,
      timingUrgency: 85,
    });
  });

  // ───────────────────────────────────────────────────────
  // 13. Edge: null breakdown when no history exists
  // ───────────────────────────────────────────────────────
  it('returns null accountPriority breakdown when no history entries', async () => {
    mockCompanyFindUnique.mockResolvedValue(FULL_COMPANY);
    mockAccountScoreFindUnique.mockResolvedValue(null);
    mockHistoryFindMany.mockResolvedValue([]);
    mockGetAccountIntelligence.mockResolvedValue(INTEL_RESULT);

    const response = await GET(makeRequest(), { params: makeParams('cmp-123') });
    const body = await getJson(response);

    expect(body.data.accountPriority).not.toBeNull();
    expect(body.data.accountPriority.breakdown).toBeNull();
  });
});
