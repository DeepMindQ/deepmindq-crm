/**
 * Ticket 10 — Intelligence Inbox API Route Tests
 *
 * Tests cover all 4 API endpoints:
 * - GET /api/g-intel-acquisition/inbox/stats
 * - GET /api/g-intel-acquisition/inbox
 * - POST /api/g-intel-acquisition/inbox/[id]/review
 * - POST /api/g-intel-acquisition/inbox/[id]/convert
 * - POST /api/g-intel-acquisition/inbox/[id]/dismiss
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ═══════════════════════════════════════════════════════════════
// Mock the business logic layer
// ═══════════════════════════════════════════════════════════════

const {
  mockGetInboxStats,
  mockGetInboxItems,
  mockReviewInboxItem,
  mockConvertApprovedItem,
  mockDismissInboxItem,
} = vi.hoisted(() => ({
  mockGetInboxStats: vi.fn(),
  mockGetInboxItems: vi.fn(),
  mockReviewInboxItem: vi.fn(),
  mockConvertApprovedItem: vi.fn(),
  mockDismissInboxItem: vi.fn(),
}))

vi.mock('@/lib/intelligence-sources/human-intelligence', () => ({
  getInboxStats: mockGetInboxStats,
  getInboxItems: mockGetInboxItems,
  reviewInboxItem: mockReviewInboxItem,
  convertApprovedItem: mockConvertApprovedItem,
  dismissInboxItem: mockDismissInboxItem,
}))

// ═══════════════════════════════════════════════════════════════
// Stats API
// ═══════════════════════════════════════════════════════════════

describe('GET /api/g-intel-acquisition/inbox/stats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns inbox stats wrapped in apiSuccess envelope', async () => {
    const { GET } = await import('../stats/route')

    const stats = {
      byStatus: { pending: 5, approved: 3, rejected: 2, converted: 1 },
      byPriority: { low: 1, normal: 4, high: 3, critical: 3 },
      total: 11,
    }
    mockGetInboxStats.mockResolvedValue(stats)

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.byStatus.pending).toBe(5)
    expect(json.data.total).toBe(11)
    expect(json.timestamp).toBeDefined()
  })

  it('returns 500 when stats fetch fails', async () => {
    const { GET } = await import('../stats/route')

    mockGetInboxStats.mockRejectedValue(new Error('DB connection error'))

    const res = await GET()
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.success).toBe(false)
    expect(json.error).toContain('DB connection error')
  })
})

// ═══════════════════════════════════════════════════════════════
// List API
// ═══════════════════════════════════════════════════════════════

describe('GET /api/g-intel-acquisition/inbox', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns paginated items with stats in apiSuccess envelope', async () => {
    const { GET } = await import('../route')

    const items = [
      { id: 'inbox-1', priority: 'critical', status: 'pending', createdAt: '2024-06-10T00:00:00Z', company: { id: 'co-1', rawName: 'Acme' } },
      { id: 'inbox-2', priority: 'low', status: 'pending', createdAt: '2024-06-09T00:00:00Z', company: { id: 'co-2', rawName: 'Beta' } },
    ]
    mockGetInboxItems.mockResolvedValue({ items, total: 10 })
    mockGetInboxStats.mockResolvedValue({ byStatus: { pending: 10 }, byPriority: {}, total: 10 })

    const req = new Request('http://localhost/api/g-intel-acquisition/inbox?page=1&limit=20')
    const res = await GET(req as any)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.items).toHaveLength(2)
    expect(json.data.pagination.page).toBe(1)
    expect(json.data.pagination.total).toBe(10)
    expect(json.data.pagination.totalPages).toBe(1)
  })

  it('filters by status and priority query params', async () => {
    const { GET } = await import('../route')

    mockGetInboxItems.mockResolvedValue({ items: [], total: 0 })
    mockGetInboxStats.mockResolvedValue({ byStatus: {}, byPriority: {}, total: 0 })

    const req = new Request('http://localhost/api/g-intel-acquisition/inbox?status=pending&priority=critical')
    const res = await GET(req as any)

    expect(res.status).toBe(200)
    expect(mockGetInboxItems).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
        priority: 'critical',
        page: 1,
        limit: 20,
      }),
    )
  })

  it('ignores invalid status and priority values', async () => {
    const { GET } = await import('../route')

    mockGetInboxItems.mockResolvedValue({ items: [], total: 0 })
    mockGetInboxStats.mockResolvedValue({ byStatus: {}, byPriority: {}, total: 0 })

    const req = new Request('http://localhost/api/g-intel-acquisition/inbox?status=invalid&priority=superhigh')
    const res = await GET(req as any)

    expect(res.status).toBe(200)
    // Should NOT pass invalid values to getInboxItems
    expect(mockGetInboxItems).toHaveBeenCalledWith(
      expect.not.objectContaining({ status: 'invalid' }),
    )
    expect(mockGetInboxItems).toHaveBeenCalledWith(
      expect.not.objectContaining({ priority: 'superhigh' }),
    )
  })

  it('clamps page to minimum 1', async () => {
    const { GET } = await import('../route')

    mockGetInboxItems.mockResolvedValue({ items: [], total: 0 })
    mockGetInboxStats.mockResolvedValue({ byStatus: {}, byPriority: {}, total: 0 })

    const req = new Request('http://localhost/api/g-intel-acquisition/inbox?page=-5')
    const res = await GET(req as any)

    expect(res.status).toBe(200)
    expect(mockGetInboxItems).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1 }),
    )
  })

  it('returns 500 when list fetch fails', async () => {
    const { GET } = await import('../route')

    mockGetInboxItems.mockRejectedValue(new Error('DB error'))

    const req = new Request('http://localhost/api/g-intel-acquisition/inbox')
    const res = await GET(req as any)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.success).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// Review API
// ═══════════════════════════════════════════════════════════════

describe('POST /api/g-intel-acquisition/inbox/[id]/review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('approves an item via POST', async () => {
    const { POST } = await import('../[id]/review/route')

    mockReviewInboxItem.mockResolvedValue({ id: 'inbox-1', status: 'approved' })

    const req = new Request('http://localhost/api/g-intel-acquisition/inbox/inbox-1/review', {
      method: 'POST',
      body: JSON.stringify({ action: 'approve', reviewerId: 'user-1' }),
    })
    const res = await POST(req as any, { params: Promise.resolve({ id: 'inbox-1' }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.status).toBe('approved')
    expect(mockReviewInboxItem).toHaveBeenCalledWith('inbox-1', 'approve', 'user-1', undefined)
  })

  it('rejects with notes via POST', async () => {
    const { POST } = await import('../[id]/review/route')

    mockReviewInboxItem.mockResolvedValue({ id: 'inbox-2', status: 'rejected' })

    const req = new Request('http://localhost/api/g-intel-acquisition/inbox/inbox-2/review', {
      method: 'POST',
      body: JSON.stringify({ action: 'reject', reviewerId: 'user-1', notes: 'Not verified' }),
    })
    const res = await POST(req as any, { params: Promise.resolve({ id: 'inbox-2' }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.status).toBe('rejected')
    expect(mockReviewInboxItem).toHaveBeenCalledWith('inbox-2', 'reject', 'user-1', 'Not verified')
  })

  it('returns 400 for missing action', async () => {
    const { POST } = await import('../[id]/review/route')

    const req = new Request('http://localhost/api/g-intel-acquisition/inbox/inbox-1/review', {
      method: 'POST',
      body: JSON.stringify({ reviewerId: 'user-1' }),
    })
    const res = await POST(req as any, { params: Promise.resolve({ id: 'inbox-1' }) })
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.success).toBe(false)
  })

  it('returns 400 for invalid action', async () => {
    const { POST } = await import('../[id]/review/route')

    const req = new Request('http://localhost/api/g-intel-acquisition/inbox/inbox-1/review', {
      method: 'POST',
      body: JSON.stringify({ action: 'delete', reviewerId: 'user-1' }),
    })
    const res = await POST(req as any, { params: Promise.resolve({ id: 'inbox-1' }) })

    expect(res.status).toBe(400)
  })

  it('returns 400 for missing reviewerId', async () => {
    const { POST } = await import('../[id]/review/route')

    const req = new Request('http://localhost/api/g-intel-acquisition/inbox/inbox-1/review', {
      method: 'POST',
      body: JSON.stringify({ action: 'approve' }),
    })
    const res = await POST(req as any, { params: Promise.resolve({ id: 'inbox-1' }) })

    expect(res.status).toBe(400)
  })

  it('returns 404 when item not found', async () => {
    const { POST } = await import('../[id]/review/route')

    mockReviewInboxItem.mockRejectedValue(new Error('item with id "missing" not found'))

    const req = new Request('http://localhost/api/g-intel-acquisition/inbox/missing/review', {
      method: 'POST',
      body: JSON.stringify({ action: 'approve', reviewerId: 'user-1' }),
    })
    const res = await POST(req as any, { params: Promise.resolve({ id: 'missing' }) })

    expect(res.status).toBe(404)
  })
})

// ═══════════════════════════════════════════════════════════════
// Convert API
// ═══════════════════════════════════════════════════════════════

describe('POST /api/g-intel-acquisition/inbox/[id]/convert', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('converts an approved item', async () => {
    const { POST } = await import('../[id]/convert/route')

    mockConvertApprovedItem.mockResolvedValue({
      inboxItem: { id: 'inbox-1', status: 'converted' },
      intelligenceObject: { id: 'intel-1' },
    })

    const req = new Request('http://localhost/api/g-intel-acquisition/inbox/inbox-1/convert', {
      method: 'POST',
    })
    const res = await POST(req as any, { params: Promise.resolve({ id: 'inbox-1' }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.inboxItem.status).toBe('converted')
    expect(json.data.intelligenceObject.id).toBe('intel-1')
  })

  it('returns 404 when item not found', async () => {
    const { POST } = await import('../[id]/convert/route')

    mockConvertApprovedItem.mockRejectedValue(new Error('item with id "missing" not found'))

    const req = new Request('http://localhost/api/g-intel-acquisition/inbox/missing/convert', {
      method: 'POST',
    })
    const res = await POST(req as any, { params: Promise.resolve({ id: 'missing' }) })

    expect(res.status).toBe(404)
  })

  it('returns 500 when item is not approved', async () => {
    const { POST } = await import('../[id]/convert/route')

    mockConvertApprovedItem.mockRejectedValue(new Error('Cannot convert item with status "pending"'))

    const req = new Request('http://localhost/api/g-intel-acquisition/inbox/inbox-1/convert', {
      method: 'POST',
    })
    const res = await POST(req as any, { params: Promise.resolve({ id: 'inbox-1' }) })
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.success).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════
// Dismiss API
// ═══════════════════════════════════════════════════════════════

describe('POST /api/g-intel-acquisition/inbox/[id]/dismiss', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('dismisses a pending item', async () => {
    const { POST } = await import('../[id]/dismiss/route')

    mockDismissInboxItem.mockResolvedValue({ id: 'inbox-1', status: 'rejected' })

    const req = new Request('http://localhost/api/g-intel-acquisition/inbox/inbox-1/dismiss', {
      method: 'POST',
      body: JSON.stringify({ reviewerId: 'user-1' }),
    })
    const res = await POST(req as any, { params: Promise.resolve({ id: 'inbox-1' }) })
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.status).toBe('rejected')
    expect(mockDismissInboxItem).toHaveBeenCalledWith('inbox-1', 'user-1')
  })

  it('returns 400 for missing reviewerId', async () => {
    const { POST } = await import('../[id]/dismiss/route')

    const req = new Request('http://localhost/api/g-intel-acquisition/inbox/inbox-1/dismiss', {
      method: 'POST',
      body: JSON.stringify({}),
    })
    const res = await POST(req as any, { params: Promise.resolve({ id: 'inbox-1' }) })

    expect(res.status).toBe(400)
  })

  it('returns 404 when item not found', async () => {
    const { POST } = await import('../[id]/dismiss/route')

    mockDismissInboxItem.mockRejectedValue(new Error('item with id "missing" not found'))

    const req = new Request('http://localhost/api/g-intel-acquisition/inbox/missing/dismiss', {
      method: 'POST',
      body: JSON.stringify({ reviewerId: 'user-1' }),
    })
    const res = await POST(req as any, { params: Promise.resolve({ id: 'missing' }) })

    expect(res.status).toBe(404)
  })
})
