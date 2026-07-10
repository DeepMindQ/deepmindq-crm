import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest'
import { randomBytes } from 'node:crypto'
import { File as NativeFile } from 'node:buffer'
import { db } from '../../../lib/db'
import { POST as healthCheckPOST } from '../health-check/route'
import { GET as exportGET } from '../export/route'
import {
  GET as knowledgeGET,
  POST as knowledgePOST,
} from '../knowledge/route'
import { DELETE as knowledgeDelete } from '../knowledge/[id]/route'
import { NextRequest } from 'next/server'

// Mock DNS-dependent email validation to avoid 5s timeouts per contact (235+ contacts)
vi.mock('@/lib/email-verification', () => ({
  validateEmail: vi.fn().mockResolvedValue({
    syntaxOk: true,
    domainOk: true,
    mxOk: true,
    disposableOk: true,
    spfOk: true,
    dmarcOk: true,
    tldScore: 10,
    score: 100,
    status: 'valid',
    recommendation: 'Email looks good for outreach',
  }),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), init)
}

// Track IDs created during tests for cleanup
const cleanup = {
  companyIds: [] as string[],
  contactIds: [] as string[],
  healthCheckIds: [] as string[],
  timelineIds: [] as string[],
  documentIds: [] as string[],
}

beforeEach(() => {
  cleanup.companyIds = []
  cleanup.contactIds = []
  cleanup.healthCheckIds = []
  cleanup.timelineIds = []
  cleanup.documentIds = []
})

afterEach(async () => {
  // Clean up in reverse dependency order
  try {
    if (cleanup.timelineIds.length > 0) {
      await db.timelineEntry.deleteMany({
        where: { id: { in: cleanup.timelineIds } },
      })
    }
    if (cleanup.healthCheckIds.length > 0) {
      await db.emailHealthCheck.deleteMany({
        where: { id: { in: cleanup.healthCheckIds } },
      })
    }
    if (cleanup.contactIds.length > 0) {
      await db.contact.deleteMany({
        where: { id: { in: cleanup.contactIds } },
      })
    }
    if (cleanup.companyIds.length > 0) {
      await db.company.deleteMany({
        where: { id: { in: cleanup.companyIds } },
      })
    }
    // Documents are cleaned up individually (or already deleted by tests)
    for (const docId of cleanup.documentIds) {
      try {
        await db.capabilityDocument.delete({ where: { id: docId } })
      } catch {
        // Already deleted
      }
    }
  } catch (err) {
    console.error('Cleanup error:', err)
  }
})

// ---------------------------------------------------------------------------
// Seed helper – create a company + contact pair for health-check tests
// ---------------------------------------------------------------------------

async function seedContact(email: string) {
  const company = await db.company.create({
    data: { name: `HC Test Co ${Date.now()}` },
  })
  cleanup.companyIds.push(company.id)

  const contact = await db.contact.create({
    data: {
      companyId: company.id,
      name: 'Health Check User',
      email,
    },
  })
  cleanup.contactIds.push(contact.id)

  return { company, contact }
}

// ===========================================================================
// Health Check API Tests
// ===========================================================================

describe('POST /api/health-check', () => {
  it('checkAll=true validates all contacts and returns counts', async () => {
    // Seed a contact with a syntactically valid email
    const { contact } = await seedContact('hc-test-user@example.com')

    const req = makeRequest('http://localhost:3000/api/health-check', {
      method: 'POST',
      body: JSON.stringify({ checkAll: true }),
      headers: { 'Content-Type': 'application/json' },
    })

    const res = await healthCheckPOST(req)
    const data = await res.json()

    expect(res.status).toBe(200)
    // checked should be >= 1 (at least our seeded contact)
    expect(data.checked).toBeGreaterThanOrEqual(1)
    // The counts should add up to checked
    expect(data.valid + data.risky + data.invalid).toBe(data.checked)
  })

  it('creates EmailHealthCheck records in the database', async () => {
    const { contact } = await seedContact('hc-record-test@example.com')

    const beforeCount = await db.emailHealthCheck.count()

    const req = makeRequest('http://localhost:3000/api/health-check', {
      method: 'POST',
      body: JSON.stringify({ contactIds: [contact.id] }),
      headers: { 'Content-Type': 'application/json' },
    })
    await healthCheckPOST(req)

    const afterCount = await db.emailHealthCheck.count()
    expect(afterCount).toBeGreaterThan(beforeCount)

    // Verify the created record belongs to our contact
    const records = await db.emailHealthCheck.findMany({
      where: { contactId: { in: cleanup.contactIds } },
    })
    expect(records.length).toBeGreaterThanOrEqual(1)
    expect(records[0].status).toMatch(/^(valid|risky|invalid)$/)
    expect(typeof records[0].score).toBe('number')
  })

  it('updates contact emailHealth field after checking', async () => {
    const { contact } = await seedContact('hc-update-test@example.com')

    // Confirm initial state is "unknown"
    const before = await db.contact.findUnique({ where: { id: contact.id } })
    expect(before?.emailHealth).toBe('unknown')

    const req = makeRequest('http://localhost:3000/api/health-check', {
      method: 'POST',
      body: JSON.stringify({ contactIds: [contact.id] }),
      headers: { 'Content-Type': 'application/json' },
    })
    await healthCheckPOST(req)

    const after = await db.contact.findUnique({ where: { id: contact.id } })
    expect(after?.emailHealth).toMatch(/^(valid|risky|invalid)$/)
    expect(after?.emailHealthScore).not.toBeNull()
    expect(after?.lastValidatedAt).not.toBeNull()
  })
})

// ===========================================================================
// Export API Tests
// ===========================================================================

describe('GET /api/export', () => {
  it('?type=companies returns CSV with correct headers', async () => {
    const req = makeRequest('http://localhost:3000/api/export?type=companies')
    const res = await exportGET(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')

    const text = await res.text()
    const firstLine = text.split('\n')[0]

    expect(firstLine).toContain('Name')
    expect(firstLine).toContain('Domain')
    expect(firstLine).toContain('Industry')
    expect(firstLine).toContain('Employee Size')
    expect(firstLine).toContain('Country')
    expect(firstLine).toContain('Status')
    expect(firstLine).toContain('Intelligence Score')
  })

  it('?type=contacts returns CSV with correct headers', async () => {
    const req = makeRequest('http://localhost:3000/api/export?type=contacts')
    const res = await exportGET(req)

    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toContain('text/csv')

    const text = await res.text()
    const firstLine = text.split('\n')[0]

    expect(firstLine).toContain('Name')
    expect(firstLine).toContain('Email')
    expect(firstLine).toContain('Job Title')
    expect(firstLine).toContain('Company')
    expect(firstLine).toContain('Email Health')
    expect(firstLine).toContain('Health Score')
    expect(firstLine).toContain('Status')
  })

  it('sets Content-Disposition header for CSV download', async () => {
    const req = makeRequest('http://localhost:3000/api/export?type=companies')
    const res = await exportGET(req)

    const disposition = res.headers.get('content-disposition')
    expect(disposition).not.toBeNull()
    expect(disposition).toContain('attachment')
    expect(disposition).toContain('companies.csv')

    const req2 = makeRequest('http://localhost:3000/api/export?type=contacts')
    const res2 = await exportGET(req2)

    const disposition2 = res2.headers.get('content-disposition')
    expect(disposition2).not.toBeNull()
    expect(disposition2).toContain('attachment')
    expect(disposition2).toContain('contacts.csv')
  })
})

// ===========================================================================
// Knowledge API Tests
// ===========================================================================

describe('GET /api/knowledge', () => {
  it('returns documents array', async () => {
    const req = makeRequest('http://localhost:3000/api/knowledge')
    const res = await knowledgeGET(req)

    expect(res.status).toBe(200)

    const data = await res.json()
    // Default response is an array of documents
    expect(Array.isArray(data)).toBe(true)
  })

  it('?include=snippets returns documents + snippets', async () => {
    // Seed a document with known content so we get at least one snippet
    const content = `
This is a capability section about our platform technology that enables data processing at scale.
We provide a comprehensive solution for enterprise customers.

This is a case study showing results achieved by a major client in the financial sector.
The outcomes included 40% cost reduction and improved operational efficiency.

This service offering helps organizations transform their digital infrastructure and modernize legacy systems.
    `.trim()

    const doc = await db.capabilityDocument.create({
      data: {
        title: 'Test Knowledge Doc',
        docType: 'TXT',
        description: 'For testing',
        content,
        fileName: 'test-knowledge.txt',
      },
    })
    cleanup.documentIds.push(doc.id)

    // Manually create a snippet for guaranteed presence
    await db.capabilitySnippet.create({
      data: {
        documentId: doc.id,
        snippetType: 'capability',
        title: 'Test Snippet',
        content: 'This is a test snippet with enough content to be meaningful and relevant.',
      },
    })

    const req = makeRequest('http://localhost:3000/api/knowledge?include=snippets')
    const res = await knowledgeGET(req)

    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data).toHaveProperty('documents')
    expect(data).toHaveProperty('snippets')
    expect(Array.isArray(data.documents)).toBe(true)
    expect(Array.isArray(data.snippets)).toBe(true)

    // Our seeded doc should appear
    const found = data.documents.find(
      (d: { id: string }) => d.id === doc.id
    )
    expect(found).toBeDefined()
    expect(found.title).toBe('Test Knowledge Doc')
  })
})

describe('POST /api/knowledge', () => {
  it('creates a document from FormData with a file', async () => {
    // jsdom overrides global File with its own polyfill, which breaks
    // Node.js native multipart parsing (webidl.is.File check fails).
    // Temporarily restore the native File so req.formData() works.
    const JSDOMFile = globalThis.File
    // @ts-expect-error -- replacing jsdom File with native File for multipart
    globalThis.File = NativeFile

    try {
      const fileContent =
        'Capability: Our platform provides advanced analytics for enterprise data.\n\n' +
        'This is a case study demonstrating results achieved through our consulting service.\n\n' +
        'Service: We offer end-to-end digital transformation solutions tailored to your industry needs.\n\n' +
        'Outcome: Customers see measurable improvements in efficiency and revenue growth after implementation.'

      const boundary = 'test-boundary-' + randomBytes(8).toString('hex')
      const parts: string[] = []

      parts.push(`--${boundary}`)
      parts.push('Content-Disposition: form-data; name="file"; filename="test-upload.txt"')
      parts.push('Content-Type: text/plain')
      parts.push('')
      parts.push(fileContent)

      parts.push(`--${boundary}`)
      parts.push('Content-Disposition: form-data; name="title"')
      parts.push('')
      parts.push('Uploaded Test Document')

      parts.push(`--${boundary}`)
      parts.push('Content-Disposition: form-data; name="description"')
      parts.push('')
      parts.push('Created by integration test')

      parts.push(`--${boundary}`)
      parts.push('Content-Disposition: form-data; name="docType"')
      parts.push('')
      parts.push('documentation')

      parts.push(`--${boundary}--`)
      const body = parts.join('\r\n')

      const req = new NextRequest(new URL('http://localhost:3000/api/knowledge'), {
        method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
        },
        body,
      })

      const res = await knowledgePOST(req)
      expect(res.status).toBe(201)

      const data = await res.json()
      expect(data.id).toBeDefined()
      expect(data.title).toBe('Uploaded Test Document')
      expect(data.fileName).toBe('test-upload.txt')
      expect(data.docType).toBe('DOCUMENTATION')

      // Register for cleanup
      cleanup.documentIds.push(data.id)

      // Verify it exists in the DB
      const found = await db.capabilityDocument.findUnique({
        where: { id: data.id },
        include: { snippets: true },
      })
      expect(found).not.toBeNull()
      expect(found!.snippets.length).toBeGreaterThanOrEqual(1)
    } finally {
      globalThis.File = JSDOMFile
    }
  })
})

describe('DELETE /api/knowledge/[id]', () => {
  it('removes a document and its snippets cascade', async () => {
    // Create a document with snippets
    const doc = await db.capabilityDocument.create({
      data: {
        title: 'To Be Deleted',
        docType: 'TXT',
        description: 'Will be removed',
        content: 'Some content here for deletion testing purposes.',
        fileName: 'delete-me.txt',
      },
    })

    await db.capabilitySnippet.create({
      data: {
        documentId: doc.id,
        snippetType: 'capability',
        title: 'Delete Snippet',
        content: 'This snippet should be cascaded when document is deleted.',
      },
    })

    // Confirm it exists
    const before = await db.capabilityDocument.findUnique({
      where: { id: doc.id },
    })
    expect(before).not.toBeNull()

    const req = makeRequest(
      `http://localhost:3000/api/knowledge/${doc.id}`,
      { method: 'DELETE' }
    )
    const res = await knowledgeDelete(req, {
      params: Promise.resolve({ id: doc.id }),
    })

    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.success).toBe(true)

    // Verify document is gone
    const after = await db.capabilityDocument.findUnique({
      where: { id: doc.id },
    })
    expect(after).toBeNull()

    // Verify snippets are also gone (cascade)
    const snippets = await db.capabilitySnippet.findMany({
      where: { documentId: doc.id },
    })
    expect(snippets).toHaveLength(0)
  })
})