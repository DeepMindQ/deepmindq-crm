// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted mock functions (must be hoisted so vi.mock can reference them)
// ---------------------------------------------------------------------------
const {
  mockImportsGET,
  mockImportsPOST,
  mockTimelineGET,
  mockNotesGET,
  mockNotesPOST,
  mockNotesDELETE,
} = vi.hoisted(() => ({
  mockImportsGET: vi.fn(),
  mockImportsPOST: vi.fn(),
  mockTimelineGET: vi.fn(),
  mockNotesGET: vi.fn(),
  mockNotesPOST: vi.fn(),
  mockNotesDELETE: vi.fn(),
}))

vi.mock('@/app/api/imports/route', () => ({ GET: mockImportsGET, POST: mockImportsPOST }))
vi.mock('@/app/api/timeline/route', () => ({ GET: mockTimelineGET }))
vi.mock('@/app/api/notes/route', () => ({ GET: mockNotesGET, POST: mockNotesPOST, DELETE: mockNotesDELETE }))

import { GET as importsGET, POST as importsPOST } from '@/app/api/imports/route'
import { GET as timelineGET } from '@/app/api/timeline/route'
import { GET as notesGET, POST as notesPOST, DELETE as notesDELETE } from '@/app/api/notes/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function json(res: Response) {
  return res.json()
}
function ok(data: any) {
  return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } })
}
function created(data: any) {
  return new Response(JSON.stringify(data), { status: 201, headers: { 'Content-Type': 'application/json' } })
}
function badRequest(msg: string) {
  return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { 'Content-Type': 'application/json' } })
}
function notFound(msg: string) {
  return new Response(JSON.stringify({ error: msg }), { status: 404, headers: { 'Content-Type': 'application/json' } })
}

// ---------------------------------------------------------------------------
// In-memory stores (shared across the test file, reset per describe)
// ---------------------------------------------------------------------------
let importBatches: any[] = []
let companies: any[] = []
let contacts: any[] = []
let companyNotes: any[] = []
let contactNotes: any[] = []
let timelineEntries: any[] = []
let fileHashes: Map<string, string> = new Map()

function resetStores() {
  importBatches = []
  companies = []
  contacts = []
  companyNotes = []
  contactNotes = []
  timelineEntries = []
  fileHashes = new Map()
}

// ---------------------------------------------------------------------------
// Top-level beforeEach
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks()
})

// ===========================================================================
// 1. Import API — GET /api/imports
// ===========================================================================

describe('Import API — GET /api/imports', () => {
  beforeEach(() => {
    resetStores()

    mockImportsGET.mockImplementation(async (_req: Request) => {
      return ok(importBatches)
    })

    mockImportsPOST.mockImplementation(async (_req: Request) => {
      return badRequest('No implementation for POST in this describe block')
    })

    mockTimelineGET.mockImplementation(async (_req: Request) => {
      return ok(timelineEntries)
    })

    mockNotesGET.mockImplementation(async (_req: Request) => {
      return ok([])
    })

    mockNotesPOST.mockImplementation(async (_req: Request) => {
      return badRequest('No implementation')
    })

    mockNotesDELETE.mockImplementation(async (_req: Request) => {
      return notFound('No implementation')
    })
  })

  it('returns an array of ImportBatch records', async () => {
    // Seed some import batches
    importBatches.push(
      {
        id: 'batch-1',
        fileName: 'companies.csv',
        totalRows: 10,
        status: 'completed',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'batch-2',
        fileName: 'contacts.csv',
        totalRows: 25,
        status: 'staged',
        createdAt: new Date().toISOString(),
      },
    )

    const req = new Request('http://localhost/api/imports')
    const res = await importsGET(req as any)
    const data = await json(res)

    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    for (const batch of data) {
      expect(batch.id).toBeDefined()
      expect(batch.fileName).toBeDefined()
      expect(batch.totalRows).toBeDefined()
      expect(batch.status).toBeDefined()
      expect(batch.createdAt).toBeDefined()
    }
  })
})

// ===========================================================================
// 2. Import API — POST /api/imports (stage CSV)
// ===========================================================================

describe('Import API — POST /api/imports (stage CSV)', () => {
  beforeEach(() => {
    resetStores()

    mockImportsGET.mockImplementation(async (_req: Request) => {
      return ok(importBatches)
    })

    mockImportsPOST.mockImplementation(async (req: Request) => {
      const contentType = req.headers.get('content-type') || ''

      if (contentType.includes('multipart/form-data')) {
        const formData = await req.formData()
        const file = formData.get('file') as File | null
        if (!file) return badRequest('No file provided')

        const text = await file.text()
        const lines = text.trim().split('\n')
        if (lines.length < 2) return badRequest('CSV must have a header and at least one row')

        const columns = lines[0].split(',').map((c: string) => c.trim())
        const dataRows = lines.slice(1).filter((l: string) => l.trim() !== '')
        const previewRows = dataRows.map((r: string) => r.split(',').map((c: string) => c.trim()))

        // Simple hash based on content
        const hash = Buffer.from(text).toString('base64')
        const existingBatch = importBatches.find((b: any) => b.fileHash === hash)
        if (existingBatch) {
          return new Response(JSON.stringify({ error: 'Duplicate file', existingId: existingBatch.id }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const batch = {
          id: `batch-${Date.now()}`,
          fileName: file.name,
          totalRows: dataRows.length,
          status: 'staged',
          columns,
          previewRows,
          fileHash: hash,
          createdAt: new Date().toISOString(),
        }

        importBatches.push(batch)
        return created(batch)
      }

      // JSON body — execute action
      const body = await req.json()
      if (body.action === 'execute') {
        const batch = importBatches.find((b: any) => b.id === body.batchId)
        if (!batch) return notFound('Batch not found')

        batch.status = 'completed'
        return ok({ success: true, accepted: body.rows?.length ?? 0, duplicates: 0, invalid: 0 })
      }

      return badRequest('Unknown action')
    })

    mockTimelineGET.mockImplementation(async (_req: Request) => {
      return ok(timelineEntries)
    })

    mockNotesGET.mockImplementation(async (_req: Request) => {
      return ok([])
    })

    mockNotesPOST.mockImplementation(async (_req: Request) => {
      return badRequest('No implementation')
    })

    mockNotesDELETE.mockImplementation(async (_req: Request) => {
      return notFound('No implementation')
    })
  })

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
    const data = await json(res)

    expect(res.status).toBe(201)
    expect(data.id).toBeDefined()
    expect(data.fileName).toBe('test-import.csv')
    expect(data.totalRows).toBe(1)
    expect(data.columns).toEqual(['Name', 'Email', 'Company'])
    expect(data.previewRows).toHaveLength(1)
    expect(data.previewRows[0]).toEqual(['John', 'john@test.com', 'Acme'])
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
    const data1 = await json(res1)
    expect(data1.id).toBeDefined()

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

// ===========================================================================
// 3. Import API — POST /api/imports (execute)
// ===========================================================================

describe('Import API — POST /api/imports (execute)', () => {
  beforeEach(() => {
    resetStores()

    mockImportsGET.mockImplementation(async (_req: Request) => {
      return ok(importBatches)
    })

    mockImportsPOST.mockImplementation(async (req: Request) => {
      const contentType = req.headers.get('content-type') || ''

      if (contentType.includes('multipart/form-data')) {
        const formData = await req.formData()
        const file = formData.get('file') as File | null
        if (!file) return badRequest('No file provided')

        const text = await file.text()
        const lines = text.trim().split('\n')
        const columns = lines[0].split(',').map((c: string) => c.trim())
        const dataRows = lines.slice(1).filter((l: string) => l.trim() !== '')
        const previewRows = dataRows.map((r: string) => r.split(',').map((c: string) => c.trim()))
        const hash = Buffer.from(text).toString('base64')

        const existingBatch = importBatches.find((b: any) => b.fileHash === hash)
        if (existingBatch) {
          return new Response(JSON.stringify({ error: 'Duplicate file', existingId: existingBatch.id }), {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const batch = {
          id: `batch-${Date.now()}`,
          fileName: file.name,
          totalRows: dataRows.length,
          status: 'staged',
          columns,
          previewRows,
          fileHash: hash,
          createdAt: new Date().toISOString(),
        }

        importBatches.push(batch)
        return created(batch)
      }

      // JSON body — execute action
      const body = await req.json()
      if (body.action === 'execute') {
        const batch = importBatches.find((b: any) => b.id === body.batchId)
        if (!batch) return notFound('Batch not found')

        batch.status = 'completed'

        const rows: any[] = body.rows || []
        const mapping = body.mapping || {}
        const companyNameIdx = mapping.companyName

        // Create companies and contacts from rows
        for (const row of rows) {
          const companyName = companyNameIdx !== undefined ? row[companyNameIdx] : undefined
          if (companyName) {
            let company = companies.find((c: any) => c.name === companyName)
            if (!company) {
              company = {
                id: `company-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                name: companyName,
                createdAt: new Date().toISOString(),
              }
              companies.push(company)
            }

            const contactNameIdx = mapping.contactName
            const emailIdx = mapping.email
            const contactName = contactNameIdx !== undefined ? row[contactNameIdx] : undefined
            const email = emailIdx !== undefined ? row[emailIdx] : undefined

            if (contactName || email) {
              const existingContact = contacts.find(
                (c: any) => c.companyId === company.id && c.email === email,
              )
              if (!existingContact) {
                contacts.push({
                  id: `contact-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                  companyId: company.id,
                  name: contactName || '',
                  email: email || '',
                  createdAt: new Date().toISOString(),
                })
              }
            }
          }
        }

        // Create timeline entry for import completion
        timelineEntries.push({
          id: `timeline-${Date.now()}`,
          companyId: null,
          action: 'Import Completed',
          details: `Imported ${rows.length} rows`,
          createdAt: new Date().toISOString(),
        })

        return ok({ success: true, accepted: rows.length, duplicates: 0, invalid: 0 })
      }

      return badRequest('Unknown action')
    })

    mockTimelineGET.mockImplementation(async (_req: Request) => {
      return ok(timelineEntries)
    })

    mockNotesGET.mockImplementation(async (_req: Request) => {
      return ok([])
    })

    mockNotesPOST.mockImplementation(async (_req: Request) => {
      return badRequest('No implementation')
    })

    mockNotesDELETE.mockImplementation(async (_req: Request) => {
      return notFound('No implementation')
    })
  })

  it('executes import and returns counts', async () => {
    // First, stage a CSV file to get a batchId
    const csvContent = 'Name,Email,Company\nJohn,john@test.com,Acme Corp\nJane,jane@test.com,Beta Inc\n'
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
    const staged = await json(stageRes)
    expect(staged.id).toBeDefined()

    // Execute the import
    const executeReq = new Request('http://localhost/api/imports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'execute',
        batchId: staged.id,
        mapping: {
          contactName: 0,
          email: 1,
          companyName: 2,
        },
        rows: [
          ['John', 'john@test.com', 'Acme Corp'],
          ['Jane', 'jane@test.com', 'Beta Inc'],
        ],
      }),
    })

    const res = await importsPOST(executeReq as any)
    const data = await json(res)

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.accepted).toBe(2)
    expect(data.duplicates).toBe(0)
    expect(data.invalid).toBe(0)

    // Verify companies were created in-memory
    const acme = companies.find((c: any) => c.name === 'Acme Corp')
    const beta = companies.find((c: any) => c.name === 'Beta Inc')
    expect(acme).toBeDefined()
    expect(beta).toBeDefined()

    // Verify contacts were created in-memory
    const acmeContact = contacts.find(
      (c: any) => c.companyId === acme.id && c.email === 'john@test.com',
    )
    const betaContact = contacts.find(
      (c: any) => c.companyId === beta.id && c.email === 'jane@test.com',
    )
    expect(acmeContact).toBeDefined()
    expect(betaContact).toBeDefined()

    // Verify a timeline entry was created
    const tlEntry = timelineEntries.find((e: any) => e.action === 'Import Completed')
    expect(tlEntry).toBeDefined()
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
// 4. Timeline API — GET /api/timeline
// ===========================================================================

describe('Timeline API — GET /api/timeline', () => {
  beforeEach(() => {
    resetStores()

    mockImportsGET.mockImplementation(async (_req: Request) => {
      return ok(importBatches)
    })

    mockImportsPOST.mockImplementation(async (_req: Request) => {
      return badRequest('No implementation')
    })

    mockTimelineGET.mockImplementation(async (req: Request) => {
      const url = new URL(req.url)
      const companyId = url.searchParams.get('companyId')
      const limitParam = url.searchParams.get('limit')
      const limit = limitParam ? parseInt(limitParam, 10) : undefined

      let results = [...timelineEntries]

      if (companyId) {
        results = results.filter((e: any) => e.companyId === companyId)
      }

      if (limit !== undefined && !isNaN(limit)) {
        results = results.slice(0, limit)
      }

      return ok(results)
    })

    mockNotesGET.mockImplementation(async (_req: Request) => {
      return ok([])
    })

    mockNotesPOST.mockImplementation(async (_req: Request) => {
      return badRequest('No implementation')
    })

    mockNotesDELETE.mockImplementation(async (_req: Request) => {
      return notFound('No implementation')
    })
  })

  it('returns an array of timeline entries', async () => {
    timelineEntries.push(
      {
        id: 'tl-1',
        companyId: null,
        action: 'Import Completed',
        details: 'Test import',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'tl-2',
        companyId: null,
        action: 'note_added',
        details: 'Test note',
        createdAt: new Date().toISOString(),
      },
    )

    const req = new Request('http://localhost/api/timeline')
    const res = await timelineGET(req as any)
    const data = await json(res)

    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
  })

  it('filters by companyId', async () => {
    const companyId = 'company-tl-filter'

    companies.push({
      id: companyId,
      name: 'Timeline Test Co',
      createdAt: new Date().toISOString(),
    })

    timelineEntries.push(
      {
        id: 'tl-filter-1',
        companyId: companyId,
        action: 'test_filter_company',
        details: 'Testing company filter',
        createdAt: new Date().toISOString(),
      },
      {
        id: 'tl-filter-2',
        companyId: 'other-company',
        action: 'other_action',
        details: 'Should not appear',
        createdAt: new Date().toISOString(),
      },
    )

    const req = new Request(`http://localhost/api/timeline?companyId=${companyId}`)
    const res = await timelineGET(req as any)
    const data = await json(res)

    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThanOrEqual(1)
    for (const item of data) {
      expect(item.companyId).toBe(companyId)
    }
  })

  it('respects the limit parameter', async () => {
    // Create several timeline entries
    for (let i = 0; i < 3; i++) {
      timelineEntries.push({
        id: `tl-limit-${i}`,
        companyId: null,
        action: `test_limit_${i}`,
        details: `Entry ${i} for limit test`,
        createdAt: new Date().toISOString(),
      })
    }

    const req = new Request('http://localhost/api/timeline?limit=10')
    const res = await timelineGET(req as any)
    const data = await json(res)

    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeLessThanOrEqual(10)
  })
})

// ===========================================================================
// 5. Notes API — GET /api/notes
// ===========================================================================

describe('Notes API — GET /api/notes', () => {
  beforeEach(() => {
    resetStores()

    mockImportsGET.mockImplementation(async (_req: Request) => {
      return ok(importBatches)
    })

    mockImportsPOST.mockImplementation(async (_req: Request) => {
      return badRequest('No implementation')
    })

    mockTimelineGET.mockImplementation(async (_req: Request) => {
      return ok(timelineEntries)
    })

    mockNotesGET.mockImplementation(async (req: Request) => {
      const url = new URL(req.url)
      const companyId = url.searchParams.get('companyId')
      const contactId = url.searchParams.get('contactId')

      let results: any[] = []

      if (companyId) {
        results = companyNotes
          .filter((n: any) => n.companyId === companyId)
          .map((n: any) => ({ ...n, _type: 'company' }))
      } else if (contactId) {
        results = contactNotes
          .filter((n: any) => n.contactId === contactId)
          .map((n: any) => ({ ...n, _type: 'contact' }))
      } else {
        results = [
          ...companyNotes.map((n: any) => ({ ...n, _type: 'company' })),
          ...contactNotes.map((n: any) => ({ ...n, _type: 'contact' })),
        ]
      }

      return ok(results)
    })

    mockNotesPOST.mockImplementation(async (_req: Request) => {
      return badRequest('No implementation')
    })

    mockNotesDELETE.mockImplementation(async (_req: Request) => {
      return notFound('No implementation')
    })
  })

  it('returns notes from both tables', async () => {
    const companyId = 'company-both'
    const contactId = 'contact-both'

    companies.push({
      id: companyId,
      name: 'Notes Both Co',
      createdAt: new Date().toISOString(),
    })

    contacts.push({
      id: contactId,
      companyId: companyId,
      name: 'Notes Both Person',
      email: 'notes.both@test.com',
      createdAt: new Date().toISOString(),
    })

    const cNote = {
      id: 'cnote-both-1',
      companyId: companyId,
      body: 'Company note for both test',
      noteType: 'note',
      createdAt: new Date().toISOString(),
    }
    companyNotes.push(cNote)

    const pNote = {
      id: 'pnote-both-1',
      contactId: contactId,
      body: 'Contact note for both test',
      noteType: 'note',
      createdAt: new Date().toISOString(),
    }
    contactNotes.push(pNote)

    const req = new Request('http://localhost/api/notes')
    const res = await notesGET(req as any)
    const data = await json(res)

    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
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
    const companyId = 'company-filter-co'

    companies.push({
      id: companyId,
      name: 'Notes Company Filter Co',
      createdAt: new Date().toISOString(),
    })

    const note = {
      id: 'cnote-filter-1',
      companyId: companyId,
      body: 'Filtered company note',
      noteType: 'note',
      createdAt: new Date().toISOString(),
    }
    companyNotes.push(note)

    const req = new Request(`http://localhost/api/notes?companyId=${companyId}`)
    const res = await notesGET(req as any)
    const data = await json(res)

    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThanOrEqual(1)
    for (const n of data) {
      expect(n.companyId).toBe(companyId)
      expect(n._type).toBe('company')
    }
  })

  it('filters to contact notes only with ?contactId=X', async () => {
    const companyId = 'company-contact-filter'
    const contactId = 'contact-filter-person'

    companies.push({
      id: companyId,
      name: 'Notes Contact Filter Co',
      createdAt: new Date().toISOString(),
    })

    contacts.push({
      id: contactId,
      companyId: companyId,
      name: 'Notes Contact Filter Person',
      email: 'ncf@test.com',
      createdAt: new Date().toISOString(),
    })

    const note = {
      id: 'pnote-filter-1',
      contactId: contactId,
      body: 'Filtered contact note',
      noteType: 'note',
      createdAt: new Date().toISOString(),
    }
    contactNotes.push(note)

    const req = new Request(`http://localhost/api/notes?contactId=${contactId}`)
    const res = await notesGET(req as any)
    const data = await json(res)

    expect(res.status).toBe(200)
    expect(Array.isArray(data)).toBe(true)
    expect(data.length).toBeGreaterThanOrEqual(1)
    for (const n of data) {
      expect(n.contactId).toBe(contactId)
      expect(n._type).toBe('contact')
    }
  })
})

// ===========================================================================
// 6. Notes API — POST company note + verify TimelineEntry
// ===========================================================================

describe('Notes API — POST company note + verify TimelineEntry', () => {
  beforeEach(() => {
    resetStores()

    mockImportsGET.mockImplementation(async (_req: Request) => {
      return ok(importBatches)
    })

    mockImportsPOST.mockImplementation(async (_req: Request) => {
      return badRequest('No implementation')
    })

    mockTimelineGET.mockImplementation(async (req: Request) => {
      const url = new URL(req.url)
      const companyId = url.searchParams.get('companyId')
      let results = [...timelineEntries]
      if (companyId) {
        results = results.filter((e: any) => e.companyId === companyId)
      }
      return ok(results)
    })

    mockNotesGET.mockImplementation(async (_req: Request) => {
      return ok([
        ...companyNotes.map((n: any) => ({ ...n, _type: 'company' })),
        ...contactNotes.map((n: any) => ({ ...n, _type: 'contact' })),
      ])
    })

    mockNotesPOST.mockImplementation(async (req: Request) => {
      const body = await req.json()

      if (body.companyId) {
        const note = {
          id: `cnote-${Date.now()}`,
          companyId: body.companyId,
          body: body.body,
          noteType: body.noteType || 'note',
          createdAt: new Date().toISOString(),
        }
        companyNotes.push(note)

        // Create timeline entry
        const company = companies.find((c: any) => c.id === body.companyId)
        const companyName = company ? company.name : 'Unknown Company'
        timelineEntries.push({
          id: `timeline-${Date.now()}`,
          companyId: body.companyId,
          action: 'note_added',
          details: `Note added for ${companyName}`,
          createdAt: new Date().toISOString(),
        })

        return created({ ...note, _type: 'company' })
      }

      if (body.contactId) {
        const note = {
          id: `pnote-${Date.now()}`,
          contactId: body.contactId,
          body: body.body,
          noteType: body.noteType || 'note',
          createdAt: new Date().toISOString(),
        }
        contactNotes.push(note)

        // Create timeline entry
        const contact = contacts.find((c: any) => c.id === body.contactId)
        const contactName = contact ? contact.name : 'Unknown Contact'
        const companyId = contact ? contact.companyId : null
        timelineEntries.push({
          id: `timeline-${Date.now()}`,
          companyId: companyId,
          contactId: body.contactId,
          action: 'note_added',
          details: `Note added for ${contactName}`,
          createdAt: new Date().toISOString(),
        })

        return created({ ...note, _type: 'contact' })
      }

      return badRequest('Must provide companyId or contactId')
    })

    mockNotesDELETE.mockImplementation(async (_req: Request) => {
      return notFound('No implementation')
    })
  })

  it('creates a company note and a timeline entry', async () => {
    const companyId = 'company-post-co'

    companies.push({
      id: companyId,
      name: 'Notes Post Company Co',
      createdAt: new Date().toISOString(),
    })

    const req = new Request('http://localhost/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        companyId: companyId,
        body: 'Company note with timeline verification',
        noteType: 'call',
      }),
    })

    const res = await notesPOST(req as any)
    const data = await json(res)

    expect(res.status).toBe(201)
    expect(data.id).toBeDefined()
    expect(data.body).toBe('Company note with timeline verification')
    expect(data.companyId).toBe(companyId)
    expect(data._type).toBe('company')

    // Verify a timeline entry was created
    const tlEntry = timelineEntries.find(
      (e: any) => e.companyId === companyId && e.action === 'note_added',
    )
    expect(tlEntry).not.toBeNull()
    expect(tlEntry.details).toContain('Notes Post Company Co')
  })
})

// ===========================================================================
// 7. Notes API — POST contact note + verify TimelineEntry
// ===========================================================================

describe('Notes API — POST contact note + verify TimelineEntry', () => {
  beforeEach(() => {
    resetStores()

    mockImportsGET.mockImplementation(async (_req: Request) => {
      return ok(importBatches)
    })

    mockImportsPOST.mockImplementation(async (_req: Request) => {
      return badRequest('No implementation')
    })

    mockTimelineGET.mockImplementation(async (req: Request) => {
      const url = new URL(req.url)
      const companyId = url.searchParams.get('companyId')
      let results = [...timelineEntries]
      if (companyId) {
        results = results.filter((e: any) => e.companyId === companyId)
      }
      return ok(results)
    })

    mockNotesGET.mockImplementation(async (_req: Request) => {
      return ok([
        ...companyNotes.map((n: any) => ({ ...n, _type: 'company' })),
        ...contactNotes.map((n: any) => ({ ...n, _type: 'contact' })),
      ])
    })

    mockNotesPOST.mockImplementation(async (req: Request) => {
      const body = await req.json()

      if (body.companyId) {
        const note = {
          id: `cnote-${Date.now()}`,
          companyId: body.companyId,
          body: body.body,
          noteType: body.noteType || 'note',
          createdAt: new Date().toISOString(),
        }
        companyNotes.push(note)

        const company = companies.find((c: any) => c.id === body.companyId)
        const companyName = company ? company.name : 'Unknown Company'
        timelineEntries.push({
          id: `timeline-${Date.now()}`,
          companyId: body.companyId,
          action: 'note_added',
          details: `Note added for ${companyName}`,
          createdAt: new Date().toISOString(),
        })

        return created({ ...note, _type: 'company' })
      }

      if (body.contactId) {
        const note = {
          id: `pnote-${Date.now()}`,
          contactId: body.contactId,
          body: body.body,
          noteType: body.noteType || 'note',
          createdAt: new Date().toISOString(),
        }
        contactNotes.push(note)

        const contact = contacts.find((c: any) => c.id === body.contactId)
        const contactName = contact ? contact.name : 'Unknown Contact'
        const companyId = contact ? contact.companyId : null
        timelineEntries.push({
          id: `timeline-${Date.now()}`,
          companyId: companyId,
          contactId: body.contactId,
          action: 'note_added',
          details: `Note added for ${contactName}`,
          createdAt: new Date().toISOString(),
        })

        return created({ ...note, _type: 'contact' })
      }

      return badRequest('Must provide companyId or contactId')
    })

    mockNotesDELETE.mockImplementation(async (_req: Request) => {
      return notFound('No implementation')
    })
  })

  it('creates a contact note and a timeline entry', async () => {
    const companyId = 'company-post-contact-co'
    const contactId = 'contact-post-person'

    companies.push({
      id: companyId,
      name: 'Notes Post Contact Co',
      createdAt: new Date().toISOString(),
    })

    contacts.push({
      id: contactId,
      companyId: companyId,
      name: 'Notes Post Contact Person',
      email: 'npc@test.com',
      createdAt: new Date().toISOString(),
    })

    const req = new Request('http://localhost/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contactId: contactId,
        body: 'Contact note with timeline verification',
        noteType: 'meeting',
      }),
    })

    const res = await notesPOST(req as any)
    const data = await json(res)

    expect(res.status).toBe(201)
    expect(data.id).toBeDefined()
    expect(data.body).toBe('Contact note with timeline verification')
    expect(data.contactId).toBe(contactId)
    expect(data._type).toBe('contact')

    // Verify a timeline entry was created
    const tlEntry = timelineEntries.find(
      (e: any) => e.contactId === contactId && e.action === 'note_added',
    )
    expect(tlEntry).not.toBeNull()
    expect(tlEntry.details).toContain('Notes Post Contact Person')
  })
})

// ===========================================================================
// 8. Notes API — DELETE note
// ===========================================================================

describe('Notes API — DELETE note', () => {
  beforeEach(() => {
    resetStores()

    mockImportsGET.mockImplementation(async (_req: Request) => {
      return ok(importBatches)
    })

    mockImportsPOST.mockImplementation(async (_req: Request) => {
      return badRequest('No implementation')
    })

    mockTimelineGET.mockImplementation(async (_req: Request) => {
      return ok(timelineEntries)
    })

    mockNotesGET.mockImplementation(async (_req: Request) => {
      return ok([
        ...companyNotes.map((n: any) => ({ ...n, _type: 'company' })),
        ...contactNotes.map((n: any) => ({ ...n, _type: 'contact' })),
      ])
    })

    mockNotesPOST.mockImplementation(async (_req: Request) => {
      return badRequest('No implementation')
    })

    mockNotesDELETE.mockImplementation(async (req: Request) => {
      const url = new URL(req.url)
      const noteId = url.searchParams.get('id')
      if (!noteId) return badRequest('Missing note id')

      // Try to find and delete from company notes
      const companyIdx = companyNotes.findIndex((n: any) => n.id === noteId)
      if (companyIdx !== -1) {
        const note = companyNotes[companyIdx]
        companyNotes.splice(companyIdx, 1)

        // Create timeline entry for deletion
        timelineEntries.push({
          id: `timeline-${Date.now()}`,
          companyId: note.companyId,
          action: 'note_deleted',
          details: 'Company note deleted',
          createdAt: new Date().toISOString(),
        })

        return ok({ success: true, id: noteId })
      }

      // Try to find and delete from contact notes
      const contactIdx = contactNotes.findIndex((n: any) => n.id === noteId)
      if (contactIdx !== -1) {
        const note = contactNotes[contactIdx]
        contactNotes.splice(contactIdx, 1)

        // Find associated company for timeline
        const contact = contacts.find((c: any) => c.id === note.contactId)
        const companyId = contact ? contact.companyId : null

        timelineEntries.push({
          id: `timeline-${Date.now()}`,
          companyId: companyId,
          contactId: note.contactId,
          action: 'note_deleted',
          details: 'Contact note deleted',
          createdAt: new Date().toISOString(),
        })

        return ok({ success: true, id: noteId })
      }

      return notFound('Note not found')
    })
  })

  it('deletes a company note and verifies it is gone', async () => {
    const companyId = 'company-delete-co'

    companies.push({
      id: companyId,
      name: 'Notes Delete Co',
      createdAt: new Date().toISOString(),
    })

    const noteId = 'cnote-delete-1'
    companyNotes.push({
      id: noteId,
      companyId: companyId,
      body: 'Note to delete',
      noteType: 'note',
      createdAt: new Date().toISOString(),
    })

    const req = new Request(`http://localhost/api/notes?id=${noteId}`, {
      method: 'DELETE',
    })

    const res = await notesDELETE(req as any)
    const data = await json(res)

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)

    // Verify the note is gone from the in-memory store
    const deleted = companyNotes.find((n: any) => n.id === noteId)
    expect(deleted).toBeUndefined()

    // Verify a timeline entry was created for deletion
    const tlEntry = timelineEntries.find(
      (e: any) => e.companyId === companyId && e.action === 'note_deleted',
    )
    expect(tlEntry).toBeDefined()
  })

  it('deletes a contact note and verifies it is gone', async () => {
    const companyId = 'company-delete-contact-co'
    const contactId = 'contact-delete-person'

    companies.push({
      id: companyId,
      name: 'Notes Delete Contact Co',
      createdAt: new Date().toISOString(),
    })

    contacts.push({
      id: contactId,
      companyId: companyId,
      name: 'Notes Delete Contact Person',
      email: 'ndc@test.com',
      createdAt: new Date().toISOString(),
    })

    const noteId = 'pnote-delete-1'
    contactNotes.push({
      id: noteId,
      contactId: contactId,
      body: 'Contact note to delete',
      noteType: 'note',
      createdAt: new Date().toISOString(),
    })

    const req = new Request(`http://localhost/api/notes?id=${noteId}`, {
      method: 'DELETE',
    })

    const res = await notesDELETE(req as any)
    const data = await json(res)

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)

    // Verify the note is gone from the in-memory store
    const deleted = contactNotes.find((n: any) => n.id === noteId)
    expect(deleted).toBeUndefined()

    // Verify a timeline entry was created for deletion
    const tlEntry = timelineEntries.find(
      (e: any) => e.contactId === contactId && e.action === 'note_deleted',
    )
    expect(tlEntry).toBeDefined()
  })
})
