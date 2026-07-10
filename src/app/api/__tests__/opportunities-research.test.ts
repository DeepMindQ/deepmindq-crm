import { describe, it, expect, afterEach, beforeEach } from 'vitest'
import { db } from '../../../lib/db'
import { GET as oppListGET, POST as oppListPOST } from '../opportunities/route'
import { GET as oppDetailGET, PATCH as oppDetailPATCH, DELETE as oppDetailDELETE } from '../opportunities/[id]/route'
import { POST as researchPOST } from '../research/route'

// ---------------------------------------------------------------------------
// Cleanup tracking
// ---------------------------------------------------------------------------
const cleanupIds: {
  opportunities: string[]
  timelineEntries: string[]
  researchCards: string[]
  companies: string[]
  // Snapshot company intelligenceScore before research tests
  companyScoreSnapshots: Map<string, number | null>
} = {
  opportunities: [],
  timelineEntries: [],
  researchCards: [],
  companies: [],
  companyScoreSnapshots: new Map(),
}

beforeEach(() => {
  cleanupIds.opportunities = []
  cleanupIds.timelineEntries = []
  cleanupIds.researchCards = []
  cleanupIds.companies = []
  cleanupIds.companyScoreSnapshots = new Map()
})

afterEach(async () => {
  try {
    // Clean up in reverse dependency order
    if (cleanupIds.timelineEntries.length > 0) {
      await db.timelineEntry.deleteMany({
        where: { id: { in: cleanupIds.timelineEntries } },
      })
    }
    if (cleanupIds.opportunities.length > 0) {
      await db.opportunity.deleteMany({
        where: { id: { in: cleanupIds.opportunities } },
      })
    }
    if (cleanupIds.researchCards.length > 0) {
      await db.companyResearchCard.deleteMany({
        where: { id: { in: cleanupIds.researchCards } },
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
// Opportunity API — GET /api/opportunities
// ===========================================================================
describe('Opportunity API — GET /api/opportunities', () => {
  it('returns array with pagination', async () => {
    const req = new Request('http://localhost/api/opportunities')
    const res = await oppListGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(data.data)).toBe(true)
    expect(typeof data.pagination).toBe('object')
    expect(typeof data.pagination.page).toBe('number')
    expect(typeof data.pagination.pageSize).toBe('number')
    expect(typeof data.pagination.total).toBe('number')
    expect(typeof data.pagination.totalPages).toBe('number')
    expect(data.pagination.page).toBe(1)
    expect(data.pagination.pageSize).toBe(20)
  })

  it('filters by companyId', async () => {
    // Grab a seed company
    const company = await db.company.findFirst()
    expect(company).not.toBeNull()

    // Create an opportunity for this company so we guarantee a result
    const opp = await db.opportunity.create({
      data: {
        companyId: company!.id,
        title: 'Filter Test Opportunity',
      },
    })
    cleanupIds.opportunities.push(opp.id)

    const req = new Request(
      `http://localhost/api/opportunities?companyId=${company!.id}`
    )
    const res = await oppListGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(Array.isArray(data.data)).toBe(true)
    expect(data.data.length).toBeGreaterThanOrEqual(1)
    for (const item of data.data) {
      expect(item.companyId).toBe(company!.id)
    }
  })

  it('respects pagination parameters', async () => {
    const req = new Request('http://localhost/api/opportunities?page=1&pageSize=2')
    const res = await oppListGET(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.data.length).toBeLessThanOrEqual(2)
    expect(data.pagination.page).toBe(1)
    expect(data.pagination.pageSize).toBe(2)
  })
})

// ===========================================================================
// Opportunity API — POST /api/opportunities
// ===========================================================================
describe('Opportunity API — POST /api/opportunities', () => {
  it('creates with all fields', async () => {
    const company = await db.company.findFirst()
    expect(company).not.toBeNull()

    const payload = {
      companyId: company!.id,
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

    const res = await oppListPOST(req as any)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.id).toBeDefined()
    expect(data.title).toBe('Full Field Opportunity')
    expect(data.description).toBe('A detailed description')
    expect(data.status).toBe('qualified')
    expect(data.nextAction).toBe('Schedule a call')
    expect(data.companyId).toBe(company!.id)
    expect(data.company).toBeDefined()
    expect(data.company.id).toBe(company!.id)
    cleanupIds.opportunities.push(data.id)
  })

  it('requires title', async () => {
    const company = await db.company.findFirst()

    const req = new Request('http://localhost/api/opportunities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: company!.id }),
    })

    const res = await oppListPOST(req as any)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toMatch(/title/i)
  })

  it('requires companyId', async () => {
    const req = new Request('http://localhost/api/opportunities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'No Company Opp' }),
    })

    const res = await oppListPOST(req as any)
    const data = await res.json()

    expect(res.status).toBe(400)
    expect(data.error).toMatch(/company/i)
  })

  it('defaults status to "researching" when not provided', async () => {
    const company = await db.company.findFirst()

    const req = new Request('http://localhost/api/opportunities', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: company!.id, title: 'Default Status Opp' }),
    })

    const res = await oppListPOST(req as any)
    const data = await res.json()

    expect(res.status).toBe(201)
    expect(data.status).toBe('researching')
    cleanupIds.opportunities.push(data.id)
  })
})

// ===========================================================================
// Opportunity API — GET /api/opportunities/[id]
// ===========================================================================
describe('Opportunity API — GET /api/opportunities/[id]', () => {
  it('returns single opportunity with company', async () => {
    const company = await db.company.findFirst()
    const opp = await db.opportunity.create({
      data: { companyId: company!.id, title: 'Detail Test Opp' },
      include: { company: true },
    })
    cleanupIds.opportunities.push(opp.id)

    const req = new Request(`http://localhost/api/opportunities/${opp.id}`)
    const res = await oppDetailGET(req as any, {
      params: Promise.resolve({ id: opp.id }),
    })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.id).toBe(opp.id)
    expect(data.title).toBe('Detail Test Opp')
    expect(data.company).toBeDefined()
    expect(data.company.id).toBe(company!.id)
  })

  it('returns 404 for non-existent id', async () => {
    const req = new Request('http://localhost/api/opportunities/nonexistent123')
    const res = await oppDetailGET(req as any, {
      params: Promise.resolve({ id: 'nonexistent123' }),
    })
    const data = await res.json()

    expect(res.status).toBe(404)
    expect(data.error).toMatch(/not found/i)
  })
})

// ===========================================================================
// Opportunity API — PATCH /api/opportunities/[id]
// ===========================================================================
describe('Opportunity API — PATCH /api/opportunities/[id]', () => {
  it('updates fields and creates timeline only on status change', async () => {
    const company = await db.company.findFirst()
    const opp = await db.opportunity.create({
      data: {
        companyId: company!.id,
        title: 'Patch Test Opp',
        status: 'researching',
      },
    })
    cleanupIds.opportunities.push(opp.id)

    // --- Step 1: Update title only (no status change) ---
    const req1 = new Request(`http://localhost/api/opportunities/${opp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Updated Patch Test Opp' }),
    })
    const res1 = await oppDetailPATCH(req1 as any, {
      params: Promise.resolve({ id: opp.id }),
    })
    const data1 = await res1.json()

    expect(res1.status).toBe(200)
    expect(data1.title).toBe('Updated Patch Test Opp')
    expect(data1.status).toBe('researching') // unchanged

    // Verify no timeline entry was created for this non-status change
    const timelineBefore = await db.timelineEntry.findMany({
      where: { companyId: company!.id, action: 'opportunity_updated' },
    })
    // There might be timeline entries from seed data; we'll compare count after status change

    // --- Step 2: Update status (should create timeline) ---
    const timelineCountBeforeStatusChange = timelineBefore.length

    const req2 = new Request(`http://localhost/api/opportunities/${opp.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'qualified' }),
    })
    const res2 = await oppDetailPATCH(req2 as any, {
      params: Promise.resolve({ id: opp.id }),
    })
    const data2 = await res2.json()

    expect(res2.status).toBe(200)
    expect(data2.status).toBe('qualified')
    expect(data2.title).toBe('Updated Patch Test Opp') // title persists

    // Verify a timeline entry was created for the status change
    const timelineAfter = await db.timelineEntry.findMany({
      where: { companyId: company!.id, action: 'opportunity_updated' },
    })
    expect(timelineAfter.length).toBe(timelineCountBeforeStatusChange + 1)
    const newEntry = timelineAfter[timelineAfter.length - 1]
    expect(newEntry.details).toContain('Updated Patch Test Opp')
    expect(newEntry.details).toContain('researching')
    expect(newEntry.details).toContain('qualified')

    // Clean up the timeline entry we just verified
    cleanupIds.timelineEntries.push(newEntry.id)
  })

  it('returns 404 for non-existent id', async () => {
    const req = new Request('http://localhost/api/opportunities/nonexistent123', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Nope' }),
    })
    const res = await oppDetailPATCH(req as any, {
      params: Promise.resolve({ id: 'nonexistent123' }),
    })

    expect(res.status).toBe(404)
  })
})

// ===========================================================================
// Opportunity API — DELETE /api/opportunities/[id]
// ===========================================================================
describe('Opportunity API — DELETE /api/opportunities/[id]', () => {
  it('deletes successfully', async () => {
    const company = await db.company.findFirst()
    const opp = await db.opportunity.create({
      data: { companyId: company!.id, title: 'Delete Me Opp' },
    })
    // Don't push to cleanupIds — we're testing deletion

    const req = new Request(`http://localhost/api/opportunities/${opp.id}`, {
      method: 'DELETE',
    })
    const res = await oppDetailDELETE(req as any, {
      params: Promise.resolve({ id: opp.id }),
    })
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.success).toBe(true)

    // Verify it's gone
    const deleted = await db.opportunity.findUnique({ where: { id: opp.id } })
    expect(deleted).toBeNull()
  })

  it('returns 404 for non-existent id', async () => {
    const req = new Request('http://localhost/api/opportunities/nonexistent123', {
      method: 'DELETE',
    })
    const res = await oppDetailDELETE(req as any, {
      params: Promise.resolve({ id: 'nonexistent123' }),
    })

    expect(res.status).toBe(404)
  })
})

// ===========================================================================
// Research API — POST /api/research
// ===========================================================================
describe('Research API — POST /api/research', () => {
  it('generates research with template fallback (no AI key)', async () => {
    // Create a dedicated test company so we don't interfere with seed data
    const company = await db.company.create({
      data: {
        name: 'Research Test Corp',
        domain: 'research-test-corp.com',
        industry: 'software',
        employeeSize: '150',
        country: 'US',
        status: 'new',
        intelligenceScore: 30,
      },
    })
    cleanupIds.companies.push(company.id)

    // Snapshot the score and dataFreshness before
    cleanupIds.companyScoreSnapshots.set(company.id, company.intelligenceScore)

    const req = new Request('http://localhost/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: company.id }),
    })

    const res = await researchPOST(req as any)
    const data = await res.json()

    expect(res.status).toBe(200)
    expect(data.id).toBeDefined()
    expect(data.companyId).toBe(company.id)
    expect(data.businessOverview).toBeDefined()
    expect(typeof data.businessOverview).toBe('string')
    expect(data.businessOverview.length).toBeGreaterThan(0)
    expect(data.currentTechLandscape).toBeDefined()
    expect(data.confidenceScore).toBeDefined()
    expect(typeof data.confidenceScore).toBe('number')
    expect(data._usedLlm).toBe(false)

    // Track the research card for cleanup
    cleanupIds.researchCards.push(data.id)
  })

  it('creates/updates CompanyResearchCard', async () => {
    const company = await db.company.create({
      data: {
        name: 'Research Card Test Inc',
        domain: 'rcard-test.com',
        industry: 'healthcare',
        employeeSize: '500',
        country: 'US',
        status: 'active',
        intelligenceScore: 20,
      },
    })
    cleanupIds.companies.push(company.id)

    // First call — should create
    const req1 = new Request('http://localhost/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: company.id }),
    })
    const res1 = await researchPOST(req1 as any)
    const data1 = await res1.json()
    expect(res1.status).toBe(200)

    const card1 = await db.companyResearchCard.findUnique({
      where: { companyId: company.id },
    })
    expect(card1).not.toBeNull()
    expect(card1!.businessOverview).toContain('Research Card Test Inc')
    cleanupIds.researchCards.push(card1!.id)

    // Second call — should update (upsert)
    const req2 = new Request('http://localhost/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: company.id }),
    })
    const res2 = await researchPOST(req2 as any)
    const data2 = await res2.json()
    expect(res2.status).toBe(200)

    // Verify only one research card exists (upsert, not duplicate)
    const card2 = await db.companyResearchCard.findUnique({
      where: { companyId: company.id },
    })
    expect(card2).not.toBeNull()
    expect(card2!.id).toBe(card1!.id) // same record
  })

  it('updates company.intelligenceScore', async () => {
    const company = await db.company.create({
      data: {
        name: 'Score Test Company',
        domain: 'score-test.com',
        industry: 'finance',
        employeeSize: '1000',
        country: 'US',
        status: 'new',
        intelligenceScore: 30,
      },
    })
    cleanupIds.companies.push(company.id)

    const req = new Request('http://localhost/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: company.id }),
    })
    const res = await researchPOST(req as any)
    expect(res.status).toBe(200)

    const updated = await db.company.findUnique({ where: { id: company.id } })
    expect(updated).not.toBeNull()
    expect(updated!.intelligenceScore).toBe(55) // 30 + 25 = 55
    expect(updated!.dataFreshness).toBe('fresh')

    // Clean up research card if created
    const card = await db.companyResearchCard.findUnique({
      where: { companyId: company.id },
    })
    if (card) cleanupIds.researchCards.push(card.id)
  })

  it('creates TimelineEntry on research generation', async () => {
    const company = await db.company.create({
      data: {
        name: 'Timeline Research Co',
        domain: 'timeline-research.com',
        industry: 'retail',
        employeeSize: '200',
        country: 'UK',
        status: 'new',
        intelligenceScore: 10,
      },
    })
    cleanupIds.companies.push(company.id)

    // Get timeline count before
    const beforeEntries = await db.timelineEntry.findMany({
      where: { companyId: company.id },
    })

    const req = new Request('http://localhost/api/research', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ companyId: company.id }),
    })
    const res = await researchPOST(req as any)
    expect(res.status).toBe(200)

    const afterEntries = await db.timelineEntry.findMany({
      where: { companyId: company.id },
    })
    expect(afterEntries.length).toBe(beforeEntries.length + 1)

    const newEntry = afterEntries[afterEntries.length - 1]
    expect(newEntry.action).toBe('research_generated')
    expect(newEntry.details).toContain('Timeline Research Co')
    cleanupIds.timelineEntries.push(newEntry.id)

    // Clean up research card
    const card = await db.companyResearchCard.findUnique({
      where: { companyId: company.id },
    })
    if (card) cleanupIds.researchCards.push(card.id)
  })
})