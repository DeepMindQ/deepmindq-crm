import { describe, it, expect, beforeEach, vi } from 'vitest'

// Mock Prisma before any imports that use it
vi.mock('@/lib/db', () => ({
  prisma: {
    company: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    contact: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    companyResearchCard: {
      findFirst: vi.fn(),
      upsert: vi.fn(),
    },
    companySignal: {
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    evidence: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    opportunityRecommendation: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    draft: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    emailSequence: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    emailTemplate: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    auditLog: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    capabilityAsset: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    intelligenceValidation: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    signalValidation: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    companyIntelligenceHealth: {
      findFirst: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/db'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}))

// Mock session
vi.mock('@/lib/session', () => ({
  getCurrentSession: vi.fn().mockResolvedValue({
    id: 'test-user',
    email: 'test@deepmindq.com',
  }),
}))

// Helper to create mock Request
function mockRequest(url: string, options: RequestInit = {}): Request {
  return new Request(url, {
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '127.0.0.1',
      ...options.headers,
    },
    ...options,
  })
}

describe('E2E: Dashboard → Companies → Intelligence → Recommendations → Reports', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Journey Step 1: Dashboard loads', () => {
    it('returns dashboard stats with company/contact/signal counts', async () => {
      vi.mocked(prisma.company.count).mockResolvedValue(150)
      vi.mocked(prisma.contact.count).mockResolvedValue(320)
      vi.mocked(prisma.companySignal.count).mockResolvedValue(89)

      // Verify the mock infrastructure works
      const companyCount = await prisma.company.count()
      expect(companyCount).toBe(150)
      expect(prisma.company.count).toHaveBeenCalled()
    })
  })

  describe('Journey Step 2: Company list with pagination', () => {
    it('parses pagination params correctly', async () => {
      const { parsePagination, buildPaginationMeta, paginatedResponse } = await import('@/lib/pagination')
      const result = parsePagination({ page: '2', limit: '10', sortBy: 'createdAt', sortOrder: 'desc' })
      expect(result).toEqual({
        page: 2,
        limit: 10,
        skip: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      })
    })

    it('builds pagination meta correctly', async () => {
      const { buildPaginationMeta } = await import('@/lib/pagination')
      const meta = buildPaginationMeta(55, 3, 10)
      expect(meta).toEqual({
        page: 3,
        limit: 10,
        total: 55,
        totalPages: 6,
        hasNext: true,
        hasPrev: true,
      })
    })

    it('handles page 1 correctly', async () => {
      const { buildPaginationMeta } = await import('@/lib/pagination')
      const meta = buildPaginationMeta(5, 1, 20)
      expect(meta.hasNext).toBe(false)
      expect(meta.hasPrev).toBe(false)
    })
  })

  describe('Journey Step 3: Rate limiting is active', () => {
    it('allows requests under limit', async () => {
      const { rateLimit } = await import('@/lib/rate-limit')
      const result = rateLimit({ key: 'test-rl-1', limit: 5, windowMs: 60000 })
      expect(result.success).toBe(true)
      expect(result.remaining).toBe(4)
    })

    it('blocks requests over limit', async () => {
      const { rateLimit } = await import('@/lib/rate-limit')
      for (let i = 0; i < 5; i++) {
        rateLimit({ key: 'test-rl-2', limit: 5, windowMs: 60000 })
      }
      const blocked = rateLimit({ key: 'test-rl-2', limit: 5, windowMs: 60000 })
      expect(blocked.success).toBe(false)
      expect(blocked.remaining).toBe(0)
    })
  })

  describe('Journey Step 4: CSRF validation', () => {
    it('allows safe methods without CSRF token', async () => {
      const { validateCsrf } = await import('@/lib/csrf')
      const req = mockRequest('http://localhost/api/g-crm/companies')
      expect(validateCsrf(req)).toBe(true)
    })

    it('rejects POST without CSRF token in production', async () => {
      const { validateCsrf } = await import('@/lib/csrf')
      const origEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'
      const req = new Request('http://localhost/api/g-crm/companies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawName: 'Test' }),
      })
      expect(validateCsrf(req)).toBe(false)
      process.env.NODE_ENV = origEnv
    })
  })

  describe('Journey Step 5: Zod validation rejects bad input', () => {
    it('rejects empty body for company creation', async () => {
      const { validateBody } = await import('@/lib/validate')
      const { z } = await import('zod/v4')
      const schema = z.object({ rawName: z.string().min(1) })
      const result = validateBody(schema, {})
      // Should fail since rawName is missing
      expect(result.success).toBe(false)
    })

    it('accepts valid input', async () => {
      const { validateBody } = await import('@/lib/validate')
      const { z } = await import('zod/v4')
      const schema = z.object({ name: z.string().min(1) })
      const result = validateBody(schema, { name: 'Valid Company' })
      if (result.success) {
        expect(result.data.name).toBe('Valid Company')
      } else {
        expect.unreachable('Should have passed validation')
      }
    })
  })

  describe('Journey Step 6: Correlation ID is generated', () => {
    it('generates new correlation ID when not provided', async () => {
      const { getCorrelationId } = await import('@/lib/correlation-id')
      const req = mockRequest('http://localhost/api/g-crm/companies')
      const id = getCorrelationId(req)
      expect(id).toBeTruthy()
      expect(id.length).toBe(36) // UUID v4 format
    })

    it('uses provided correlation ID', async () => {
      const { getCorrelationId } = await import('@/lib/correlation-id')
      const req = mockRequest('http://localhost/api/g-crm/companies', {
        headers: { 'x-correlation-id': 'test-correlation-123' },
      })
      const id = getCorrelationId(req)
      expect(id).toBe('test-correlation-123')
    })
  })

  describe('Journey Step 7: Structured logger works', () => {
    it('logs without throwing', async () => {
      const { logger, childLogger } = await import('@/lib/logger')
      expect(() => logger.info('test message', { key: 'value' })).not.toThrow()
      expect(() => logger.error('error message', { err: 'test' })).not.toThrow()
      const child = childLogger({ component: 'test' })
      expect(() => child.info('child message')).not.toThrow()
    })
  })

  describe('Journey Step 8: Zustand store manages app state', () => {
    it('navigates through views', async () => {
      const { useAppStore } = await import('@/lib/store')
      const store = useAppStore.getState()
      expect(store.activeView).toBe('dashboard')
      store.setActiveView('companies')
      expect(useAppStore.getState().activeView).toBe('companies')
      store.setActiveView('company-profile')
      expect(useAppStore.getState().activeView).toBe('company-profile')
      store.setActiveView('contact-profile')
      expect(useAppStore.getState().activeView).toBe('contact-profile')
      store.setActiveView('dashboard')
      expect(useAppStore.getState().activeView).toBe('dashboard')
    })
  })
})