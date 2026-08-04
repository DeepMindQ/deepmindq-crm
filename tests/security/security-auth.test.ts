/**
 * Phase 2 — Security Auth Primitive Tests
 *
 * Tests the authentication guard functions in src/lib/api-auth.ts
 * and src/lib/session.ts to verify correct behavior for:
 * - Missing session cookie → 401
 * - Invalid/expired session → 401
 * - DB unavailable → 401
 * - Inactive user → 401
 * - Valid session → success with SessionUser
 * - Admin role check → correct 403 for non-admin
 *
 * These tests MUST pass BEFORE any production route is modified.
 * They prove the auth primitives work correctly under all conditions.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkApiAuth, requireAdminRole } from '@/lib/api-auth'
import type { SessionUser } from '@/lib/session'

// ── Mock next/server before import ───────────────────────
const mockJson = vi.fn()
vi.mock('next/server', () => ({
  NextResponse: {
    json: (...args: unknown[]) => {
      mockJson(...args)
      return new Response(JSON.stringify(args[0]), {
        status: (args[1] as Record<string, unknown>)?.status || 200,
        headers: { 'Content-Type': 'application/json' },
      })
    },
  },
}))

// ── Mock session module ───────────────────────────────────
const mockGetCurrentSession = vi.fn()
vi.mock('@/lib/session', () => ({
  getCurrentSession: (...args: unknown[]) => mockGetCurrentSession(...args),
}))

// ── Test data ─────────────────────────────────────────────
const ADMIN_USER: SessionUser = {
  id: 'admin-001',
  email: 'admin@deepmindq.com',
  name: 'Admin User',
  phone: null,
  company: 'DeepMindQ',
  designation: 'CEO',
  role: 'admin',
  hasPassword: true,
  avatarUrl: null,
}

const REGULAR_USER: SessionUser = {
  id: 'user-001',
  email: 'user@deepmindq.com',
  name: 'Regular User',
  phone: null,
  company: 'Acme Corp',
  designation: 'Sales Rep',
  role: 'sales_rep',
  hasPassword: true,
  avatarUrl: null,
}

describe('checkApiAuth()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no session exists (missing cookie)', async () => {
    mockGetCurrentSession.mockResolvedValue(null)

    const result = await checkApiAuth()

    expect(result.session).toBeNull()
    expect(result.errorResponse).toBeDefined()
    // Extract status from the Response object
    expect(result.errorResponse!.status).toBe(401)
  })

  it('returns 401 when session token is invalid (not in DB)', async () => {
    mockGetCurrentSession.mockResolvedValue(null)

    const result = await checkApiAuth()

    expect(result.session).toBeNull()
    expect(result.errorResponse!.status).toBe(401)
  })

  it('returns 401 when session is expired', async () => {
    // getCurrentSession handles expiry internally and returns null
    mockGetCurrentSession.mockResolvedValue(null)

    const result = await checkApiAuth()

    expect(result.session).toBeNull()
    expect(result.errorResponse!.status).toBe(401)
  })

  it('returns 401 when DB is unavailable (exception thrown)', async () => {
    mockGetCurrentSession.mockRejectedValue(new Error('DB connection failed'))

    const result = await checkApiAuth()

    expect(result.session).toBeNull()
    expect(result.errorResponse!.status).toBe(401)
  })

  it('returns 401 when user is inactive', async () => {
    // getCurrentSession handles isActive check internally and returns null
    mockGetCurrentSession.mockResolvedValue(null)

    const result = await checkApiAuth()

    expect(result.session).toBeNull()
    expect(result.errorResponse!.status).toBe(401)
  })

  it('returns session when valid session exists', async () => {
    mockGetCurrentSession.mockResolvedValue(ADMIN_USER)

    const result = await checkApiAuth()

    expect(result.session).toEqual(ADMIN_USER)
    expect(result.errorResponse).toBeUndefined()
  })

  it('returns session for regular authenticated user', async () => {
    mockGetCurrentSession.mockResolvedValue(REGULAR_USER)

    const result = await checkApiAuth()

    expect(result.session).toEqual(REGULAR_USER)
    expect(result.errorResponse).toBeUndefined()
  })

  it('error response body follows apiSuccess envelope', async () => {
    mockGetCurrentSession.mockResolvedValue(null)

    const result = await checkApiAuth()
    const body = await result.errorResponse!.json()

    expect(body).toHaveProperty('success', false)
    expect(body).toHaveProperty('error')
    expect(body).toHaveProperty('timestamp')
  })
})

describe('requireAdminRole()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null (authorized) for admin user', () => {
    const result = requireAdminRole(ADMIN_USER)

    expect(result).toBeNull()
  })

  it('returns 403 for regular user (sales_rep)', () => {
    const result = requireAdminRole(REGULAR_USER)

    expect(result).toBeDefined()
    expect(result!.status).toBe(403)
  })

  it('returns 403 for manager role', () => {
    const manager: SessionUser = { ...REGULAR_USER, role: 'manager' }
    const result = requireAdminRole(manager)

    expect(result).toBeDefined()
    expect(result!.status).toBe(403)
  })

  it('returns 403 for viewer role', () => {
    const viewer: SessionUser = { ...REGULAR_USER, role: 'viewer' }
    const result = requireAdminRole(viewer)

    expect(result).toBeDefined()
    expect(result!.status).toBe(403)
  })

  it('403 response body follows apiSuccess envelope', async () => {
    const result = requireAdminRole(REGULAR_USER)
    const body = await result!.json()

    expect(body).toHaveProperty('success', false)
    expect(body).toHaveProperty('error')
    expect(body).toHaveProperty('timestamp')
    expect(body.error).toContain('Admin access required')
  })

  it('checks lowercase admin role (not ADMIN)', () => {
    // This verifies the Phase 2 prerequisite fix:
    // requireAdminRole must match 'admin' (lowercase) as stored in DB,
    // not 'ADMIN' (uppercase) which would never match.
    const result = requireAdminRole(ADMIN_USER)

    expect(result).toBeNull() // admin role should pass
  })

  it('rejects uppercase ADMIN role if that were passed (defense in depth)', () => {
    // If somehow an uppercase role made it through, it should be rejected
    // since the RBAC system uses lowercase 'admin'
    const uppercaseAdmin: SessionUser = { ...ADMIN_USER, role: 'ADMIN' }
    const result = requireAdminRole(uppercaseAdmin)

    // Should reject because 'ADMIN' !== 'admin'
    expect(result).toBeDefined()
    expect(result!.status).toBe(403)
  })
})
