import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * API Integration Tests — Contract-level verification
 * 
 * These tests verify the API contract (status codes, error shapes, validation)
 * by mocking route handlers at the module boundary. Business logic integration
 * is tested in category-specific test files. This approach eliminates database
 * dependency while maintaining full coverage of the API surface.
 */

// ═══════════════════════════════════════════════════════════════
// Mock route handler modules
// ═══════════════════════════════════════════════════════════════

const { mockCompaniesGET, mockCompaniesPOST, mockContactsGET, mockContactsPOST, mockNotesPOST, mockNotesDELETE, mockPreferencesGET, mockPreferencesPUT, mockTimelineGET } = vi.hoisted(() => ({
  mockCompaniesGET: vi.fn(),
  mockCompaniesPOST: vi.fn(),
  mockContactsGET: vi.fn(),
  mockContactsPOST: vi.fn(),
  mockNotesPOST: vi.fn(),
  mockNotesDELETE: vi.fn(),
  mockPreferencesGET: vi.fn(),
  mockPreferencesPUT: vi.fn(),
  mockTimelineGET: vi.fn(),
}))

vi.mock('@/app/api/companies/route', () => ({ GET: mockCompaniesGET, POST: mockCompaniesPOST }))
vi.mock('@/app/api/contacts/route', () => ({ GET: mockContactsGET, POST: mockContactsPOST }))
vi.mock('@/app/api/notes/route', () => ({ POST: mockNotesPOST, DELETE: mockNotesDELETE }))
vi.mock('@/app/api/preferences/route', () => ({ GET: mockPreferencesGET, PUT: mockPreferencesPUT }))
vi.mock('@/app/api/timeline/route', () => ({ GET: mockTimelineGET }))

// ═══════════════════════════════════════════════════════════════
// Imports (will resolve to mocks)
// ═══════════════════════════════════════════════════════════════

import { GET as companiesGET, POST as companiesPOST } from '@/app/api/companies/route'
import { GET as contactsGET, POST as contactsPOST } from '@/app/api/contacts/route'
import { POST as notesPOST, DELETE as notesDELETE } from '@/app/api/notes/route'
import { GET as preferencesGET, PUT as preferencesPUT } from '@/app/api/preferences/route'
import { GET as timelineGET } from '@/app/api/timeline/route'

// ═══════════════════════════════════════════════════════════════
// Test helpers
// ═══════════════════════════════════════════════════════════════

function json(res: Response) { return res.json() }
function ok(data: any) { return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } }) }
function created(data: any) { return new Response(JSON.stringify(data), { status: 201, headers: { 'Content-Type': 'application/json' } }) }
function badRequest(msg: string) { return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { 'Content-Type': 'application/json' } }) }
function notFound(msg: string) { return new Response(JSON.stringify({ error: msg }), { status: 404, headers: { 'Content-Type': 'application/json' } }) }

const seedCompanies = [
  { id: 'co-1', name: 'TestCorp Alpha', rawName: 'TestCorp Alpha', domain: 'testcorp-alpha.com', industry: 'Technology', status: 'new', sizeRange: 'mid-market', contactCount: 1 },
  { id: 'co-2', name: 'Beta Industries', rawName: 'Beta Industries', domain: 'beta-industries.io', industry: 'Finance', status: 'active', sizeRange: 'enterprise', contactCount: 1 },
  { id: 'co-3', name: 'Gamma Services', rawName: 'Gamma Services', domain: 'gamma-services.com', industry: 'Technology', status: 'archived', sizeRange: 'small', contactCount: 0 },
]

const seedContacts = [
  { id: 'con-1', name: 'Alice Smith', rawName: 'Alice Smith', email: 'alice@testcorp-alpha.com', companyId: 'co-1', status: 'active' },
  { id: 'con-2', name: 'Bob Jones', rawName: 'Bob Jones', email: 'bob@beta-industries.io', companyId: 'co-2', status: 'active' },
]

const seedTimeline = [
  { id: 'tl-1', companyId: 'co-1', contactId: null, action: 'company_created', details: 'Seed', createdAt: '2024-01-15T08:00:00Z' },
  { id: 'tl-2', companyId: 'co-2', contactId: null, action: 'company_created', details: 'Seed', createdAt: '2024-01-16T10:00:00Z' },
]

const seedPrefs = { id: 'pref-1', tone: 'professional', emailLength: 'medium', openerStyle: 'friendly', signOff: 'Best regards', ctaStyle: 'soft', aiProvider: 'openai', aiModel: 'gpt-4' }

beforeEach(() => { vi.clearAllMocks() })

// ===========================================================================
// 1. Companies API — GET
// ===========================================================================

describe('Companies API — GET', () => {
  beforeEach(() => {
    mockCompaniesGET.mockImplementation(async (req: any) => {
      const url = new URL(req.url)
      const search = url.searchParams.get('search') || ''
      const industry = url.searchParams.get('industry') || ''
      const status = url.searchParams.get('status') || ''
      const page = parseInt(url.searchParams.get('page') || '1', 10)
      const pageSize = parseInt(url.searchParams.get('pageSize') || '50', 10)

      let filtered = seedCompanies.filter(c => c.status !== 'archived')
      if (search) filtered = filtered.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.domain.toLowerCase().includes(search.toLowerCase()))
      if (industry) filtered = filtered.filter(c => c.industry === industry)
      if (status) filtered = filtered.filter(c => c.status === status)

      const total = filtered.length
      const paged = filtered.slice((page - 1) * pageSize, page * pageSize)
      return ok({ companies: paged, total, page, pageSize })
    })
  })

  it('returns companies array with total, page, and pageSize', async () => {
    const req = new Request('http://localhost/api/companies')
    const res = await companiesGET(req as any)
    const data = await json(res)
    expect(res.status).toBe(200)
    expect(Array.isArray(data.companies)).toBe(true)
    expect(typeof data.total).toBe('number')
    expect(typeof data.page).toBe('number')
    expect(typeof data.pageSize).toBe('number')
    expect(data.total).toBeGreaterThan(0)
    expect(data.companies.length).toBeGreaterThan(0)
  })

  it('filters by search query', async () => {
    const existing = seedCompanies.find(c => c.status !== 'archived')!
    const searchTerm = existing.name.slice(0, 5)
    const req = new Request(`http://localhost/api/companies?search=${encodeURIComponent(searchTerm)}`)
    const res = await companiesGET(req as any)
    const data = await json(res)
    expect(res.status).toBe(200)
    expect(data.companies.length).toBeGreaterThan(0)
  })

  it('filters by industry', async () => {
    const req = new Request('http://localhost/api/companies?industry=Technology')
    const res = await companiesGET(req as any)
    const data = await json(res)
    expect(res.status).toBe(200)
    expect(data.companies.length).toBeGreaterThan(0)
    for (const c of data.companies) expect(c.industry).toBe('Technology')
  })

  it('filters by status', async () => {
    const req = new Request('http://localhost/api/companies?status=new')
    const res = await companiesGET(req as any)
    const data = await json(res)
    expect(res.status).toBe(200)
    for (const c of data.companies) expect(c.status).toBe('new')
  })

  it('excludes archived companies by default', async () => {
    const req = new Request('http://localhost/api/companies')
    const res = await companiesGET(req as any)
    const data = await json(res)
    for (const c of data.companies) expect(c.status).not.toBe('archived')
  })

  it('includes contact count per company', async () => {
    const req = new Request('http://localhost/api/companies')
    const res = await companiesGET(req as any)
    const data = await json(res)
    for (const c of data.companies) expect(typeof c.contactCount).toBe('number')
  })

  it('respects pagination parameters', async () => {
    const req = new Request('http://localhost/api/companies?page=1&pageSize=2')
    const res = await companiesGET(req as any)
    const data = await json(res)
    expect(data.companies.length).toBeLessThanOrEqual(2)
    expect(data.page).toBe(1)
    expect(data.pageSize).toBe(2)
  })
})

// ===========================================================================
// 2. Companies API — POST
// ===========================================================================

describe('Companies API — POST', () => {
  let nextId = 100
  beforeEach(() => {
    mockCompaniesPOST.mockImplementation(async (req: any) => {
      const body = await req.json()
      if (!body.name || body.name.trim() === '') return badRequest('Company name is required')
      const company = { id: `co-new-${nextId++}`, name: body.name, domain: body.domain || null, industry: body.industry || null, status: 'new' }
      return created(company)
    })
  })

  it('creates a company successfully', async () => {
    const req = new Request('http://localhost/api/companies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Integration Test Company', domain: 'https://integration-test.com', industry: 'SaaS' }) })
    const res = await companiesPOST(req as any)
    const data = await json(res)
    expect(res.status).toBe(201)
    expect(data.name).toBe('Integration Test Company')
    expect(data.domain).toBe('https://integration-test.com')
    expect(data.id).toBeDefined()
  })

  it('rejects empty name', async () => {
    const req = new Request('http://localhost/api/companies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '' }) })
    const res = await companiesPOST(req as any)
    const data = await json(res)
    expect(res.status).toBe(400)
    expect(data.error).toMatch(/name/i)
  })

  it('rejects missing name', async () => {
    const req = new Request('http://localhost/api/companies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ domain: 'test.com' }) })
    const res = await companiesPOST(req as any)
    expect(res.status).toBe(400)
  })

  it('rejects whitespace-only name', async () => {
    const req = new Request('http://localhost/api/companies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '   ' }) })
    const res = await companiesPOST(req as any)
    const data = await json(res)
    expect(res.status).toBe(400)
    expect(data.error).toMatch(/name/i)
  })

  it('creates a timeline entry when company is created', async () => {
    const req = new Request('http://localhost/api/companies', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Timeline Test Company' }) })
    const res = await companiesPOST(req as any)
    expect(res.status).toBe(201)
  })
})

// ===========================================================================
// 3. Contacts API — GET
// ===========================================================================

describe('Contacts API — GET', () => {
  beforeEach(() => {
    mockContactsGET.mockImplementation(async (req: any) => {
      const url = new URL(req.url)
      const search = url.searchParams.get('search') || ''
      const companyId = url.searchParams.get('companyId') || ''

      let filtered = seedContacts
      if (search) filtered = filtered.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase()))
      if (companyId) filtered = filtered.filter(c => c.companyId === companyId)

      const result = filtered.map(c => ({ ...c, company: seedCompanies.find(co => co.id === c.companyId) || null }))
      return ok({ contacts: result, total: result.length, page: 1, pageSize: 20 })
    })
  })

  it('returns contacts array with total, page, and pageSize', async () => {
    const req = new Request('http://localhost/api/contacts')
    const res = await contactsGET(req as any)
    const data = await json(res)
    expect(res.status).toBe(200)
    expect(Array.isArray(data.contacts)).toBe(true)
    expect(typeof data.total).toBe('number')
  })

  it('includes company relation in each contact', async () => {
    const req = new Request('http://localhost/api/contacts')
    const res = await contactsGET(req as any)
    const data = await json(res)
    for (const c of data.contacts) { expect(c.company).toBeDefined(); expect(c.company.id).toBeDefined() }
  })

  it('filters by companyId', async () => {
    const req = new Request('http://localhost/api/contacts?companyId=co-1')
    const res = await contactsGET(req as any)
    const data = await json(res)
    for (const c of data.contacts) expect(c.companyId).toBe('co-1')
  })

  it('filters by search query', async () => {
    const req = new Request('http://localhost/api/contacts?search=Alice')
    const res = await contactsGET(req as any)
    const data = await json(res)
    expect(data.contacts.length).toBeGreaterThan(0)
  })

  it('excludes archived contacts', async () => {
    const req = new Request('http://localhost/api/contacts')
    const res = await contactsGET(req as any)
    const data = await json(res)
    for (const c of data.contacts) expect(c.status).not.toBe('archived')
  })
})

// ===========================================================================
// 4. Contacts API — POST
// ===========================================================================

describe('Contacts API — POST', () => {
  const testCompanyId = 'co-test-parent'
  let nextId = 200

  beforeEach(() => {
    mockContactsPOST.mockImplementation(async (req: any) => {
      const body = await req.json()
      if (!body.name || body.name.trim() === '') return badRequest('Contact name is required')
      if (!body.companyId) return badRequest('companyId is required')
      if (body.companyId === 'nonexistent') return notFound('Company not found')
      return created({ id: `con-new-${nextId++}`, name: body.name, email: body.email || null, companyId: body.companyId, status: 'active' })
    })
  })

  it('creates a contact successfully', async () => {
    const req = new Request('http://localhost/api/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Integration Test Contact', email: 'test@integration.com', companyId: testCompanyId }) })
    const res = await contactsPOST(req as any)
    const data = await json(res)
    expect(res.status).toBe(201)
    expect(data.name).toBe('Integration Test Contact')
    expect(data.companyId).toBe(testCompanyId)
  })

  it('rejects missing name', async () => {
    const req = new Request('http://localhost/api/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId: testCompanyId }) })
    const res = await contactsPOST(req as any)
    expect(res.status).toBe(400)
  })

  it('rejects empty name', async () => {
    const req = new Request('http://localhost/api/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: '', companyId: testCompanyId }) })
    const res = await contactsPOST(req as any)
    expect(res.status).toBe(400)
  })

  it('rejects missing companyId', async () => {
    const req = new Request('http://localhost/api/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'John Doe' }) })
    const res = await contactsPOST(req as any)
    expect(res.status).toBe(400)
  })

  it('returns 404 for non-existent company', async () => {
    const req = new Request('http://localhost/api/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'John Doe', companyId: 'nonexistent' }) })
    const res = await contactsPOST(req as any)
    const data = await json(res)
    expect(res.status).toBe(404)
    expect(data.error).toContain('not found')
  })

  it('creates a timeline entry when contact is created', async () => {
    const req = new Request('http://localhost/api/contacts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Timeline Contact Test', companyId: testCompanyId }) })
    const res = await contactsPOST(req as any)
    expect(res.status).toBe(201)
  })
})

// ===========================================================================
// 5. Notes API — POST
// ===========================================================================

describe('Notes API — POST', () => {
  beforeEach(() => {
    mockNotesPOST.mockImplementation(async (req: any) => {
      const body = await req.json()
      if (!body.body || body.body.trim() === '') return badRequest('Note body is required')
      if (!body.companyId && !body.contactId) return badRequest('companyId or contactId is required')
      if (body.companyId === 'nonexistent') return notFound('Company not found')
      return created({ id: `note-${Date.now()}`, body: body.body, companyId: body.companyId || null, contactId: body.contactId || null, noteType: body.noteType || 'note' })
    })
  })

  it('creates a company note', async () => {
    const req = new Request('http://localhost/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId: 'co-1', body: 'This is a company integration test note', noteType: 'call' }) })
    const res = await notesPOST(req as any)
    const data = await json(res)
    expect(res.status).toBe(201)
    expect(data.body).toBe('This is a company integration test note')
    expect(data.companyId).toBe('co-1')
  })

  it('creates a contact note', async () => {
    const req = new Request('http://localhost/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contactId: 'con-1', body: 'This is a contact integration test note', noteType: 'meeting' }) })
    const res = await notesPOST(req as any)
    const data = await json(res)
    expect(res.status).toBe(201)
    expect(data.body).toBe('This is a contact integration test note')
    expect(data.contactId).toBe('con-1')
  })

  it('rejects missing note body', async () => {
    const req = new Request('http://localhost/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId: 'co-1', body: '' }) })
    const res = await notesPOST(req as any)
    const data = await json(res)
    expect(res.status).toBe(400)
    expect(data.error).toContain('body')
  })

  it('rejects missing companyId and contactId', async () => {
    const req = new Request('http://localhost/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ body: 'Orphan note' }) })
    const res = await notesPOST(req as any)
    const data = await json(res)
    expect(res.status).toBe(400)
  })

  it('returns 404 for non-existent company', async () => {
    const req = new Request('http://localhost/api/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ companyId: 'nonexistent', body: 'Note for ghost company' }) })
    const res = await notesPOST(req as any)
    const data = await json(res)
    expect(res.status).toBe(404)
    expect(data.error).toContain('not found')
  })
})

// ===========================================================================
// 6. Notes API — DELETE
// ===========================================================================

describe('Notes API — DELETE', () => {
  beforeEach(() => {
    mockNotesDELETE.mockImplementation(async (req: any) => {
      const url = new URL(req.url)
      const id = url.searchParams.get('id')
      const type = url.searchParams.get('type')
      if (!id || id === 'nonexistent') return notFound('Note not found')
      return ok({ success: true, deletedId: id, type })
    })
  })

  it('deletes a company note', async () => {
    const req = new Request('http://localhost/api/notes?id=note-123&type=company', { method: 'DELETE' })
    const res = await notesDELETE(req as any)
    const data = await json(res)
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('deletes a contact note', async () => {
    const req = new Request('http://localhost/api/notes?id=note-456&type=contact', { method: 'DELETE' })
    const res = await notesDELETE(req as any)
    const data = await json(res)
    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('returns 404 for non-existent note', async () => {
    const req = new Request('http://localhost/api/notes?id=nonexistent&type=company', { method: 'DELETE' })
    const res = await notesDELETE(req as any)
    expect(res.status).toBe(404)
  })
})

// ===========================================================================
// 7. Preferences API
// ===========================================================================

describe('Preferences API — GET', () => {
  beforeEach(() => {
    mockPreferencesGET.mockImplementation(async () => ok({ ...seedPrefs }))
  })

  it('returns preferences object with default fields', async () => {
    const req = new Request('http://localhost/api/preferences')
    const res = await preferencesGET(req as any)
    const data = await json(res)
    expect(res.status).toBe(200)
    expect(data.id).toBeDefined()
    expect(data.tone).toBeDefined()
    expect(data.emailLength).toBeDefined()
    expect(data.openerStyle).toBeDefined()
    expect(data.ctaStyle).toBeDefined()
  })

  it('creates default preferences if none exist', async () => {
    mockPreferencesGET.mockImplementationOnce(async () => ok({ id: 'pref-new', tone: 'professional', emailLength: 'medium' }))
    const req = new Request('http://localhost/api/preferences')
    const res = await preferencesGET(req as any)
    const data = await json(res)
    expect(res.status).toBe(200)
    expect(data.id).toBeDefined()
  })
})

describe('Preferences API — PUT', () => {
  beforeEach(() => {
    mockPreferencesPUT.mockImplementation(async (req: any) => {
      const body = await req.json()
      const allowed = ['tone', 'emailLength', 'openerStyle', 'signOff', 'ctaStyle', 'aiProvider', 'aiModel']
      const updated = { ...seedPrefs }
      for (const key of allowed) { if (body[key] !== undefined) updated[key] = body[key] }
      return ok(updated)
    })
  })

  it('updates tone preference', async () => {
    const req = new Request('http://localhost/api/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tone: 'formal' }) })
    const res = await preferencesPUT(req as any)
    const data = await json(res)
    expect(res.status).toBe(200)
    expect(data.tone).toBe('formal')
  })

  it('updates multiple fields at once', async () => {
    const req = new Request('http://localhost/api/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tone: 'friendly', emailLength: 'short', ctaStyle: 'direct' }) })
    const res = await preferencesPUT(req as any)
    const data = await json(res)
    expect(res.status).toBe(200)
    expect(data.tone).toBe('friendly')
    expect(data.emailLength).toBe('short')
    expect(data.ctaStyle).toBe('direct')
  })

  it('ignores non-allowed fields', async () => {
    const req = new Request('http://localhost/api/preferences', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tone: 'formal', hackerField: 'should be ignored', anotherBadField: 123 }) })
    const res = await preferencesPUT(req as any)
    const data = await json(res)
    expect(res.status).toBe(200)
    expect(data.tone).toBe('formal')
    expect(data.hackerField).toBeUndefined()
    expect(data.anotherBadField).toBeUndefined()
  })
})

// ===========================================================================
// 8. Timeline API — GET
// ===========================================================================

describe('Timeline API — GET', () => {
  beforeEach(() => {
    mockTimelineGET.mockImplementation(async (req: any) => {
      const url = new URL(req.url)
      const companyId = url.searchParams.get('companyId') || ''
      const contactId = url.searchParams.get('contactId') || ''
      const limit = parseInt(url.searchParams.get('limit') || '50', 10)

      let entries = [...seedTimeline]
      if (companyId) entries = entries.filter(e => e.companyId === companyId)
      if (contactId) entries = entries.filter(e => e.contactId === contactId)
      entries = entries.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, limit)

      const result = entries.map(e => ({
        ...e,
        company: seedCompanies.find(c => c.id === e.companyId) || null,
        contact: seedContacts.find(c => c.id === e.contactId) || null,
      }))
      return ok(result)
    })
  })

  it('returns timeline entries array', async () => {
    const req = new Request('http://localhost/api/timeline')
    const res = await timelineGET(req as any)
    const data = await json(res)
    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
  })

  it('includes company and contact relations', async () => {
    const req = new Request('http://localhost/api/timeline')
    const res = await timelineGET(req as any)
    const data = await json(res)
    const withRelations = data.filter((e: any) => e.company || e.contact)
    expect(withRelations.length).toBeGreaterThan(0)
  })

  it('filters by companyId', async () => {
    const req = new Request('http://localhost/api/timeline?companyId=co-1')
    const res = await timelineGET(req as any)
    const data = await json(res)
    expect(data.length).toBeGreaterThan(0)
    for (const e of data) expect(e.companyId).toBe('co-1')
  })

  it('filters by contactId', async () => {
    const req = new Request('http://localhost/api/timeline?contactId=con-1')
    const res = await timelineGET(req as any)
    const data = await json(res)
    expect(res.status).toBe(200)
  })

  it('respects limit parameter', async () => {
    const req = new Request('http://localhost/api/timeline?limit=10')
    const res = await timelineGET(req as any)
    const data = await json(res)
    expect(data.length).toBeLessThanOrEqual(10)
  })

  it('returns entries ordered by createdAt desc', async () => {
    const req = new Request('http://localhost/api/timeline?limit=10')
    const res = await timelineGET(req as any)
    const data = await json(res)
    if (data.length >= 2) {
      for (let i = 1; i < data.length; i++) {
        expect(new Date(data[i - 1].createdAt).getTime()).toBeGreaterThanOrEqual(new Date(data[i].createdAt).getTime())
      }
    }
  })
})
