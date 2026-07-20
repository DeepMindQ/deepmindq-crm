import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Mock dependencies ────────────────────────────────────────

const mockComputeAccountPriorityBatch = vi.fn()
const mockGetAccountRankings = vi.fn()
const mockComputeAccountPriority = vi.fn()
const mockScoreEventsEmit = vi.fn()
const mockDbCompanyUpdateMany = vi.fn()
const mockDbCompanyFindUnique = vi.fn()
const mockDbSystemSettingUpsert = vi.fn()
const mockGetIcpProfile = vi.fn()
const mockUpdateIcpProfile = vi.fn()
const mockResetIcpProfile = vi.fn()
const mockNormalizeIcpProfile = vi.fn()

const MOCK_DEFAULT_ICP = {
  targetIndustries: ['technology', 'fintech', 'saas'],
  targetSizeRanges: ['201-500', '501-1000'],
  targetRegions: ['us', 'uk'],
  weights: { industry: 0.3, companySize: 0.25, geography: 0.15, revenue: 0.15, techFit: 0.15 },
}

vi.mock('@/lib/account-prioritization', () => ({
  computeAccountPriorityBatch: mockComputeAccountPriorityBatch,
  getAccountRankings: mockGetAccountRankings,
  computeAccountPriority: mockComputeAccountPriority,
  PriorityTier: ['HOT', 'ACTIVE', 'NURTURE', 'LOW'],
}))

vi.mock('@/lib/events', () => ({
  scoreEvents: { on: vi.fn(), emit: mockScoreEventsEmit, removeAll: vi.fn() },
}))

vi.mock('@/lib/db', () => ({
  db: {
    company: {
      updateMany: mockDbCompanyUpdateMany,
      findUnique: mockDbCompanyFindUnique,
      update: vi.fn().mockResolvedValue({}),
    },
    systemSetting: {
      upsert: mockDbSystemSettingUpsert,
    },
  },
}))

vi.mock('@/lib/icp-config', () => ({
  getIcpProfile: mockGetIcpProfile,
  updateIcpProfile: mockUpdateIcpProfile,
  resetIcpProfile: mockResetIcpProfile,
  normalizeIcpProfile: mockNormalizeIcpProfile,
  DEFAULT_ICP: MOCK_DEFAULT_ICP,
}))

// ── Helpers ──────────────────────────────────────────────────

function makeRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options)
}

async function getJson(response: Response) {
  return response.json()
}

// ═══════════════════════════════════════════════════════════════
// Task 6b Part B: Integration-style tests for priority API routes
// ═══════════════════════════════════════════════════════════════

// ── 1. GET /api/g-strategy/account-rankings — proper shape ──

describe('GET /api/g-strategy/account-rankings', () => {
  let GET: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    const mod = await import('@/app/api/g-strategy/[...slug]/account-rankings')
    GET = mod.GET
  })

  it('returns companies array and tierDistribution with correct shape', async () => {
    const now = new Date()
    mockGetAccountRankings.mockResolvedValueOnce({
      rankings: [
        {
          companyId: 'c1',
          companyName: 'Acme Corp',
          domain: 'acme.com',
          industry: 'Technology',
          sizeRange: '201-500',
          country: 'United States',
          status: 'active',
          intelligenceScore: 70,
          engagementScore: 50,
          accountPriorityScore: 85,
          priorityTier: 'ACTIVE',
          priorityComputedAt: now,
          _count: { contacts: 5, signals: 3, opportunityRecommendations: 1, pursuits: 0 },
        },
        {
          companyId: 'c2',
          companyName: 'Beta Inc',
          domain: 'beta.io',
          industry: 'Fintech',
          sizeRange: '501-1000',
          country: 'UK',
          status: 'prospect',
          intelligenceScore: 60,
          engagementScore: 30,
          accountPriorityScore: 92,
          priorityTier: 'HOT',
          priorityComputedAt: now,
          _count: { contacts: 8, signals: 6, opportunityRecommendations: 2, pursuits: 1 },
        },
      ],
      total: 2,
      tierBreakdown: { HOT: 1, ACTIVE: 1, NURTURE: 0, LOW: 0 },
    })

    const req = makeRequest('/api/g-strategy/account-rankings')
    const res = await GET(req)
    const json = await getJson(res)

    expect(res.status).toBe(200)
    // Response shape: { companies, total, tierDistribution }
    expect(json.companies).toHaveLength(2)
    expect(json.total).toBe(2)
    expect(json.tierDistribution).toEqual({ HOT: 1, ACTIVE: 1, NURTURE: 0, LOW: 0 })

    // First company has frontend-expected field names
    const c1 = json.companies[0]
    expect(c1.id).toBe('c1')
    expect(c1.rawName).toBe('Acme Corp')
    expect(c1.domain).toBe('acme.com')
    expect(c1.industry).toBe('Technology')
    expect(c1.sizeRange).toBe('201-500')
    expect(c1.accountPriorityScore).toBe(85)
    expect(c1.priorityTier).toBe('ACTIVE')
    expect(c1.intelligenceScore).toBe(70)
    expect(c1.engagementScore).toBe(50)
    expect(c1._count.contacts).toBe(5)
    expect(c1._count.signals).toBe(3)
  })

  it('returns tierDistribution with all four tiers (even zeros)', async () => {
    mockGetAccountRankings.mockResolvedValueOnce({
      rankings: [],
      total: 0,
      tierBreakdown: { HOT: 0, ACTIVE: 0, NURTURE: 0, LOW: 0 },
    })

    const req = makeRequest('/api/g-strategy/account-rankings')
    const res = await GET(req)
    const json = await getJson(res)

    expect(json.tierDistribution).toHaveProperty('HOT')
    expect(json.tierDistribution).toHaveProperty('ACTIVE')
    expect(json.tierDistribution).toHaveProperty('NURTURE')
    expect(json.tierDistribution).toHaveProperty('LOW')
  })

  it('handles null accountPriorityScore gracefully (defaults to 0)', async () => {
    mockGetAccountRankings.mockResolvedValueOnce({
      rankings: [
        {
          companyId: 'c3',
          companyName: 'Unscored Co',
          domain: null,
          industry: null,
          sizeRange: null,
          country: null,
          status: 'prospect',
          intelligenceScore: 0,
          engagementScore: 0,
          accountPriorityScore: null,
          priorityTier: null,
          priorityComputedAt: null,
          _count: { contacts: 0, signals: 0, opportunityRecommendations: 0, pursuits: 0 },
        },
      ],
      total: 1,
      tierBreakdown: { HOT: 0, ACTIVE: 0, NURTURE: 0, LOW: 1 },
    })

    const req = makeRequest('/api/g-strategy/account-rankings')
    const res = await GET(req)
    const json = await getJson(res)

    expect(json.companies[0].accountPriorityScore).toBe(0)
    expect(json.companies[0].priorityTier).toBe('LOW')
  })
})

// ── 2. POST /api/g-strategy/account-rankings — triggers recomputation ──

describe('POST /api/g-strategy/account-rankings', () => {
  let POST: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    const mod = await import('@/app/api/g-strategy/[...slug]/account-rankings')
    POST = mod.POST
  })

  it('triggers batch computation and returns 202 with jobId', async () => {
    // Don't resolve the batch — it runs in background
    mockComputeAccountPriorityBatch.mockReturnValue(new Promise(() => {}))

    const req = makeRequest('/api/g-strategy/account-rankings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })

    const res = await POST(req)
    const json = await getJson(res)

    expect(res.status).toBe(202)
    expect(json.jobId).toMatch(/^job_/)
    expect(json.status).toBe('pending')
    expect(json.message).toContain('started')
  })

  it('passes filter options to batch compute', async () => {
    mockComputeAccountPriorityBatch.mockReturnValue(new Promise(() => {}))

    const req = makeRequest('/api/g-strategy/account-rankings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'active', industry: 'technology', limit: 100 }),
    })

    await POST(req)

    expect(mockComputeAccountPriorityBatch).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'active', industry: 'technology', limit: 100 }),
    )
  })

  it('handles empty body (compute all) without error', async () => {
    mockComputeAccountPriorityBatch.mockReturnValue(new Promise(() => {}))

    const req = makeRequest('/api/g-strategy/account-rankings', { method: 'POST' })

    const res = await POST(req)
    expect(res.status).toBe(202)
  })
})

// ── 3. GET single company priority — returns breakdown ──

describe('GET /api/g-strategy/companies/[id]/priority', () => {
  let GET: (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => Promise<Response>

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    const mod = await import('@/app/api/g-strategy/[...slug]/companies___id__priority')
    GET = mod.GET
  })

  it('returns company priority with all expected fields', async () => {
    const now = new Date()
    mockDbCompanyFindUnique.mockResolvedValueOnce({
      id: 'comp-1',
      rawName: 'Acme Corp',
      domain: 'acme.com',
      industry: 'Technology',
      sizeRange: '201-500',
      country: 'United States',
      accountPriorityScore: 85.5,
      priorityTier: 'ACTIVE',
      priorityComputedAt: now,
      intelligenceScore: 70,
      engagementScore: 50,
      status: 'active',
      lifecycleStage: 'qualification',
    })

    const req = makeRequest('/api/g-strategy/companies/comp-1/priority')
    const res = await GET(req, { params: Promise.resolve({ id: 'comp-1' }) })
    const json = await getJson(res)

    expect(res.status).toBe(200)
    expect(json.companyId).toBe('comp-1')
    expect(json.companyName).toBe('Acme Corp')
    expect(json.accountPriorityScore).toBe(85.5)
    expect(json.priorityTier).toBe('ACTIVE')
    expect(json.intelligenceScore).toBe(70)
    expect(json.engagementScore).toBe(50)
    expect(json.hasComputedPriority).toBe(true)
  })

  it('returns 404 for non-existent company', async () => {
    mockDbCompanyFindUnique.mockResolvedValueOnce(null)

    const req = makeRequest('/api/g-strategy/companies/nonexistent/priority')
    const res = await GET(req, { params: Promise.resolve({ id: 'nonexistent' }) })
    const json = await getJson(res)

    expect(res.status).toBe(404)
    expect(json.error).toContain('not found')
  })

  it('returns hasComputedPriority false when score is null', async () => {
    mockDbCompanyFindUnique.mockResolvedValueOnce({
      id: 'comp-2',
      rawName: 'New Corp',
      domain: 'newcorp.com',
      industry: null,
      sizeRange: null,
      country: null,
      accountPriorityScore: null,
      priorityTier: null,
      priorityComputedAt: null,
      intelligenceScore: 0,
      engagementScore: 0,
      status: 'prospect',
      lifecycleStage: 'discovery',
    })

    const req = makeRequest('/api/g-strategy/companies/comp-2/priority')
    const res = await GET(req, { params: Promise.resolve({ id: 'comp-2' }) })
    const json = await getJson(res)

    expect(json.hasComputedPriority).toBe(false)
    expect(json.accountPriorityScore).toBeNull()
  })
})

// ── 4. GET /api/g-strategy/icp-profile — returns ICP object ──

describe('GET /api/g-strategy/icp-profile', () => {
  let GET: () => Promise<Response>

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    const mod = await import('@/app/api/g-strategy/[...slug]/icp-profile')
    GET = mod.GET
  })

  it('returns profile object with all ICP fields', async () => {
    const mockProfile = {
      targetIndustries: ['fintech', 'saas'],
      targetSizeRanges: ['201-500', '501-1000'],
      targetRegions: ['us', 'uk', 'germany'],
      minEmployeeCount: 50,
      maxEmployeeCount: -1,
      minRevenue: '$1M',
      targetFundingStages: ['series a', 'series b'],
      preferredTechKeywords: ['cloud', 'aws'],
      excludedIndustries: ['gambling'],
      weights: { industry: 0.3, companySize: 0.25, geography: 0.15, revenue: 0.15, techFit: 0.15 },
    }
    mockGetIcpProfile.mockResolvedValueOnce(mockProfile)

    const res = await GET()
    const json = await getJson(res)

    expect(res.status).toBe(200)
    expect(json.profile).toEqual(mockProfile)
    expect(json.isDefault).toBe(false)
  })

  it('returns isDefault=true when profile matches defaults', async () => {
    mockGetIcpProfile.mockResolvedValueOnce(MOCK_DEFAULT_ICP)

    const res = await GET()
    const json = await getJson(res)

    expect(json.isDefault).toBe(true)
    expect(json.profile).toBeDefined()
  })

  it('returns 500 when getIcpProfile throws', async () => {
    mockGetIcpProfile.mockRejectedValueOnce(new Error('DB connection failed'))

    const res = await GET()
    expect(res.status).toBe(500)
  })
})

// ── 5. PUT /api/g-strategy/icp-profile — validates and saves ──

describe('PUT /api/g-strategy/icp-profile', () => {
  let PUT: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    const mod = await import('@/app/api/g-strategy/[...slug]/icp-profile')
    PUT = mod.PUT
  })

  it('saves valid ICP profile update and invalidates stale scores', async () => {
    const updatedProfile = {
      targetIndustries: ['fintech', 'saas'],
      targetSizeRanges: ['201-500'],
      targetRegions: ['us', 'uk'],
      weights: { industry: 0.3, companySize: 0.25, geography: 0.15, revenue: 0.15, techFit: 0.15 },
    }
    mockGetIcpProfile
      .mockResolvedValueOnce({ weights: { industry: 0.3, companySize: 0.25, geography: 0.15, revenue: 0.15, techFit: 0.15 } })
    mockNormalizeIcpProfile.mockReturnValueOnce({ targetIndustries: ['fintech', 'saas'], targetRegions: ['us', 'uk'] })
    mockUpdateIcpProfile.mockResolvedValueOnce(updatedProfile)
    mockDbCompanyUpdateMany.mockResolvedValue({ count: 50 })
    mockDbSystemSettingUpsert.mockResolvedValue({})

    const req = makeRequest('/api/g-strategy/icp-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetIndustries: ['fintech', 'saas'], targetRegions: ['us', 'uk'] }),
    })

    const res = await PUT(req)
    const json = await getJson(res)

    expect(res.status).toBe(200)
    expect(json.profile).toEqual(updatedProfile)
    expect(json.isDefault).toBe(false)
    expect(json.message).toContain('updated')

    // Verify score invalidation
    expect(mockDbCompanyUpdateMany).toHaveBeenCalledWith({
      data: { accountPriorityScore: null, priorityTier: null, priorityComputedAt: null },
    })
    expect(mockDbSystemSettingUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: 'priority_scores_stale' } }),
    )
  })

  it('resets ICP when reset=true', async () => {
    const defaultProfile = {
      targetIndustries: ['technology', 'fintech', 'saas'],
      targetSizeRanges: ['201-500'],
      targetRegions: ['us', 'uk'],
      weights: { industry: 0.3, companySize: 0.25, geography: 0.15, revenue: 0.15, techFit: 0.15 },
    }
    mockResetIcpProfile.mockResolvedValueOnce(defaultProfile)
    mockDbCompanyUpdateMany.mockResolvedValue({ count: 50 })
    mockDbSystemSettingUpsert.mockResolvedValue({})

    const req = makeRequest('/api/g-strategy/icp-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reset: true }),
    })

    const res = await PUT(req)
    const json = await getJson(res)

    expect(res.status).toBe(200)
    expect(mockResetIcpProfile).toHaveBeenCalledTimes(1)
    expect(json.isDefault).toBe(true)
  })
})

// ── 6. PUT with invalid weights (sum != 1.0) → 400 ──

describe('PUT /api/g-strategy/icp-profile — weight validation', () => {
  let PUT: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    const mod = await import('@/app/api/g-strategy/[...slug]/icp-profile')
    PUT = mod.PUT
  })

  it('returns 400 when merged weights do not sum to 1.0', async () => {
    // Current weights sum to 1.0, but new weights push sum to 1.45
    mockGetIcpProfile.mockResolvedValueOnce({
      weights: { industry: 0.3, companySize: 0.25, geography: 0.15, revenue: 0.15, techFit: 0.15 },
    })

    const req = makeRequest('/api/g-strategy/icp-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetIndustries: ['fintech'],
        targetRegions: ['us'],
        weights: { industry: 0.5, companySize: 0.5 },
      }),
    })

    const res = await PUT(req)
    const json = await getJson(res)

    expect(res.status).toBe(400)
    expect(json.error).toContain('must sum to 1.0')
  })

  it('returns 400 when all weights are zero (sum = 0)', async () => {
    mockGetIcpProfile.mockResolvedValueOnce({
      weights: { industry: 0.3, companySize: 0.25, geography: 0.15, revenue: 0.15, techFit: 0.15 },
    })

    const req = makeRequest('/api/g-strategy/icp-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetIndustries: ['fintech'],
        targetRegions: ['us'],
        weights: { industry: 0, companySize: 0, geography: 0, revenue: 0, techFit: 0 },
      }),
    })

    const res = await PUT(req)
    const json = await getJson(res)

    expect(res.status).toBe(400)
    expect(json.error).toContain('must sum to 1.0')
  })

  it('accepts weights that sum exactly to 1.0', async () => {
    mockGetIcpProfile.mockResolvedValueOnce({
      weights: { industry: 0.3, companySize: 0.25, geography: 0.15, revenue: 0.15, techFit: 0.15 },
    })
    const updatedProfile = {
      targetIndustries: ['fintech'],
      targetRegions: ['us'],
      weights: { industry: 0.4, companySize: 0.2, geography: 0.15, revenue: 0.15, techFit: 0.1 },
    }
    mockNormalizeIcpProfile.mockReturnValueOnce({ targetIndustries: ['fintech'], targetRegions: ['us'] })
    mockUpdateIcpProfile.mockResolvedValueOnce(updatedProfile)
    mockDbCompanyUpdateMany.mockResolvedValue({ count: 50 })
    mockDbSystemSettingUpsert.mockResolvedValue({})

    const req = makeRequest('/api/g-strategy/icp-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetIndustries: ['fintech'],
        targetRegions: ['us'],
        weights: { industry: 0.4, companySize: 0.2, geography: 0.15, revenue: 0.15, techFit: 0.1 },
      }),
    })

    const res = await PUT(req)
    expect(res.status).toBe(200)
  })
})

// ── 7. PUT with empty targetIndustries → 400 ──

describe('PUT /api/g-strategy/icp-profile — targetIndustries validation', () => {
  let PUT: (req: NextRequest) => Promise<Response>

  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
    const mod = await import('@/app/api/g-strategy/[...slug]/icp-profile')
    PUT = mod.PUT
  })

  it('returns 400 when targetIndustries is empty array', async () => {
    mockGetIcpProfile.mockResolvedValueOnce({
      weights: { industry: 0.3, companySize: 0.25, geography: 0.15, revenue: 0.15, techFit: 0.15 },
    })

    const req = makeRequest('/api/g-strategy/icp-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetIndustries: [],
        targetRegions: ['us'],
      }),
    })

    const res = await PUT(req)
    const json = await getJson(res)

    expect(res.status).toBe(400)
    expect(json.error).toContain('targetIndustries must not be empty')
  })

  it('returns 400 when targetRegions is empty array', async () => {
    mockGetIcpProfile.mockResolvedValueOnce({
      weights: { industry: 0.3, companySize: 0.25, geography: 0.15, revenue: 0.15, techFit: 0.15 },
    })

    const req = makeRequest('/api/g-strategy/icp-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetIndustries: ['fintech'],
        targetRegions: [],
      }),
    })

    const res = await PUT(req)
    const json = await getJson(res)

    expect(res.status).toBe(400)
    expect(json.error).toContain('targetRegions must not be empty')
  })

  it('returns 400 when neither targetIndustries nor targetCountries are provided', async () => {
    mockGetIcpProfile.mockResolvedValueOnce({
      weights: { industry: 0.3, companySize: 0.25, geography: 0.15, revenue: 0.15, techFit: 0.15 },
    })

    // Send body with no industries at all — parsed.targetIndustries and parsed.targetCountries are both undefined
    const req = makeRequest('/api/g-strategy/icp-profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetRegions: ['us'],
      }),
    })

    const res = await PUT(req)
    const json = await getJson(res)

    expect(res.status).toBe(400)
    expect(json.error).toContain('targetIndustries must not be empty')
  })
})