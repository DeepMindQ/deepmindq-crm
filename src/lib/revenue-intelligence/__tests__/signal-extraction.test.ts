import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockIntelligenceObjectFindMany,
  mockOpportunitySignalDeleteMany,
  mockOpportunitySignalCreateMany,
  mockOpportunitySignalFindMany,
  mockOpportunitySignalUpdate,
  mockOpportunitySignalGroupBy,
  mockCompanyFindUnique,
} = vi.hoisted(() => ({
  mockIntelligenceObjectFindMany: vi.fn(),
  mockOpportunitySignalDeleteMany: vi.fn(),
  mockOpportunitySignalCreateMany: vi.fn(),
  mockOpportunitySignalFindMany: vi.fn(),
  mockOpportunitySignalUpdate: vi.fn(),
  mockOpportunitySignalGroupBy: vi.fn(),
  mockCompanyFindUnique: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    intelligenceObject: { findMany: mockIntelligenceObjectFindMany },
    opportunitySignal: {
      deleteMany: mockOpportunitySignalDeleteMany,
      createMany: mockOpportunitySignalCreateMany,
      findMany: mockOpportunitySignalFindMany,
      update: mockOpportunitySignalUpdate,
      groupBy: mockOpportunitySignalGroupBy,
    },
    company: { findUnique: mockCompanyFindUnique },
  },
}))

vi.mock('../signal-patterns', () => ({
  KEYWORD_TO_CATEGORY: new Map([
    ['ai', { category: 'technology', importance: 9 }],
    ['hiring', { category: 'growth', importance: 7 }],
    ['partner', { category: 'partnership', importance: 7 }],
    ['cio', { category: 'leadership', importance: 8 }],
    ['layoff', { category: 'pain', importance: 8 }],
  ]),
  SIGNAL_SCORING_WEIGHTS: {
    freshness: 0.25,
    sourceConfidence: 0.25,
    signalImportance: 0.30,
    signalFrequency: 0.20,
  },
  IMPORTANCE_WEIGHTS: { 9: 0.9, 8: 0.8, 7: 0.7 },
}))

vi.mock('@/lib/intelligence-sources/types', () => ({
  FRESHNESS_CONFIG: { csv: 365, website: 180, rss: 90 },
  SOURCE_RELIABILITY: { csv: 0.95, website: 0.85, rss: 0.75 },
}))

import {
  detectSignalsForCompany,
  persistSignals,
  getSignalsForCompany,
  updateSignalStatus,
  getCompanySignalSummary,
} from '../signal-extraction'

describe('Signal Extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const companyId = 'comp-abc'
  const now = new Date('2025-01-15')

  describe('detectSignalsForCompany', () => {
    it('detects AI keyword in content → technology signal', async () => {
      mockIntelligenceObjectFindMany.mockResolvedValue([
        {
          id: 'obj-1',
          companyId,
          content: 'The company is investing heavily in ai automation.',
          sourceType: 'website',
          capturedAt: now,
          sourceConfidence: 0.9,
        },
      ])
      const signals = await detectSignalsForCompany(companyId)
      expect(signals).toHaveLength(1)
      expect(signals[0]).toMatchObject({
        companyId,
        category: 'technology',
        keyword: 'ai',
        status: 'NEW',
      })
    })

    it('detects multiple keywords across objects → multiple signals', async () => {
      mockIntelligenceObjectFindMany.mockResolvedValue([
        { id: 'obj-1', companyId, content: 'ai adoption is accelerating', sourceType: 'website', capturedAt: now, sourceConfidence: 0.9 },
        { id: 'obj-2', companyId, content: 'hiring 50 engineers for the new platform', sourceType: 'rss', capturedAt: now, sourceConfidence: 0.8 },
      ])
      const signals = await detectSignalsForCompany(companyId)
      expect(signals).toHaveLength(2)
      const categories = signals.map((s: { category: string }) => s.category)
      expect(categories).toContain('technology')
      expect(categories).toContain('growth')
    })

    it('no matching keywords → empty array', async () => {
      mockIntelligenceObjectFindMany.mockResolvedValue([
        { id: 'obj-1', companyId, content: 'The weather is nice today.', sourceType: 'website', capturedAt: now, sourceConfidence: 0.9 },
      ])
      const signals = await detectSignalsForCompany(companyId)
      expect(signals).toEqual([])
    })

    it('deduplicates same signal type across objects', async () => {
      mockIntelligenceObjectFindMany.mockResolvedValue([
        { id: 'obj-1', companyId, content: 'ai powered analytics launched', sourceType: 'website', capturedAt: now, sourceConfidence: 0.9 },
        { id: 'obj-2', companyId, content: 'new ai chatbot for customers', sourceType: 'rss', capturedAt: now, sourceConfidence: 0.8 },
      ])
      const signals = await detectSignalsForCompany(companyId)
      const techSignals = signals.filter((s: { category: string }) => s.category === 'technology')
      expect(techSignals).toHaveLength(1)
    })

    it('score calculation uses formula correctly', async () => {
      mockIntelligenceObjectFindMany.mockResolvedValue([
        { id: 'obj-1', companyId, content: 'ai strategy announced', sourceType: 'website', capturedAt: now, sourceConfidence: 0.85 },
      ])
      const signals = await detectSignalsForCompany(companyId)
      // score = freshness*0.25 + sourceConfidence*0.25 + importance*0.30 + frequency*0.20
      // freshness for website (180 days, captured today) ≈ 1.0
      // sourceConfidence = 0.85, importance = 0.9 (keyword 'ai' importance 9), frequency = 1
      const expected = 1.0 * 0.25 + 0.85 * 0.25 + 0.9 * 0.30 + 1.0 * 0.20
      expect(signals[0].score).toBeCloseTo(expected, 2)
    })

    it('handles null capturedAt (freshness penalty)', async () => {
      mockIntelligenceObjectFindMany.mockResolvedValue([
        { id: 'obj-1', companyId, content: 'ai platform released', sourceType: 'csv', capturedAt: null, sourceConfidence: 0.95 },
      ])
      const signals = await detectSignalsForCompany(companyId)
      // Null capturedAt should yield a low freshness score (0)
      const expected = 0 * 0.25 + 0.95 * 0.25 + 0.9 * 0.30 + 1.0 * 0.20
      expect(signals[0].score).toBeCloseTo(expected, 2)
    })
  })

  describe('persistSignals', () => {
    it('deletes old NEW signals and creates new ones', async () => {
      const signals = [
        { companyId, category: 'technology', keyword: 'ai', score: 0.82, status: 'NEW' as const, sourceType: 'website' },
        { companyId, category: 'growth', keyword: 'hiring', score: 0.71, status: 'NEW' as const, sourceType: 'rss' },
      ]
      mockOpportunitySignalDeleteMany.mockResolvedValue({ count: 3 })
      mockOpportunitySignalCreateMany.mockResolvedValue({ count: 2 })

      await persistSignals(companyId, signals)

      expect(mockOpportunitySignalDeleteMany).toHaveBeenCalledWith({
        where: { companyId, status: 'NEW' },
      })
      expect(mockOpportunitySignalCreateMany).toHaveBeenCalledWith({
        data: expect.arrayContaining([
          expect.objectContaining({ category: 'technology', keyword: 'ai' }),
          expect.objectContaining({ category: 'growth', keyword: 'hiring' }),
        ]),
      })
    })

    it('skips create when signals array is empty', async () => {
      mockOpportunitySignalDeleteMany.mockResolvedValue({ count: 0 })
      await persistSignals(companyId, [])
      expect(mockOpportunitySignalDeleteMany).toHaveBeenCalled()
      expect(mockOpportunitySignalCreateMany).not.toHaveBeenCalled()
    })
  })

  describe('getSignalsForCompany', () => {
    it('returns all signals when no filters provided', async () => {
      mockOpportunitySignalFindMany.mockResolvedValue([
        { id: 'sig-1', companyId, category: 'technology', status: 'ACTIVE', score: 0.85 },
        { id: 'sig-2', companyId, category: 'growth', status: 'NEW', score: 0.7 },
      ])
      const results = await getSignalsForCompany(companyId)
      expect(mockOpportunitySignalFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId }) }),
      )
      expect(results).toHaveLength(2)
    })

    it('applies filters correctly', async () => {
      mockOpportunitySignalFindMany.mockResolvedValue([
        { id: 'sig-1', companyId, category: 'technology', status: 'ACTIVE', score: 0.85 },
      ])
      const results = await getSignalsForCompany(companyId, { category: 'technology', status: 'ACTIVE' })
      expect(mockOpportunitySignalFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId, category: 'technology', status: 'ACTIVE' }),
        }),
      )
      expect(results).toHaveLength(1)
    })
  })

  describe('updateSignalStatus', () => {
    it('updates status', async () => {
      mockOpportunitySignalUpdate.mockResolvedValue({ id: 'sig-1', status: 'DISMISSED' })
      const result = await updateSignalStatus('sig-1', 'DISMISSED')
      expect(mockOpportunitySignalUpdate).toHaveBeenCalledWith({
        where: { id: 'sig-1' },
        data: { status: 'DISMISSED' },
      })
      expect(result.status).toBe('DISMISSED')
    })
  })

  describe('getCompanySignalSummary', () => {
    it('returns correct counts and top signals', async () => {
      mockOpportunitySignalGroupBy
        .mockResolvedValueOnce([{ status: 'NEW', _count: 3 }, { status: 'ACTIVE', _count: 5 }, { status: 'DISMISSED', _count: 2 }])
      .mockResolvedValueOnce([{ category: 'technology', _count: 4 }, { category: 'growth', _count: 3 }])
      mockOpportunitySignalFindMany.mockResolvedValue([
        { id: 'sig-1', category: 'technology', score: 0.95, keyword: 'ai' },
        { id: 'sig-2', category: 'growth', score: 0.88, keyword: 'hiring' },
      ])
      mockCompanyFindUnique.mockResolvedValue({ id: companyId, name: 'Acme Corp' })

      const summary = await getCompanySignalSummary(companyId)

      expect(summary.totalSignals).toBe(10)
      expect(summary.statusCounts).toEqual({ NEW: 3, ACTIVE: 5, DISMISSED: 2 })
      expect(summary.topCategories).toHaveLength(2)
      expect(summary.topSignals).toHaveLength(2)
      expect(summary.topSignals[0].score).toBeGreaterThanOrEqual(summary.topSignals[1].score)
    })
  })
})