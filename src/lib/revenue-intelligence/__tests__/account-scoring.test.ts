import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockCompanyFindMany,
  mockCompanyFindUnique,
  mockKnowledgeEntryGroupBy,
  mockOpportunitySignalFindMany,
  mockIntelligenceObjectFindFirst,
  mockIntelligenceTimelineCount,
  mockAccountScoreUpsert,
  mockAccountScoreFindUnique,
  mockAccountScoreFindMany,
  mockEvidenceCount,
} = vi.hoisted(() => ({
  mockCompanyFindMany: vi.fn(),
  mockCompanyFindUnique: vi.fn(),
  mockKnowledgeEntryGroupBy: vi.fn(),
  mockOpportunitySignalFindMany: vi.fn(),
  mockIntelligenceObjectFindFirst: vi.fn(),
  mockIntelligenceTimelineCount: vi.fn(),
  mockAccountScoreUpsert: vi.fn(),
  mockAccountScoreFindUnique: vi.fn(),
  mockAccountScoreFindMany: vi.fn(),
  mockEvidenceCount: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    company: { findMany: mockCompanyFindMany, findUnique: mockCompanyFindUnique },
    knowledgeEntry: { groupBy: mockKnowledgeEntryGroupBy },
    opportunitySignal: { findMany: mockOpportunitySignalFindMany },
    intelligenceObject: { findFirst: mockIntelligenceObjectFindFirst },
    intelligenceTimeline: { count: mockIntelligenceTimelineCount },
    accountScore: { upsert: mockAccountScoreUpsert, findUnique: mockAccountScoreFindUnique, findMany: mockAccountScoreFindMany },
    evidence: { count: mockEvidenceCount },
  },
}))

vi.mock('@/lib/intelligence-sources', () => ({
  FRESHNESS_CONFIG: {},
  ALL_CATEGORIES: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M'],
}))

vi.mock('../signal-patterns', () => ({
  ACCOUNT_SCORING_WEIGHTS: {
    intelligenceCoverage: 0.20,
    opportunitySignals: 0.30,
    freshness: 0.20,
    strategicFit: 0.20,
    engagementHistory: 0.10,
  },
  ACCOUNT_CATEGORY_THRESHOLDS: {
    HOT_ACCOUNT: 80,
    WARM_ACCOUNT: 60,
  },
}))

import {
  calculateAccountScore,
  persistAccountScore,
  getAccountScore,
  getTopOpportunities,
  recalculateAllScores,
} from '../account-scoring'

describe('Account Scoring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const companyId = 'comp-abc'
  const now = new Date('2025-01-15')

  const baseCompany = {
    id: companyId,
    industry: 'Technology',
    domain: 'acme.com',
  }

  function setupBaseMocks() {
    mockCompanyFindUnique.mockResolvedValue(baseCompany)
    mockKnowledgeEntryGroupBy.mockResolvedValue([
      { category: 'Strategy' },
      { category: 'Products' },
      { category: 'Technology' },
    ])
    mockOpportunitySignalFindMany.mockResolvedValue([
      { signalType: 'technology', score: 85 },
      { signalType: 'growth', score: 70 },
    ])
    mockIntelligenceObjectFindFirst.mockResolvedValue({ capturedAt: now })
    mockIntelligenceTimelineCount.mockResolvedValue(3)
    mockEvidenceCount.mockResolvedValue(1)
  }

  describe('calculateAccountScore', () => {
    it('returns score in 0-100 range', async () => {
      setupBaseMocks()
      const result = await calculateAccountScore(companyId)
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(100)
    })

    it('returns valid category', async () => {
      setupBaseMocks()
      const result = await calculateAccountScore(companyId)
      expect(['HOT_ACCOUNT', 'WARM_ACCOUNT', 'NURTURE']).toContain(result.category)
    })

    it('includes all 5 breakdown dimensions', async () => {
      setupBaseMocks()
      const result = await calculateAccountScore(companyId)
      expect(result.breakdown).toHaveProperty('intelligenceCoverage')
      expect(result.breakdown).toHaveProperty('signalStrength')
      expect(result.breakdown).toHaveProperty('freshness')
      expect(result.breakdown).toHaveProperty('strategicFit')
      expect(result.breakdown).toHaveProperty('engagementHistory')
    })

    it('each sub-score is 0-100', async () => {
      setupBaseMocks()
      const result = await calculateAccountScore(companyId)
      const { breakdown } = result
      expect(breakdown.intelligenceCoverage).toBeGreaterThanOrEqual(0)
      expect(breakdown.intelligenceCoverage).toBeLessThanOrEqual(100)
      expect(breakdown.signalStrength).toBeGreaterThanOrEqual(0)
      expect(breakdown.signalStrength).toBeLessThanOrEqual(100)
      expect(breakdown.freshness).toBeGreaterThanOrEqual(0)
      expect(breakdown.freshness).toBeLessThanOrEqual(100)
      expect(breakdown.strategicFit).toBeGreaterThanOrEqual(0)
      expect(breakdown.strategicFit).toBeLessThanOrEqual(100)
      expect(breakdown.engagementHistory).toBeGreaterThanOrEqual(0)
      expect(breakdown.engagementHistory).toBeLessThanOrEqual(100)
    })

    it('no signals → zero signal strength', async () => {
      setupBaseMocks()
      mockOpportunitySignalFindMany.mockResolvedValue([])
      const result = await calculateAccountScore(companyId)
      expect(result.breakdown.signalStrength).toBe(0)
    })

    it('stale data → low freshness', async () => {
      setupBaseMocks()
      mockIntelligenceObjectFindFirst.mockResolvedValue({
        capturedAt: new Date('2023-01-01'),
      })
      const result = await calculateAccountScore(companyId)
      expect(result.breakdown.freshness).toBeLessThan(20)
    })

    it('no intelligence objects → zero freshness', async () => {
      setupBaseMocks()
      mockIntelligenceObjectFindFirst.mockResolvedValue(null)
      const result = await calculateAccountScore(companyId)
      expect(result.breakdown.freshness).toBe(0)
    })

    it('strategicFit is deterministic (no Math.random)', async () => {
      setupBaseMocks()
      const result1 = await calculateAccountScore(companyId)
      const result2 = await calculateAccountScore(companyId)
      expect(result1.breakdown.strategicFit).toBe(result2.breakdown.strategicFit)
    })

    it('technology industry gets high strategicFit', async () => {
      setupBaseMocks()
      const result = await calculateAccountScore(companyId)
      expect(result.breakdown.strategicFit).toBeGreaterThanOrEqual(80)
    })

    it('manufacturing industry gets moderate strategicFit', async () => {
      setupBaseMocks()
      mockCompanyFindUnique.mockResolvedValue({
        ...baseCompany,
        industry: 'manufacturing',
      })
      const result = await calculateAccountScore(companyId)
      expect(result.breakdown.strategicFit).toBeGreaterThanOrEqual(40)
      expect(result.breakdown.strategicFit).toBeLessThanOrEqual(60)
    })
  })

  describe('persistAccountScore', () => {
    it('upserts with correct fields', async () => {
      setupBaseMocks()
      mockAccountScoreUpsert.mockResolvedValue({
        id: 'as-1',
        companyId,
        score: 75,
        scoreBreakdown: '{}',
        category: 'WARM_ACCOUNT',
        calculatedAt: new Date(),
      })

      await persistAccountScore(companyId)

      expect(mockAccountScoreUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId },
        }),
      )
    })
  })

  describe('getAccountScore', () => {
    it('returns null if not found', async () => {
      mockAccountScoreFindUnique.mockResolvedValue(null)
      const result = await getAccountScore(companyId)
      expect(result).toBeNull()
    })
  })

  describe('getTopOpportunities', () => {
    it('returns scored accounts ordered by score DESC', async () => {
      mockAccountScoreFindMany.mockResolvedValue([
        {
          id: 'as-1',
          companyId: 'comp-1',
          score: 92,
          scoreBreakdown: JSON.stringify({ overallScore: 92 }),
          category: 'HOT_ACCOUNT',
          calculatedAt: new Date(),
          company: { id: 'comp-1', rawName: 'Acme Corp', industry: 'Technology', domain: 'acme.com' },
        },
        {
          id: 'as-2',
          companyId: 'comp-2',
          score: 78,
          scoreBreakdown: JSON.stringify({ overallScore: 78 }),
          category: 'WARM_ACCOUNT',
          calculatedAt: new Date(),
          company: { id: 'comp-2', rawName: 'Beta Inc', industry: 'Finance', domain: 'beta.com' },
        },
      ])

      const results = await getTopOpportunities(2)

      expect(results).toHaveLength(2)
      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score)
    })
  })

  describe('recalculateAllScores', () => {
    it('processes companies with intelligence objects', async () => {
      mockCompanyFindMany.mockResolvedValue([{ id: 'comp-1' }, { id: 'comp-2' }])
      setupBaseMocks()
      mockAccountScoreUpsert.mockResolvedValue({ id: 'as-1' })

      const { updated } = await recalculateAllScores()

      expect(updated).toBe(2)
      expect(mockAccountScoreUpsert).toHaveBeenCalledTimes(2)
    })

    it('returns zero for empty company list', async () => {
      mockCompanyFindMany.mockResolvedValue([])
      const { updated } = await recalculateAllScores()
      expect(updated).toBe(0)
      expect(mockAccountScoreUpsert).not.toHaveBeenCalled()
    })
  })
})
