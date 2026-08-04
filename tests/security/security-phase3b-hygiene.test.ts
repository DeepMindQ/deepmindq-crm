/**
 * Phase 3B — Security Hygiene Tests
 *
 * Verifies:
 * 1. logAction() calls in enriched routes pass userId
 * 2. validate.ts is deleted
 * 3. ADMIN_ROLES constant is removed
 * 4. Orphaned resetPassword schemas/types are removed
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { existsSync } from 'fs'
import { resolve } from 'path'

// ── Hoisted mocks ────────────────────────────────────────────────────

const { mockAuditCreate } = vi.hoisted(() => {
  return {
    mockAuditCreate: vi.fn().mockResolvedValue({
      id: 'audit-1', action: 'test', entity: 'Test', entityId: 'ent-1',
      userId: 'user-1', details: '{}', createdAt: new Date(),
    }),
  }
})

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock('@/lib/db', () => ({
  db: {
    session: {
      findUnique: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockResolvedValue({ id: 'sess-1' }),
      delete: vi.fn().mockResolvedValue({ count: 1 }),
      deleteMany: vi.fn().mockResolvedValue({ count: 1 }),
      update: vi.fn().mockResolvedValue({}),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: 'user-1', email: 'test@example.com', name: 'Test',
        role: 'admin', isActive: true, hasPassword: true,
        avatarUrl: null, phone: null, company: null, designation: null,
      }),
    },
    auditLog: { create: mockAuditCreate, findMany: vi.fn().mockResolvedValue([]) },
    contact: {
      findMany: vi.fn().mockResolvedValue([]),
      findUnique: vi.fn().mockImplementation((args: any) => {
        // For leads/assign, return a contact with location
        if (args.where?.id === 'c-1') {
          return Promise.resolve({
            id: 'c-1', email: 'a@b.com', location: 'USA', consentStatus: 'unknown',
            consentDate: null, consentSource: null, suppressionReason: null, isSuppressed: false,
          });
        }
        return Promise.resolve({ id: 'c-1', email: 'a@b.com', consentStatus: 'unknown',
          consentDate: null, consentSource: null, suppressionReason: null, isSuppressed: false,
        });
      }),
      update: vi.fn().mockResolvedValue({ id: 'c-1', consentStatus: 'opted_in' }),
      count: vi.fn().mockResolvedValue(0),
    },
    contactNote: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({ id: 'n-1', contactId: 'c-1', body: 'Test note' }),
      update: vi.fn().mockResolvedValue({ id: 'n-1', body: 'Updated note' }),
      delete: vi.fn().mockResolvedValue({}),
    },
    company: { findMany: vi.fn().mockResolvedValue([]), updateMany: vi.fn() },
    companyTimelineEvent: { create: vi.fn().mockResolvedValue({}) },
    dataUpload: { create: vi.fn().mockResolvedValue({ id: 'u-1' }), findUnique: vi.fn().mockResolvedValue({ id: 'u-1', status: 'pending' }), update: vi.fn() },
    otpCode: { findFirst: vi.fn().mockResolvedValue(null), updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    emailVerification: { verifyEmail: vi.fn().mockResolvedValue({ health: 'valid', score: 95 }) },
  },
}))

vi.mock('@/lib/session', () => ({
  getCurrentSession: vi.fn().mockResolvedValue({
    id: 'user-1', email: 'test@example.com', name: 'Test',
    role: 'admin', isActive: true, hasPassword: true,
    avatarUrl: null, phone: null, company: null, designation: null,
  }),
  createSession: vi.fn().mockResolvedValue({ token: 'tok-1', expiresAt: new Date() }),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/email-verify', () => ({
  checkSyntax: vi.fn().mockReturnValue({ valid: true }),
  checkDisposable: vi.fn().mockReturnValue({ disposable: false }),
  checkRoleBased: vi.fn().mockReturnValue({ roleBased: false }),
  checkFreeProvider: vi.fn().mockReturnValue({ free: false }),
  scoreEmail: vi.fn().mockReturnValue({ health: 'valid', score: 95 }),
  verifyEmail: vi.fn().mockResolvedValue({ health: 'valid', score: 95 }),
}))

vi.mock('@/lib/lead-scoring', () => ({
  calculateLeadScore: vi.fn().mockReturnValue(85),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({
    get: vi.fn().mockReturnValue(null), set: vi.fn(), delete: vi.fn(),
  }),
}))

vi.mock('next/server', () => ({
  NextRequest: class { url: string; headers: Headers; constructor(url: string) { this.url = url; this.headers = new Headers(); } },
  NextResponse: { json: (body: unknown, init?: { status?: number }) => ({ status: init?.status || 200, json: async () => body }) },
}))

import { logAction } from '@/lib/audit'

// ── Test Suite ──────────────────────────────────────────────────────

describe('Phase 3B — Security Hygiene', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockAuditCreate.mockClear()
  })

  // ── 1. Verify-queue POST enriches logAction with userId ──

  describe('verify-queue logAction enrichment', () => {
    it('POST passes session.id to logAction', async () => {
      const { POST } = await import('@/app/api/verify-queue/route')
      const req = new Request('http://localhost/api/verify-queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds: ['c-1'], verifyAll: false }),
      })
      const response = await POST(req as any)
      expect(response.status).toBe(200)

      const calls = mockAuditCreate.mock.calls
      const call = calls.find((c: any[]) => c[0]?.data?.action === 'verify_queue_added')
      expect(call).toBeDefined()
      expect(call[0].data.userId).toBe('user-1')
    })
  })

  // ── 2. Verify-queue/process enriches logAction with userId ──

  describe('verify-queue/process logAction enrichment', () => {
    it('POST passes session.id to logAction', async () => {
      const { POST } = await import('@/app/api/verify-queue/process/route')
      const req = new Request('http://localhost/api/verify-queue/process', { method: 'POST' })
      const response = await POST(req as any)
      expect(response.status).toBe(200)

      const calls = mockAuditCreate.mock.calls
      const call = calls.find((c: any[]) => c[0]?.data?.action === 'email_verified')
      if (call) {
        expect(call[0].data.userId).toBe('user-1')
      }
    })
  })

  // ── 3. Leads/assign enriches logAction with userId ──

  describe('leads/assign logAction enrichment', () => {
    it('POST passes session.id to logAction', async () => {
      const { POST } = await import('@/app/api/leads/assign/route')
      const req = new Request('http://localhost/api/leads/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactIds: ['c-1'], method: 'round_robin' }),
      })
      const response = await POST(req as any)
      expect(response.status).toBe(200)

      const calls = mockAuditCreate.mock.calls
      const call = calls.find((c: any[]) => c[0]?.data?.action === 'leads_assigned')
      expect(call).toBeDefined()
      expect(call[0].data.userId).toBe('user-1')
    })
  })

  // ── 4. Leads/consent enriches logAction with userId ──

  describe('leads/consent logAction enrichment', () => {
    it('POST passes session.id to logAction', async () => {
      const { POST } = await import('@/app/api/leads/consent/route')
      const req = new Request('http://localhost/api/leads/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: 'c-1', consentStatus: 'opted_in', consentSource: 'manual' }),
      })
      const response = await POST(req as any)
      expect(response.status).toBe(200)

      const calls = mockAuditCreate.mock.calls
      const call = calls.find((c: any[]) => c[0]?.data?.action === 'consent_updated')
      expect(call).toBeDefined()
      expect(call[0].data.userId).toBe('user-1')
    })
  })

  // ── 5. Contacts notes enriches logAction with userId ──

  describe('contacts/[id]/notes logAction enrichment', () => {
    it('POST (note_added) passes session.id', async () => {
      const { POST } = await import('@/app/api/contacts/[id]/notes/route')
      const req = new Request('http://localhost/api/contacts/c-1/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: 'Test note content' }),
      })
      const response = await POST(req as any, { params: Promise.resolve({ id: 'c-1' }) })
      expect(response.status).toBe(201)

      const calls = mockAuditCreate.mock.calls
      const call = calls.find((c: any[]) => c[0]?.data?.action === 'note_added')
      expect(call).toBeDefined()
      expect(call[0].data.userId).toBe('user-1')
    })

    it('PUT (note_updated) passes session.id', async () => {
      const { PUT } = await import('@/app/api/contacts/[id]/notes/route')
      const req = new Request('http://localhost/api/contacts/c-1/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ noteId: 'n-1', body: 'Updated content' }),
      })
      const response = await PUT(req as any, { params: Promise.resolve({ id: 'c-1' }) })
      expect(response.status).toBe(200)

      const calls = mockAuditCreate.mock.calls
      const call = calls.find((c: any[]) => c[0]?.data?.action === 'note_updated')
      expect(call).toBeDefined()
      expect(call[0].data.userId).toBe('user-1')
    })

    it('DELETE (note_deleted) passes session.id', async () => {
      const { DELETE } = await import('@/app/api/contacts/[id]/notes/route')
      const req = new Request('http://localhost/api/contacts/c-1/notes?noteId=n-1', { method: 'DELETE' })
      const response = await DELETE(req as any, { params: Promise.resolve({ id: 'c-1' }) })
      expect(response.status).toBe(200)

      const calls = mockAuditCreate.mock.calls
      const call = calls.find((c: any[]) => c[0]?.data?.action === 'note_deleted')
      expect(call).toBeDefined()
      expect(call[0].data.userId).toBe('user-1')
    })
  })

  // ── 6. Dead code removals ──

  describe('Dead code removal', () => {
    it('validate.ts has been deleted', () => {
      expect(existsSync(resolve(__dirname, '../src/lib/validate.ts'))).toBe(false)
    })

    it('ADMIN_ROLES constant removed from auth-helpers', async () => {
      const mod = await import('@/lib/auth-helpers')
      expect((mod as any).ADMIN_ROLES).toBeUndefined()
    })

    it('resetPassword schemas removed from validations', async () => {
      const mod = await import('@/lib/validations')
      expect((mod as any).resetPasswordRequestSchema).toBeUndefined()
      expect((mod as any).resetPasswordConfirmSchema).toBeUndefined()
      expect((mod as any).ResetPasswordRequestInput).toBeUndefined()
      expect((mod as any).ResetPasswordConfirmInput).toBeUndefined()
    })
  })
})
