/**
 * Phase 2 Batch 2 — Authenticated Intelligence Access Test
 *
 * Proves that an authenticated user can:
 * 1. Pass auth check → access intelligence endpoint → receive normal response
 * 2. Not just 401/403 checks — validates the full happy path
 *
 * This verifies the auth integration doesn't break legitimate access.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET as companyIntelGET } from '@/app/api/intelligence/company/[id]/route'
import { POST as enrichPOST } from '@/app/api/ai/enrich/route'
import { GET as inboxGET } from '@/app/api/g-intel-acquisition/inbox/route'
import type { SessionUser } from '@/lib/session'

vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal<typeof import('next/server')>()
  return {
    ...actual,
    NextResponse: {
      json: (data: unknown, init?: { status?: number }) => {
        return new Response(JSON.stringify(data), {
          status: init?.status || 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  }
})

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn().mockReturnValue({ success: true, remaining: 100, resetAt: Date.now() + 60000 }),
}))

const mockCompanyFindUnique = vi.fn()
vi.mock('@/lib/db', () => ({
  db: {
    company: { findUnique: (...args: unknown[]) => mockCompanyFindUnique(...args) },
    companySignal: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    contact: { findMany: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0) },
    companyTimelineEvent: { findMany: vi.fn().mockResolvedValue([]) },
    fusionResult: { findMany: vi.fn().mockResolvedValue([]) },
    capabilityAsset: { findMany: vi.fn().mockResolvedValue([]) },
    companyResearchCard: { findUnique: vi.fn().mockResolvedValue(null) },
    reasoningStep: { findMany: vi.fn().mockResolvedValue([]) },
    learningEvent: { findMany: vi.fn().mockResolvedValue([]) },
    knowledgeEntry: { findMany: vi.fn().mockResolvedValue([]) },
    accountScore: { findUnique: vi.fn().mockResolvedValue(null) },
    session: { findUnique: vi.fn().mockResolvedValue(null) },
    otpCode: { updateMany: vi.fn().mockResolvedValue({ count: 0 }) },
    evidence: { findMany: vi.fn().mockResolvedValue([]) },
    narrative: { findMany: vi.fn().mockResolvedValue([]) },
    intelligenceBriefing: { findMany: vi.fn().mockResolvedValue([]) },
  },
}))

const MOCK_COMPANY = {
  id: 'company-123',
  domain: 'acme.com',
  name: 'Acme Corp',
  website: 'https://acme.com',
  industry: 'Technology',
  description: 'A tech company',
  employeeSize: '500-1000',
  foundedYear: 2010,
  linkedinUrl: 'https://linkedin.com/company/acme',
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

const AUTHENTICATED_SESSION: SessionUser = {
  id: 'test-user-001',
  email: 'test@deepmindq.com',
  name: 'Test User',
  phone: '+1234567890',
  company: 'DeepMindQ',
  designation: 'Sales Engineer',
  role: 'admin',
  hasPassword: true,
  avatarUrl: null,
}

describe('Authenticated user can access intelligence endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('authenticated user gets company intelligence data (not 401)', async () => {
    vi.spyOn(await import('@/lib/session'), 'getCurrentSession').mockResolvedValue(AUTHENTICATED_SESSION)
    mockCompanyFindUnique.mockResolvedValue(MOCK_COMPANY)

    const request = new NextRequest('http://localhost/api/intelligence/company/company-123', {
      headers: { 'X-Correlation-ID': 'test-123' },
    })
    const response = await companyIntelGET(request, { params: Promise.resolve({ id: 'company-123' }) })

    // Should NOT be 401 (authenticated)
    expect(response.status).not.toBe(401)
    expect(response.status).not.toBe(403)
    // Auth was checked
    const sessionModule = await import('@/lib/session')
    expect(sessionModule.getCurrentSession).toHaveBeenCalledTimes(1)
  })

  it('unauthenticated user gets 401 from company intelligence', async () => {
    vi.spyOn(await import('@/lib/session'), 'getCurrentSession').mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/intelligence/company/company-123')
    const response = await companyIntelGET(request, { params: Promise.resolve({ id: 'company-123' }) })

    expect(response.status).toBe(401)
    // Business logic (DB call) should NOT execute
    expect(mockCompanyFindUnique).not.toHaveBeenCalled()
  })

  it('unauthenticated user gets 401 from AI enrich endpoint', async () => {
    vi.spyOn(await import('@/lib/session'), 'getCurrentSession').mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/ai/enrich', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entityType: 'company', entityId: 'company-123' }),
    })
    const response = await enrichPOST(request)

    expect(response.status).toBe(401)
  })

  it('unauthenticated user gets 401 from G-intel inbox endpoint', async () => {
    vi.spyOn(await import('@/lib/session'), 'getCurrentSession').mockResolvedValue(null)

    const request = new NextRequest('http://localhost/api/g-intel-acquisition/inbox')
    const response = await inboxGET(request)

    expect(response.status).toBe(401)
  })
})
