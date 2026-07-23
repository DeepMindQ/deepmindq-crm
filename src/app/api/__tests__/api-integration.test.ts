import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { db } from '../../../lib/db'
import { GET as companiesGET, POST as companiesPOST } from '../companies/route'
import { GET as contactsGET, POST as contactsPOST } from '../contacts/route'
import { POST as notesPOST, DELETE as notesDELETE } from '../notes/route'
import { GET as preferencesGET, PUT as preferencesPUT } from '../preferences/route'
import { GET as timelineGET } from '../timeline/route'

// Track IDs created during tests for cleanup
const cleanupIds: {
  companies: string[]
  contacts: string[]
  companyNotes: string[]
  contactNotes: string[]
  timelineEntries: string[]
} = {
  companies: [],
  contacts: [],
  companyNotes: [],
  contactNotes: [],
  timelineEntries: [],
}

beforeEach(() => {
  cleanupIds.companies = []
  cleanupIds.contacts = []
  cleanupIds.companyNotes = []
  cleanupIds.contactNotes = []
  cleanupIds.timelineEntries = []
})

afterEach(async () => {
  // Clean up in reverse dependency order
  try {
    if (cleanupIds.timelineEntries.length > 0) {
      await db.companyTimelineEvent.deleteMany({
        where: { id: { in: cleanupIds.timelineEntries } },
      })
    }
    if (cleanupIds.contactNotes.length > 0) {
      await db.contactNote.deleteMany({
        where: { id: { in: cleanupIds.contactNotes } },
      })
    }
    if (cleanupIds.companyNotes.length > 0) {
      await db.companyNote.deleteMany({
        where: { id: { in: cleanupIds.companyNotes } },
      })
    }
    if (cleanupIds.contacts.length > 0) {
      await db.contact.deleteMany({
        where: { id: { in: cleanupIds.contacts } },
      })
    }
    if (cleanupIds.companies.length > 0) {
      await db.company.deleteMany({
        where: { id: { in: cleanupIds.companies } },
      })
    }
  } catch (e) {
    console.error('Cleanup error:', e)
  }
})

// ===========================================================================
// 1. Companies API
// ===========================================================================

describe('Companies API — GET', () => {
  it('returns companies array with total, page, and pageSize', async () => {
    const req = new Request('http://localhost/api/companies')
    const res = await companiesGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(data.companies)).toBe(true)
    expect(typeof data.total).toBe('number')
    expect(typeof data.page).toBe('number')
    expect(typeof data.pageSize).toBe('number')
    expect(data.total).toBeGreaterThan(0)
    expect(data.companies.length).toBeGreaterThan(0)
  })

  it('filters by search query', async () => {
    // First get a company name from the DB
    const existing = await db.company.findFirst({
      where: { status: { not: 'archived' } },
    })
    expect(existing).not.toBeNull()

    // Search for it by a substring of its name
    const searchTerm = existing!.name.slice(0, Math.min(5, existing!.name.length))
    const req = new Request(`http://localhost/api/companies?search=${encodeURIComponent(searchTerm)}`)
    const res = await companiesGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.companies.length).toBeGreaterThan(0)
    // At least one result should contain the search term in name, domain, or website
    const matches = data.companies.some(
      (c: any) =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.domain && c.domain.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.website && c.website.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    expect(matches).toBe(true)
  })

  it('filters by industry', async () => {
    // Find a company with a non-null industry
    const existing = await db.company.findFirst({
      where: { status: { not: 'archived' }, industry: { not: null } },
    })
    if (!existing) return // skip if no data

    const req = new Request(`http://localhost/api/companies?industry=${encodeURIComponent(existing.industry!)}`)
    const res = await companiesGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.companies.length).toBeGreaterThan(0)
    for (const c of data.companies) {
      expect(c.industry).toBe(existing.industry)
    }
  })

  it('filters by status', async () => {
    const req = new Request('http://localhost/api/companies?status=new')
    const res = await companiesGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    for (const c of data.companies) {
      expect(c.status).toBe('new')
    }
  })

  it('excludes archived companies by default', async () => {
    const req = new Request('http://localhost/api/companies')
    const res = await companiesGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    for (const c of data.companies) {
      expect(c.status).not.toBe('archived')
    }
  })

  it('includes _count with contacts count per company', async () => {
    const req = new Request('http://localhost/api/companies')
    const res = await companiesGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.companies.length).toBeGreaterThan(0)
    for (const c of data.companies) {
      expect(c._count).toBeDefined()
      expect(typeof c._count.contacts).toBe('number')
    }
  })

  it('respects pagination parameters', async () => {
    const req = new Request('http://localhost/api/companies?page=1&pageSize=2')
    const res = await companiesGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.companies.length).toBeLessThanOrEqual(2)
    expect(data.page).toBe(1)
    expect(data.pageSize).toBe(2)
  })
})

describe('Companies API — POST', () => {
  it('creates a company successfully', async () => {
    const req = new Request('http://localhost/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Integration Test Company',
        domain: 'https://integration-test.com',
        industry: 'SaaS',
        country: 'US',
      }),
    })

    const res = await companiesPOST(req as any)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.name).toBe('Integration Test Company')
    expect(data.domain).toBe('https://integration-test.com')
    expect(data.industry).toBe('SaaS')
    expect(data.country).toBe('US')
    expect(data.id).toBeDefined()
    cleanupIds.companies.push(data.id)
  })

  it('rejects empty name', async () => {
    const req = new Request('http://localhost/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '' }),
    })

    const res = await companiesPOST(req as any)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toMatch(/name/i)
  })

  it('rejects missing name', async () => {
    const req = new Request('http://localhost/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ domain: 'test.com' }),
    })

    const res = await companiesPOST(req as any)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(typeof data.error).toBe('string')
    expect(data.error.length).toBeGreaterThan(0)
  })

  it('rejects whitespace-only name', async () => {
    const req = new Request('http://localhost/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '   ' }),
    })

    const res = await companiesPOST(req as any)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toMatch(/name/i)
  })

  it('creates a timeline entry when company is created', async () => {
    const req = new Request('http://localhost/api/companies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Timeline Test Company' }),
    })

    const res = await companiesPOST(req as any)
    const data = await res.json()
    expect(res.status).toBe(201)

    const timeline = await db.companyTimelineEvent.findFirst({
      where: { companyId: data.id, action: 'company_created' },
    })
    expect(timeline).not.toBeNull()
    expect(timeline!.details).toContain('Timeline Test Company')
    if (timeline) cleanupIds.timelineEntries.push(timeline.id)
    cleanupIds.companies.push(data.id)
  })
})

// ===========================================================================
// 2. Contacts API
// ===========================================================================

describe('Contacts API — GET', () => {
  it('returns contacts array with total, page, and pageSize', async () => {
    const req = new Request('http://localhost/api/contacts')
    const res = await contactsGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(data.contacts)).toBe(true)
    expect(typeof data.total).toBe('number')
    expect(typeof data.page).toBe('number')
    expect(typeof data.pageSize).toBe('number')
    expect(data.total).toBeGreaterThan(0)
    expect(data.contacts.length).toBeGreaterThan(0)
  })

  it('includes company relation in each contact', async () => {
    const req = new Request('http://localhost/api/contacts')
    const res = await contactsGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    for (const c of data.contacts) {
      expect(c.company).toBeDefined()
      expect(c.company.id).toBeDefined()
      expect(c.company.name).toBeDefined()
    }
  })

  it('filters by companyId', async () => {
    // Get a real company with contacts
    const company = await db.company.findFirst({
      where: {
        status: { not: 'archived' },
        contacts: { some: { archivedAt: null } },
      },
      include: { contacts: { where: { archivedAt: null }, take: 1 } },
    })
    if (!company) return // skip if no data

    const req = new Request(`http://localhost/api/contacts?companyId=${company.id}`)
    const res = await contactsGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.contacts.length).toBeGreaterThan(0)
    for (const c of data.contacts) {
      expect(c.companyId).toBe(company.id)
    }
  })

  it('filters by search query', async () => {
    const existing = await db.contact.findFirst({ where: { archivedAt: null } })
    expect(existing).not.toBeNull()

    const searchTerm = existing!.name.slice(0, Math.min(4, existing!.name.length))
    const req = new Request(`http://localhost/api/contacts?search=${encodeURIComponent(searchTerm)}`)
    const res = await contactsGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.contacts.length).toBeGreaterThan(0)
    const matches = data.contacts.some(
      (c: any) =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (c.jobTitle && c.jobTitle.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    expect(matches).toBe(true)
  })

  it('excludes archived contacts', async () => {
    const req = new Request('http://localhost/api/contacts')
    const res = await contactsGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    for (const c of data.contacts) {
      expect(c.archivedAt).toBeNull()
    }
  })
})

describe('Contacts API — POST', () => {
  let testCompanyId: string

  beforeEach(async () => {
    // Create a company for the contact to belong to
    const company = await db.company.create({
      data: { name: 'Contact Test Parent Co' },
    })
    testCompanyId = company.id
    cleanupIds.companies.push(company.id)
  })

  it('creates a contact successfully', async () => {
    const req = new Request('http://localhost/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Integration Test Contact',
        email: 'test@integration.com',
        jobTitle: 'CEO',
        companyId: testCompanyId,
      }),
    })

    const res = await contactsPOST(req as any)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.name).toBe('Integration Test Contact')
    expect(data.email).toBe('test@integration.com')
    expect(data.jobTitle).toBe('CEO')
    expect(data.companyId).toBe(testCompanyId)
    expect(data.id).toBeDefined()
    cleanupIds.contacts.push(data.id)
  })

  it('rejects missing name', async () => {
    const req = new Request('http://localhost/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: testCompanyId,
        email: 'test@integration.com',
      }),
    })

    const res = await contactsPOST(req as any)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(typeof data.error).toBe('string')
    expect(data.error.length).toBeGreaterThan(0)
  })

  it('rejects empty name', async () => {
    const req = new Request('http://localhost/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: '',
        companyId: testCompanyId,
      }),
    })

    const res = await contactsPOST(req as any)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toMatch(/name/i)
  })

  it('rejects missing companyId', async () => {
    const req = new Request('http://localhost/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'John Doe',
      }),
    })

    const res = await contactsPOST(req as any)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(typeof data.error).toBe('string')
    expect(data.error.length).toBeGreaterThan(0)
  })

  it('returns 404 for non-existent company', async () => {
    const req = new Request('http://localhost/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'John Doe',
        companyId: 'nonexistent_company_id',
      }),
    })

    const res = await contactsPOST(req as any)
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.error).toContain('not found')
  })

  it('creates a timeline entry when contact is created', async () => {
    const req = new Request('http://localhost/api/contacts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Timeline Contact Test',
        companyId: testCompanyId,
      }),
    })

    const res = await contactsPOST(req as any)
    const data = await res.json()
    expect(res.status).toBe(201)

    const timeline = await db.companyTimelineEvent.findFirst({
      where: { contactId: data.id, action: 'contact_created' },
    })
    expect(timeline).not.toBeNull()
    expect(timeline!.details).toContain('Timeline Contact Test')
    if (timeline) cleanupIds.timelineEntries.push(timeline.id)
    cleanupIds.contacts.push(data.id)
  })
})

// ===========================================================================
// 3. Notes API
// ===========================================================================

describe('Notes API — POST', () => {
  it('creates a company note', async () => {
    const company = await db.company.create({
      data: { name: 'Note Test Company' },
    })
    cleanupIds.companies.push(company.id)

    const req = new Request('http://localhost/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: company.id,
        body: 'This is a company integration test note',
        noteType: 'call',
      }),
    })

    const res = await notesPOST(req as any)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.body).toBe('This is a company integration test note')
    expect(data.companyId).toBe(company.id)
    expect(data.noteType).toBe('call')
    expect(data.id).toBeDefined()
    cleanupIds.companyNotes.push(data.id)

    // Verify a timeline entry was created
    const timeline = await db.companyTimelineEvent.findFirst({
      where: { companyId: company.id, action: 'note_added' },
    })
    expect(timeline).not.toBeNull()
    if (timeline) cleanupIds.timelineEntries.push(timeline.id)
  })

  it('creates a contact note', async () => {
    const company = await db.company.create({
      data: { name: 'Contact Note Test Company' },
    })
    cleanupIds.companies.push(company.id)

    const contact = await db.contact.create({
      data: {
        name: 'Contact Note Test Person',
        companyId: company.id,
      },
    })
    cleanupIds.contacts.push(contact.id)

    const req = new Request('http://localhost/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactId: contact.id,
        body: 'This is a contact integration test note',
        noteType: 'meeting',
      }),
    })

    const res = await notesPOST(req as any)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.body).toBe('This is a contact integration test note')
    expect(data.contactId).toBe(contact.id)
    expect(data.noteType).toBe('meeting')
    expect(data.id).toBeDefined()
    cleanupIds.contactNotes.push(data.id)

    // Verify a timeline entry was created
    const timeline = await db.companyTimelineEvent.findFirst({
      where: { contactId: contact.id, action: 'note_added' },
    })
    expect(timeline).not.toBeNull()
    if (timeline) cleanupIds.timelineEntries.push(timeline.id)
  })

  it('rejects missing note body', async () => {
    const company = await db.company.create({
      data: { name: 'Empty Note Test Company' },
    })
    cleanupIds.companies.push(company.id)

    const req = new Request('http://localhost/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: company.id,
        body: '',
      }),
    })

    const res = await notesPOST(req as any)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('body')
  })

  it('rejects missing companyId and contactId', async () => {
    const req = new Request('http://localhost/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        body: 'Orphan note',
      }),
    })

    const res = await notesPOST(req as any)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toContain('companyId')
    expect(data.error).toContain('contactId')
  })

  it('returns 404 for non-existent company', async () => {
    const req = new Request('http://localhost/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: 'nonexistent_company',
        body: 'Note for ghost company',
      }),
    })

    const res = await notesPOST(req as any)
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.error).toContain('not found')
  })
})

describe('Notes API — DELETE', () => {
  it('deletes a company note', async () => {
    const company = await db.company.create({
      data: { name: 'Delete Note Test Company' },
    })
    cleanupIds.companies.push(company.id)

    const note = await db.companyNote.create({
      data: {
        companyId: company.id,
        body: 'Note to delete',
      },
    })

    const req = new Request(`http://localhost/api/notes?id=${note.id}&type=company`, {
      method: 'DELETE',
    })

    const res = await notesDELETE(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)

    // Verify note is gone
    const deleted = await db.companyNote.findUnique({ where: { id: note.id } })
    expect(deleted).toBeNull()
  })

  it('deletes a contact note', async () => {
    const company = await db.company.create({
      data: { name: 'Delete Contact Note Test Co' },
    })
    cleanupIds.companies.push(company.id)

    const contact = await db.contact.create({
      data: { name: 'Delete Note Contact', companyId: company.id },
    })
    cleanupIds.contacts.push(contact.id)

    const note = await db.contactNote.create({
      data: {
        contactId: contact.id,
        body: 'Contact note to delete',
      },
    })

    const req = new Request(`http://localhost/api/notes?id=${note.id}&type=contact`, {
      method: 'DELETE',
    })

    const res = await notesDELETE(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)

    const deleted = await db.contactNote.findUnique({ where: { id: note.id } })
    expect(deleted).toBeNull()
  })

  it('returns 404 for non-existent note', async () => {
    const req = new Request('http://localhost/api/notes?id=nonexistent&type=company', {
      method: 'DELETE',
    })

    const res = await notesDELETE(req as any)
    expect(res.status).toBe(404)
  })
})

// ===========================================================================
// 4. Preferences API
// ===========================================================================

describe('Preferences API — GET', () => {
  it('returns preferences object with default fields', async () => {
    const req = new Request('http://localhost/api/preferences')
    const res = await preferencesGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.id).toBeDefined()
    // Check for expected default fields
    expect(data).toHaveProperty('tone')
    expect(data).toHaveProperty('emailLength')
    expect(data).toHaveProperty('openerStyle')
    expect(data).toHaveProperty('signOff')
    expect(data).toHaveProperty('ctaStyle')
    expect(data).toHaveProperty('aiProvider')
    expect(data).toHaveProperty('aiModel')
  })

  it('creates default preferences if none exist', async () => {
    // Delete any existing preferences to test creation path
    await db.systemSetting.deleteMany({})

    const req = new Request('http://localhost/api/preferences')
    const res = await preferencesGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.id).toBeDefined()
    expect(data.tone).toBeDefined()
  })
})

describe('Preferences API — PUT', () => {
  let originalPrefs: any

  beforeEach(async () => {
    originalPrefs = await db.systemSetting.findFirst()
  })

  afterEach(async () => {
    // Restore original preferences
    if (originalPrefs) {
      await db.systemSetting.update({
        where: { id: originalPrefs.id },
        data: {
          tone: originalPrefs.tone,
          emailLength: originalPrefs.emailLength,
          openerStyle: originalPrefs.openerStyle,
          signOff: originalPrefs.signOff,
          avoidPhrases: originalPrefs.avoidPhrases,
          ctaStyle: originalPrefs.ctaStyle,
          aiProvider: originalPrefs.aiProvider,
          aiModel: originalPrefs.aiModel,
          aiApiKey: originalPrefs.aiApiKey,
        },
      })
    }
  })

  it('updates tone preference', async () => {
    const req = new Request('http://localhost/api/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tone: 'formal' }),
    })

    const res = await preferencesPUT(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.tone).toBe('formal')
  })

  it('updates multiple fields at once', async () => {
    const req = new Request('http://localhost/api/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tone: 'friendly',
        emailLength: 'short',
        ctaStyle: 'direct',
      }),
    })

    const res = await preferencesPUT(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.tone).toBe('friendly')
    expect(data.emailLength).toBe('short')
    expect(data.ctaStyle).toBe('direct')
  })

  it('ignores non-allowed fields', async () => {
    const req = new Request('http://localhost/api/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tone: 'formal',
        hackerField: 'should be ignored',
        anotherBadField: 123,
      }),
    })

    const res = await preferencesPUT(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.tone).toBe('formal')
    expect((data as any).hackerField).toBeUndefined()
    expect((data as any).anotherBadField).toBeUndefined()
  })
})

// ===========================================================================
// 5. Timeline API
// ===========================================================================

describe('Timeline API — GET', () => {
  it('returns timeline entries array', async () => {
    const req = new Request('http://localhost/api/timeline')
    const res = await timelineGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThan(0)
  })

  it('includes company and contact relations', async () => {
    const req = new Request('http://localhost/api/timeline')
    const res = await timelineGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    // At least some entries should have company or contact
    const withRelations = data.filter(
      (e: any) => e.company || e.contact
    )
    expect(withRelations.length).toBeGreaterThan(0)
  })

  it('filters by companyId', async () => {
    // Create a company and a timeline entry for it
    const company = await db.company.create({
      data: { name: 'Timeline Filter Test Co' },
    })
    cleanupIds.companies.push(company.id)

    await db.companyTimelineEvent.create({
      data: {
        companyId: company.id,
        action: 'test_action',
        details: 'Test timeline entry for filtering',
      },
    })

    const req = new Request(`http://localhost/api/timeline?companyId=${company.id}`)
    const res = await timelineGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.length).toBeGreaterThan(0)
    for (const entry of data) {
      expect(entry.companyId).toBe(company.id)
    }
  })

  it('filters by contactId', async () => {
    const company = await db.company.create({
      data: { name: 'Timeline Contact Filter Co' },
    })
    cleanupIds.companies.push(company.id)

    const contact = await db.contact.create({
      data: { name: 'Timeline Contact Filter Person', companyId: company.id },
    })
    cleanupIds.contacts.push(contact.id)

    await db.companyTimelineEvent.create({
      data: {
        companyId: company.id,
        contactId: contact.id,
        action: 'contact_test_action',
        details: 'Test timeline entry for contact filtering',
      },
    })

    const req = new Request(`http://localhost/api/timeline?contactId=${contact.id}`)
    const res = await timelineGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.length).toBeGreaterThan(0)
    for (const entry of data) {
      expect(entry.contactId).toBe(contact.id)
    }
  })

  it('respects limit parameter', async () => {
    const req = new Request('http://localhost/api/timeline?limit=10')
    const res = await timelineGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.length).toBeLessThanOrEqual(10)
  })

  it('returns entries ordered by createdAt desc', async () => {
    const req = new Request('http://localhost/api/timeline?limit=10')
    const res = await timelineGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    if (data.length >= 2) {
      for (let i = 1; i < data.length; i++) {
        const prev = new Date(data[i - 1].createdAt).getTime()
        const curr = new Date(data[i].createdAt).getTime()
        expect(prev).toBeGreaterThanOrEqual(curr)
      }
    }
  })
})