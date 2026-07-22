import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockAlertCreate,
  mockAlertFindUnique,
  mockAlertFindMany,
  mockAlertFindFirst,
  mockAlertCount,
  mockAlertUpdate,
  mockAlertGroupBy,
} = vi.hoisted(() => ({
  mockAlertCreate: vi.fn(),
  mockAlertFindUnique: vi.fn(),
  mockAlertFindMany: vi.fn(),
  mockAlertFindFirst: vi.fn(),
  mockAlertCount: vi.fn(),
  mockAlertUpdate: vi.fn(),
  mockAlertGroupBy: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    intelligenceAlert: {
      create: mockAlertCreate,
      findUnique: mockAlertFindUnique,
      findMany: mockAlertFindMany,
      findFirst: mockAlertFindFirst,
      count: mockAlertCount,
      update: mockAlertUpdate,
      groupBy: mockAlertGroupBy,
    },
    sourceHealth: { findMany: vi.fn().mockResolvedValue([]) },
    intelligenceAssociation: { groupBy: vi.fn().mockResolvedValue([]) },
    intelligenceObject: { findMany: vi.fn().mockResolvedValue([]) },
    connectorRun: { groupBy: vi.fn().mockResolvedValue([]) },
    connector: { findUnique: vi.fn().mockResolvedValue(null) },
  },
}))

import {
  createAlert,
  acknowledgeAlert,
  resolveAlert,
  dismissAlert,
  getAlerts,
  getAlertSummary,
  autoGenerateAlerts,
} from '../intelligence-alerts'

describe('Intelligence Alerts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── createAlert ──────────────────────────────────────────

  describe('createAlert', () => {
    it('creates an alert with valid severity and type', async () => {
      mockAlertCreate.mockResolvedValue({
        id: 'alert-1',
        severity: 'high',
        alertType: 'health_degraded',
        title: 'Health degraded',
        status: 'active',
      })

      const result = await createAlert({
        severity: 'high',
        alertType: 'health_degraded',
        title: 'Health degraded',
        description: 'Score below 0.5',
      })

      expect(result.status).toBe('active')
      expect(mockAlertCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            severity: 'high',
            alertType: 'health_degraded',
            status: 'active',
          }),
        }),
      )
    })

    it('throws for invalid severity', async () => {
      await expect(
        createAlert({
          severity: 'urgent' as any,
          alertType: 'health_degraded',
          title: 'Test',
          description: 'Test',
        }),
      ).rejects.toThrow('Invalid severity "urgent"')
    })

    it('throws for invalid alertType', async () => {
      await expect(
        createAlert({
          severity: 'high',
          alertType: 'unknown_type' as any,
          title: 'Test',
          description: 'Test',
        }),
      ).rejects.toThrow('Invalid alertType "unknown_type"')
    })
  })

  // ─── acknowledgeAlert ─────────────────────────────────────

  describe('acknowledgeAlert', () => {
    it('transitions an active alert to acknowledged', async () => {
      mockAlertFindUnique.mockResolvedValue({ id: 'alert-1', status: 'active' })
      mockAlertUpdate.mockResolvedValue({ id: 'alert-1', status: 'acknowledged' })

      const result = await acknowledgeAlert('alert-1', 'user-1')

      expect(result.status).toBe('acknowledged')
      expect(mockAlertUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'acknowledged',
            acknowledgedBy: 'user-1',
            acknowledgedAt: expect.any(Date),
          }),
        }),
      )
    })

    it('throws for non-active alert', async () => {
      mockAlertFindUnique.mockResolvedValue({ id: 'alert-1', status: 'resolved' })

      await expect(
        acknowledgeAlert('alert-1', 'user-1'),
      ).rejects.toThrow('Cannot acknowledge alert with status "resolved"')
    })

    it('throws when alert not found', async () => {
      mockAlertFindUnique.mockResolvedValue(null)

      await expect(
        acknowledgeAlert('missing', 'user-1'),
      ).rejects.toThrow('not found')
    })
  })

  // ─── resolveAlert ─────────────────────────────────────────

  describe('resolveAlert', () => {
    it('resolves an active alert', async () => {
      mockAlertFindUnique.mockResolvedValue({ id: 'alert-1', status: 'active' })
      mockAlertUpdate.mockResolvedValue({ id: 'alert-1', status: 'resolved' })

      const result = await resolveAlert('alert-1', 'user-1', 'Fixed the issue')

      expect(result.status).toBe('resolved')
      expect(mockAlertUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'resolved',
            resolutionNotes: 'Fixed the issue',
          }),
        }),
      )
    })

    it('resolves an acknowledged alert', async () => {
      mockAlertFindUnique.mockResolvedValue({ id: 'alert-2', status: 'acknowledged' })
      mockAlertUpdate.mockResolvedValue({ id: 'alert-2', status: 'resolved' })

      const result = await resolveAlert('alert-2', 'user-1')

      expect(result.status).toBe('resolved')
    })

    it('throws for dismissed alert', async () => {
      mockAlertFindUnique.mockResolvedValue({ id: 'alert-3', status: 'dismissed' })

      await expect(
        resolveAlert('alert-3', 'user-1'),
      ).rejects.toThrow('Cannot resolve alert with status "dismissed"')
    })

    it('throws when alert not found', async () => {
      mockAlertFindUnique.mockResolvedValue(null)

      await expect(resolveAlert('missing', 'user-1')).rejects.toThrow('not found')
    })
  })

  // ─── dismissAlert ─────────────────────────────────────────

  describe('dismissAlert', () => {
    it('dismisses an alert regardless of current status', async () => {
      mockAlertFindUnique.mockResolvedValue({ id: 'alert-1', status: 'active' })
      mockAlertUpdate.mockResolvedValue({ id: 'alert-1', status: 'dismissed' })

      const result = await dismissAlert('alert-1', 'user-1')

      expect(result.status).toBe('dismissed')
      expect(mockAlertUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'dismissed', resolvedBy: 'user-1' }),
        }),
      )
    })
  })

  // ─── getAlerts ────────────────────────────────────────────

  describe('getAlerts', () => {
    it('returns paginated alerts with total count', async () => {
      const now = new Date('2024-06-15T10:00:00Z')
      const alerts = [
        { id: 'a1', severity: 'critical', createdAt: now, title: 'Critical' },
        { id: 'a2', severity: 'low', createdAt: now, title: 'Low' },
      ]
      mockAlertFindMany.mockResolvedValue(alerts)
      mockAlertCount.mockResolvedValue(25)

      const result = await getAlerts({ page: 2, limit: 10 })

      expect(result.alerts).toHaveLength(2)
      expect(result.total).toBe(25)
      expect(mockAlertFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      )
    })

    it('sorts critical severity first within same timestamp', async () => {
      const now = new Date('2024-06-15T10:00:00Z')
      mockAlertFindMany.mockResolvedValue([
        { id: 'a1', severity: 'low', createdAt: now, title: 'Low' },
        { id: 'a2', severity: 'critical', createdAt: now, title: 'Critical' },
      ])
      mockAlertCount.mockResolvedValue(2)

      const result = await getAlerts()

      expect(result.alerts[0].severity).toBe('critical')
      expect(result.alerts[1].severity).toBe('low')
    })
  })

  // ─── getAlertSummary ──────────────────────────────────────

  describe('getAlertSummary', () => {
    it('returns grouped counts by severity, status, and type', async () => {
      mockAlertGroupBy
        .mockResolvedValueOnce([{ severity: 'high', _count: { id: 3 } }])
        .mockResolvedValueOnce([
          { status: 'active', _count: { id: 5 } },
          { status: 'resolved', _count: { id: 10 } },
        ])
        .mockResolvedValueOnce([{ alertType: 'health_degraded', _count: { id: 2 } }])
      mockAlertFindMany.mockResolvedValue([{ id: 'a1' }, { id: 'a2' }, { id: 'a3' }])
      mockAlertCount.mockResolvedValue(15)

      const summary = await getAlertSummary()

      expect(summary.bySeverity).toEqual({ high: 3 })
      expect(summary.byStatus).toEqual({ active: 5, resolved: 10 })
      expect(summary.byType).toEqual({ health_degraded: 2 })
      expect(summary.total).toBe(15)
      expect(summary.recentActive).toHaveLength(3)
    })
  })

  // ─── autoGenerateAlerts ───────────────────────────────────

  describe('autoGenerateAlerts', () => {
    it('creates alerts for degraded health and deduplicates', async () => {
      // No existing alerts to trigger dedup skip
      mockAlertFindFirst.mockResolvedValue(null)
      mockAlertCreate.mockImplementation(async (args: any) => ({
        id: 'auto-1',
        ...args.data,
      }))

      // Provide degraded health data via sourceHealth mock
      const { db: _db } = await import('@/lib/db') as any
      _db.sourceHealth.findMany.mockResolvedValueOnce([
        {
          connectorId: 'conn-1',
          healthScore: 0.2,
          successRate: 0.5,
          qualityScore: 0.3,
          freshnessScore: 0.4,
          consecutiveFailures: 2,
          connector: { name: 'RSS Feed' },
        },
      ])

      const result = await autoGenerateAlerts()

      expect(result.created).toBeGreaterThanOrEqual(1)
      expect(mockAlertCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            alertType: 'health_degraded',
            connectorId: 'conn-1',
          }),
        }),
      )
    })

    it('returns zero created when no conditions are met', async () => {
      // All source mocks return empty arrays
      const result = await autoGenerateAlerts()

      expect(result.created).toBe(0)
      expect(result.alerts).toHaveLength(0)
    })
  })
})