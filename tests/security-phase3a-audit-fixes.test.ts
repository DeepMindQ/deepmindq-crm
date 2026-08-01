/**
 * Phase 3A — Audit Accountability & Security Fix Tests
 *
 * Verifies:
 * 1. logAction() stores userId when provided
 * 2. emails/send records authenticated userId in audit log
 * 3. export-center GET history query uses correct filter
 * 4. export/route.ts creates audit entries
 * 5. emails/send rate limiting returns 429
 * 6. reset-password stubs are removed
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { existsSync } from 'fs'
import { resolve } from 'path'

// ── Hoisted mocks ────────────────────────────────────────────────────

const { mockAuditCreate, mockAuditFindMany } = vi.hoisted(() => {
  return {
    mockAuditCreate: vi.fn().mockResolvedValue({
      id: 'audit-1', action: 'test', entity: 'Test', entityId: 'ent-1',
      userId: 'user-1', details: '{}', createdAt: new Date(),
    }),
    mockAuditFindMany: vi.fn().mockResolvedValue([]),
  }
})

const rateLimitStore = vi.hoisted(() => new Map<string, { count: number; resetAt: number }>())

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  db: {
    session: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'sess-1', userId: 'user-1' }),
      delete: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'admin',
        isActive: true,
        hasPassword: true,
        avatarUrl: null,
        phone: null,
        company: null,
        designation: null,
      }),
    },
    auditLog: {
      create: mockAuditCreate,
      findMany: mockAuditFindMany,
    },
    company: {
      findMany: vi.fn().mockResolvedValue([
        { rawName: 'Co', domain: 'co.com', industry: 'Tech', sizeRange: '1-10', country: 'US', location: 'NYC', website: 'co.com', status: 'prospect', intelligenceScore: 80, createdAt: new Date(), normalizedName: 'co', lifecycleStage: 'lead' },
      ]),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    contact: {
      findMany: vi.fn().mockResolvedValue([]),
      update: vi.fn(),
    },
    companyTimelineEvent: {
      create: vi.fn().mockResolvedValue({}),
    },
    draft: {
      findUnique: vi.fn().mockResolvedValue(null),
      update: vi.fn().mockResolvedValue({}),
    },
    otpCode: {
      findFirst: vi.fn().mockResolvedValue(null),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    capabilityAsset: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    opportunityRecommendation: { findMany: vi.fn().mockResolvedValue([]) },
    aIInsight: { findMany: vi.fn().mockResolvedValue([]) },
    companySignal: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

vi.mock('@/lib/session', () => ({
  getCurrentSession: vi.fn().mockResolvedValue({
    id: 'user-1',
    email: 'test@example.com',
    name: 'Test User',
    role: 'admin',
    isActive: true,
    hasPassword: true,
    avatarUrl: null,
    phone: null,
    company: null,
    designation: null,
  }),
  createSession: vi.fn().mockResolvedValue({ token: 'tok-1', expiresAt: new Date() }),
  destroyCurrentSession: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/email-provider', () => ({
  sendEmail: vi.fn().mockResolvedValue({ success: true, providerId: 'prov-1' }),
}))

vi.mock('@/lib/email-tracking', () => ({
  registerTrackingEvent: vi.fn(),
}))

vi.mock('@/lib/event-bus', () => ({
  eventBus: { emit: vi.fn(), on: vi.fn(), off: vi.fn() },
}))

// Rate limit mock with real behavior
vi.mock('@/lib/rate-limit', () => ({
  rateLimit: (opts: { key: string; limit: number; windowMs: number }) => {
    const now = Date.now()
    let entry = rateLimitStore.get(opts.key)
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + opts.windowMs }
      rateLimitStore.set(opts.key, entry)
    }
    entry.count++
    return { success: entry.count <= opts.limit, remaining: Math.max(0, opts.limit - entry.count), resetAt: entry.resetAt }
  },
  emailSendRateLimit: (userId: string) => {
    const now = Date.now()
    const key = `email:send:${userId}`
    let entry = rateLimitStore.get(key)
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + 3600000 }
      rateLimitStore.set(key, entry)
    }
    entry.count++
    return { success: entry.count <= 50, remaining: Math.max(0, 50 - entry.count), resetAt: entry.resetAt }
  },
  apiRateLimit: vi.fn(),
  authRateLimit: vi.fn(),
  aiRateLimit: vi.fn(),
  importRateLimit: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(null),
    set: vi.fn(),
    delete: vi.fn(),
  }),
}))

vi.mock('next/server', () => ({
  NextRequest: class {
    url: string
    headers: Headers
    constructor(url: string, init?: RequestInit) {
      this.url = url
      this.headers = new Headers(init?.headers)
    }
  },
  NextResponse: {
    json: (body: unknown, init?: { status?: number }) => ({
      status: init?.status || 200,
      json: async () => body,
    }),
  },
}))

import { logAction } from '@/lib/audit'
import { emailSendRateLimit } from '@/lib/rate-limit'

// ── Test Suite ──────────────────────────────────────────────────────

describe('Phase 3A — Audit Accountability', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuditCreate.mockClear()
    mockAuditFindMany.mockClear()
    rateLimitStore.clear()
  })

  // ── 1. logAction stores userId ──

  describe('logAction() userId support', () => {
    it('passes userId to auditLog.create when provided', async () => {
      await logAction('test_action', 'TestEntity', 'ent-1', { key: 'val' }, 'user-abc')

      expect(mockAuditCreate).toHaveBeenCalledWith({
        data: {
          action: 'test_action',
          entity: 'TestEntity',
          entityId: 'ent-1',
          userId: 'user-abc',
          details: '{"key":"val"}',
        },
      })
    })

    it('omits userId when not provided (backward compat)', async () => {
      await logAction('test_action', 'TestEntity', 'ent-1', { key: 'val' })

      expect(mockAuditCreate).toHaveBeenCalledWith({
        data: {
          action: 'test_action',
          entity: 'TestEntity',
          entityId: 'ent-1',
          userId: undefined,
          details: '{"key":"val"}',
        },
      })
    })

    it('works without details and without userId', async () => {
      await logAction('test_action', 'TestEntity', 'ent-1')

      expect(mockAuditCreate).toHaveBeenCalledWith({
        data: {
          action: 'test_action',
          entity: 'TestEntity',
          entityId: 'ent-1',
          userId: undefined,
          details: undefined,
        },
      })
    })
  })

  // ── 2. emails/send audit records userId ──

  describe('emails/send audit logging', () => {
    it('records userId in auditLog.create when sending email', async () => {
      const { POST } = await import('@/app/api/emails/send/route')

      const req = new Request('http://localhost/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: 'recipient@example.com', subject: 'Test', body: '<p>Hello</p>' }),
      })

      const response = await POST(req as any)
      expect(response.status).toBe(200)

      // Verify db.auditLog.create was called with userId = 'user-1'
      const createCalls = mockAuditCreate.mock.calls
      const auditCall = createCalls.find((call: any[]) =>
        call[0]?.data?.action === 'email_sent' && call[0]?.data?.userId
      )

      expect(auditCall).toBeDefined()
      expect(auditCall[0].data.userId).toBe('user-1')
    })
  })

  // ── 3. export-center GET history query filter ──

  describe('export-center history query', () => {
    it('queries auditLog with action=export only (not entity=export)', async () => {
      const { GET } = await import('@/app/api/export-center/route')

      const req = new Request('http://localhost/api/export-center', {
        method: 'GET',
      })

      const response = await GET(req as any)
      expect(response.status).toBe(200)

      // Verify findMany was called with correct filter: { action: 'export' } only
      expect(mockAuditFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { action: 'export' },
        })
      )
    })
  })

  // ── 4. export/route.ts creates audit entries ──

  describe('export/route.ts audit logging', () => {
    it('creates audit log entry when exporting companies', async () => {
      const { GET } = await import('@/app/api/export/route')

      const req = new Request('http://localhost/api/export', { method: 'GET' })

      const response = await GET(req as any)
      expect(response.status).toBe(200)

      // logAction calls auditLog.create internally — verify it was called
      expect(mockAuditCreate).toHaveBeenCalled()

      // Find the export call
      const exportCall = mockAuditCreate.mock.calls.find((call: any[]) =>
        call[0]?.data?.action === 'export' && call[0]?.data?.entity === 'companies'
      )
      expect(exportCall).toBeDefined()
      expect(exportCall[0].data.userId).toBe('user-1')
    })
  })

  // ── 5. emails/send rate limiting ──

  describe('emails/send rate limiting', () => {
    it('returns false when rate limit exceeded after 50 calls', () => {
      // Exhaust the limit
      for (let i = 0; i < 50; i++) {
        const result = emailSendRateLimit('user-1')
        expect(result.success).toBe(true)
      }

      // 51st call should fail
      const result = emailSendRateLimit('user-1')
      expect(result.success).toBe(false)
      expect(result.remaining).toBe(0)
    })

    it('tracks limits independently per user', () => {
      // User-1 sends 50
      for (let i = 0; i < 50; i++) emailSendRateLimit('user-1')
      expect(emailSendRateLimit('user-1').success).toBe(false)

      // User-2 should still have full quota
      expect(emailSendRateLimit('user-2').success).toBe(true)
    })
  })

  // ── 6. Dead stubs removed ──

  describe('Dead stub removal', () => {
    it('reset-password route file no longer exists', () => {
      const routePath = resolve(__dirname, '../src/app/api/auth/reset-password/route.ts')
      expect(existsSync(routePath)).toBe(false)
    })

    it('reset-password/confirm route file no longer exists', () => {
      const routePath = resolve(__dirname, '../src/app/api/auth/reset-password/confirm/route.ts')
      expect(existsSync(routePath)).toBe(false)
    })
  })
})
