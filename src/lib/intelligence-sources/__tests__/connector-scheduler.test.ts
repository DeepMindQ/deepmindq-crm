import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockConnectorFindMany,
  mockConnectorFindUnique,
  mockConnectorUpdate,
  mockEnqueueJob,
} = vi.hoisted(() => ({
  mockConnectorFindMany: vi.fn(),
  mockConnectorFindUnique: vi.fn(),
  mockConnectorUpdate: vi.fn(),
  mockEnqueueJob: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    connector: {
      findMany: mockConnectorFindMany,
      findUnique: mockConnectorFindUnique,
      update: mockConnectorUpdate,
    },
  },
}))

vi.mock('../job-queue', () => ({
  enqueueJob: mockEnqueueJob,
}))

import {
  getScheduledConnectors,
  getDueConnectors,
  triggerScheduledRun,
  runAllDueConnectors,
  getScheduleOverview,
  updateScheduleFrequency,
} from '../connector-scheduler'

describe('Connector Scheduler', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── getScheduledConnectors ───────────────────────────────

  describe('getScheduledConnectors', () => {
    it('returns scheduled connectors with calculated nextRunAt', async () => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      mockConnectorFindMany.mockResolvedValue([
        {
          id: 'conn-1',
          name: 'RSS Feed',
          sourceType: 'rss',
          status: 'active',
          scheduleFrequency: 'hourly',
          lastRunAt: oneHourAgo,
          lastSuccessAt: oneHourAgo,
          sourceHealth: { healthScore: 0.85 },
        },
      ])

      const result = await getScheduledConnectors()

      expect(result).toHaveLength(1)
      expect(result[0].nextRunAt).toBeInstanceOf(Date)
      expect(result[0].healthScore).toBe(0.85)
      expect(result[0].due).toBe(true)
    })

    it('marks connectors as not due when nextRunAt is in the future', async () => {
      mockConnectorFindMany.mockResolvedValue([
        {
          id: 'conn-2',
          name: 'Daily Import',
          sourceType: 'csv',
          status: 'active',
          scheduleFrequency: 'daily',
          lastRunAt: new Date(),
          lastSuccessAt: new Date(),
          sourceHealth: null,
        },
      ])

      const result = await getScheduledConnectors()

      expect(result[0].due).toBe(false)
    })
  })

  // ─── getDueConnectors ─────────────────────────────────────

  describe('getDueConnectors', () => {
    it('filters to only connectors that are currently due', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000)
      mockConnectorFindMany.mockResolvedValue([
        {
          id: 'conn-due',
          name: 'Overdue Feed',
          sourceType: 'rss',
          status: 'active',
          scheduleFrequency: 'hourly',
          lastRunAt: twoHoursAgo,
          lastSuccessAt: twoHoursAgo,
          sourceHealth: null,
        },
        {
          id: 'conn-future',
          name: 'Future Feed',
          sourceType: 'rss',
          status: 'active',
          scheduleFrequency: 'hourly',
          lastRunAt: new Date(),
          lastSuccessAt: new Date(),
          sourceHealth: null,
        },
      ])

      const due = await getDueConnectors()

      expect(due).toHaveLength(1)
      expect(due[0].id).toBe('conn-due')
    })
  })

  // ─── triggerScheduledRun ──────────────────────────────────

  describe('triggerScheduledRun', () => {
    it('enqueues a job and updates lastRunAt for an active connector', async () => {
      mockConnectorFindUnique.mockResolvedValue({
        id: 'conn-1',
        name: 'RSS Feed',
        status: 'active',
        sourceType: 'rss',
        config: '{"feedUrl":"https://example.com/feed"}',
      })
      mockEnqueueJob.mockResolvedValue('run-1')
      mockConnectorUpdate.mockResolvedValue({ id: 'conn-1', lastRunAt: new Date() })

      const result = await triggerScheduledRun('conn-1')

      expect(result.runId).toBe('run-1')
      expect(result.connectorId).toBe('conn-1')
      expect(mockEnqueueJob).toHaveBeenCalledWith(
        expect.objectContaining({
          connectorId: 'conn-1',
          action: 'acquire',
          config: expect.objectContaining({ sourceType: 'rss' }),
        }),
      )
      expect(mockConnectorUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'conn-1' },
          data: expect.objectContaining({ lastRunAt: expect.any(Date) }),
        }),
      )
    })

    it('throws when connector is not found', async () => {
      mockConnectorFindUnique.mockResolvedValue(null)

      await expect(triggerScheduledRun('missing')).rejects.toThrow('not found')
    })

    it('throws when connector is not active', async () => {
      mockConnectorFindUnique.mockResolvedValue({
        id: 'conn-1',
        name: 'Paused Feed',
        status: 'paused',
        sourceType: 'rss',
        config: '{}',
      })

      await expect(triggerScheduledRun('conn-1')).rejects.toThrow('not active')
    })
  })

  // ─── runAllDueConnectors ──────────────────────────────────

  describe('runAllDueConnectors', () => {
    it('triggers multiple due connectors and continues on failure', async () => {
      const past = new Date(Date.now() - 2 * 60 * 60 * 1000)

      // First call: getScheduledConnectors via getDueConnectors
      mockConnectorFindMany.mockResolvedValue([
        {
          id: 'conn-ok',
          name: 'Good Feed',
          sourceType: 'rss',
          status: 'active',
          scheduleFrequency: 'hourly',
          lastRunAt: past,
          lastSuccessAt: past,
          sourceHealth: null,
        },
        {
          id: 'conn-fail',
          name: 'Bad Feed',
          sourceType: 'rss',
          status: 'active',
          scheduleFrequency: 'hourly',
          lastRunAt: past,
          lastSuccessAt: past,
          sourceHealth: null,
        },
      ])

      // triggerScheduledRun calls findUnique for each connector
      mockConnectorFindUnique
        .mockResolvedValueOnce({
          id: 'conn-ok', name: 'Good Feed', status: 'active', sourceType: 'rss', config: '{}',
        })
        .mockResolvedValueOnce({
          id: 'conn-fail', name: 'Bad Feed', status: 'active', sourceType: 'rss', config: '{}',
        })

      mockEnqueueJob
        .mockResolvedValueOnce('run-1')
        .mockRejectedValueOnce(new Error('Queue full'))
      mockConnectorUpdate.mockResolvedValue({ id: 'conn-ok' })

      const result = await runAllDueConnectors()

      expect(result.triggered).toBe(1)
      expect(result.results).toHaveLength(2)
      expect(result.results[0].success).toBe(true)
      expect(result.results[1].success).toBe(false)
      expect(result.results[1].error).toBe('Queue full')
    })
  })

  // ─── getScheduleOverview ──────────────────────────────────

  describe('getScheduleOverview', () => {
    it('returns a structured overview with frequency counts', async () => {
      // First call: all connectors (no where filter)
      mockConnectorFindMany
        .mockResolvedValueOnce([
          { id: 'c1', scheduleFrequency: 'hourly', status: 'active' },
          { id: 'c2', scheduleFrequency: 'manual', status: 'active' },
          { id: 'c3', scheduleFrequency: 'daily', status: 'paused' },
        ])
        // Second call: active scheduled connectors
        .mockResolvedValueOnce([
          {
            id: 'c1',
            name: 'Hourly Feed',
            sourceType: 'rss',
            status: 'active',
            scheduleFrequency: 'hourly',
            lastRunAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
            lastSuccessAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
            sourceHealth: null,
          },
        ])

      const overview = await getScheduleOverview()

      expect(overview.totalConnectors).toBe(3)
      expect(overview.scheduledConnectors).toBe(1)
      expect(overview.manualConnectors).toBe(1)
      expect(overview.byFrequency).toEqual({ hourly: 1, manual: 1, daily: 1 })
      expect(overview.dueNow).toBe(1)
      expect(overview.nextScheduledRun).toBeInstanceOf(Date)
    })
  })

  // ─── updateScheduleFrequency ──────────────────────────────

  describe('updateScheduleFrequency', () => {
    it('updates the connector frequency', async () => {
      mockConnectorFindUnique.mockResolvedValue({ id: 'conn-1' })
      mockConnectorUpdate.mockResolvedValue({
        id: 'conn-1',
        scheduleFrequency: 'daily',
      })

      const result = await updateScheduleFrequency('conn-1', 'daily')

      expect(result.scheduleFrequency).toBe('daily')
      expect(mockConnectorUpdate).toHaveBeenCalledWith({
        where: { id: 'conn-1' },
        data: { scheduleFrequency: 'daily' },
      })
    })

    it('throws when frequency is invalid', async () => {
      await expect(
        updateScheduleFrequency('conn-1', 'every_minute'),
      ).rejects.toThrow('Invalid schedule frequency "every_minute"')
    })

    it('throws when connector is not found', async () => {
      mockConnectorFindUnique.mockResolvedValue(null)

      await expect(
        updateScheduleFrequency('missing', 'daily'),
      ).rejects.toThrow('not found')
    })
  })
})