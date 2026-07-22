import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockCompanyFindUnique,
  mockInboxCreate,
  mockInboxFindUnique,
  mockInboxFindMany,
  mockInboxCount,
  mockInboxUpdate,
  mockIntelligenceObjectCreate,
  mockInboxGroupByStatus,
  mockInboxGroupByPriority,
} = vi.hoisted(() => ({
  mockCompanyFindUnique: vi.fn(),
  mockInboxCreate: vi.fn(),
  mockInboxFindUnique: vi.fn(),
  mockInboxFindMany: vi.fn(),
  mockInboxCount: vi.fn(),
  mockInboxUpdate: vi.fn(),
  mockIntelligenceObjectCreate: vi.fn(),
  mockInboxGroupByStatus: vi.fn(),
  mockInboxGroupByPriority: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    company: {
      findUnique: mockCompanyFindUnique,
    },
    humanIntelligenceInbox: {
      create: mockInboxCreate,
      findUnique: mockInboxFindUnique,
      findMany: mockInboxFindMany,
      count: mockInboxCount,
      update: mockInboxUpdate,
      groupBy: vi.fn((args: any) => {
        if (args.by?.[0] === 'status') return mockInboxGroupByStatus(args)
        if (args.by?.[0] === 'priority') return mockInboxGroupByPriority(args)
        return []
      }),
    },
    intelligenceObject: {
      create: mockIntelligenceObjectCreate,
    },
  },
}))

import {
  submitToIntelligenceInbox,
  reviewInboxItem,
  convertApprovedItem,
  getInboxItems,
  getInboxStats,
  updateInboxItem,
} from '../human-intelligence'

describe('Human Intelligence Inbox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── submitToIntelligenceInbox ─────────────────────────────

  describe('submitToIntelligenceInbox', () => {
    it('creates a pending inbox record for valid input', async () => {
      mockCompanyFindUnique.mockResolvedValue({ id: 'co-1' })
      mockInboxCreate.mockResolvedValue({
        id: 'inbox-1',
        companyId: 'co-1',
        submittedBy: 'user-1',
        content: 'Acme Corp is expanding into APAC',
        status: 'pending',
        priority: 'normal',
        source: 'manual',
      })

      const result = await submitToIntelligenceInbox({
        companyId: 'co-1',
        submittedBy: 'user-1',
        content: 'Acme Corp is expanding into APAC',
      })

      expect(result.status).toBe('pending')
      expect(mockInboxCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            companyId: 'co-1',
            submittedBy: 'user-1',
            content: 'Acme Corp is expanding into APAC',
            status: 'pending',
          }),
        }),
      )
    })

    it('throws when companyId does not exist', async () => {
      mockCompanyFindUnique.mockResolvedValue(null)

      await expect(
        submitToIntelligenceInbox({
          companyId: 'missing',
          submittedBy: 'user-1',
          content: 'Some intel',
        }),
      ).rejects.toThrow('Company with id "missing" not found')
    })

    it('throws when category is invalid', async () => {
      mockCompanyFindUnique.mockResolvedValue({ id: 'co-1' })

      await expect(
        submitToIntelligenceInbox({
          companyId: 'co-1',
          submittedBy: 'user-1',
          content: 'Some intel',
          category: 'invalid_cat',
        }),
      ).rejects.toThrow('Invalid category "invalid_cat"')
    })

    it('serialises tags to JSON when provided', async () => {
      mockCompanyFindUnique.mockResolvedValue({ id: 'co-1' })
      mockInboxCreate.mockResolvedValue({ id: 'inbox-2' })

      await submitToIntelligenceInbox({
        companyId: 'co-1',
        submittedBy: 'user-1',
        content: 'Intel with tags',
        tags: ['expansion', 'apac'],
      })

      expect(mockInboxCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            tags: JSON.stringify(['expansion', 'apac']),
          }),
        }),
      )
    })
  })

  // ─── reviewInboxItem ──────────────────────────────────────

  describe('reviewInboxItem', () => {
    it('approves a pending item', async () => {
      mockInboxFindUnique.mockResolvedValue({ id: 'inbox-1', status: 'pending' })
      mockInboxUpdate.mockResolvedValue({ id: 'inbox-1', status: 'approved' })

      const result = await reviewInboxItem('inbox-1', 'approve', 'reviewer-1')

      expect(result.status).toBe('approved')
      expect(mockInboxUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inbox-1' },
          data: expect.objectContaining({ status: 'approve', reviewedBy: 'reviewer-1' }),
        }),
      )
    })

    it('rejects a pending item', async () => {
      mockInboxFindUnique.mockResolvedValue({ id: 'inbox-2', status: 'pending' })
      mockInboxUpdate.mockResolvedValue({ id: 'inbox-2', status: 'rejected' })

      const result = await reviewInboxItem('inbox-2', 'reject', 'reviewer-1', 'Not verified')

      expect(result.status).toBe('rejected')
      expect(mockInboxUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ reviewNotes: 'Not verified' }),
        }),
      )
    })

    it('throws when item is not in pending status', async () => {
      mockInboxFindUnique.mockResolvedValue({ id: 'inbox-3', status: 'approved' })

      await expect(
        reviewInboxItem('inbox-3', 'approve', 'reviewer-1'),
      ).rejects.toThrow('Cannot review item with status "approved"')
    })

    it('throws when item is not found', async () => {
      mockInboxFindUnique.mockResolvedValue(null)

      await expect(
        reviewInboxItem('missing', 'approve', 'reviewer-1'),
      ).rejects.toThrow('not found')
    })
  })

  // ─── convertApprovedItem ──────────────────────────────────

  describe('convertApprovedItem', () => {
    it('creates an IntelligenceObject from an approved item', async () => {
      const inboxItem = {
        id: 'inbox-1',
        status: 'approved',
        companyId: 'co-1',
        content: 'Acme raises Series C',
        summary: 'Funding round',
        category: 'Strategy',
        priority: 'high',
        submittedBy: 'user-1',
        sourceUrl: 'https://example.com',
        tags: '["funding"]',
        createdAt: new Date('2024-06-01'),
      }
      mockInboxFindUnique.mockResolvedValue(inboxItem)
      mockIntelligenceObjectCreate.mockResolvedValue({ id: 'intel-1' })
      mockInboxUpdate.mockResolvedValue({ id: 'inbox-1', status: 'converted' })

      const result = await convertApprovedItem('inbox-1')

      expect(result.intelligenceObject.id).toBe('intel-1')
      expect(result.inboxItem.status).toBe('converted')
      expect(mockIntelligenceObjectCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sourceType: 'human',
            origin: 'human_submission',
            originalConfidence: 0.85,
          }),
        }),
      )
    })

    it('throws when item is not approved', async () => {
      mockInboxFindUnique.mockResolvedValue({ id: 'inbox-2', status: 'pending' })

      await expect(convertApprovedItem('inbox-2')).rejects.toThrow(
        'Cannot convert item with status "pending"',
      )
    })

    it('throws when item is not found', async () => {
      mockInboxFindUnique.mockResolvedValue(null)

      await expect(convertApprovedItem('missing')).rejects.toThrow('not found')
    })
  })

  // ─── getInboxItems ────────────────────────────────────────

  describe('getInboxItems', () => {
    it('returns paginated results ordered by createdAt desc', async () => {
      const items = [{ id: 'inbox-1' }, { id: 'inbox-2' }]
      mockInboxFindMany.mockResolvedValue(items)
      mockInboxCount.mockResolvedValue(2)

      const result = await getInboxItems({ page: 1, limit: 10 })

      expect(result.items).toHaveLength(2)
      expect(result.total).toBe(2)
      expect(mockInboxFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { createdAt: 'desc' },
          skip: 0,
          take: 10,
        }),
      )
    })

    it('filters by status', async () => {
      mockInboxFindMany.mockResolvedValue([])
      mockInboxCount.mockResolvedValue(0)

      await getInboxItems({ status: 'pending' })

      expect(mockInboxFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'pending' }),
        }),
      )
    })
  })

  // ─── getInboxStats ────────────────────────────────────────

  describe('getInboxStats', () => {
    it('returns grouped counts by status and priority', async () => {
      mockInboxGroupByStatus.mockResolvedValue([
        { status: 'pending', _count: { status: 5 } },
        { status: 'approved', _count: { status: 3 } },
      ])
      mockInboxGroupByPriority.mockResolvedValue([
        { priority: 'high', _count: { priority: 2 } },
      ])
      mockInboxCount.mockResolvedValue(10)

      const stats = await getInboxStats()

      expect(stats.total).toBe(10)
      expect(stats.byStatus.pending).toBe(5)
      expect(stats.byStatus.approved).toBe(3)
      expect(stats.byPriority.high).toBe(2)
      expect(stats.byStatus.rejected).toBe(0)
    })
  })

  // ─── updateInboxItem ──────────────────────────────────────

  describe('updateInboxItem', () => {
    it('updates a pending item with new content', async () => {
      mockInboxFindUnique.mockResolvedValue({ id: 'inbox-1', status: 'pending' })
      mockInboxUpdate.mockResolvedValue({ id: 'inbox-1', content: 'Updated content' })

      const result = await updateInboxItem('inbox-1', { content: 'Updated content' })

      expect(result.content).toBe('Updated content')
      expect(mockInboxUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'inbox-1' },
          data: { content: 'Updated content' },
        }),
      )
    })

    it('throws when item is not in pending status', async () => {
      mockInboxFindUnique.mockResolvedValue({ id: 'inbox-1', status: 'approved' })

      await expect(
        updateInboxItem('inbox-1', { content: 'new' }),
      ).rejects.toThrow('Cannot update item with status "approved"')
    })

    it('throws when item is not found', async () => {
      mockInboxFindUnique.mockResolvedValue(null)

      await expect(
        updateInboxItem('missing', { content: 'new' }),
      ).rejects.toThrow('not found')
    })
  })
})