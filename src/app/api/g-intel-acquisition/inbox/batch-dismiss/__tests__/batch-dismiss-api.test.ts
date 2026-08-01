/**
 * Ticket 10 — Batch Dismiss API Route Tests
 *
 * Tests for POST /api/g-intel-acquisition/inbox/batch-dismiss
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Auth mock — these routes now require authentication ──
vi.mock('@/lib/session', () => ({
  getCurrentSession: vi.fn().mockResolvedValue({
    id: 'test-user',
    email: 'test@deepmindq.com',
    name: 'Test User',
    phone: null,
    company: 'DeepMindQ',
    designation: 'Admin',
    role: 'admin',
    hasPassword: true,
    avatarUrl: null,
  }),
}))

// ═══════════════════════════════════════════════════════════════
// Mock the business logic layer
// ═══════════════════════════════════════════════════════════════

const {
  mockBatchDismissInboxItems,
} = vi.hoisted(() => ({
  mockBatchDismissInboxItems: vi.fn(),
}))

vi.mock('@/lib/intelligence-sources/human-intelligence', () => ({
  batchDismissInboxItems: mockBatchDismissInboxItems,
}))

// ═══════════════════════════════════════════════════════════════
// Batch Dismiss API
// ═══════════════════════════════════════════════════════════════

describe('POST /api/g-intel-acquisition/inbox/batch-dismiss', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('batch dismisses multiple items and returns counts', async () => {
    const { POST } = await import('../route')

    mockBatchDismissInboxItems.mockResolvedValue({
      dismissed: 3,
      failed: 0,
      errors: [],
    })

    const req = new Request('http://localhost/api/g-intel-acquisition/inbox/batch-dismiss', {
      method: 'POST',
      body: JSON.stringify({
        ids: ['inbox-1', 'inbox-2', 'inbox-3'],
        reviewerId: 'user-1',
      }),
    })
    const res = await POST(req as any)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.dismissed).toBe(3)
    expect(json.data.failed).toBe(0)
    expect(json.timestamp).toBeDefined()
    expect(mockBatchDismissInboxItems).toHaveBeenCalledWith(
      ['inbox-1', 'inbox-2', 'inbox-3'],
      'user-1',
    )
  })

  it('returns partial success when some items fail', async () => {
    const { POST } = await import('../route')

    mockBatchDismissInboxItems.mockResolvedValue({
      dismissed: 2,
      failed: 1,
      errors: ['item not found'],
    })

    const req = new Request('http://localhost/api/g-intel-acquisition/inbox/batch-dismiss', {
      method: 'POST',
      body: JSON.stringify({
        ids: ['inbox-1', 'inbox-2', 'inbox-missing'],
        reviewerId: 'user-1',
      }),
    })
    const res = await POST(req as any)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.dismissed).toBe(2)
    expect(json.data.failed).toBe(1)
    expect(json.data.errors).toHaveLength(1)
  })

  it('returns 400 when reviewerId is missing', async () => {
    const { POST } = await import('../route')

    const req = new Request('http://localhost/api/g-intel-acquisition/inbox/batch-dismiss', {
      method: 'POST',
      body: JSON.stringify({ ids: ['inbox-1'] }),
    })
    const res = await POST(req as any)

    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.success).toBe(false)
  })

  it('returns 400 when ids is empty', async () => {
    const { POST } = await import('../route')

    const req = new Request('http://localhost/api/g-intel-acquisition/inbox/batch-dismiss', {
      method: 'POST',
      body: JSON.stringify({ ids: [], reviewerId: 'user-1' }),
    })
    const res = await POST(req as any)

    expect(res.status).toBe(400)
  })

  it('returns 400 when ids exceeds 100 items', async () => {
    const { POST } = await import('../route')

    const ids = Array.from({ length: 101 }, (_, i) => `inbox-${i}`)
    const req = new Request('http://localhost/api/g-intel-acquisition/inbox/batch-dismiss', {
      method: 'POST',
      body: JSON.stringify({ ids, reviewerId: 'user-1' }),
    })
    const res = await POST(req as any)

    expect(res.status).toBe(400)
  })

  it('returns 400 when ids is not an array', async () => {
    const { POST } = await import('../route')

    const req = new Request('http://localhost/api/g-intel-acquisition/inbox/batch-dismiss', {
      method: 'POST',
      body: JSON.stringify({ ids: 'not-an-array', reviewerId: 'user-1' }),
    })
    const res = await POST(req as any)

    expect(res.status).toBe(400)
  })

  it('returns 500 when batch dismiss fails', async () => {
    const { POST } = await import('../route')

    mockBatchDismissInboxItems.mockRejectedValue(new Error('DB connection error'))

    const req = new Request('http://localhost/api/g-intel-acquisition/inbox/batch-dismiss', {
      method: 'POST',
      body: JSON.stringify({ ids: ['inbox-1'], reviewerId: 'user-1' }),
    })
    const res = await POST(req as any)
    const json = await res.json()

    expect(res.status).toBe(500)
    expect(json.success).toBe(false)
    expect(json.error).toContain('DB connection error')
  })
})
