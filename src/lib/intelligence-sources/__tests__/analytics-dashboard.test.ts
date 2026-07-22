import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockIntelObjectFindMany,
  mockKnowledgeEntryFindMany,
  mockConnectorCount,
  mockConnectorFindMany,
  mockAlertFindMany,
  mockAssociationCount,
  mockTimelineCount,
  mockIntelObjectGroupBy,
  mockInboxFindMany,
} = vi.hoisted(() => ({
  mockIntelObjectFindMany: vi.fn(),
  mockKnowledgeEntryFindMany: vi.fn(),
  mockConnectorCount: vi.fn(),
  mockConnectorFindMany: vi.fn(),
  mockAlertFindMany: vi.fn(),
  mockAssociationCount: vi.fn(),
  mockTimelineCount: vi.fn(),
  mockIntelObjectGroupBy: vi.fn(),
  mockInboxFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    intelligenceObject: {
      findMany: mockIntelObjectFindMany,
      groupBy: mockIntelObjectGroupBy,
    },
    knowledgeEntry: {
      findMany: mockKnowledgeEntryFindMany,
    },
    connector: {
      count: mockConnectorCount,
      findMany: mockConnectorFindMany,
    },
    intelligenceAlert: {
      findMany: mockAlertFindMany,
    },
    intelligenceAssociation: {
      count: mockAssociationCount,
    },
    intelligenceTimeline: {
      count: mockTimelineCount,
      findMany: vi.fn().mockResolvedValue([]),
    },
    humanIntelligenceInbox: {
      findMany: mockInboxFindMany,
    },
  },
}))

import {
  getIntelligenceOverview,
  getAcquisitionTrends,
  getConfidenceDistribution,
  getKnowledgeCoverage,
  getSourcePerformance,
  getActivityFeed,
} from '../analytics-dashboard'

describe('Analytics Dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── getIntelligenceOverview ──────────────────────────────

  describe('getIntelligenceOverview', () => {
    it('returns a structured overview with counts and activity windows', async () => {
      mockIntelObjectFindMany
        .mockResolvedValueOnce([{ companyId: 'co-1' }, { companyId: 'co-2' }])
        .mockResolvedValueOnce([
          { status: 'active', originalConfidence: 0.8 },
          { status: 'active', originalConfidence: 0.6 },
          { status: 'stale', originalConfidence: 0.3 },
        ])
      mockKnowledgeEntryFindMany.mockResolvedValue([
        { category: 'Strategy' },
        { category: 'Strategy' },
      ])
      mockConnectorCount.mockResolvedValue(5)
      mockAlertFindMany.mockResolvedValue([
        { status: 'active' },
        { status: 'resolved' },
      ])
      mockAssociationCount
        .mockResolvedValueOnce(20)
        .mockResolvedValueOnce(3)
      mockTimelineCount
        .mockResolvedValueOnce(10)
        .mockResolvedValueOnce(50)
        .mockResolvedValueOnce(200)

      const overview = await getIntelligenceOverview()

      expect(overview.totalCompanies).toBe(2)
      expect(overview.totalIntelligenceObjects).toBe(3)
      expect(overview.totalConnectors).toBe(5)
      expect(overview.totalAlerts).toBe(2)
      expect(overview.activeAlerts).toBe(1)
      expect(overview.avgConfidence).toBeCloseTo((0.8 + 0.6 + 0.3) / 3)
      expect(overview.intelligenceByStatus).toEqual({ active: 2, stale: 1 })
      expect(overview.knowledgeByCategory).toEqual({ Strategy: 2 })
      expect(overview.totalAssociations).toBe(20)
      expect(overview.unresolvedConflicts).toBe(3)
      expect(overview.recentActivity).toEqual({ last24h: 10, last7d: 50, last30d: 200 })
    })
  })

  // ─── getAcquisitionTrends ─────────────────────────────────

  describe('getAcquisitionTrends', () => {
    it('returns daily trends array grouped by sourceType', async () => {
      mockIntelObjectFindMany.mockResolvedValue([
        { createdAt: new Date('2024-06-01T10:00:00Z'), sourceType: 'csv' },
        { createdAt: new Date('2024-06-01T14:00:00Z'), sourceType: 'csv' },
        { createdAt: new Date('2024-06-02T09:00:00Z'), sourceType: 'rss' },
      ])

      const trends = await getAcquisitionTrends(7)

      expect(trends).toHaveLength(2)
      expect(trends[0].date).toBe('2024-06-01')
      expect(trends[0].acquired).toBe(2)
      expect(trends[0].bySourceType.csv).toBe(2)
      expect(trends[1].date).toBe('2024-06-02')
      expect(trends[1].bySourceType.rss).toBe(1)
    })

    it('returns empty array when no objects exist', async () => {
      mockIntelObjectFindMany.mockResolvedValue([])

      const trends = await getAcquisitionTrends()

      expect(trends).toHaveLength(0)
    })
  })

  // ─── getConfidenceDistribution ────────────────────────────

  describe('getConfidenceDistribution', () => {
    it('returns 5 confidence buckets with counts and freshness', async () => {
      mockIntelObjectFindMany.mockResolvedValue([
        { originalConfidence: 0.1, capturedAt: new Date('2024-06-01') },
        { originalConfidence: 0.3, capturedAt: new Date('2024-06-10') },
        { originalConfidence: 0.5, capturedAt: new Date('2024-06-15') },
        { originalConfidence: 0.7, capturedAt: new Date('2024-06-20') },
        { originalConfidence: 0.95, capturedAt: new Date('2024-06-25') },
      ])

      const dist = await getConfidenceDistribution()

      expect(dist.buckets).toHaveLength(5)
      expect(dist.buckets[0].range).toBe('0.0–0.2')
      expect(dist.buckets[0].count).toBe(1)
      expect(dist.buckets[4].range).toBe('0.8–1.0')
      expect(dist.buckets[4].count).toBe(1)
      expect(dist.totalObjects).toBe(5)
      expect(dist.overallAvg).toBeCloseTo((0.1 + 0.3 + 0.5 + 0.7 + 0.95) / 5)
    })

    it('returns zeros when no objects exist', async () => {
      mockIntelObjectFindMany.mockResolvedValue([])

      const dist = await getConfidenceDistribution()

      expect(dist.totalObjects).toBe(0)
      expect(dist.overallAvg).toBe(0)
      for (const bucket of dist.buckets) {
        expect(bucket.count).toBe(0)
      }
    })
  })

  // ─── getKnowledgeCoverage ─────────────────────────────────

  describe('getKnowledgeCoverage', () => {
    it('returns coverage with gaps and respects companyId', async () => {
      mockKnowledgeEntryFindMany.mockResolvedValue([
        { category: 'Strategy' },
        { category: 'Strategy' },
        { category: 'Products' },
      ])

      const coverage = await getKnowledgeCoverage('co-1')

      expect(coverage.totalEntries).toBe(3)
      expect(coverage.gaps.length).toBeGreaterThan(0)
      expect(coverage.gaps).not.toContain('Strategy')
      expect(coverage.gaps).not.toContain('Products')
      expect(coverage.coverageScore).toBeGreaterThan(0)
      expect(mockKnowledgeEntryFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { companyId: 'co-1' } }),
      )
    })

    it('scopes globally when no companyId is provided', async () => {
      mockKnowledgeEntryFindMany.mockResolvedValue([])

      await getKnowledgeCoverage()

      expect(mockKnowledgeEntryFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} }),
      )
    })
  })

  // ─── getSourcePerformance ─────────────────────────────────

  describe('getSourcePerformance', () => {
    it('returns per-connector metrics ordered by total records', async () => {
      mockConnectorFindMany.mockResolvedValue([
        {
          id: 'conn-1',
          name: 'CSV Import',
          sourceType: 'csv',
          status: 'active',
          lastRunAt: null,
          sourceHealth: { healthScore: 0.9 },
          runs: [{ createdAt: new Date('2024-06-15') }],
        },
        {
          id: 'conn-2',
          name: 'RSS Feed',
          sourceType: 'rss',
          status: 'active',
          lastRunAt: null,
          sourceHealth: null,
          runs: [],
        },
      ])
      mockIntelObjectGroupBy.mockResolvedValue([
        { connectorId: 'conn-1', _count: 50, _avg: { originalConfidence: 0.82 } },
        { connectorId: 'conn-2', _count: 10, _avg: { originalConfidence: 0.65 } },
      ])

      const performance = await getSourcePerformance()

      expect(performance).toHaveLength(2)
      expect(performance[0].connectorName).toBe('CSV Import')
      expect(performance[0].totalRecords).toBe(50)
      expect(performance[0].healthScore).toBe(0.9)
      expect(performance[0].avgConfidence).toBeCloseTo(0.82)
      // Ordered by totalRecords desc: conn-1 (50) > conn-2 (10)
      expect(performance[0].totalRecords).toBeGreaterThanOrEqual(performance[1].totalRecords)
    })

    it('returns empty array when no active connectors', async () => {
      mockConnectorFindMany.mockResolvedValue([])

      const performance = await getSourcePerformance()

      expect(performance).toHaveLength(0)
    })
  })

  // ─── getActivityFeed ──────────────────────────────────────

  describe('getActivityFeed', () => {
    it('returns unified feed from timeline, alerts, and inbox', async () => {
      const ts = new Date('2024-06-15T12:00:00Z')
      mockIntelObjectFindMany.mockResolvedValue([]) // for overview sub-calls if any

      // Timeline
      const { db: _db } = await import('@/lib/db') as any
      _db.intelligenceTimeline.findMany.mockResolvedValue([
        {
          id: 'tl-1',
          eventType: 'acquired',
          title: 'Intel acquired',
          description: 'From RSS',
          metadata: '{}',
          createdAt: ts,
        },
      ])
      mockAlertFindMany.mockResolvedValue([
        {
          id: 'al-1',
          severity: 'high',
          alertType: 'health_degraded',
          title: 'Health degraded',
          description: 'Score low',
          metadata: '{}',
          createdAt: ts,
        },
      ])
      mockInboxFindMany.mockResolvedValue([
        {
          id: 'ib-1',
          content: 'Manual submission about Acme',
          summary: 'Acme expansion',
          priority: 'high',
          status: 'pending',
          createdAt: ts,
        },
      ])

      const feed = await getActivityFeed(10)

      expect(feed).toHaveLength(3)
      const types = feed.map((item) => item.type)
      expect(types).toContain('timeline')
      expect(types).toContain('alert')
      expect(types).toContain('inbox')
      // Sorted by timestamp desc — all same time so order depends on sort stability
      expect(feed.length).toBeLessThanOrEqual(10)
    })
  })
})