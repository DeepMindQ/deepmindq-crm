import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockCompanyFindMany,
  mockCompanyFindUnique,
  mockKnowledgeEntryFindMany,
  mockOpportunitySignalFindMany,
  mockOpportunitySignalGroupBy,
  mockIntelligenceObjectFindMany,
  mockIntelligenceObjectGroupBy,
  mockIntelligenceTimelineFindMany,
  mockAccountScoreUpsert,
  mockAccountScoreFindUnique,
  mockEvidenceFindMany,
} = vi.hoisted(() => ({
  mockCompanyFindMany: vi.fn(),
  mockCompanyFindUnique: vi.fn(),
  mockKnowledgeEntryFindMany: vi.fn(),
  mockOpportunitySignalFindMany: vi.fn(),
  mockOpportunitySignalGroupBy: vi.fn(),
  mockIntelligenceObjectFindMany: vi.fn(),
  mockIntelligenceObjectGroupBy: vi.fn(),
  mockIntelligenceTimelineFindMany: vi.fn(),
  mockAccountScoreUpsert: vi.fn(),
  mockAccountScoreFindUnique: vi.fn(),
  mockEvidenceFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    company: { findMany: mockCompanyFindMany, findUnique: mockCompanyFindUnique },
    knowledgeEntry: { findMany: mockKnowledgeEntryFindMany },
    opportunitySignal: { findMany: mockOpportunitySignalFindMany, groupBy: mockOpportunitySignalGroupBy },
    intelligenceObject: { findMany: mockIntelligenceObjectFindMany, groupBy: mockIntelligenceObjectGroupBy },
    intelligenceTimeline: { findMany: mockIntelligenceTimelineFindMany },
    accountScore: { upsert: mockAccountScoreUpsert, findUnique: mockAccountScoreFindUnique },
    evidence: { findMany: mockEvidenceFindMany },
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
    name: 'Acme Corp',
    industry: 'Technology',
    employeeCount: 500,
    revenue: '50M',
  }

  describe('calculateAccountScore', () => {
    it('all sub-scores computed correctly', async () => {
      mockCompanyFindUnique.mockResolvedValue(baseCompany)
      mockIntelligenceObjectGroupBy
        .mockResolvedValueOnce([{ _count: 15 }])        // total objects
        .mockResolvedValueOnce([{ _count: 5 }])          // distinct source types
      mockOpportunitySignalFindMany.mockResolvedValue([
        { category: 'technology', score: 0.9 },
        { category: 'growth', score: 0.7 },
      ])
      mockKnowledgeEntryFindMany.mockResolvedValue([
        { id: 'ke-1', category: 'Strategy', content: 'Expanding into AI' },
        { id: 'ke-2', category: 'Products', content: 'New platform launch' },
      ])
      mockIntelligenceObjectFindMany.mockResolvedValue([
        { capturedAt: now, sourceType: 'website' },
      ])

      const result = await calculateAccountScore(companyId)

      expect(result).toHaveProperty('intelligenceCoverage')
      expect(result).toHaveProperty('signalStrength')
      expect(result).toHaveProperty('knowledgeDepth')
      expect(result).toHaveProperty('freshness')
      expect(result).toHaveProperty('compositeScore')
      expect(result.compositeScore).toBeGreaterThanOrEqual(0)
      expect(result.compositeScore).toBeLessThanOrEqual(1)
    })

    it('no intelligence objects → low score', async () => {
      mockCompanyFindUnique.mockResolvedValue(baseCompany)
      mockIntelligenceObjectGroupBy
        .mockResolvedValueOnce([{ _count: 0 }])
        .mockResolvedValueOnce([{ _count: 0 }])
      mockOpportunitySignalFindMany.mockResolvedValue([])
      mockKnowledgeEntryFindMany.mockResolvedValue([])
      mockIntelligenceObjectFindMany.mockResolvedValue([])

      const result = await calculateAccountScore(companyId)

      expect(result.intelligenceCoverage).toBe(0)
      expect(result.compositeScore).toBeLessThan(0.3)
    })

    it('high coverage + high signals → HOT_ACCOUNT', async () => {
      mockCompanyFindUnique.mockResolvedValue({ ...baseCompany, industry: 'Technology' })
      mockIntelligenceObjectGroupBy
        .mockResolvedValueOnce([{ _count: 50 }])
        .mockResolvedValueOnce([{ _count: 8 }])
      mockOpportunitySignalFindMany.mockResolvedValue([
        { category: 'technology', score: 0.95 },
        { category: 'growth', score: 0.90 },
        { category: 'partnership', score: 0.85 },
        { category: 'leadership', score: 0.88 },
      ])
      mockKnowledgeEntryFindMany.mockResolvedValue([
        { id: 'ke-1', category: 'Strategy', content: 'AI first strategy' },
        { id: 'ke-2', category: 'Products', content: 'Platform v2' },
        { id: 'ke-3', category: 'Technology', content: 'Cloud migration' },
      ])
      mockIntelligenceObjectFindMany.mockResolvedValue([
        { capturedAt: now, sourceType: 'website' },
      ])

      const result = await calculateAccountScore(companyId)

      expect(result.tier).toBe('HOT_ACCOUNT')
      expect(result.compositeScore).toBeGreaterThanOrEqual(0.7)
    })

    it('strategicFit based on industry', async () => {
      mockCompanyFindUnique.mockResolvedValue({ ...baseCompany, industry: 'Healthcare' })
      mockIntelligenceObjectGroupBy.mockResolvedValueOnce([{ _count: 10 }]).mockResolvedValueOnce([{ _count: 3 }])
      mockOpportunitySignalFindMany.mockResolvedValue([])
      mockKnowledgeEntryFindMany.mockResolvedValue([])
      mockIntelligenceObjectFindMany.mockResolvedValue([])

      const result = await calculateAccountScore(companyId)

      expect(result.strategicFit).toBeGreaterThanOrEqual(0)
      expect(result.strategicFit).toBeLessThanOrEqual(1)
    })

    it('freshness decay applied to older data', async () => {
      const oldDate = new Date('2023-06-01')
      mockCompanyFindUnique.mockResolvedValue(baseCompany)
      mockIntelligenceObjectGroupBy.mockResolvedValueOnce([{ _count: 5 }]).mockResolvedValueOnce([{ _count: 2 }])
      mockOpportunitySignalFindMany.mockResolvedValue([])
      mockKnowledgeEntryFindMany.mockResolvedValue([])
      mockIntelligenceObjectFindMany.mockResolvedValue([
        { capturedAt: oldDate, sourceType: 'website' },
      ])

      const result = await calculateAccountScore(companyId)

      expect(result.freshness).toBeLessThan(0.5)
    })
  })

  describe('persistAccountScore', () => {
    it('upserts correctly', async () => {
      mockAccountScoreUpsert.mockResolvedValue({ id: 'as-1', companyId })
      const scoreData = { companyId, compositeScore: 0.82, tier: 'HOT_ACCOUNT', intelligenceCoverage: 0.9, signalStrength: 0.85, knowledgeDepth: 0.7, freshness: 0.8, strategicFit: 0.9 }

      await persistAccountScore(companyId, scoreData)

      expect(mockAccountScoreUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId },
          create: expect.objectContaining({ companyId, compositeScore: 0.82, tier: 'HOT_ACCOUNT' }),
          update: expect.objectContaining({ compositeScore: 0.82, tier: 'HOT_ACCOUNT' }),
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
    it('ordered by score DESC with company info', async () => {
      mockAccountScoreFindUnique
        .mockResolvedValueOnce({ companyId: 'comp-1', compositeScore: 0.92, tier: 'HOT_ACCOUNT', company: { name: 'Acme Corp' } })
        .mockResolvedValueOnce({ companyId: 'comp-2', compositeScore: 0.78, tier: 'WARM_ACCOUNT', company: { name: 'Beta Inc' } })
        .mockResolvedValueOnce({ companyId: 'comp-3', compositeScore: 0.55, tier: 'COLD_ACCOUNT', company: { name: 'Gamma Ltd' } })

      const results = await getTopOpportunities(3)

      expect(results).toHaveLength(3)
      expect(results[0].compositeScore).toBeGreaterThanOrEqual(results[1].compositeScore)
      expect(results[1].compositeScore).toBeGreaterThanOrEqual(results[2].compositeScore)
      expect(results[0].company.name).toBe('Acme Corp')
    })
  })

  describe('recalculateAllScores', () => {
    it('processes multiple companies', async () => {
      mockCompanyFindMany.mockResolvedValue([{ id: 'comp-1' }, { id: 'comp-2' }])
      mockCompanyFindUnique.mockResolvedValue(baseCompany)
      mockIntelligenceObjectGroupBy.mockResolvedValue([{ _count: 5 }]).mockResolvedValue([{ _count: 2 }])
      mockOpportunitySignalFindMany.mockResolvedValue([])
      mockKnowledgeEntryFindMany.mockResolvedValue([])
      mockIntelligenceObjectFindMany.mockResolvedValue([])
      mockAccountScoreUpsert.mockResolvedValue({ id: 'as-1' })

      const results = await recalculateAllScores()

      expect(results.processed).toBe(2)
      expect(mockAccountScoreUpsert).toHaveBeenCalledTimes(2)
    })

    it('returns zero processed for empty company list', async () => {
      mockCompanyFindMany.mockResolvedValue([])
      const results = await recalculateAllScores()
      expect(results.processed).toBe(0)
      expect(mockAccountScoreUpsert).not.toHaveBeenCalled()
    })
  })
})