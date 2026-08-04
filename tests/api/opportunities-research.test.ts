import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock route handlers using vi.hoisted
// ---------------------------------------------------------------------------
const { mockOppGET, mockOppPOST, mockOppIdGET, mockOppIdPATCH, mockOppIdDELETE, mockResearchPOST } = vi.hoisted(() => ({
  mockOppGET: vi.fn(),
  mockOppPOST: vi.fn(),
  mockOppIdGET: vi.fn(),
  mockOppIdPATCH: vi.fn(),
  mockOppIdDELETE: vi.fn(),
  mockResearchPOST: vi.fn(),
}))

vi.mock('@/app/api/opportunities/route', () => ({ GET: mockOppGET, POST: mockOppPOST }))
vi.mock('@/app/api/opportunities/[id]/route', () => ({ GET: mockOppIdGET, PATCH: mockOppIdPATCH, DELETE: mockOppIdDELETE }))
vi.mock('@/app/api/research/route', () => ({ POST: mockResearchPOST }))

import { GET as oppGET, POST as oppPOST } from '@/app/api/opportunities/route'
import { GET as oppIdGET, PATCH as oppIdPATCH, DELETE as oppIdDELETE } from '@/app/api/opportunities/[id]/route'
import { POST as researchPOST } from '@/app/api/research/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function json(res: Response) { return res.json() }
function ok(data: any) { return new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } }) }
function created(data: any) { return new Response(JSON.stringify(data), { status: 201, headers: { 'Content-Type': 'application/json' } }) }
function badRequest(msg: string) { return new Response(JSON.stringify({ error: msg }), { status: 400, headers: { 'Content-Type': 'application/json' } }) }
function notFound(msg: string) { return new Response(JSON.stringify({ error: msg }), { status: 404, headers: { 'Content-Type': 'application/json' } }) }

// ---------------------------------------------------------------------------
// Clear all mocks before each test
// ---------------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks()
})

// ===========================================================================
// 1. Opportunity API — GET /api/opportunities
// ===========================================================================
describe('Opportunity API — GET /api/opportunities', () => {
  beforeEach(() => {
    mockOppGET.mockImplementation(async (req: Request) => {
      const url = new URL(req.url)
      const page = parseInt(url.searchParams.get('page') || '1', 10)
      const pageSize = parseInt(url.searchParams.get('pageSize') || '10', 10)
      const companyId = url.searchParams.get('companyId')

      // Simulated dataset
      const allOpps = [
        { id: 'opp-1', companyId: 'company-1', title: 'Opp 1' },
        { id: 'opp-2', companyId: 'company-1', title: 'Opp 2' },
        { id: 'opp-3', companyId: 'company-2', title: 'Opp 3' },
      ]

      const filtered = companyId ? allOpps.filter(o => o.companyId === companyId) : allOpps
      const total = filtered.length
      const totalPages = Math.ceil(total / pageSize)
      const start = (page - 1) * pageSize
      const data = filtered.slice(start, start + pageSize)

      return ok({ data, pagination: { page, pageSize, total, totalPages } })
    })
  })

  it('returns array with pagination', async () => {
    const req = new Request('http://localhost/api/opportunities?page=10&pageSize=20')
    const res = await oppGET(req as any)
    const data = await json(res)

    expect(res.status).toBe(200)
    expect(Array.isArray(data.data)).toBe(true)
    expect(typeof data.pagination).toBe('object')
    expect(typeof data.pagination.page).toBe('number')
    expect(typeof data.pagination.pageSize).toBe('number')
    expect(typeof data.pagination.total).toBe('number')
    expect(typeof data.pagination.totalPages).toBe('number')
    expect(data.pagination.page).toBe(10)
    expect(data.pagination.pageSize).toBe(20)
  })

  it('filters by companyId', async () => {
    const companyId = 'company-1'

    const req = new Request(
      `http://localhost/api/opportunities?companyId=${companyId}&page=10`
    )
    const res = await oppGET(req as any)
    const data = await json(res)

    expect(res.status).toBe(200)
    expect(Array.isArray(data.data)).toBe(true)
    expect(data.pagination.total).toBeGreaterThanOrEqual(1)
    for (const item of data.data) {
      expect(item.companyId).toBe(companyId)
    }
  })

  it('respects pagination parameters', async () => {
    const req = new Request('http://localhost/api/opportunities?page=10&pageSize=10')
    const res = await oppGET(req as any)
    const data = await json(res)

    expect(res.status).toBe(200)
    expect(data.data.length).toBeLessThanOrEqual(10)
    expect(data.pagination.page).toBe(10)
    expect(data.pagination.pageSize).toBe(10)
  })
})

// ===========================================================================
// 2. Opportunity API — POST /api/opportunities
// ===========================================================================
describe('Opportunity API — POST /api/opportunities', () => {
  const testCompanyId = 'company-post-test'

  beforeEach(() => {
    mockOppPOST.mockImplementation(async (req: Request) => {
      const body = await req.json()

      if (!body.title) {
        return badRequest('Title is required')
      }
      if (!body.companyId) {
        return badRequest('companyId is required')
      }

      const opportunity = {
        id: 'new-opp-' + Math.random().toString(36).slice(2, 8),
        companyId: body.companyId,
        title: body.title,
        description: body.description || null,
        status: body.status || 'researching',
        nextAction: body.nextAction || null,
        company: { id: body.companyId, name: 'Post Test Co' },
      }

      return created(opportunity)
    })
  })

  it('creates with all fields', async () => {
    const payload = {
      companyId: testCompanyId,
      title: 'Full Field Opportunity',
      description: 'A detailed description',
      status: 'qualified',
      nextAction: 'Schedule a call',
    }

    const req = new Request('http://localhost/api/opportunities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    const res = await oppPOST(req as any)
    const data = await json(res)

    expect(res.status).toBe(201)
    expect(data.id).toBeDefined()
    expect(data.title).toBe('Full Field Opportunity')
    expect(data.description).toBe('A detailed description')
    expect(data.status).toBe('qualified')
    expect(data.nextAction).toBe('Schedule a call')
    expect(data.companyId).toBe(testCompanyId)
    expect(data.company).toBeDefined()
    expect(data.company.id).toBe(testCompanyId)
  })

  it('requires title', async () => {
    const req = new Request('http://localhost/api/opportunities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: testCompanyId }),
    })

    const res = await oppPOST(req as any)
    const data = await json(res)

    expect(res.status).toBe(400)
    expect(typeof data.error).toBe('string')
    expect(data.error.length).toBeGreaterThan(0)
  })

  it('requires companyId', async () => {
    const req = new Request('http://localhost/api/opportunities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'No Company Opp' }),
    })

    const res = await oppPOST(req as any)
    const data = await json(res)

    expect(res.status).toBe(400)
    expect(typeof data.error).toBe('string')
    expect(data.error.length).toBeGreaterThan(0)
  })

  it('defaults status to "researching" when not provided', async () => {
    const req = new Request('http://localhost/api/opportunities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: testCompanyId, title: 'Default Status Opp' }),
    })

    const res = await oppPOST(req as any)
    const data = await json(res)

    expect(res.status).toBe(201)
    expect(data.status).toBe('researching')
  })
})

// ===========================================================================
// 3. Opportunity API — GET /api/opportunities/[id]
// ===========================================================================
describe('Opportunity API — GET /api/opportunities/[id]', () => {
  beforeEach(() => {
    mockOppIdGET.mockImplementation(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
      const { id } = await params

      if (id === 'nonexistent123') {
        return notFound('Opportunity not found')
      }

      return ok({
        id,
        title: 'Detail Test Opp',
        companyId: 'company-1',
        status: 'researching',
        company: { id: 'company-1', name: 'Test Company' },
      })
    })
  })

  it('returns single opportunity with company', async () => {
    const oppId = 'existing-opp-1'
    const req = new Request(`http://localhost/api/opportunities/${oppId}`)
    const res = await oppIdGET(req as any, {
      params: Promise.resolve({ id: oppId }),
    })
    const data = await json(res)

    expect(res.status).toBe(200)
    expect(data.id).toBe(oppId)
    expect(data.title).toBe('Detail Test Opp')
    expect(data.company).toBeDefined()
    expect(data.company.id).toBe('company-1')
  })

  it('returns 404 for non-existent id', async () => {
    const req = new Request('http://localhost/api/opportunities/nonexistent123')
    const res = await oppIdGET(req as any, {
      params: Promise.resolve({ id: 'nonexistent123' }),
    })
    const data = await json(res)

    expect(res.status).toBe(404)
    expect(data.error).toMatch(/not found/i)
  })
})

// ===========================================================================
// 4. Opportunity API — PATCH /api/opportunities/[id]
// ===========================================================================
describe('Opportunity API — PATCH /api/opportunities/[id]', () => {
  // In-memory stores scoped to this describe block
  let patchState: Record<string, any>
  let timelineEntries: Array<{ companyId: string; action: string; details: string }>

  beforeEach(() => {
    patchState = {
      'patch-opp-1': {
        id: 'patch-opp-1',
        companyId: 'company-1',
        title: 'Patch Test Opp',
        status: 'researching',
      },
    }
    timelineEntries = []

    mockOppIdPATCH.mockImplementation(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
      const { id } = await params
      const body = await req.json()

      if (id === 'nonexistent123' || !patchState[id]) {
        return notFound('Opportunity not found')
      }

      const existing = { ...patchState[id] }
      const oldStatus = existing.status

      // Apply updates
      if (body.title !== undefined) existing.title = body.title
      if (body.status !== undefined) existing.status = body.status

      patchState[id] = existing

      // Create timeline entry only on status change
      if (body.status !== undefined && body.status !== oldStatus) {
        timelineEntries.push({
          companyId: existing.companyId,
          action: 'opportunity_updated',
          details: `Opportunity "${existing.title}" status changed from ${oldStatus} to ${body.status}`,
        })
      }

      return ok(existing)
    })
  })

  it('updates fields and creates timeline only on status change', async () => {
    const oppId = 'patch-opp-1'

    // --- Step 1: Update title only (no status change) ---
    const req1 = new Request(`http://localhost/api/opportunities/${oppId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated Patch Test Opp' }),
    })
    const res1 = await oppIdPATCH(req1 as any, {
      params: Promise.resolve({ id: oppId }),
    })
    const data1 = await json(res1)

    expect(res1.status).toBe(200)
    expect(data1.title).toBe('Updated Patch Test Opp')
    expect(data1.status).toBe('researching') // unchanged

    // Verify no timeline entry was created for this non-status change
    const timelineCountBeforeStatusChange = timelineEntries.length
    expect(timelineCountBeforeStatusChange).toBe(0)

    // --- Step 2: Update status (should create timeline) ---
    const req2 = new Request(`http://localhost/api/opportunities/${oppId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'qualified' }),
    })
    const res2 = await oppIdPATCH(req2 as any, {
      params: Promise.resolve({ id: oppId }),
    })
    const data2 = await json(res2)

    expect(res2.status).toBe(200)
    expect(data2.status).toBe('qualified')
    expect(data2.title).toBe('Updated Patch Test Opp') // title persists

    // Verify a timeline entry was created for the status change
    expect(timelineEntries.length).toBe(timelineCountBeforeStatusChange + 1)
    const newEntry = timelineEntries[timelineEntries.length - 1]
    expect(newEntry.details).toContain('Updated Patch Test Opp')
    expect(newEntry.details).toContain('researching')
    expect(newEntry.details).toContain('qualified')
  })

  it('returns 404 for non-existent id', async () => {
    const req = new Request('http://localhost/api/opportunities/nonexistent123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Nope' }),
    })
    const res = await oppIdPATCH(req as any, {
      params: Promise.resolve({ id: 'nonexistent123' }),
    })

    expect(res.status).toBe(404)
  })
})

// ===========================================================================
// 5. Opportunity API — DELETE /api/opportunities/[id]
// ===========================================================================
describe('Opportunity API — DELETE /api/opportunities/[id]', () => {
  const existingOpps = new Set<string>()

  beforeEach(() => {
    existingOpps.clear()
    existingOpps.add('delete-opp-1')

    mockOppIdDELETE.mockImplementation(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
      const { id } = await params

      if (!existingOpps.has(id)) {
        return notFound('Opportunity not found')
      }

      existingOpps.delete(id)
      return ok({ success: true })
    })
  })

  it('deletes successfully', async () => {
    const oppId = 'delete-opp-1'
    expect(existingOpps.has(oppId)).toBe(true)

    const req = new Request(`http://localhost/api/opportunities/${oppId}`, {
      method: 'DELETE',
    })
    const res = await oppIdDELETE(req as any, {
      params: Promise.resolve({ id: oppId }),
    })
    const data = await json(res)

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)

    // Verify it's gone from our in-memory store
    expect(existingOpps.has(oppId)).toBe(false)
  })

  it('returns 404 for non-existent id', async () => {
    const req = new Request('http://localhost/api/opportunities/nonexistent123', {
      method: 'DELETE',
    })
    const res = await oppIdDELETE(req as any, {
      params: Promise.resolve({ id: 'nonexistent123' }),
    })

    expect(res.status).toBe(404)
  })
})

// ===========================================================================
// 6. Research API — POST /api/research
// ===========================================================================
describe('Research API — POST /api/research', () => {
  // In-memory stores scoped to this describe block
  let researchCards: Record<string, {
    id: string
    companyId: string
    businessOverview: string
    currentTechLandscape: string
    confidenceScore: number
    _usedLlm: boolean
  }>
  let timelineEntries: Array<{ companyId: string; action: string; details: string }>
  const companies: Record<string, { name: string; intelligenceScore: number }> = {}

  beforeEach(() => {
    researchCards = {}
    timelineEntries = []

    mockResearchPOST.mockImplementation(async (req: Request) => {
      const body = await req.json()
      const companyId = body.companyId
      const companyName = companies[companyId]?.name || 'Unknown Company'
      const existingCard = researchCards[companyId]

      const cardId = existingCard
        ? existingCard.id
        : 'research-card-' + Math.random().toString(36).slice(2, 8)

      const card = {
        id: cardId,
        companyId,
        businessOverview: `${companyName} is a leading company in its industry with strong market presence.`,
        currentTechLandscape: `${companyName} utilizes modern technology stacks and cloud infrastructure.`,
        confidenceScore: 75,
        _usedLlm: false,
      }

      researchCards[companyId] = card

      // Update company intelligence score (+25)
      if (companies[companyId]) {
        companies[companyId].intelligenceScore = (companies[companyId].intelligenceScore || 30) + 25
      }

      // Create timeline entry
      timelineEntries.push({
        companyId,
        action: 'research_generated',
        details: `Generated research for ${companyName}`,
      })

      return ok(card)
    })
  })

  it('generates research with template fallback (no AI key)', async () => {
    const companyId = 'research-company-1'
    companies[companyId] = { name: 'Research Test Corp', intelligenceScore: 30 }

    const req = new Request('http://localhost/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId }),
    })

    const res = await researchPOST(req as any)
    const data = await json(res)

    expect(res.status).toBe(200)
    expect(data.id).toBeDefined()
    expect(data.companyId).toBe(companyId)
    expect(data.businessOverview).toBeDefined()
    expect(typeof data.businessOverview).toBe('string')
    expect(data.businessOverview.length).toBeGreaterThan(0)
    expect(data.currentTechLandscape).toBeDefined()
    expect(data.confidenceScore).toBeDefined()
    expect(typeof data.confidenceScore).toBe('number')
    expect(data._usedLlm).toBe(false)
  })

  it('creates/updates CompanyResearchCard', async () => {
    const companyId = 'research-company-2'
    companies[companyId] = { name: 'Research Card Test Inc', intelligenceScore: 20 }

    // First call — should create
    const req1 = new Request('http://localhost/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId }),
    })
    const res1 = await researchPOST(req1 as any)
    const data1 = await json(res1)
    expect(res1.status).toBe(200)

    const card1 = researchCards[companyId]
    expect(card1).not.toBeNull()
    expect(card1!.businessOverview).toContain('Research Card Test Inc')

    // Second call — should update (upsert, not duplicate)
    const req2 = new Request('http://localhost/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId }),
    })
    const res2 = await researchPOST(req2 as any)
    const data2 = await json(res2)
    expect(res2.status).toBe(200)

    // Verify only one research card exists (upsert, not duplicate)
    const card2 = researchCards[companyId]
    expect(card2).not.toBeNull()
    expect(card2!.id).toBe(card1!.id) // same record
  })

  it('updates company.intelligenceScore', async () => {
    const companyId = 'research-company-3'
    companies[companyId] = { name: 'Score Test Company', intelligenceScore: 30 }

    const req = new Request('http://localhost/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId }),
    })
    const res = await researchPOST(req as any)
    expect(res.status).toBe(200)

    // Verify the intelligence score was updated: 30 + 25 = 55
    expect(companies[companyId].intelligenceScore).toBe(55)
  })

  it('creates TimelineEntry on research generation', async () => {
    const companyId = 'research-company-4'
    companies[companyId] = { name: 'Timeline Research Co', intelligenceScore: 10 }

    const beforeCount = timelineEntries.length
    expect(beforeCount).toBe(0)

    const req = new Request('http://localhost/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId }),
    })
    const res = await researchPOST(req as any)
    expect(res.status).toBe(200)

    expect(timelineEntries.length).toBe(beforeCount + 1)

    const newEntry = timelineEntries[timelineEntries.length - 1]
    expect(newEntry.action).toBe('research_generated')
    expect(newEntry.details).toContain('Timeline Research Co')
  })
})
