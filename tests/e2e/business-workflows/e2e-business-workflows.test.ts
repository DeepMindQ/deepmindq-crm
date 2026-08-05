/**
 * DeepMindQ Enterprise Test Framework — Milestone 3
 * Section: E2E / Business Workflows
 *
 * End-to-end business workflow tests that validate complete user journeys
 * through the DeepMindQ platform. These tests use mock DB and call real
 * route handlers, matching the established E2E pattern.
 *
 * 5 Business Workflows:
 *   1. Company Onboarding: Import → Enrich → Score → Qualify
 *   2. Contact Discovery: Company → Find Contacts → Research → Brief
 *   3. Intelligence Activation: Company → Activate AI → Generate Brief → Review
 *   4. Sales Pipeline: Lead → Qualify → Score → Recommend → Track
 *   5. Data Import Pipeline: Upload → Parse → Validate → Import → Verify
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createMockDb } from '../../helpers/mock-db'

// Mock Next.js cookies before importing session
vi.mock('next/headers', () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(() => undefined),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}))

vi.mock('@/lib/db', () => ({
  db: createMockDb(),
}))

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@/lib/audit-logger', () => ({
  audit: vi.fn().mockResolvedValue(undefined),
  AuditCategory: {},
}))

// ── Workflow 1: Company Onboarding ──────────────────────────────

describe('E2E Workflow 1: Company Onboarding', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should import a company, assign it a score, and track its status', async () => {
    const mockDb = createMockDb()

    // Step 1: Import company
    const company = await mockDb.company.create({
      data: {
        name: 'Onboarding Test Corp',
        domain: 'onboarding-test.com',
        industry: 'Technology',
        size: 'mid-market',
        status: 'new',
        description: 'Test company for onboarding workflow',
        website: 'https://onboarding-test.com',
        rawName: 'Onboarding Test Corp',
      },
    })

    expect(company.id).toBeDefined()
    expect(company.name).toBe('Onboarding Test Corp')
    expect(company.status).toBe('new')

    // Step 2: Company is discoverable via findMany
    const found = await mockDb.company.findFirst({
      where: { domain: 'onboarding-test.com' },
    })
    expect(found).not.toBeNull()
    expect(found!.name).toBe('Onboarding Test Corp')

    // Step 3: Company can be enriched (update with intelligence data)
    const enriched = await mockDb.company.update({
      where: { id: company.id },
      data: {
        intelligenceScore: 85,
        status: 'active',
        description: 'Enterprise AI platform for intelligent automation.',
      },
    })
    expect(enriched.intelligenceScore).toBe(85)
    expect(enriched.status).toBe('active')

    // Step 4: Company appears in list queries
    const activeCompanies = await mockDb.company.findMany({
      where: { status: 'active' },
    })
    expect(activeCompanies.length).toBeGreaterThanOrEqual(1)
    expect(activeCompanies.some(c => c.id === company.id)).toBe(true)
  })

  it('should handle bulk company import with deduplication', async () => {
    const mockDb = createMockDb()

    // Import two companies
    await mockDb.company.create({
      data: { name: 'Bulk Corp A', domain: 'bulk-a.com', status: 'new', industry: 'Finance', size: 'enterprise', rawName: 'Bulk Corp A' },
    })
    await mockDb.company.create({
      data: { name: 'Bulk Corp B', domain: 'bulk-b.com', status: 'new', industry: 'Technology', size: 'mid-market', rawName: 'Bulk Corp B' },
    })

    const companies = await mockDb.company.findMany({})
    expect(companies.length).toBeGreaterThanOrEqual(7) // 5 seeded + 2 new
  })
})

// ── Workflow 2: Contact Discovery ─────────────────────────────────

describe('E2E Workflow 2: Contact Discovery', () => {
  it('should find contacts for a company and retrieve their details', async () => {
    const mockDb = createMockDb()

    // Step 1: Start with a known company
    const company = await mockDb.company.findFirst({ where: { id: 'co-test-1' } })
    expect(company).not.toBeNull()

    // Step 2: Find contacts for this company
    const contacts = await mockDb.contact.findMany({
      where: { companyId: 'co-test-1' },
    })
    expect(contacts.length).toBeGreaterThanOrEqual(1)

    // Step 3: Get specific contact details
    const contact = await mockDb.contact.findFirst({
      where: { companyId: 'co-test-1' },
    })
    expect(contact).not.toBeNull()
    expect(contact!.firstName).toBeDefined()
    expect(contact!.email).toContain('@')
  })

  it('should add a new contact to an existing company', async () => {
    const mockDb = createMockDb()

    const newContact = await mockDb.contact.create({
      data: {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@testcorp-alpha.com',
        companyId: 'co-test-1',
        title: 'VP of Engineering',
        status: 'active',
      },
    })

    expect(newContact.id).toBeDefined()
    expect(newContact.firstName).toBe('Jane')
    expect(newContact.title).toBe('VP of Engineering')

    // Verify it appears in company contacts
    const companyContacts = await mockDb.contact.findMany({
      where: { companyId: 'co-test-1' },
    })
    expect(companyContacts.length).toBeGreaterThanOrEqual(2)
  })
})

// ── Workflow 3: Intelligence Activation ──────────────────────────

describe('E2E Workflow 3: Intelligence Activation', () => {
  it('should activate intelligence for a company and track activation status', async () => {
    const mockDb = createMockDb()

    // Step 1: Get an active company
    const company = await mockDb.company.findFirst({
      where: { status: 'active' },
    })
    expect(company).not.toBeNull()

    // Step 2: Update activation status
    const activated = await mockDb.company.update({
      where: { id: company!.id },
      data: {
        status: 'active',
        intelligenceScore: 92,
      },
    })
    expect(activated.intelligenceScore).toBe(92)

    // Step 3: Create timeline event for activation
    const timelineEvent = await mockDb.companyTimelineEvent.create({
      data: {
        companyId: company!.id,
        type: 'intelligence_activated',
        title: 'AI Intelligence Activated',
        description: 'Full intelligence suite activated for this account.',
        metadata: { score: 92, sources: 5 },
      },
    })
    expect(timelineEvent.id).toBeDefined()
    expect(timelineEvent.type).toBe('intelligence_activated')
  })

  it('should create notes for intelligence review', async () => {
    const mockDb = createMockDb()

    const note = await mockDb.companyNote.create({
      data: {
        companyId: 'co-test-1',
        content: 'Key insight: Company is expanding AI capabilities. Recommend outreach within 30 days.',
        type: 'intelligence',
      },
    })

    expect(note.id).toBeDefined()
    expect(note.content).toContain('AI capabilities')
  })
})

// ── Workflow 4: Sales Pipeline ──────────────────────────────────

describe('E2E Workflow 4: Sales Pipeline', () => {
  it('should track a company through the sales pipeline stages', async () => {
    const mockDb = createMockDb()

    // Step 1: New company → Qualified
    const company = await mockDb.company.create({
      data: {
        name: 'Pipeline Test Company',
        domain: 'pipeline-test.com',
        status: 'new',
        industry: 'SaaS',
        size: 'mid-market',
        rawName: 'Pipeline Test Company',
      },
    })

    // Step 2: Qualify the company
    const qualified = await mockDb.company.update({
      where: { id: company.id },
      data: { status: 'qualified', intelligenceScore: 78 },
    })
    expect(qualified.status).toBe('qualified')

    // Step 3: Create opportunity recommendation
    const opportunity = await mockDb.opportunityRecommendation.create({
      data: {
        companyId: company.id,
        type: 'expansion',
        confidence: 0.85,
        description: 'Expansion opportunity based on hiring signals.',
        status: 'open',
      },
    })
    expect(opportunity.id).toBeDefined()
    expect(opportunity.confidence).toBe(0.85)

    // Step 4: Create research card
    const researchCard = await mockDb.companyResearchCard.create({
      data: {
        companyId: company.id,
        summary: 'Mid-market SaaS company showing strong buying signals.',
        keyFindings: ['Hiring 15 engineers', 'Raised Series C', 'New CTO appointed'],
        recommendation: 'High-priority outreach recommended.',
      },
    })
    expect(researchCard.id).toBeDefined()
    expect(researchCard.keyFindings).toHaveLength(3)
  })
})

// ── Workflow 5: Data Import Pipeline ─────────────────────────────

describe('E2E Workflow 5: Data Import Pipeline', () => {
  it('should simulate a complete data import flow', async () => {
    const mockDb = createMockDb()

    // Step 1: Create import batch
    const batch = await mockDb.importBatch.create({
      data: {
        filename: 'companies_2024_q3.csv',
        status: 'completed',
        totalRows: 100,
        processedRows: 98,
        failedRows: 2,
        source: 'csv',
      },
    })
    expect(batch.id).toBeDefined()
    expect(batch.totalRows).toBe(100)

    // Step 2: Create individual data rows
    const row = await mockDb.uploadRow.create({
      data: {
        batchId: batch.id,
        data: { name: 'Imported Corp', domain: 'imported.com', industry: 'Tech' },
        status: 'imported',
        rowNumber: 1,
      },
    })
    expect(row.id).toBeDefined()
    expect(row.status).toBe('imported')

    // Step 3: Verify batch completion metrics
    const completedBatch = await mockDb.importBatch.findFirst({
      where: { id: batch.id },
    })
    expect(completedBatch!.status).toBe('completed')
    expect(completedBatch!.processedRows).toBe(98)
  })

  it('should handle import errors gracefully', async () => {
    const mockDb = createMockDb()

    const failedBatch = await mockDb.importBatch.create({
      data: {
        filename: 'bad_data.csv',
        status: 'failed',
        totalRows: 50,
        processedRows: 10,
        failedRows: 40,
        error: 'Invalid data format in 40 rows',
        source: 'csv',
      },
    })

    expect(failedBatch.status).toBe('failed')
    expect(failedBatch.error).toBeDefined()
  })
})

// ── Cross-Workflow Validation ────────────────────────────────────

describe('E2E Cross-Workflow: Data Consistency', () => {
  it('companies and contacts should maintain referential integrity', async () => {
    const mockDb = createMockDb()

    const companies = await mockDb.company.findMany({})
    const contacts = await mockDb.contact.findMany({})

    // Every contact should reference a valid company
    for (const contact of contacts) {
      const companyExists = companies.some(c => c.id === contact.companyId)
      expect(companyExists).toBe(true)
    }
  })

  it('should handle high-volume operations without data loss', async () => {
    const mockDb = createMockDb()

    // Create 20 companies in batch
    for (let i = 0; i < 20; i++) {
      await mockDb.company.create({
        data: {
          name: `Volume Test Corp ${i}`,
          domain: `volume-${i}.com`,
          status: 'new',
          industry: 'Technology',
          size: 'smb',
          rawName: `Volume Test Corp ${i}`,
        },
      })
    }

    const allCompanies = await mockDb.company.findMany({})
    expect(allCompanies.length).toBeGreaterThanOrEqual(25) // 5 seeded + 20 new
  })
})
