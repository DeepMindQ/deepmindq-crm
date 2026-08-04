import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockOpportunitySignalFindMany,
  mockOpportunitySignalCount,
  mockOpportunitySignalGroupBy,
  mockOpportunitySignalAggregate,
  mockGetTopOpportunities,
} = vi.hoisted(() => ({
  mockOpportunitySignalFindMany: vi.fn(),
  mockOpportunitySignalCount: vi.fn(),
  mockOpportunitySignalGroupBy: vi.fn(),
  mockOpportunitySignalAggregate: vi.fn(),
  mockGetTopOpportunities: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    opportunitySignal: {
      findMany: mockOpportunitySignalFindMany,
      count: mockOpportunitySignalCount,
      groupBy: mockOpportunitySignalGroupBy,
      aggregate: mockOpportunitySignalAggregate,
    },
  },
}))

vi.mock('@/lib/revenue-intelligence/account-scoring', () => ({
  getTopOpportunities: mockGetTopOpportunities,
}))

import { getOpportunityRadar, getRadarStats } from '@/lib/revenue-intelligence/opportunity-radar'

describe('opportunity-radar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const scoredAccounts = [
    {
      id: 'as-1',
      companyId: 'comp-1',
      companyName: 'Acme Corp',
      industry: 'Technology',
      domain: 'acme.com',
      score: 92,
      category: 'HOT_ACCOUNT',
      breakdown: {
        intelligenceCoverage: 80,
        signalStrength: 90,
        freshness: 95,
        strategicFit: 85,
        engagementHistory: 70,
        overallScore: 92,
      },
    },
    {
      id: 'as-2',
      companyId: 'comp-2',
      companyName: 'Beta Inc',
      industry: 'Finance',
      domain: 'beta.com',
      score: 78,
      category: 'WARM_ACCOUNT',
      breakdown: {
        intelligenceCoverage: 70,
        signalStrength: 80,
        freshness: 75,
        strategicFit: 80,
        engagementHistory: 60,
        overallScore: 78,
      },
    },
  ]

  describe('getOpportunityRadar', () => {
    it('returns enriched radar accounts', async () => {
      mockGetTopOpportunities.mockResolvedValue(scoredAccounts)
      mockOpportunitySignalFindMany
        .mockResolvedValueOnce([
          { signalType: 'technology', title: 'AI initiative', score: 90 },
          { signalType: 'growth', title: 'Hiring spree', score: 75 },
        ])
        .mockResolvedValueOnce([
          { signalType: 'pain', title: 'Data breach', score: 80 },
        ])

      const result = await getOpportunityRadar({ limit: 10 })

      expect(result.accounts).toHaveLength(2)
      expect(result.accounts[0].companyName).toBe('Acme Corp')
      expect(result.accounts[0].signalStrength).toBe('HIGH')
      expect(result.accounts[0].topSignals).toHaveLength(2)
    })

    it('skips accounts with no signals', async () => {
      mockGetTopOpportunities.mockResolvedValue(scoredAccounts)
      mockOpportunitySignalFindMany
        .mockResolvedValueOnce([]) // comp-1 has no signals
        .mockResolvedValueOnce([
          { signalType: 'pain', title: 'Data breach', score: 80 },
        ])

      const result = await getOpportunityRadar({ limit: 10 })

      expect(result.accounts).toHaveLength(1)
      expect(result.accounts[0].companyId).toBe('comp-2')
    })

    it('applies minScore filter', async () => {
      mockGetTopOpportunities.mockResolvedValue(scoredAccounts)
      mockOpportunitySignalFindMany.mockResolvedValue([
        { signalType: 'technology', title: 'AI initiative', score: 90 },
      ])

      const result = await getOpportunityRadar({ minScore: 85 })

      expect(result.accounts).toHaveLength(1)
      expect(result.accounts[0].companyId).toBe('comp-1')
    })

    it('applies signalTypes filter', async () => {
      mockGetTopOpportunities.mockResolvedValue(scoredAccounts)
      mockOpportunitySignalFindMany
        .mockResolvedValueOnce([
          { signalType: 'technology', title: 'AI initiative', score: 90 },
          { signalType: 'growth', title: 'Hiring spree', score: 75 },
        ])
        .mockResolvedValueOnce([
          { signalType: 'pain', title: 'Data breach', score: 80 },
        ])

      const result = await getOpportunityRadar({ signalTypes: ['pain'] })

      expect(result.accounts).toHaveLength(1)
      expect(result.accounts[0].companyId).toBe('comp-2')
    })

    it('respects limit', async () => {
      const manyAccounts = Array.from({ length: 20 }, (_, i) => ({
        ...scoredAccounts[0],
        id: `as-${i}`,
        companyId: `comp-${i}`,
        companyName: `Company ${i}`,
      }))
      mockGetTopOpportunities.mockResolvedValue(manyAccounts)
      mockOpportunitySignalFindMany.mockResolvedValue([
        { signalType: 'technology', title: 'AI', score: 80 },
      ])
      // countMatchingAccounts is called when limit is hit
      mockOpportunitySignalGroupBy.mockResolvedValue(
        Array.from({ length: 20 }, (_, i) => ({ companyId: `comp-${i}` })),
      )

      const result = await getOpportunityRadar({ limit: 5 })

      expect(result.accounts).toHaveLength(5)
    })

    it('classifies signal strength correctly', async () => {
      mockGetTopOpportunities.mockResolvedValue([
        { ...scoredAccounts[0], score: 85 },
        { ...scoredAccounts[1], score: 50 },
      ])
      mockOpportunitySignalFindMany
        .mockResolvedValueOnce([{ signalType: 'technology', title: 'AI', score: 90 }])
        .mockResolvedValueOnce([{ signalType: 'pain', title: 'Breach', score: 70 }])

      const result = await getOpportunityRadar({ limit: 10 })

      expect(result.accounts[0].signalStrength).toBe('HIGH')
      expect(result.accounts[1].signalStrength).toBe('MEDIUM')
    })

    it('derives opportunity from dominant signal type', async () => {
      mockGetTopOpportunities.mockResolvedValue(scoredAccounts)
      mockOpportunitySignalFindMany
        .mockResolvedValueOnce([
          { signalType: 'growth', title: 'Massive hiring', score: 90 },
          { signalType: 'growth', title: 'New office', score: 70 },
        ])
        .mockResolvedValueOnce([
          { signalType: 'pain', title: 'Layoffs', score: 80 },
        ])

      const result = await getOpportunityRadar({ limit: 10 })

      expect(result.accounts[0].possibleOpportunity).toBe('Growth Advisory')
      expect(result.accounts[1].possibleOpportunity).toBe('Transformation Consulting')
    })

    it('counts signals per type', async () => {
      mockGetTopOpportunities.mockResolvedValue(scoredAccounts)
      mockOpportunitySignalFindMany
        .mockResolvedValueOnce([
          { signalType: 'technology', title: 'AI', score: 90 },
          { signalType: 'technology', title: 'Cloud', score: 80 },
          { signalType: 'growth', title: 'Hiring', score: 70 },
        ])
        .mockResolvedValueOnce([])

      const result = await getOpportunityRadar({ limit: 10 })

      expect(result.accounts[0].signalCounts).toEqual({
        technology: 2,
        growth: 1,
      })
    })
  })

  describe('getRadarStats', () => {
    it('returns aggregate statistics', async () => {
      mockOpportunitySignalFindMany.mockResolvedValue([
        { status: 'new', signalType: 'technology', score: 80, companyId: 'comp-1' },
        { status: 'validated', signalType: 'growth', score: 70, companyId: 'comp-1' },
        { status: 'new', signalType: 'pain', score: 60, companyId: 'comp-2' },
      ])
      mockOpportunitySignalCount.mockResolvedValue(1)
      mockOpportunitySignalGroupBy.mockResolvedValue([
        { companyId: 'comp-1' },
        { companyId: 'comp-2' },
      ])
      mockOpportunitySignalAggregate.mockResolvedValue({ _avg: { score: 70 } })

      const stats = await getRadarStats()

      expect(stats.totalSignals).toBe(3)
      expect(stats.byStatus).toEqual({ new: 2, validated: 1 })
      expect(stats.byType).toEqual({ technology: 1, growth: 1, pain: 1 })
      expect(stats.accountsWithSignals).toBe(2)
      expect(stats.avgScore).toBe(70)
      expect(stats.newLast7Days).toBe(1)
    })

    it('handles empty signal set', async () => {
      mockOpportunitySignalFindMany.mockResolvedValue([])
      mockOpportunitySignalCount.mockResolvedValue(0)
      mockOpportunitySignalGroupBy.mockResolvedValue([])
      mockOpportunitySignalAggregate.mockResolvedValue({ _avg: { score: null } })

      const stats = await getRadarStats()

      expect(stats.totalSignals).toBe(0)
      expect(stats.accountsWithSignals).toBe(0)
      expect(stats.avgScore).toBe(0)
      expect(stats.newLast7Days).toBe(0)
    })
  })
})
