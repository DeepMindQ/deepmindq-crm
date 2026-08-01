/**
 * Phase 2 — Admin Route Security Tests
 *
 * Tests that admin routes enforce authentication + admin role:
 * - No cookie → 401
 * - Valid non-admin → 403
 * - Valid admin → success
 *
 * These tests verify the actual route handlers, not just the auth primitives.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '@/app/api/admin/ai-usage/route'
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

// ── Mock dependencies ─────────────────────────────────────
const mockGetDailyCostStatus = vi.fn()
vi.mock('@/lib/intelligence-sources/ai-cost-governance', () => ({
  getDailyCostStatus: (...args: unknown[]) => mockGetDailyCostStatus(...args),
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

const REGULAR_SESSION: SessionUser = {
  id: 'user-001',
  email: 'user@company.com',
  name: 'Sales Rep',
  phone: null,
  company: 'Acme',
  designation: 'Sales Rep',
  role: 'sales_rep',
  hasPassword: true,
  avatarUrl: null,
}

const MOCK_COST_STATUS = {
  dailyCost: 12.50,
  dailyLimit: 50.00,
  usagePercent: 25,
  status: 'healthy',
}

describe('GET /api/admin/ai-usage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 401 when no session cookie is present', async () => {
    // Mock getCurrentSession to return null (no cookie)
    const { checkApiAuth } = await import('@/lib/api-auth')
    vi.spyOn(await import('@/lib/session'), 'getCurrentSession')
      .mockResolvedValue(null)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(401)
    expect(body.success).toBe(false)
    expect(body.error).toContain('Authentication required')
  })

  it('returns 403 when authenticated user is not admin', async () => {
    // Mock getCurrentSession to return regular user
    vi.spyOn(await import('@/lib/session'), 'getCurrentSession')
      .mockResolvedValue(REGULAR_SESSION)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(403)
    expect(body.success).toBe(false)
    expect(body.error).toContain('Admin access required')
  })

  it('returns 403 for manager role', async () => {
    const managerSession: SessionUser = { ...REGULAR_SESSION, role: 'manager' }
    vi.spyOn(await import('@/lib/session'), 'getCurrentSession')
      .mockResolvedValue(managerSession)

    const response = await GET()
    expect(response.status).toBe(403)
  })

  it('returns success data when admin is authenticated', async () => {
    // Mock getCurrentSession to return admin user
    vi.spyOn(await import('@/lib/session'), 'getCurrentSession')
      .mockResolvedValue(ADMIN_SESSION)

    // Mock the business logic
    mockGetDailyCostStatus.mockResolvedValue(MOCK_COST_STATUS)

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ok).toBe(true)
    expect(body.dailyCost).toBe(12.50)
    expect(body.status).toBe('healthy')
  })

  it('returns 500 when business logic throws', async () => {
    vi.spyOn(await import('@/lib/session'), 'getCurrentSession')
      .mockResolvedValue(ADMIN_SESSION)

    mockGetDailyCostStatus.mockRejectedValue(new Error('DB down'))

    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.ok).toBe(false)
  })
})
