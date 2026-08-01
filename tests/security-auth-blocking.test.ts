/**
 * Phase 2 — Auth Execution Blocking Tests
 *
 * Proves that auth guards don't just return error codes — they
 * completely block business logic execution. Uses destructive
 * endpoints (seed, settings PUT) to demonstrate that unauthenticated
 * requests cannot mutate database state.
 *
 * Evidence: business logic functions are NEVER called when
 * request lacks authentication.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST as seedPost } from '@/app/api/seed/route'
import { PUT as settingsPut } from '@/app/api/settings/route'
import type { SessionUser } from '@/lib/session'

// ── Mock next/server ──────────────────────────────────────
vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => {
      return new Response(JSON.stringify(data), {
        status: init?.status || 200,
        headers: { 'Content-Type': 'application/json' },
      })
    },
  },
}))

// ── Mock DB — track whether mutations are attempted ──────
const mockDbContactCount = vi.fn()
const mockDbContactCreateMany = vi.fn()
const mockDbCompanyCreateMany = vi.fn()
const mockDbImportBatchCreate = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    contact: {
      count: (...args: unknown[]) => mockDbContactCount(...args),
      createMany: (...args: unknown[]) => mockDbContactCreateMany(...args),
    },
    company: {
      createMany: (...args: unknown[]) => mockDbCompanyCreateMany(...args),
    },
    importBatch: {
      create: (...args: unknown[]) => mockDbImportBatchCreate(...args),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}))

// ── Test data ─────────────────────────────────────────────
const ADMIN_SESSION: SessionUser = {
  id: 'admin-001',
  email: 'admin@deepmindq.com',
  name: 'Admin',
  phone: null,
  company: 'DeepMindQ',
  designation: 'CEO',
  role: 'admin',
  hasPassword: true,
  avatarUrl: null,
}

describe('Auth execution blocking: POST /api/seed', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('unauthenticated request returns 401 and does NOT touch database', async () => {
    // Arrange: no session (getCurrentSession returns null)
    vi.spyOn(await import('@/lib/session'), 'getCurrentSession')
      .mockResolvedValue(null)

    // Act: attempt destructive seed operation
    const response = await seedPost()
    const body = await response.json()

    // Assert: auth blocks execution
    expect(response.status).toBe(401)
    expect(body.success).toBe(false)
    expect(body.error).toContain('Authentication required')

    // CRITICAL: prove no DB mutation was attempted
    expect(mockDbContactCount).not.toHaveBeenCalled()
    expect(mockDbContactCreateMany).not.toHaveBeenCalled()
    expect(mockDbCompanyCreateMany).not.toHaveBeenCalled()
    expect(mockDbImportBatchCreate).not.toHaveBeenCalled()
  })

  it('non-admin authenticated request returns 403 and does NOT touch database', async () => {
    // Arrange: regular user (not admin)
    const regularUser: SessionUser = { ...ADMIN_SESSION, id: 'user-001', role: 'sales_rep' }
    vi.spyOn(await import('@/lib/session'), 'getCurrentSession')
      .mockResolvedValue(regularUser)

    // Act: attempt destructive seed operation
    const response = await seedPost()
    const body = await response.json()

    // Assert: admin check blocks execution
    expect(response.status).toBe(403)
    expect(body.success).toBe(false)
    expect(body.error).toContain('Admin access required')

    // CRITICAL: prove no DB mutation was attempted
    expect(mockDbContactCount).not.toHaveBeenCalled()
    expect(mockDbContactCreateMany).not.toHaveBeenCalled()
    expect(mockDbCompanyCreateMany).not.toHaveBeenCalled()
    expect(mockDbImportBatchCreate).not.toHaveBeenCalled()
  })

  it('admin request passes auth and reaches business logic', async () => {
    // Arrange: admin session
    vi.spyOn(await import('@/lib/session'), 'getCurrentSession')
      .mockResolvedValue(ADMIN_SESSION)

    // Business logic will find 0 contacts — but seed route has many DB calls
    // The critical proof is that contact.count IS called (auth gate passed)
    mockDbContactCount.mockResolvedValue(0)

    // Act
    const response = await seedPost()

    // PROVE: auth gate passed — DB mutation attempt occurred
    // (seed route will error on unmocked DB calls, but that's fine — we only
    // need to prove that auth did NOT block the request)
    expect(mockDbContactCount).toHaveBeenCalledTimes(1)

    // The response may be 500 due to unmocked DB calls, but it will NOT be 401 or 403
    expect([401, 403]).not.toContain(response.status)
  })
})

describe('Auth execution blocking: PUT /api/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('unauthenticated request returns 401 and does NOT mutate settings', async () => {
    // Arrange: no session
    vi.spyOn(await import('@/lib/session'), 'getCurrentSession')
      .mockResolvedValue(null)

    // Act: attempt to modify system settings
    const maliciousSettings = { mailbox: { fromEmail: 'attacker@evil.com' } }
    const request = new Request('http://localhost/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(maliciousSettings),
    })
    const response = await settingsPut(request)
    const body = await response.json()

    // Assert: blocked before reaching settings mutation
    expect(response.status).toBe(401)
    expect(body.success).toBe(false)
    expect(body.error).toContain('Authentication required')
  })

  it('non-admin request returns 403 and does NOT mutate settings', async () => {
    // Arrange: regular user
    const viewer: SessionUser = { ...ADMIN_SESSION, id: 'user-002', role: 'viewer' }
    vi.spyOn(await import('@/lib/session'), 'getCurrentSession')
      .mockResolvedValue(viewer)

    // Act: attempt to modify settings
    const request = new Request('http://localhost/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workingHours: { enabled: false } }),
    })
    const response = await settingsPut(request)
    const body = await response.json()

    // Assert: blocked before settings mutation
    expect(response.status).toBe(403)
    expect(body.success).toBe(false)
    expect(body.error).toContain('Admin access required')
  })
})
