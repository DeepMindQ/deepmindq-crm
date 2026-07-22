import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockCompanyFindUnique,
  mockTimelineCreate,
  mockTimelineFindMany,
  mockTimelineCount,
  mockTransaction,
} = vi.hoisted(() => ({
  mockCompanyFindUnique: vi.fn(),
  mockTimelineCreate: vi.fn(),
  mockTimelineFindMany: vi.fn(),
  mockTimelineCount: vi.fn(),
  mockTransaction: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    company: {
      findUnique: mockCompanyFindUnique,
    },
    intelligenceTimeline: {
      create: mockTimelineCreate,
      findMany: mockTimelineFindMany,
      count: mockTimelineCount,
      deleteMany: vi.fn(),
    },
    $transaction: mockTransaction,
  },
}))

import {
  logTimelineEvent,
  getCompanyTimeline,
  getEntityTimeline,
  getRecentEvents,
  deleteOldEvents,
} from '../intelligence-timeline'

describe('Intelligence Timeline', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── logTimelineEvent ─────────────────────────────────────

  describe('logTimelineEvent', () => {
    it('creates a timeline event with serialised metadata', async () => {
      mockCompanyFindUnique.mockResolvedValue({ id: 'co-1' })
      mockTimelineCreate.mockResolvedValue({
        id: 'tl-1',
        companyId: 'co-1',
        eventType: 'acquired',
        title: 'New intel acquired',
        metadata: '{"key":"value"}',
      })

      const result = await logTimelineEvent({
        companyId: 'co-1',
        eventType: 'acquired',
        title: 'New intel acquired',
        metadata: { key: 'value' },
      })

      expect(result.id).toBe('tl-1')
      expect(mockTimelineCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'co-1',
            eventType: 'acquired',
            metadata: '{"key":"value"}',
          }),
        }),
      )
    })

    it('serialises empty metadata as {}', async () => {
      mockCompanyFindUnique.mockResolvedValue({ id: 'co-1' })
      mockTimelineCreate.mockResolvedValue({ id: 'tl-2' })

      await logTimelineEvent({
        companyId: 'co-1',
        eventType: 'merged',
        title: 'Merge event',
      })

      expect(mockTimelineCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ metadata: '{}' }),
        }),
      )
    })

    it('throws when companyId is missing', async () => {
      await expect(
        logTimelineEvent({ companyId: '', eventType: 'acquired', title: 'Test' }),
      ).rejects.toThrow('companyId is required')
    })

    it('throws when company does not exist', async () => {
      mockCompanyFindUnique.mockResolvedValue(null)

      await expect(
        logTimelineEvent({ companyId: 'missing', eventType: 'acquired', title: 'Test' }),
      ).rejects.toThrow('does not exist')
    })
  })

  // ─── getCompanyTimeline ───────────────────────────────────

  describe('getCompanyTimeline', () => {
    it('returns events with pagination and total count', async () => {
      const events = [
        { id: 'tl-1', eventType: 'acquired', createdAt: new Date('2024-06-15') },
        { id: 'tl-2', eventType: 'merged', createdAt: new Date('2024-06-14') },
      ]
      mockTimelineFindMany.mockResolvedValue(events)
      mockTimelineCount.mockResolvedValue(10)

      const result = await getCompanyTimeline('co-1', { limit: 5 })

      expect(result.events).toHaveLength(2)
      expect(result.total).toBe(10)
      expect(mockTimelineFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'co-1' }),
          orderBy: { createdAt: 'desc' },
          take: 5,
        }),
      )
    })

    it('filters by eventType', async () => {
      mockTimelineFindMany.mockResolvedValue([])
      mockTimelineCount.mockResolvedValue(0)

      await getCompanyTimeline('co-1', { eventType: 'acquired' })

      expect(mockTimelineFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'co-1', eventType: 'acquired' }),
        }),
      )
    })
  })

  // ─── getEntityTimeline ────────────────────────────────────

  describe('getEntityTimeline', () => {
    it('returns events for a specific entity', async () => {
      const events = [
        { id: 'tl-1', entityType: 'IntelligenceObject', entityId: 'io-1' },
      ]
      mockTimelineFindMany.mockResolvedValue(events)

      const result = await getEntityTimeline('IntelligenceObject', 'io-1')

      expect(result).toHaveLength(1)
      expect(mockTimelineFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { entityType: 'IntelligenceObject', entityId: 'io-1' },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      )
    })

    it('throws when entityType or entityId is missing', async () => {
      await expect(getEntityTimeline('', 'io-1')).rejects.toThrow('entityType and entityId are both required')
      await expect(getEntityTimeline('IntelligenceObject', '')).rejects.toThrow('entityType and entityId are both required')
    })
  })

  // ─── getRecentEvents ──────────────────────────────────────

  describe('getRecentEvents', () => {
    it('returns global events with company included', async () => {
      mockTimelineFindMany.mockResolvedValue([
        {
          id: 'tl-1',
          title: 'Acquired',
          company: { id: 'co-1', rawName: 'Acme Corp' },
        },
      ])

      const result = await getRecentEvents(10)

      expect(result).toHaveLength(1)
      expect(result[0].company.rawName).toBe('Acme Corp')
      expect(mockTimelineFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          include: { company: { select: { id: true, rawName: true } } },
          take: 10,
        }),
      )
    })
  })

  // ─── deleteOldEvents ──────────────────────────────────────

  describe('deleteOldEvents', () => {
    it('deletes events older than N days via transaction', async () => {
      mockTransaction.mockImplementation(async (cb: any) => {
        const tx = {
          intelligenceTimeline: {
            count: vi.fn().mockResolvedValue(7),
            deleteMany: vi.fn().mockResolvedValue({ count: 7 }),
          },
        }
        return cb(tx)
      })

      const result = await deleteOldEvents(90)

      expect(result.deleted).toBe(7)
      expect(mockTransaction).toHaveBeenCalledTimes(1)
    })

    it('returns 0 when no old events exist', async () => {
      mockTransaction.mockImplementation(async (cb: any) => {
        const tx = {
          intelligenceTimeline: {
            count: vi.fn().mockResolvedValue(0),
            deleteMany: vi.fn(),
          },
        }
        return cb(tx)
      })

      const result = await deleteOldEvents(30)

      expect(result.deleted).toBe(0)
    })

    it('throws when daysOld is not positive', async () => {
      await expect(deleteOldEvents(0)).rejects.toThrow('daysOld must be a positive number')
      await expect(deleteOldEvents(-5)).rejects.toThrow('daysOld must be a positive number')
    })
  })
})