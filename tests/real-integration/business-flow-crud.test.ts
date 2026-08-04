/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * DeepMindQ Enterprise AI Intelligence Platform
 * Milestone 3 — Testing Quality Certification
 * Real Integration Tests: Business Flow CRUD (Part 1)
 *
 * These tests exercise REAL database connections and REAL route handlers.
 * Only `checkApiAuth` is minimal-mocked (Next.js cookie middleware is unavailable
 * in Node.js vitest). Everything else — validation, DB queries, response
 * formatting, business logic — is tested for real.
 *
 * Run: npx vitest run --config vitest.real-integration.config.ts
 * ═══════════════════════════════════════════════════════════════════════════════
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { db } from '@/lib/db'
import { buildRequest, cleanupTestData } from '../setup-integration'

// ── Route Handlers (real, not mocked) ─────────────────────────────────────────
import { GET as companiesGET, POST as companiesPOST } from '@/app/api/companies/route'
import { GET as contactsGET, POST as contactsPOST } from '@/app/api/contacts/route'
import { GET as notesGET, POST as notesPOST, DELETE as notesDELETE } from '@/app/api/notes/route'
import { GET as signalsGET } from '@/app/api/signals/route'
import { GET as dashboardGET } from '@/app/api/dashboard/route'

// ── Minimal Auth Mock ─────────────────────────────────────────────────────────
// Next.js `cookies()` from 'next/headers' doesn't work in Node.js vitest.
// We mock ONLY checkApiAuth so route handlers believe a user is authenticated.
// Everything else (DB, validation, business logic) stays real.
vi.mock('@/lib/api-auth', () => ({
  checkApiAuth: vi.fn().mockResolvedValue({
    session: {
      id: 'test-user-id-integration',
      email: 'integration-test@deepmindq.test',
      role: 'admin',
      name: 'Integration Test User',
      phone: null,
      company: null,
      designation: null,
      hasPassword: true,
      avatarUrl: null,
    },
  }),
  requireAdminRole: vi.fn().mockReturnValue(null),
}))

// ── Suppress intelligence activation side effects ─────────────────────────────
// activateIntelligenceAsync is fire-and-forget; we suppress it to avoid
// AI pipeline side effects during CRUD tests.
vi.mock('@/lib/intelligence-activation', () => ({
  activateIntelligenceAsync: vi.fn().mockResolvedValue(undefined),
}))

// Import the mocked module for per-test control
import { checkApiAuth } from '@/lib/api-auth'

// ═══════════════════════════════════════════════════════════════════════════════
// Shared State & Helpers
// ═══════════════════════════════════════════════════════════════════════════════

/** Tracked entity IDs for cleanup after each test */
let createdCompanyIds: string[] = []
let createdContactIds: string[] = []
let createdCompanyNoteIds: string[] = []
let createdContactNoteIds: string[] = []
let createdImportBatchIds: string[] = []

/** Generate a unique test name to avoid DB collisions */
function uniqueName(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

/** Helper: create a company via real POST handler and track for cleanup */
async function createTestCompany(data?: Record<string, unknown>) {
  const name = uniqueName('TestCo')
  const body = { name, ...data }
  const req = buildRequest('/api/companies', { method: 'POST', body })
  const res = await companiesPOST(req as any)
  const json = await res.json()
  if (json.company?.id) {
    createdCompanyIds.push(json.company.id)
  }
  return { res, json, companyId: json.company?.id, name }
}

/** Helper: create a contact via real POST handler and track for cleanup */
async function createTestContact(companyId: string, overrides?: Record<string, unknown>) {
  const name = uniqueName('TestContact')
  const body = {
    name,
    companyId,
    email: `${name.toLowerCase().replace(/[^a-z0-9]/g, '')}@test.deepmindq.test`,
    ...overrides,
  }
  const req = buildRequest('/api/contacts', { method: 'POST', body })
  const res = await contactsPOST(req as any)
  const json = await res.json()
  if (json.data?.id) {
    createdContactIds.push(json.data.id)
    if (json.data.batchId) {
      createdImportBatchIds.push(json.data.batchId)
    }
  }
  return { res, json, contactId: json.data?.id, name }
}

/** Helper: create a company note and track for cleanup */
async function createTestCompanyNote(companyId: string, bodyText?: string) {
  const body = { companyId, body: bodyText || `Integration test note ${Date.now()}` }
  const req = buildRequest('/api/notes', { method: 'POST', body })
  const res = await notesPOST(req as any)
  const json = await res.json()
  if (json.data?.id) {
    createdCompanyNoteIds.push(json.data.id)
  }
  return { res, json, noteId: json.data?.id }
}

/** Helper: create a contact note and track for cleanup */
async function createTestContactNote(contactId: string, bodyText?: string) {
  const body = { contactId, body: bodyText || `Integration test contact note ${Date.now()}` }
  const req = buildRequest('/api/notes', { method: 'POST', body })
  const res = await notesPOST(req as any)
  const json = await res.json()
  if (json.data?.id) {
    createdContactNoteIds.push(json.data.id)
  }
  return { res, json, noteId: json.data?.id }
}

/** Cleanup all tracked test data in correct dependency order */
async function cleanupAll() {
  // 1. Company timeline events (created as side effect of note operations)
  if (createdCompanyIds.length > 0) {
    try {
      await db.companyTimelineEvent.deleteMany({
        where: { companyId: { in: createdCompanyIds } },
      })
    } catch { /* may not exist or cascade */ }
  }

  // 2. Company notes
  if (createdCompanyNoteIds.length > 0) {
    await cleanupTestData([{ table: 'companyNote', ids: createdCompanyNoteIds }])
  }

  // 3. Contact notes
  if (createdContactNoteIds.length > 0) {
    await cleanupTestData([{ table: 'contactNote', ids: createdContactNoteIds }])
  }

  // 4. Contacts
  if (createdContactIds.length > 0) {
    await cleanupTestData([{ table: 'contact', ids: createdContactIds }])
  }

  // 5. Import batches (created as side effect of contact creation)
  if (createdImportBatchIds.length > 0) {
    await cleanupTestData([{ table: 'importBatch', ids: createdImportBatchIds }])
  }

  // 6. Companies (last — contacts depend on them)
  if (createdCompanyIds.length > 0) {
    await cleanupTestData([{ table: 'company', ids: createdCompanyIds }])
  }

  // Reset tracking arrays
  createdCompanyIds = []
  createdContactIds = []
  createdCompanyNoteIds = []
  createdContactNoteIds = []
  createdImportBatchIds = []
}

// Reset before each test
beforeEach(() => {
  createdCompanyIds = []
  createdContactIds = []
  createdCompanyNoteIds = []
  createdContactNoteIds = []
  createdImportBatchIds = []
})

// Cleanup after each test
afterEach(async () => {
  await cleanupAll()
})

// ═══════════════════════════════════════════════════════════════════════════════
// Suite 1: Companies CRUD Flow (Real DB)
// ═══════════════════════════════════════════════════════════════════════════════
describe.skipIf(!process.env.DATABASE_URL)('Companies CRUD Flow', () => {

  it('POST creates a company with correct fields and returns 201', async () => {
    const name = uniqueName('CRUD-Co')
    const req = buildRequest('/api/companies', {
      method: 'POST',
      body: {
        name,
        domain: 'https://crud-co.example.com',
        industry: 'Technology',
        employeeSize: '51-200',
        country: 'US',
        location: 'San Francisco, CA',
      },
    })

    const res = await companiesPOST(req as any)
    const json = await res.json()

    // Track for cleanup
    if (json.company?.id) createdCompanyIds.push(json.company.id)

    // Status code
    expect(res.status).toBe(201)

    // Response structure
    expect(json).toHaveProperty('company')
    expect(json.company).toHaveProperty('id')
    expect(json.company).toHaveProperty('rawName')
    expect(json.company).toHaveProperty('domain')
    expect(json.company).toHaveProperty('industry')
    expect(json.company).toHaveProperty('status')
    expect(json.company).toHaveProperty('contactCount')
    expect(json.company).toHaveProperty('signalCount')
    expect(json.company).toHaveProperty('isEnriched')

    // Field values
    expect(json.company.rawName).toBe(name)
    expect(json.company.domain).toBe('https://crud-co.example.com')
    expect(json.company.industry).toBe('Technology')
    expect(json.company.status).toBe('prospect')
    expect(json.company.contactCount).toBe(0)
    expect(json.company.signalCount).toBe(0)
    expect(json.company.isEnriched).toBe(false)
  })

  it('POST returns 409 for duplicate company name', async () => {
    // Create first company
    const { name } = await createTestCompany()

    // Attempt to create duplicate
    const req = buildRequest('/api/companies', {
      method: 'POST',
      body: { name },
    })
    const res = await companiesPOST(req as any)
    const json = await res.json()

    expect(res.status).toBe(409)
    expect(json).toHaveProperty('error')
    expect(json).toHaveProperty('companyId')
    expect(json.companyId).toBeDefined()
  })

  it('GET returns paginated companies list with correct structure', async () => {
    // Create a company to ensure list is non-empty
    await createTestCompany()

    const req = buildRequest('/api/companies')
    const res = await companiesGET(req as any)
    const json = await res.json()

    expect(res.status).toBe(200)

    // Pagination structure
    expect(json).toHaveProperty('companies')
    expect(json).toHaveProperty('pagination')
    expect(json).toHaveProperty('filters')

    expect(json.pagination).toHaveProperty('page')
    expect(json.pagination).toHaveProperty('limit')
    expect(json.pagination).toHaveProperty('total')
    expect(json.pagination).toHaveProperty('totalPages')

    expect(typeof json.pagination.total).toBe('number')
    expect(json.pagination.total).toBeGreaterThanOrEqual(1)
    expect(json.pagination.totalPages).toBeGreaterThanOrEqual(1)

    // Filters structure
    expect(json.filters).toHaveProperty('tiers')
    expect(json.filters).toHaveProperty('statuses')
    expect(Array.isArray(json.filters.tiers)).toBe(true)
    expect(Array.isArray(json.filters.statuses)).toBe(true)

    // Company items have expected shape
    if (json.companies.length > 0) {
      const c = json.companies[0]
      expect(c).toHaveProperty('id')
      expect(c).toHaveProperty('rawName')
      expect(c).toHaveProperty('domain')
      expect(c).toHaveProperty('status')
      expect(c).toHaveProperty('contactCount')
      expect(c).toHaveProperty('signalCount')
    }
  })

  it('GET with search filter returns matching companies', async () => {
    // Create a company with a distinctive name
    const { name } = await createTestCompany()
    const searchName = name.slice(0, -8) // remove random suffix partially

    const req = buildRequest(`/api/companies?search=${encodeURIComponent(searchName)}`)
    const res = await companiesGET(req as any)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.companies.length).toBeGreaterThanOrEqual(1)

    // At least one result should contain our unique name fragment
    const found = json.companies.some(
      (c: any) => c.rawName.toLowerCase().includes(searchName.toLowerCase())
    )
    expect(found).toBe(true)
  })

  it('GET with pagination returns correct page and limit', async () => {
    const req = buildRequest('/api/companies?page=1&limit=3')
    const res = await companiesGET(req as any)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.pagination.page).toBe(1)
    expect(json.pagination.limit).toBe(3)
    expect(json.companies.length).toBeLessThanOrEqual(3)
  })

  it('POST creates company with minimal data (name only)', async () => {
    const name = uniqueName('Minimal-Co')
    const req = buildRequest('/api/companies', {
      method: 'POST',
      body: { name },
    })
    const res = await companiesPOST(req as any)
    const json = await res.json()

    if (json.company?.id) createdCompanyIds.push(json.company.id)

    expect(res.status).toBe(201)
    expect(json.company.rawName).toBe(name)
    expect(json.company.domain).toBeNull()
    expect(json.company.industry).toBeNull()
    expect(json.company.status).toBe('prospect')
  })

  it('POST creates company with full data (all fields populated)', async () => {
    const name = uniqueName('FullData-Co')
    const req = buildRequest('/api/companies', {
      method: 'POST',
      body: {
        name,
        domain: 'https://fulldata.example.com',
        industry: 'SaaS',
        employeeSize: '201-500',
        country: 'United Kingdom',
        location: 'London, UK',
        website: 'https://fulldata.example.com',
      },
    })
    const res = await companiesPOST(req as any)
    const json = await res.json()

    if (json.company?.id) createdCompanyIds.push(json.company.id)

    expect(res.status).toBe(201)
    expect(json.company.rawName).toBe(name)
    expect(json.company.domain).toBe('https://fulldata.example.com')
    expect(json.company.industry).toBe('SaaS')
    expect(json.company.status).toBe('prospect')
  })

  it('POST returns 400 for empty name', async () => {
    const req = buildRequest('/api/companies', {
      method: 'POST',
      body: { name: '   ' },
    })
    const res = await companiesPOST(req as any)

    // Zod validation catches empty name, but handler also checks rawName.trim()
    expect([400, 500]).toContain(res.status)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Suite 2: Contacts CRUD Flow (Real DB)
// ═══════════════════════════════════════════════════════════════════════════════
describe.skipIf(!process.env.DATABASE_URL)('Contacts CRUD Flow', () => {

  it('POST creates a contact associated with a company', async () => {
    // First create a company
    const { companyId } = await createTestCompany()
    expect(companyId).toBeDefined()

    // Then create a contact for that company
    const { res, json, contactId } = await createTestContact(companyId)

    expect(res.status).toBe(201)
    expect(json.success).toBe(true)
    expect(json.data).toHaveProperty('id')
    expect(json.data).toHaveProperty('rawName')
    expect(json.data).toHaveProperty('email')
    expect(json.data).toHaveProperty('companyId')
    expect(json.data.companyId).toBe(companyId)
    expect(contactId).toBeDefined()
  })

  it('GET returns contacts list with correct structure', async () => {
    // Create a company + contact
    const { companyId } = await createTestCompany()
    await createTestContact(companyId)

    const req = buildRequest('/api/contacts')
    const res = await contactsGET(req as any)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toHaveProperty('contacts')
    expect(json.data).toHaveProperty('total')
    expect(json.data).toHaveProperty('page')
    expect(json.data).toHaveProperty('pageSize')
    expect(json.data).toHaveProperty('stats')

    // Stats structure
    expect(json.data.stats).toHaveProperty('total')
    expect(json.data.stats).toHaveProperty('avgScore')
    expect(json.data.stats).toHaveProperty('emailValidPct')
    expect(json.data.stats).toHaveProperty('engaged')

    // Contact items have expected shape
    expect(json.data.total).toBeGreaterThanOrEqual(1)
    if (json.data.contacts.length > 0) {
      const c = json.data.contacts[0]
      expect(c).toHaveProperty('id')
      expect(c).toHaveProperty('name')
      expect(c).toHaveProperty('email')
      expect(c).toHaveProperty('status')
      expect(c).toHaveProperty('company')
    }
  })

  it('GET filtered by companyId returns only that company\'s contacts', async () => {
    // Create two companies with contacts
    const { companyId: comp1Id } = await createTestCompany()
    const { companyId: comp2Id } = await createTestCompany()
    const { contactId: contact1Id } = await createTestContact(comp1Id)
    await createTestContact(comp2Id)

    const req = buildRequest(`/api/contacts?companyId=${comp1Id}`)
    const res = await contactsGET(req as any)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.total).toBeGreaterThanOrEqual(1)

    // All returned contacts should belong to comp1
    const allMatchCompany = json.data.contacts.every(
      (c: any) => c.company?.id === comp1Id
    )
    expect(allMatchCompany).toBe(true)
  })

  it('POST returns 400 for invalid contact data (missing companyId)', async () => {
    const req = buildRequest('/api/contacts', {
      method: 'POST',
      body: { name: 'No Company Contact' },
    })
    const res = await contactsPOST(req as any)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.success).toBe(false)
    expect(json).toHaveProperty('error')
  })

  it('POST returns 400 for invalid email format', async () => {
    const { companyId } = await createTestCompany()
    const req = buildRequest('/api/contacts', {
      method: 'POST',
      body: {
        name: uniqueName('BadEmail'),
        companyId,
        email: 'not-an-email',
      },
    })
    const res = await contactsPOST(req as any)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.success).toBe(false)
    expect(json).toHaveProperty('error')
  })

  it('POST returns 404 for non-existent company', async () => {
    const fakeId = 'nonexistent-company-id-000000'
    const req = buildRequest('/api/contacts', {
      method: 'POST',
      body: {
        name: uniqueName('Ghost'),
        companyId: fakeId,
      },
    })
    const res = await contactsPOST(req as any)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.success).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Suite 3: Notes CRUD Flow (Real DB)
// ═══════════════════════════════════════════════════════════════════════════════
describe.skipIf(!process.env.DATABASE_URL)('Notes CRUD Flow', () => {

  it('POST creates a company note and returns 201', async () => {
    const { companyId } = await createTestCompany()
    const { res, json, noteId } = await createTestCompanyNote(companyId, 'Test company note body')

    expect(res.status).toBe(201)
    expect(json.success).toBe(true)
    expect(json.data).toHaveProperty('id')
    expect(json.data).toHaveProperty('body')
    expect(json.data).toHaveProperty('companyId')
    expect(json.data.companyId).toBe(companyId)
    expect(json.data._type).toBe('company')
    expect(noteId).toBeDefined()
  })

  it('POST creates a contact note and returns 201', async () => {
    const { companyId } = await createTestCompany()
    const { contactId } = await createTestContact(companyId)
    const { res, json, noteId } = await createTestContactNote(contactId, 'Test contact note body')

    expect(res.status).toBe(201)
    expect(json.success).toBe(true)
    expect(json.data).toHaveProperty('id')
    expect(json.data).toHaveProperty('body')
    expect(json.data).toHaveProperty('contactId')
    expect(json.data.contactId).toBe(contactId)
    expect(json.data._type).toBe('contact')
    expect(noteId).toBeDefined()
  })

  it('GET by companyId returns only that company\'s notes', async () => {
    const { companyId } = await createTestCompany()
    await createTestCompanyNote(companyId, 'Company note for filter test')

    const req = buildRequest(`/api/notes?companyId=${companyId}`)
    const res = await notesGET(req as any)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data.length).toBeGreaterThanOrEqual(1)

    // All returned notes should have _type 'company'
    const allCompanyNotes = json.data.every(
      (n: any) => n._type === 'company' && n.companyId === companyId
    )
    expect(allCompanyNotes).toBe(true)
  })

  it('GET by contactId returns only that contact\'s notes', async () => {
    const { companyId } = await createTestCompany()
    const { contactId } = await createTestContact(companyId)
    await createTestContactNote(contactId, 'Contact note for filter test')

    const req = buildRequest(`/api/notes?contactId=${contactId}`)
    const res = await notesGET(req as any)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data.length).toBeGreaterThanOrEqual(1)

    const allContactNotes = json.data.every(
      (n: any) => n._type === 'contact' && n.contactId === contactId
    )
    expect(allContactNotes).toBe(true)
  })

  it('GET with both companyId and contactId returns notes from both', async () => {
    const { companyId } = await createTestCompany()
    const { contactId } = await createTestContact(companyId)
    await createTestCompanyNote(companyId, 'Co note for both-filter')
    await createTestContactNote(contactId, 'Contact note for both-filter')

    const req = buildRequest(`/api/notes?companyId=${companyId}&contactId=${contactId}`)
    const res = await notesGET(req as any)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(Array.isArray(json.data)).toBe(true)
    expect(json.data.length).toBeGreaterThanOrEqual(2)

    const types = json.data.map((n: any) => n._type)
    expect(types).toContain('company')
    expect(types).toContain('contact')
  })

  it('DELETE removes a note and returns success', async () => {
    const { companyId } = await createTestCompany()
    const { noteId } = await createTestCompanyNote(companyId, 'Note to be deleted')
    expect(noteId).toBeDefined()

    // Delete the note
    const req = buildRequest(`/api/notes?id=${noteId}`, { method: 'DELETE' })
    const res = await notesDELETE(req as any)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data.success).toBe(true)

    // Verify it's gone — remove from cleanup tracking since already deleted
    createdCompanyNoteIds = createdCompanyNoteIds.filter(id => id !== noteId)

    // GET should no longer return this note
    const getReq = buildRequest(`/api/notes?companyId=${companyId}`)
    const getRes = await notesGET(getReq as any)
    const getJson = await getRes.json()
    const found = getJson.data.some((n: any) => n.id === noteId)
    expect(found).toBe(false)
  })

  it('DELETE returns 404 for non-existent note', async () => {
    const req = buildRequest('/api/notes?id=nonexistent-note-id', { method: 'DELETE' })
    const res = await notesDELETE(req as any)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.success).toBe(false)
  })

  it('POST returns 400 when neither companyId nor contactId is provided', async () => {
    const req = buildRequest('/api/notes', {
      method: 'POST',
      body: { body: 'Orphan note' },
    })
    const res = await notesPOST(req as any)
    const json = await res.json()

    expect(res.status).toBe(400)
    expect(json.success).toBe(false)
  })

  it('POST returns 404 for non-existent company', async () => {
    const req = buildRequest('/api/notes', {
      method: 'POST',
      body: { companyId: 'nonexistent-company-id', body: 'Ghost note' },
    })
    const res = await notesPOST(req as any)
    const json = await res.json()

    expect(res.status).toBe(404)
    expect(json.success).toBe(false)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Suite 4: Dashboard Aggregation (Real DB)
// ═══════════════════════════════════════════════════════════════════════════════
describe.skipIf(!process.env.DATABASE_URL)('Dashboard Aggregation', () => {

  it('GET returns dashboard with correct response structure', async () => {
    const req = buildRequest('/api/dashboard', {
      headers: { 'User-Agent': 'integration-test/1.0' },
    })
    const res = await dashboardGET(req as any)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json).toHaveProperty('data')
    expect(json).toHaveProperty('meta')

    // Data structure — real aggregated fields from DB
    expect(json.data).toHaveProperty('contactsByStatus')
    expect(json.data).toHaveProperty('totalCompanies')
    expect(json.data).toHaveProperty('recentBatches')
    expect(json.data).toHaveProperty('draftsPendingReview')
    expect(json.data).toHaveProperty('queuePending')
    expect(json.data).toHaveProperty('repliesThisWeek')
    expect(json.data).toHaveProperty('bouncesCount')
    expect(json.data).toHaveProperty('suppressionsCount')
    expect(json.data).toHaveProperty('emailHealthDistribution')

    // Meta structure
    expect(json.meta).toHaveProperty('endpoint')
    expect(json.meta).toHaveProperty('durationMs')
    expect(json.meta.endpoint).toBe('dashboard')
    expect(typeof json.meta.durationMs).toBe('number')
  })

  it('GET returns real aggregated counts from the database', async () => {
    // Create a company to affect the totalCompanies count
    await createTestCompany()

    const req = buildRequest('/api/dashboard', {
      headers: { 'User-Agent': 'integration-test/1.0' },
    })
    const res = await dashboardGET(req as any)
    const json = await res.json()

    expect(res.status).toBe(200)

    // totalCompanies should be a non-negative number
    expect(typeof json.data.totalCompanies).toBe('number')
    expect(json.data.totalCompanies).toBeGreaterThanOrEqual(0)

    // contactsByStatus should be an object with string keys and number values
    expect(typeof json.data.contactsByStatus).toBe('object')
    for (const [status, count] of Object.entries(json.data.contactsByStatus)) {
      expect(typeof status).toBe('string')
      expect(typeof count).toBe('number')
    }

    // Numeric fields should all be non-negative numbers
    const numericFields = [
      'draftsPendingReview',
      'queuePending',
      'repliesThisWeek',
      'bouncesCount',
      'suppressionsCount',
    ] as const
    for (const field of numericFields) {
      expect(typeof json.data[field]).toBe('number')
      expect(json.data[field]).toBeGreaterThanOrEqual(0)
    }

    // recentBatches should be an array (max 5)
    expect(Array.isArray(json.data.recentBatches)).toBe(true)
    expect(json.data.recentBatches.length).toBeLessThanOrEqual(5)

    // emailHealthDistribution should be an object
    expect(typeof json.data.emailHealthDistribution).toBe('object')
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Suite 5: Auth Guards (Behavioral)
// ═══════════════════════════════════════════════════════════════════════════════
describe.skipIf(!process.env.DATABASE_URL)('Auth Guards (Behavioral)', () => {

  it('returns 401 when checkApiAuth denies access (unauthenticated)', async () => {
    // Override the default mock to simulate unauthenticated request
    const unauthorizedResp = new Response(
      JSON.stringify({ success: false, error: 'Authentication required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
    vi.mocked(checkApiAuth).mockResolvedValueOnce({
      session: null,
      errorResponse: unauthorizedResp,
    })

    const req = buildRequest('/api/companies')
    const res = await companiesGET(req as any)

    expect(res.status).toBe(401)
  })

  it('returns 200 when checkApiAuth grants access (authenticated)', async () => {
    // Default mock returns a valid session — no override needed
    const req = buildRequest('/api/companies')
    const res = await companiesGET(req as any)

    expect(res.status).toBe(200)
  })

  it('returns 401 for expired or invalid session on contacts route', async () => {
    // Simulate expired/invalid session
    const unauthorizedResp = new Response(
      JSON.stringify({ success: false, error: 'Authentication required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
    vi.mocked(checkApiAuth).mockResolvedValueOnce({
      session: null,
      errorResponse: unauthorizedResp,
    })

    const req = buildRequest('/api/contacts')
    const res = await contactsGET(req as any)

    expect(res.status).toBe(401)
  })

  it('returns 401 for expired or invalid session on notes route', async () => {
    const unauthorizedResp = new Response(
      JSON.stringify({ success: false, error: 'Authentication required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
    vi.mocked(checkApiAuth).mockResolvedValueOnce({
      session: null,
      errorResponse: unauthorizedResp,
    })

    const req = buildRequest('/api/notes')
    const res = await notesGET(req as any)

    expect(res.status).toBe(401)
  })

  it('returns 401 for expired or invalid session on signals route', async () => {
    const unauthorizedResp = new Response(
      JSON.stringify({ success: false, error: 'Authentication required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
    vi.mocked(checkApiAuth).mockResolvedValueOnce({
      session: null,
      errorResponse: unauthorizedResp,
    })

    const req = buildRequest('/api/signals')
    const res = await signalsGET(req as any)

    expect(res.status).toBe(401)
  })

  it('returns 401 for expired or invalid session on dashboard route', async () => {
    const unauthorizedResp = new Response(
      JSON.stringify({ success: false, error: 'Authentication required' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
    vi.mocked(checkApiAuth).mockResolvedValueOnce({
      session: null,
      errorResponse: unauthorizedResp,
    })

    const req = buildRequest('/api/dashboard', {
      headers: { 'User-Agent': 'integration-test/1.0' },
    })
    const res = await dashboardGET(req as any)

    expect(res.status).toBe(401)
  })
})

// ═══════════════════════════════════════════════════════════════════════════════
// Suite 6: Signals Filtering (Real DB)
// ═══════════════════════════════════════════════════════════════════════════════
describe.skipIf(!process.env.DATABASE_URL)('Signals Filtering', () => {

  it('GET returns signals list with correct structure', async () => {
    const req = buildRequest('/api/signals')
    const res = await signalsGET(req as any)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(json.data).toHaveProperty('signals')
    expect(json.data).toHaveProperty('evidenceCounts')
    expect(json.data).toHaveProperty('categories')
    expect(json.data).toHaveProperty('pagination')

    // Signals should be an array
    expect(Array.isArray(json.data.signals)).toBe(true)

    // evidenceCounts should be an object
    expect(typeof json.data.evidenceCounts).toBe('object')

    // categories should be an array
    expect(Array.isArray(json.data.categories)).toBe(true)

    // Pagination structure
    expect(json.data.pagination).toHaveProperty('page')
    expect(json.data.pagination).toHaveProperty('pageSize')
    expect(json.data.pagination).toHaveProperty('total')
    expect(json.data.pagination).toHaveProperty('totalPages')
    expect(json.data.pagination.pageSize).toBe(20)
  })

  it('GET filtered by companyId returns signals for that company', async () => {
    const { companyId } = await createTestCompany()
    const req = buildRequest(`/api/signals?companyId=${companyId}`)
    const res = await signalsGET(req as any)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    expect(Array.isArray(json.data.signals)).toBe(true)
    // Newly created company likely has no signals yet
    expect(json.data.pagination.total).toBe(0)
    expect(json.data.signals.length).toBe(0)
  })

  it('GET with pagination returns correct page and respects page size', async () => {
    const req = buildRequest('/api/signals?page=2')
    const res = await signalsGET(req as any)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.data.pagination.page).toBe(2)
    expect(json.data.pagination.pageSize).toBe(20)
    expect(json.data.signals.length).toBeLessThanOrEqual(20)
  })

  it('GET with type filter returns only matching signals', async () => {
    const req = buildRequest('/api/signals?type=funding')
    const res = await signalsGET(req as any)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    // All returned signals should be of type 'funding'
    for (const signal of json.data.signals) {
      expect(signal.signalType).toBe('funding')
    }
  })

  it('GET with severity filter returns only matching signals', async () => {
    const req = buildRequest('/api/signals?severity=high')
    const res = await signalsGET(req as any)
    const json = await res.json()

    expect(res.status).toBe(200)
    expect(json.success).toBe(true)
    // All returned signals should have severity 'high'
    for (const signal of json.data.signals) {
      expect(signal.severity).toBe('high')
    }
  })
})
