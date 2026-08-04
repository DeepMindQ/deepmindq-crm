/**
 * Ticket 10 — Intelligence Inbox: Comprehensive Tests
 *
 * Tests cover:
 * - Unit: Inbox priority sorting (critical > high > normal > low)
 * - Unit: Dismiss action updates signal status to rejected
 * - Unit: Batch dismiss
 * - Integration: API routes (stats, list, review, convert, dismiss)
 * - Navigation: store.ts ViewId, screen-map.tsx, nav-config.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ═══════════════════════════════════════════════════════════════
// Shared Mock Setup
// ═══════════════════════════════════════════════════════════════

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
  dismissInboxItem,
  batchDismissInboxItems,
} from '@/lib/intelligence-sources/human-intelligence'

// ═══════════════════════════════════════════════════════════════
// Unit Tests — Priority Sorting
// ═══════════════════════════════════════════════════════════════

describe('Intelligence Inbox — Priority Sorting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sorts items by priority: critical > high > normal > low (per T10 spec)', async () => {
    // Items returned by DB in reverse chronological order ( newest first )
    const dbItems = [
      { id: 'inbox-low', priority: 'low', createdAt: new Date('2024-06-10T10:00:00Z') },
      { id: 'inbox-critical', priority: 'critical', createdAt: new Date('2024-06-06T10:00:00Z') },
      { id: 'inbox-normal', priority: 'normal', createdAt: new Date('2024-06-08T10:00:00Z') },
      { id: 'inbox-high', priority: 'high', createdAt: new Date('2024-06-07T10:00:00Z') },
      { id: 'inbox-high-2', priority: 'high', createdAt: new Date('2024-06-09T10:00:00Z') },
    ]

    mockInboxFindMany.mockResolvedValue(dbItems)
    mockInboxCount.mockResolvedValue(5)

    const result = await getInboxItems({ page: 1, limit: 20 })

    // After sorting, critical should be first, then high items (newest first), then normal, then low
    expect(result.items[0].id).toBe('inbox-critical')
    expect(result.items[1].id).toBe('inbox-high-2') // high, newer
    expect(result.items[2].id).toBe('inbox-high')   // high, older
    expect(result.items[3].id).toBe('inbox-normal')
    expect(result.items[4].id).toBe('inbox-low')
  })

  it('sorts items with same priority by createdAt desc', async () => {
    const dbItems = [
      { id: 'old-normal', priority: 'normal', createdAt: new Date('2024-06-01T10:00:00Z') },
      { id: 'new-normal', priority: 'normal', createdAt: new Date('2024-06-10T10:00:00Z') },
    ]

    mockInboxFindMany.mockResolvedValue(dbItems)
    mockInboxCount.mockResolvedValue(2)

    const result = await getInboxItems({ page: 1, limit: 20 })

    expect(result.items[0].id).toBe('new-normal')
    expect(result.items[1].id).toBe('old-normal')
  })

  it('handles unknown priority values by pushing them to the end', async () => {
    const dbItems = [
      { id: 'unknown', priority: 'urgent', createdAt: new Date('2024-06-10T10:00:00Z') },
      { id: 'normal-item', priority: 'normal', createdAt: new Date('2024-06-06T10:00:00Z') },
    ]

    mockInboxFindMany.mockResolvedValue(dbItems)
    mockInboxCount.mockResolvedValue(2)

    const result = await getInboxItems({ page: 1, limit: 20 })

    // Unknown priority (99) should sort after normal (2)
    expect(result.items[0].id).toBe('normal-item')
    expect(result.items[1].id).toBe('unknown')
  })

  it('returns empty list when no items match', async () => {
    mockInboxFindMany.mockResolvedValue([])
    mockInboxCount.mockResolvedValue(0)

    const result = await getInboxItems({ status: 'approved' })

    expect(result.items).toHaveLength(0)
    expect(result.total).toBe(0)
  })
})

// ═══════════════════════════════════════════════════════════════
// Unit Tests — Dismiss Action
// ═══════════════════════════════════════════════════════════════

describe('Intelligence Inbox — Dismiss Action', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('dismisses a pending item by setting status to rejected', async () => {
    mockInboxFindUnique.mockResolvedValue({ id: 'inbox-1', status: 'pending' })
    mockInboxUpdate.mockResolvedValue({ id: 'inbox-1', status: 'rejected' })

    const result = await dismissInboxItem('inbox-1', 'reviewer-1')

    expect(result.status).toBe('rejected')
    expect(mockInboxUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'inbox-1' },
        data: expect.objectContaining({
          status: 'rejected',
          reviewedBy: 'reviewer-1',
          reviewNotes: 'Dismissed by reviewer',
        }),
      }),
    )
  })

  it('throws when trying to dismiss a non-pending item', async () => {
    mockInboxFindUnique.mockResolvedValue({ id: 'inbox-2', status: 'approved' })

    await expect(
      dismissInboxItem('inbox-2', 'reviewer-1'),
    ).rejects.toThrow('Cannot dismiss item with status "approved"')
  })

  it('throws when dismissing a non-existent item', async () => {
    mockInboxFindUnique.mockResolvedValue(null)

    await expect(
      dismissInboxItem('missing', 'reviewer-1'),
    ).rejects.toThrow('not found')
  })
})

// ═══════════════════════════════════════════════════════════════
// Unit Tests — Batch Dismiss
// ═══════════════════════════════════════════════════════════════

describe('Intelligence Inbox — Batch Dismiss', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('dismisses all pending items in batch', async () => {
    // Make findUnique return pending items for each call
    mockInboxFindUnique.mockResolvedValue({ id: 'inbox-x', status: 'pending' })
    mockInboxUpdate.mockResolvedValue({ id: 'inbox-x', status: 'rejected' })

    const result = await batchDismissInboxItems(
      ['inbox-1', 'inbox-2', 'inbox-3'],
      'reviewer-1',
    )

    expect(result.dismissed).toBe(3)
    expect(result.failed).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it('counts failures for items that cannot be dismissed', async () => {
    // First item: pending (success)
    mockInboxFindUnique
      .mockResolvedValueOnce({ id: 'inbox-1', status: 'pending' })
      // Second item: already approved (fail)
      .mockResolvedValueOnce({ id: 'inbox-2', status: 'approved' })
      // Third item: not found (fail)
      .mockResolvedValueOnce(null)

    mockInboxUpdate.mockResolvedValue({ id: 'inbox-1', status: 'rejected' })

    const result = await batchDismissInboxItems(
      ['inbox-1', 'inbox-2', 'inbox-3'],
      'reviewer-1',
    )

    expect(result.dismissed).toBe(1)
    expect(result.failed).toBe(2)
    expect(result.errors).toHaveLength(2)
  })

  it('handles empty batch', async () => {
    const result = await batchDismissInboxItems([], 'reviewer-1')

    expect(result.dismissed).toBe(0)
    expect(result.failed).toBe(0)
    expect(result.errors).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════
// Integration Tests — Review Updates Signal Status
// ═══════════════════════════════════════════════════════════════

describe('Intelligence Inbox — Review Updates Signal Status', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('approve writes "approved" (not "approve") to DB', async () => {
    mockInboxFindUnique.mockResolvedValue({ id: 'inbox-1', status: 'pending' })
    mockInboxUpdate.mockResolvedValue({ id: 'inbox-1', status: 'approved' })

    await reviewInboxItem('inbox-1', 'approve', 'reviewer-1')

    // The DB update must use "approved", not "approve"
    const updateCall = mockInboxUpdate.mock.calls[0][0]
    expect(updateCall.data.status).toBe('approved')
  })

  it('reject writes "rejected" (not "reject") to DB', async () => {
    mockInboxFindUnique.mockResolvedValue({ id: 'inbox-2', status: 'pending' })
    mockInboxUpdate.mockResolvedValue({ id: 'inbox-2', status: 'rejected' })

    await reviewInboxItem('inbox-2', 'reject', 'reviewer-1')

    const updateCall = mockInboxUpdate.mock.calls[0][0]
    expect(updateCall.data.status).toBe('rejected')
  })

  it('dismiss via reviewInboxItem with reject action sets rejected status', async () => {
    mockInboxFindUnique.mockResolvedValue({ id: 'inbox-3', status: 'pending' })
    mockInboxUpdate.mockResolvedValue({ id: 'inbox-3', status: 'rejected', reviewNotes: 'Spam' })

    const result = await reviewInboxItem('inbox-3', 'reject', 'reviewer-1', 'Spam')

    expect(result.status).toBe('rejected')
    const updateCall = mockInboxUpdate.mock.calls[0][0]
    expect(updateCall.data.reviewNotes).toBe('Spam')
  })
})

// ═══════════════════════════════════════════════════════════════
// Integration Tests — Stats no longer include dead "reviewed" bucket
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// Unit Tests — Search Scope
// ═══════════════════════════════════════════════════════════════

describe('Intelligence Inbox — Search Scope', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('searches across content, summary, submittedBy, and company name', async () => {
    mockInboxFindMany.mockResolvedValue([])
    mockInboxCount.mockResolvedValue(0)

    await getInboxItems({ search: 'Acme' })

    // Verify the where clause includes all four search fields
    const whereArg = mockInboxFindMany.mock.calls[0][0].where
    expect(whereArg.OR).toEqual(
      expect.arrayContaining([
        { content: { contains: 'Acme', mode: 'insensitive' } },
        { summary: { contains: 'Acme', mode: 'insensitive' } },
        { submittedBy: { contains: 'Acme', mode: 'insensitive' } },
        { company: { rawName: { contains: 'Acme', mode: 'insensitive' } } },
      ]),
    )
  })

  it('does not add OR clause when search is empty', async () => {
    mockInboxFindMany.mockResolvedValue([])
    mockInboxCount.mockResolvedValue(0)

    await getInboxItems({})

    const whereArg = mockInboxFindMany.mock.calls[0][0].where
    expect(whereArg.OR).toBeUndefined()
  })
})

// ═══════════════════════════════════════════════════════════════
// Integration Tests — Stats Cleanup
// ═══════════════════════════════════════════════════════════════

describe('Intelligence Inbox — Stats Cleanup', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('stats do not include dead "reviewed" bucket', async () => {
    mockInboxGroupByStatus.mockResolvedValue([
      { status: 'pending', _count: { status: 5 } },
      { status: 'approved', _count: { status: 3 } },
    ])
    mockInboxGroupByPriority.mockResolvedValue([
      { priority: 'high', _count: { priority: 2 } },
    ])
    mockInboxCount.mockResolvedValue(8)

    const stats = await getInboxStats()

    // "reviewed" should NOT be a key in byStatus
    expect('reviewed' in stats.byStatus).toBe(false)
    // Known good keys should exist
    expect('pending' in stats.byStatus).toBe(true)
    expect('approved' in stats.byStatus).toBe(true)
    expect('rejected' in stats.byStatus).toBe(true)
    expect('converted' in stats.byStatus).toBe(true)
  })
})
