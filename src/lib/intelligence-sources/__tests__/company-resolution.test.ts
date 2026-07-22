import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so mock fns are available inside the hoisted vi.mock factory
const {
  mockCompanyCreate,
  mockCompanyFindFirst,
  mockCompanyFindMany,
  mockCompanyFindUnique,
  mockCompanyAliasCreate,
  mockCompanyAliasFindFirst,
} = vi.hoisted(() => ({
  mockCompanyCreate: vi.fn(),
  mockCompanyFindFirst: vi.fn(),
  mockCompanyFindMany: vi.fn(),
  mockCompanyFindUnique: vi.fn(),
  mockCompanyAliasCreate: vi.fn(),
  mockCompanyAliasFindFirst: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    company: {
      findFirst: mockCompanyFindFirst,
      findMany: mockCompanyFindMany,
      create: mockCompanyCreate,
      findUnique: mockCompanyFindUnique,
    },
    companyAlias: {
      create: mockCompanyAliasCreate,
      findFirst: mockCompanyAliasFindFirst,
    },
  },
}))

import {
  resolveCompany,
  confirmResolution,
  createUnverifiedCompany,
} from '../company-resolution'

describe('Company Resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Default: no domain match, no aliases, no companies
    mockCompanyFindFirst.mockResolvedValue(null)
    mockCompanyAliasFindFirst.mockResolvedValue(null)
    mockCompanyFindMany.mockResolvedValue([])
  })

  // ─── Domain Match (95%) ────────────────────────────────────

  describe('domain match (95% confidence)', () => {
    it('auto-resolves when input domain matches an existing company domain', async () => {
      mockCompanyFindFirst.mockResolvedValue({
        id: 'co-1',
        rawName: 'Acme Corporation',
        domain: 'acme.com',
        industry: 'Technology',
        country: 'US',
      })

      const result = await resolveCompany('Acme Corp', 'acme.com')

      expect(result.resolved).toBe(true)
      expect(result.candidate).toBeDefined()
      expect(result.candidate!.confidence).toBe(0.95)
      expect(result.candidate!.matchType).toBe('domain_match')
      expect(result.candidate!.companyId).toBe('co-1')
      expect(result.needsNewCompany).toBe(false)
      expect(mockCompanyFindFirst).toHaveBeenCalledWith({
        where: { domain: 'acme.com' },
      })
    })

    it('is case-insensitive for domain matching', async () => {
      mockCompanyFindFirst.mockResolvedValue({
        id: 'co-2',
        rawName: 'Beta Inc',
        domain: 'beta.org',
        industry: null,
        country: null,
      })

      const result = await resolveCompany('Beta', 'BETA.ORG')

      expect(result.resolved).toBe(true)
      expect(result.candidate!.confidence).toBe(0.95)
    })

    it('does not match when no domain match is found', async () => {
      const result = await resolveCompany('Unknown Co', 'unknown.com')

      expect(result.candidate).toBeUndefined()
      expect(result.resolved).toBe(false)
    })
  })

  // ─── Exact Name Match (90%) ────────────────────────────────

  describe('exact name match (90% confidence)', () => {
    it('resolves when normalized names match exactly', async () => {
      mockCompanyFindMany.mockResolvedValue([
        {
          id: 'co-3',
          rawName: 'Acme Corporation',
          normalizedName: 'acme corporation',
          domain: 'acme.com',
          industry: 'Tech',
          country: 'US',
        },
      ])

      const result = await resolveCompany('Acme Corporation')

      expect(result.resolved).toBe(true)
      expect(result.candidate!.confidence).toBe(0.9)
      expect(result.candidate!.matchType).toBe('exact_name')
      expect(result.candidate!.companyId).toBe('co-3')
    })

    it('normalizes punctuation and whitespace for exact matching', async () => {
      mockCompanyFindMany.mockResolvedValue([
        {
          id: 'co-4',
          rawName: 'Acme Corp.',
          normalizedName: 'acme corp',
          domain: null,
          industry: null,
          country: null,
        },
      ])

      // Input has different punctuation/spacing but same normalized form
      const result = await resolveCompany('  ACME   CORP!  ')

      expect(result.resolved).toBe(true)
      expect(result.candidate!.confidence).toBe(0.9)
      expect(result.candidate!.matchType).toBe('exact_name')
    })
  })

  // ─── Alias Match (85%) ─────────────────────────────────────

  describe('alias match (85% confidence)', () => {
    it('resolves when input name matches a company alias', async () => {
      mockCompanyFindMany.mockResolvedValue([
        {
          id: 'co-5',
          rawName: 'International Business Machines',
          normalizedName: 'international business machines',
          domain: 'ibm.com',
          industry: 'Technology',
          country: 'US',
        },
      ])
      mockCompanyAliasFindFirst.mockResolvedValue({
        companyId: 'co-5',
        alias: 'IBM',
      })

      const result = await resolveCompany('IBM')

      expect(result.resolved).toBe(true)
      expect(result.candidate!.confidence).toBe(0.85)
      expect(result.candidate!.matchType).toBe('alias_match')
      expect(result.candidate!.companyId).toBe('co-5')
      expect(result.candidate!.name).toBe('International Business Machines')
    })
  })

  // ─── Partial Name Match (70-80%) ───────────────────────────

  describe('partial name match (70-80% confidence)', () => {
    it('returns candidates when partial word overlap exists', async () => {
      mockCompanyFindMany.mockResolvedValue([
        {
          id: 'co-6',
          rawName: 'Acme Technology Solutions',
          normalizedName: 'acme technology solutions',
          domain: null,
          industry: 'Tech',
          country: null,
        },
        {
          id: 'co-7',
          rawName: 'Acme Financial Corp',
          normalizedName: 'acme financial corp',
          domain: null,
          industry: 'Finance',
          country: null,
        },
      ])

      const result = await resolveCompany('Acme Corp')

      expect(result.resolved).toBe(false)
      expect(result.needsNewCompany).toBe(false)
      expect(result.candidates).toBeDefined()
      expect(result.candidates!.length).toBeGreaterThan(0)
      // All candidates should have confidence between 0.7 and 0.8
      for (const c of result.candidates!) {
        expect(c.confidence).toBeGreaterThanOrEqual(0.7)
        expect(c.confidence).toBeLessThanOrEqual(0.8)
        expect(c.matchType).toBe('partial_name')
      }
      // Should be sorted by confidence descending
      const confidences = result.candidates!.map(c => c.confidence)
      for (let i = 1; i < confidences.length; i++) {
        expect(confidences[i]).toBeLessThanOrEqual(confidences[i - 1]!)
      }
    })

    it('limits candidates to top 5', async () => {
      const companies = Array.from({ length: 10 }, (_, i) => ({
        id: `co-${i}`,
        rawName: `Acme Variant ${i} Corp`,
        normalizedName: `acme variant ${i} corp`,
        domain: null,
        industry: null,
        country: null,
      }))
      mockCompanyFindMany.mockResolvedValue(companies)

      const result = await resolveCompany('Acme Corp')

      expect(result.candidates!.length).toBeLessThanOrEqual(5)
    })
  })

  // ─── No Match ──────────────────────────────────────────────

  describe('no match (needsNewCompany)', () => {
    it('returns needsNewCompany=true when nothing matches', async () => {
      mockCompanyFindMany.mockResolvedValue([
        {
          id: 'co-8',
          rawName: 'Completely Different Company',
          normalizedName: 'completely different company',
          domain: null,
          industry: null,
          country: null,
        },
      ])

      const result = await resolveCompany('Brand New Startup XYZ')

      expect(result.resolved).toBe(false)
      expect(result.needsNewCompany).toBe(true)
      expect(result.candidates).toBeUndefined()
      expect(result.candidate).toBeUndefined()
    })

    it('returns needsNewCompany=true when company list is empty', async () => {
      const result = await resolveCompany('Nobody Here Inc')

      expect(result.needsNewCompany).toBe(true)
      expect(result.resolved).toBe(false)
    })
  })

  // ─── confirmResolution ─────────────────────────────────────

  describe('confirmResolution', () => {
    it('creates an alias and returns the company', async () => {
      mockCompanyAliasCreate.mockResolvedValue({
        companyId: 'co-1',
        alias: 'IBM',
        source: 'resolution',
        confidence: 0.9,
      })
      mockCompanyFindUnique.mockResolvedValue({
        id: 'co-1',
        rawName: 'International Business Machines',
      })

      const result = await confirmResolution('co-1', 'IBM')

      expect(mockCompanyAliasCreate).toHaveBeenCalledWith({
        data: {
          companyId: 'co-1',
          alias: 'IBM',
          source: 'resolution',
          confidence: 0.9,
        },
      })
      expect(result).toBeDefined()
      expect(result!.id).toBe('co-1')
    })
  })

  // ─── createUnverifiedCompany ───────────────────────────────

  describe('createUnverifiedCompany', () => {
    it('creates a company with correct fields and a self-alias', async () => {
      mockCompanyCreate.mockResolvedValue({
        id: 'co-new-1',
        rawName: 'New Startup XYZ',
        normalizedName: 'new startup xyz',
        domain: 'newstartup.com',
        source: 'intelligence_acquisition',
        status: 'prospect',
      })
      mockCompanyAliasCreate.mockResolvedValue({
        companyId: 'co-new-1',
        alias: 'New Startup XYZ',
        source: 'resolution',
        confidence: 1.0,
      })

      const result = await createUnverifiedCompany('New Startup XYZ', 'newstartup.com')

      expect(mockCompanyCreate).toHaveBeenCalledWith({
        data: {
          rawName: 'New Startup XYZ',
          normalizedName: 'new startup xyz',
          domain: 'newstartup.com',
          source: 'intelligence_acquisition',
          status: 'prospect',
        },
      })
      expect(result.id).toBe('co-new-1')

      // Self-alias should have confidence 1.0
      expect(mockCompanyAliasCreate).toHaveBeenCalledWith({
        data: {
          companyId: 'co-new-1',
          alias: 'New Startup XYZ',
          source: 'resolution',
          confidence: 1.0,
        },
      })
    })

    it('sets domain to null when not provided', async () => {
      mockCompanyCreate.mockResolvedValue({
        id: 'co-new-2',
        rawName: 'No Domain Co',
        normalizedName: 'no domain co',
        domain: null,
        source: 'intelligence_acquisition',
        status: 'prospect',
      })
      mockCompanyAliasCreate.mockResolvedValue({})

      await createUnverifiedCompany('No Domain Co')

      expect(mockCompanyCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ domain: null }),
        }),
      )
    })
  })
})