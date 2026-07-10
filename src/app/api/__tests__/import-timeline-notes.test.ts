// @vitest-environment node
import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { db } from '../../../lib/db'
import {
  GET as importsGET,
  POST as importsPOST,
} from '../imports/route'
import { GET as timelineGET } from '../timeline/route'
import {
  GET as notesGET,
  POST as notesPOST,
  DELETE as notesDELETE,
} from '../notes/route'

// ---------------------------------------------------------------------------
// Cleanup tracking
// ---------------------------------------------------------------------------
const cleanupIds: {
  importBatches: string[]
  companies: string[]
  contacts: string[]
  companyNotes: string[]
  contactNotes: string[]
  timelineEntries: string[]
} = {
  importBatches: [],
  companies: [],
  contacts: [],
  companyNotes: [],
  contactNotes: [],
  timelineEntries: [],
}

beforeEach(() => {
  cleanupIds.importBatches = []
  cleanupIds.companies = []
  cleanupIds.contacts = []
  cleanupIds.companyNotes = []
  cleanupIds.contactNotes = []
  cleanupIds.timelineEntries = []
})

afterEach(async () => {
  try {
    if (cleanupIds.timelineEntries.length > 0) {
      await db.timelineEntry.deleteMany({
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
    if (cleanupIds.importBatches.length > 0) {
      await db.importBatch.deleteMany({
        where: { id: { in: cleanupIds.importBatches } },
      })
    }
  } catch (e) {
    console.error('Cleanup error:', e)
  }
})

// ===========================================================================
// 1. Import API
// ===========================================================================

describe('Import API — GET /api/imports', () => {
  it('returns an array of ImportBatch records', async () => {
    const req = new Request('http://localhost/api/imports')
    const res = await importsGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    // Each item should have ImportBatch fields
    for (const batch of data) {
      expect(batch.id).toBeDefined()
      expect(batch.fileName).toBeDefined()
      expect(batch.totalRows).toBeDefined()
      expect(batch.status).toBeDefined()
      expect(batch.createdAt).toBeDefined()
    }
  })
})

describe('Import API — POST /api/imports (stage CSV)', () => {
  it('stages a CSV file and returns { id, fileName, totalRows }', async () => {
    const csvContent = 'Name,Email,Company\nJohn,john@test.com,Acme\n'
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const file = new File([blob], 'test-import.csv', { type: 'text/csv' })

    const formData = new FormData()
    formData.append('file', file)

    const req = new Request('http://localhost/api/imports', {
      method: 'POST',
      body: formData,
    })

    const res = await importsPOST(req as any)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.id).toBeDefined()
    expect(data.fileName).toBe('test-import.csv')
    expect(data.totalRows).toBe(1)
    expect(data.columns).toEqual(['Name', 'Email', 'Company'])
    expect(data.previewRows).toHaveLength(1)
    expect(data.previewRows[0]).toEqual(['John', 'john@test.com', 'Acme'])

    cleanupIds.importBatches.push(data.id)
  })

  it('rejects duplicate CSV uploads (same file hash)', async () => {
    const csvContent = 'Name,Email,Company\nJane,jane@test.com,Beta\n'
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const file = new File([blob], 'dup-import.csv', { type: 'text/csv' })

    const formData1 = new FormData()
    formData1.append('file', file)
    const req1 = new Request('http://localhost/api/imports', {
      method: 'POST',
      body: formData1,
    })
    const res1 = await importsPOST(req1 as any)
    expect(res1.status).toBe(201)
    const data1 = await res1.json()
    cleanupIds.importBatches.push(data1.id)

    // Upload the same content again
    const formData2 = new FormData()
    formData2.append('file', file)
    const req2 = new Request('http://localhost/api/imports', {
      method: 'POST',
      body: formData2,
    })
    const res2 = await importsPOST(req2 as any)
    expect(res2.status).toBe(409)
  })
})

describe('Import API — POST /api/imports (execute)', () => {
  it('executes import and returns counts', async () => {
    // First, stage a CSV file to get a batchId
    const csvContent = `Name,Email,Company\nJohn,john@test.com,Acme Corp\nJane,jane@test.com,Beta Inc\n`
    const blob = new Blob([csvContent], { type: 'text/csv' })
    const file = new File([blob], 'exec-import.csv', { type: 'text/csv' })

    const formData = new FormData()
    formData.append('file', file)

    const stageReq = new Request('http://localhost/api/imports', {
      method: 'POST',
      body: formData,
    })
    const stageRes = await importsPOST(stageReq as any)
    expect(stageRes.status).toBe(201)
    const staged = await stageRes.json()
    cleanupIds.importBatches.push(staged.id)

    // Execute the import
    const executeReq = new Request('http://localhost/api/imports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'execute',
        batchId: staged.id,
        mapping: {
          contactName: 0, // Name
          email: 1,       // Email
          companyName: 2, // Company
        },
        rows: [
          ['John', 'john@test.com', 'Acme Corp'],
          ['Jane', 'jane@test.com', 'Beta Inc'],
        ],
      }),
    })

    const res = await importsPOST(executeReq as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.accepted).toBe(2)
    expect(data.duplicates).toBe(0)
    expect(data.invalid).toBe(0)

    // Track created companies and contacts for cleanup
    const acme = await db.company.findFirst({ where: { name: 'Acme Corp' } })
    const beta = await db.company.findFirst({ where: { name: 'Beta Inc' } })
    if (acme) cleanupIds.companies.push(acme.id)
    if (beta) cleanupIds.companies.push(beta.id)

    const acmeContact = await db.contact.findFirst({
      where: { companyId: acme?.id, email: 'john@test.com' },
    })
    const betaContact = await db.contact.findFirst({
      where: { companyId: beta?.id, email: 'jane@test.com' },
    })
    if (acmeContact) cleanupIds.contacts.push(acmeContact.id)
    if (betaContact) cleanupIds.contacts.push(betaContact.id)

    // Track the timeline entry created by executeImport
    const tlEntry = await db.timelineEntry.findFirst({
      where: { action: 'Import Completed' },
    })
    if (tlEntry) cleanupIds.timelineEntries.push(tlEntry.id)
  })

  it('returns 404 for non-existent batch', async () => {
    const req = new Request('http://localhost/api/imports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'execute',
        batchId: 'nonexistent_batch_id',
        mapping: { contactName: 0, companyName: 1 },
        rows: [['Test', 'TestCo']],
      }),
    })

    const res = await importsPOST(req as any)
    expect(res.status).toBe(404)
  })
})

// ===========================================================================
// 2. Timeline API
// ===========================================================================

describe('Timeline API — GET /api/timeline', () => {
  it('returns an array of timeline entries', async () => {
    const req = new Request('http://localhost/api/timeline')
    const res = await timelineGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
  })

  it('filters by companyId', async () => {
    // Create a company and a timeline entry for it
    const company = await db.company.create({
      data: { name: 'Timeline Test Co' },
    })
    cleanupIds.companies.push(company.id)

    const entry = await db.timelineEntry.create({
      data: {
        companyId: company.id,
        action: 'test_filter_company',
        details: 'Testing company filter',
      },
    })
    cleanupIds.timelineEntries.push(entry.id)

    const req = new Request(
      `http://localhost/api/timeline?companyId=${company.id}`,
    )
    const res = await timelineGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThanOrEqual(1)
    // All returned entries should belong to this company
    for (const item of data) {
      expect(item.companyId).toBe(company.id)
    }
  })

  it('respects the limit parameter', async () => {
    // Create several timeline entries
    for (let i = 0; i < 3; i++) {
      const entry = await db.timelineEntry.create({
        data: {
          action: `test_limit_${i}`,
          details: `Entry ${i} for limit test`,
        },
      })
      cleanupIds.timelineEntries.push(entry.id)
    }

    const req = new Request('http://localhost/api/timeline?limit=2')
    const res = await timelineGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeLessThanOrEqual(2)
  })
})

// ===========================================================================
// 3. Notes API — Extended Tests
// ===========================================================================

describe('Notes API — GET /api/notes', () => {
  it('returns notes from both tables', async () => {
    // Create a company + company note and a contact + contact note
    const company = await db.company.create({
      data: { name: 'Notes Both Co' },
    })
    cleanupIds.companies.push(company.id)

    const contact = await db.contact.create({
      data: { companyId: company.id, name: 'Notes Both Person', email: 'notes.both@test.com' },
    })
    cleanupIds.contacts.push(contact.id)

    const cNote = await db.companyNote.create({
      data: { companyId: company.id, body: 'Company note for both test' },
    })
    cleanupIds.companyNotes.push(cNote.id)

    const pNote = await db.contactNote.create({
      data: { contactId: contact.id, body: 'Contact note for both test' },
    })
    cleanupIds.contactNotes.push(pNote.id)

    const req = new Request('http://localhost/api/notes')
    const res = await notesGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    // Should contain at least the two notes we just created
    const hasCompanyNote = data.some(
      (n: any) => n.id === cNote.id && n._type === 'company',
    )
    const hasContactNote = data.some(
      (n: any) => n.id === pNote.id && n._type === 'contact',
    )
    expect(hasCompanyNote).toBe(true)
    expect(hasContactNote).toBe(true)
  })

  it('filters to company notes only with ?companyId=X', async () => {
    const company = await db.company.create({
      data: { name: 'Notes Company Filter Co' },
    })
    cleanupIds.companies.push(company.id)

    const note = await db.companyNote.create({
      data: { companyId: company.id, body: 'Filtered company note' },
    })
    cleanupIds.companyNotes.push(note.id)

    const req = new Request(`http://localhost/api/notes?companyId=${company.id}`)
    const res = await notesGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThanOrEqual(1)
    for (const n of data) {
      expect(n.companyId).toBe(company.id)
      expect(n._type).toBe('company')
    }
  })

  it('filters to contact notes only with ?contactId=X', async () => {
    const company = await db.company.create({
      data: { name: 'Notes Contact Filter Co' },
    })
    cleanupIds.companies.push(company.id)

    const contact = await db.contact.create({
      data: { companyId: company.id, name: 'Notes Contact Filter Person', email: 'ncf@test.com' },
    })
    cleanupIds.contacts.push(contact.id)

    const note = await db.contactNote.create({
      data: { contactId: contact.id, body: 'Filtered contact note' },
    })
    cleanupIds.contactNotes.push(note.id)

    const req = new Request(`http://localhost/api/notes?contactId=${contact.id}`)
    const res = await notesGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThanOrEqual(1)
    for (const n of data) {
      expect(n.contactId).toBe(contact.id)
      expect(n._type).toBe('contact')
    }
  })
})

describe('Notes API — POST company note + verify TimelineEntry', () => {
  it('creates a company note and a timeline entry', async () => {
    const company = await db.company.create({
      data: { name: 'Notes Post Company Co' },
    })
    cleanupIds.companies.push(company.id)

    const req = new Request('http://localhost/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: company.id,
        body: 'Company note with timeline verification',
        noteType: 'call',
      }),
    })

    const res = await notesPOST(req as any)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.id).toBeDefined()
    expect(data.body).toBe('Company note with timeline verification')
    expect(data.companyId).toBe(company.id)
    expect(data._type).toBe('company')
    cleanupIds.companyNotes.push(data.id)

    // Verify a timeline entry was created
    const tlEntry = await db.timelineEntry.findFirst({
      where: { companyId: company.id, action: 'note_added' },
    })
    expect(tlEntry).not.toBeNull()
    expect(tlEntry!.details).toContain('Notes Post Company Co')
    if (tlEntry) cleanupIds.timelineEntries.push(tlEntry.id)
  })
})

describe('Notes API — POST contact note + verify TimelineEntry', () => {
  it('creates a contact note and a timeline entry', async () => {
    const company = await db.company.create({
      data: { name: 'Notes Post Contact Co' },
    })
    cleanupIds.companies.push(company.id)

    const contact = await db.contact.create({
      data: { companyId: company.id, name: 'Notes Post Contact Person', email: 'npc@test.com' },
    })
    cleanupIds.contacts.push(contact.id)

    const req = new Request('http://localhost/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactId: contact.id,
        body: 'Contact note with timeline verification',
        noteType: 'meeting',
      }),
    })

    const res = await notesPOST(req as any)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.id).toBeDefined()
    expect(data.body).toBe('Contact note with timeline verification')
    expect(data.contactId).toBe(contact.id)
    expect(data._type).toBe('contact')
    cleanupIds.contactNotes.push(data.id)

    // Verify a timeline entry was created
    const tlEntry = await db.timelineEntry.findFirst({
      where: { contactId: contact.id, action: 'note_added' },
    })
    expect(tlEntry).not.toBeNull()
    expect(tlEntry!.details).toContain('Notes Post Contact Person')
    if (tlEntry) cleanupIds.timelineEntries.push(tlEntry.id)
  })
})

describe('Notes API — DELETE note', () => {
  it('deletes a company note and verifies it is gone', async () => {
    const company = await db.company.create({
      data: { name: 'Notes Delete Co' },
    })
    cleanupIds.companies.push(company.id)

    const note = await db.companyNote.create({
      data: { companyId: company.id, body: 'Note to delete' },
    })

    const req = new Request(`http://localhost/api/notes?id=${note.id}`, {
      method: 'DELETE',
    })

    const res = await notesDELETE(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)

    // Verify the note is gone
    const deleted = await db.companyNote.findUnique({ where: { id: note.id } })
    expect(deleted).toBeNull()

    // Clean up the timeline entry created by the delete handler
    const tlEntry = await db.timelineEntry.findFirst({
      where: { companyId: company.id, action: 'note_deleted' },
    })
    if (tlEntry) cleanupIds.timelineEntries.push(tlEntry.id)
  })

  it('deletes a contact note and verifies it is gone', async () => {
    const company = await db.company.create({
      data: { name: 'Notes Delete Contact Co' },
    })
    cleanupIds.companies.push(company.id)

    const contact = await db.contact.create({
      data: { companyId: company.id, name: 'Notes Delete Contact Person', email: 'ndc@test.com' },
    })
    cleanupIds.contacts.push(contact.id)

    const note = await db.contactNote.create({
      data: { contactId: contact.id, body: 'Contact note to delete' },
    })

    const req = new Request(`http://localhost/api/notes?id=${note.id}`, {
      method: 'DELETE',
    })

    const res = await notesDELETE(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)

    // Verify the note is gone
    const deleted = await db.contactNote.findUnique({ where: { id: note.id } })
    expect(deleted).toBeNull()

    // Clean up the timeline entry created by the delete handler
    const tlEntry = await db.timelineEntry.findFirst({
      where: { contactId: contact.id, action: 'note_deleted' },
    })
    if (tlEntry) cleanupIds.timelineEntries.push(tlEntry.id)
  })
})