import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockConnectorFindUnique,
  mockConnectorFindMany,
  mockConnectorUpdate,
  mockIntelligenceObjectFindMany,
  mockSourceHealthUpsert,
  mockSourceHealthFindMany,
  mockSourceHealthFindUnique,
  mockAssociationCount,
} = vi.hoisted(() => ({
  mockConnectorFindUnique: vi.fn(),
  mockConnectorFindMany: vi.fn(),
  mockConnectorUpdate: vi.fn(),
  mockIntelligenceObjectFindMany: vi.fn(),
  mockSourceHealthUpsert: vi.fn(),
  mockSourceHealthFindMany: vi.fn(),
  mockSourceHealthFindUnique: vi.fn(),
  mockAssociationCount: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    connector: {
      findUnique: mockConnectorFindUnique,
      findMany: mockConnectorFindMany,
      update: mockConnectorUpdate,
    },
    intelligenceObject: {
      findMany: mockIntelligenceObjectFindMany,
    },
    sourceHealth: {
      upsert: mockSourceHealthUpsert,
      findMany: mockSourceHealthFindMany,
      findUnique: mockSourceHealthFindUnique,
    },
    intelligenceAssociation: {
      count: mockAssociationCount,
    },
  },
}))

import {
  calculateSourceHealth,
  getAllSourceHealth,
  getGovernanceReport,
  flagStaleSources,
} from '../source-governance'

describe('Source Governance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── calculateSourceHealth ────────────────────────────────

  describe('calculateSourceHealth', () => {
    it('returns high health score for connector with successful runs', async () => {
      mockConnectorFindUnique.mockResolvedValue({
        id: 'conn-1',
        sourceType: 'csv',
        runs: [
          { status: 'completed', recordsAcquired: 50, completedAt: new Date('2024-06-15') },
          { status: 'completed', recordsAcquired: 60, completedAt: new Date('2024-06-14') },
          { status: 'completed', recordsAcquired: 40, completedAt: new Date('2024-06-13') },
        ],
        sourceHealth: null,
      })

      mockIntelligenceObjectFindMany
        .mockResolvedValueOnce([
          { originalConfidence: 0.9 },
          { originalConfidence: 0.85 },
        ]) // quality objects
        .mockResolvedValueOnce([
          { capturedAt: new Date() },
          { capturedAt: new Date() },
        ]) // recent objects for freshness

      mockSourceHealthUpsert.mockResolvedValue({
        connectorId: 'conn-1',
        healthScore: 0.9,
        successRate: 1.0,
      })

      const result = await calculateSourceHealth('conn-1')

      expect(result.healthScore).toBeGreaterThanOrEqual(0.8)
      expect(mockSourceHealthUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { connectorId: 'conn-1' },
        }),
      )
    })

    it('returns low health score for connector with failed runs', async () => {
      mockConnectorFindUnique.mockResolvedValue({
        id: 'conn-2',
        sourceType: 'rss',
        runs: [
          { status: 'failed', completedAt: new Date('2024-06-15') },
          { status: 'failed', completedAt: new Date('2024-06-14') },
          { status: 'completed', recordsAcquired: 5, completedAt: new Date('2024-06-13') },
        ],
        sourceHealth: null,
      })

      mockIntelligenceObjectFindMany
        .mockResolvedValueOnce([{ originalConfidence: 0.3 }])
        .mockResolvedValueOnce([{ capturedAt: new Date('2024-01-01') }])

      mockSourceHealthUpsert.mockResolvedValue({
        connectorId: 'conn-2',
        healthScore: 0.35,
      })

      const result = await calculateSourceHealth('conn-2')

      expect(result.healthScore).toBeLessThan(0.5)
    })

    it('defaults successRate to 1.0 when connector has no runs', async () => {
      mockConnectorFindUnique.mockResolvedValue({
        id: 'conn-3',
        sourceType: 'csv',
        runs: [],
        sourceHealth: null,
      })

      mockIntelligenceObjectFindMany
        .mockResolvedValueOnce([]) // quality objects
        .mockResolvedValueOnce([]) // recent objects

      mockSourceHealthUpsert.mockImplementation(async (args: any) => ({
        connectorId: 'conn-3',
        healthScore: args.create.healthScore,
        successRate: args.create.successRate,
      }))

      const result = await calculateSourceHealth('conn-3')

      // No runs → successRate = 1.0, no objects → qualityScore = 0.5, no objects → freshnessScore = 1.0
      // composite = 1.0*0.35 + 0.5*0.35 + 1.0*0.3 = 0.35 + 0.175 + 0.3 = 0.825
      expect(result.successRate).toBe(1.0)
      expect(result.healthScore).toBeGreaterThan(0.75)
    })

    it('throws when connector does not exist', async () => {
      mockConnectorFindUnique.mockResolvedValue(null)

      await expect(calculateSourceHealth('missing')).rejects.toThrow(
        'Connector with id "missing" not found',
      )
    })
  })

  // ─── getAllSourceHealth ───────────────────────────────────

  describe('getAllSourceHealth', () => {
    it('returns all health records ordered by healthScore ASC', async () => {
      mockSourceHealthFindMany.mockResolvedValue([
        { connectorId: 'conn-b', healthScore: 0.3 },
        { connectorId: 'conn-a', healthScore: 0.8 },
        { connectorId: 'conn-c', healthScore: 0.95 },
      ])

      const result = await getAllSourceHealth()

      expect(result).toHaveLength(3)
      expect(mockSourceHealthFindMany).toHaveBeenCalledWith({
        orderBy: { healthScore: 'asc' },
      })
    })
  })

  // ─── getGovernanceReport ──────────────────────────────────

  describe('getGovernanceReport', () => {
    it('returns a structured governance report', async () => {
      mockSourceHealthFindMany.mockResolvedValue([
        {
          healthScore: 0.9,
          freshnessScore: 0.8,
          connector: { id: 'conn-1', name: 'CSV Import', status: 'active', sourceType: 'csv' },
        },
        {
          healthScore: 0.2,
          freshnessScore: 0.1,
          connector: { id: 'conn-2', name: 'RSS Feed', status: 'active', sourceType: 'rss' },
        },
        {
          healthScore: 0.5,
          freshnessScore: 0.4,
          connector: { id: 'conn-3', name: 'Web Scraper', status: 'paused', sourceType: 'website' },
        },
      ])

      mockAssociationCount
        .mockResolvedValueOnce(15) // total associations
        .mockResolvedValueOnce(3) // unresolved conflicts

      const report = await getGovernanceReport()

      expect(report.totalConnectors).toBe(3)
      expect(report.activeConnectors).toBe(2) // only conn-1 and conn-2 are active
      expect(report.degradedConnectors).toBe(2) // healthScore < 0.6
      expect(report.failedConnectors).toBe(1) // healthScore < 0.3
      expect(report.avgHealthScore).toBeCloseTo((0.9 + 0.2 + 0.5) / 3)
      expect(report.connectorsByHealth).toEqual({
        healthy: 1,   // >= 0.7
        warning: 1,   // >= 0.4 && < 0.7
        critical: 1,  // < 0.4
      })
      expect(report.totalAssociations).toBe(15)
      expect(report.unresolvedConflicts).toBe(3)
    })

    it('includes stale sources with freshnessScore below 0.5', async () => {
      mockSourceHealthFindMany.mockResolvedValue([
        {
          healthScore: 0.4,
          freshnessScore: 0.1,
          connector: { id: 'conn-1', name: 'Old Feed', status: 'active', sourceType: 'rss' },
        },
        {
          healthScore: 0.8,
          freshnessScore: 0.9,
          connector: { id: 'conn-2', name: 'Fresh Import', status: 'active', sourceType: 'csv' },
        },
      ])

      mockAssociationCount.mockResolvedValue(0)

      const report = await getGovernanceReport()

      expect(report.topStaleSources).toHaveLength(1)
      expect(report.topStaleSources[0].connectorId).toBe('conn-1')
      expect(report.topStaleSources[0].freshnessScore).toBe(0.1)
    })

    it('returns zeroed report when no health records exist', async () => {
      mockSourceHealthFindMany.mockResolvedValue([])
      mockAssociationCount.mockResolvedValue(0)

      const report = await getGovernanceReport()

      expect(report.totalConnectors).toBe(0)
      expect(report.avgHealthScore).toBe(0)
      expect(report.connectorsByHealth).toEqual({ healthy: 0, warning: 0, critical: 0 })
      expect(report.topStaleSources).toHaveLength(0)
    })
  })

  // ─── flagStaleSources ─────────────────────────────────────

  describe('flagStaleSources', () => {
    it('pauses connectors with freshnessScore below 0.3 that are active', async () => {
      mockSourceHealthFindMany.mockResolvedValue([
        {
          freshnessScore: 0.15,
          connector: { id: 'conn-stale', name: 'Stale Feed', status: 'active' },
        },
        {
          freshnessScore: 0.1,
          connector: { id: 'conn-already-paused', name: 'Paused Feed', status: 'paused' },
        },
      ])

      mockConnectorUpdate.mockResolvedValue({ id: 'conn-stale', status: 'paused' })

      const result = await flagStaleSources()

      // Only the active one gets flagged
      expect(result.flagged).toBe(1)
      expect(result.details).toHaveLength(1)
      expect(result.details[0].connectorId).toBe('conn-stale')
      expect(mockConnectorUpdate).toHaveBeenCalledWith({
        where: { id: 'conn-stale' },
        data: { status: 'paused' },
      })
    })

    it('returns zero flagged when no stale active connectors exist', async () => {
      mockSourceHealthFindMany.mockResolvedValue([])

      const result = await flagStaleSources()

      expect(result.flagged).toBe(0)
      expect(result.details).toHaveLength(0)
      expect(mockConnectorUpdate).not.toHaveBeenCalled()
    })
  })
})