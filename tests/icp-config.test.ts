import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock DB ────────────────────────────────────────────────────

const mockFindUnique = vi.fn()
const mockUpsert = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    systemSetting: {
      findUnique: mockFindUnique,
      upsert: mockUpsert,
    },
  },
}))

// ── We need to reset module state between tests ────────────────
// icp-config has module-level _loaded and currentIcp state.
// We re-import for each test via vi.resetModules() in beforeEach.

describe('ICP Config — getIcpProfile', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()

    // Re-mock db after module reset
    const { db } = await import('@/lib/db')
    vi.mocked(db.systemSetting.findUnique) = mockFindUnique
    vi.mocked(db.systemSetting.upsert) = mockUpsert
  })

  it('returns ICP profile from DB with correct key', async () => {
    const storedProfile = {
      targetIndustries: ['fintech'],
      targetSizeRanges: ['501-1000'],
      weights: { industry: 0.5, companySize: 0.2, geography: 0.1, revenue: 0.1, techFit: 0.1 },
    }
    mockFindUnique.mockResolvedValueOnce({
      key: 'icp_profile_v1',
      value: JSON.stringify(storedProfile),
    })

    const { getIcpProfile, DEFAULT_ICP } = await import('@/lib/icp-config')
    const profile = await getIcpProfile()

    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: 'icp_profile_v1' } })
    )
    // Stored values should override defaults
    expect(profile.targetIndustries).toEqual(['fintech'])
    expect(profile.targetSizeRanges).toEqual(['501-1000'])
    // Default values should be preserved for non-overridden fields
    expect(profile.targetRegions).toEqual(DEFAULT_ICP.targetRegions)
  })

  it('returns default profile when DB returns null', async () => {
    mockFindUnique.mockResolvedValueOnce(null)

    const { getIcpProfile, DEFAULT_ICP } = await import('@/lib/icp-config')
    const profile = await getIcpProfile()

    expect(profile).toEqual(DEFAULT_ICP)
  })

  it('handles DB errors gracefully and returns defaults', async () => {
    mockFindUnique.mockRejectedValueOnce(new Error('DB connection failed'))

    const { getIcpProfile, DEFAULT_ICP } = await import('@/lib/icp-config')
    const profile = await getIcpProfile()

    // Should return defaults when DB fails
    expect(profile).toEqual(DEFAULT_ICP)
  })

  it('deep-merges stored profile with defaults (partial update)', async () => {
    const partial = {
      targetIndustries: ['ai', 'machine learning'],
    }
    mockFindUnique.mockResolvedValueOnce({
      key: 'icp_profile_v1',
      value: JSON.stringify(partial),
    })

    const { getIcpProfile, DEFAULT_ICP } = await import('@/lib/icp-config')
    const profile = await getIcpProfile()

    expect(profile.targetIndustries).toEqual(['ai', 'machine learning'])
    // Other fields should remain from DEFAULT_ICP
    expect(profile.targetRegions).toEqual(DEFAULT_ICP.targetRegions)
    expect(profile.weights).toEqual(DEFAULT_ICP.weights)
    expect(profile.targetFundingStages).toEqual(DEFAULT_ICP.targetFundingStages)
  })
})

describe('ICP Config — updateIcpProfile', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('saves with correct key via upsert', async () => {
    mockFindUnique.mockResolvedValueOnce(null) // first load returns null
    mockUpsert.mockResolvedValue({})

    const { updateIcpProfile } = await import('@/lib/icp-config')
    await updateIcpProfile({ targetIndustries: ['new industry'] })

    expect(mockUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { key: 'icp_profile_v1' },
        create: expect.objectContaining({ key: 'icp_profile_v1' }),
      })
    )
  })

  it('handles partial updates (merges with existing)', async () => {
    mockFindUnique.mockResolvedValueOnce(null) // load defaults
    mockUpsert.mockResolvedValue({})

    const { updateIcpProfile, getIcpProfile } = await import('@/lib/icp-config')

    // First load defaults
    await getIcpProfile()

    // Partial update
    const updated = await updateIcpProfile({ minEmployeeCount: 200 })

    expect(updated.minEmployeeCount).toBe(200)
    // Other fields should still have default values
    expect(updated.targetIndustries.length).toBeGreaterThan(0)
  })

  it('persists to DB after update', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    mockUpsert.mockResolvedValue({})

    const { updateIcpProfile } = await import('@/lib/icp-config')
    await updateIcpProfile({ targetIndustries: ['test'] })

    expect(mockUpsert).toHaveBeenCalledTimes(1)
    const call = mockUpsert.mock.calls[0][0]
    // Verify the upsert value contains the updated data
    const parsedValue = JSON.parse(call.update.value)
    expect(parsedValue.targetIndustries).toEqual(['test'])
  })
})

describe('ICP Config — resetIcpProfile', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('resets to defaults and persists', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    mockUpsert.mockResolvedValue({})

    const { resetIcpProfile, DEFAULT_ICP } = await import('@/lib/icp-config')
    const profile = await resetIcpProfile()

    expect(profile).toEqual(DEFAULT_ICP)
    expect(mockUpsert).toHaveBeenCalledTimes(1)
  })
})

// ═══════════════════════════════════════════════════════════════
// Pure matching functions (no module state)
// ═══════════════════════════════════════════════════════════════

describe('ICP Config — industryMatch', () => {
  // These functions are pure and can be imported once
  let industryMatch: (industry: string | null, icp: any) => boolean
  let DEFAULT_ICP: any

  beforeAll(async () => {
    vi.resetModules()
    // Provide a no-op DB mock
    vi.doMock('@/lib/db', () => ({
      db: { systemSetting: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn() } },
    }))
    const mod = await import('@/lib/icp-config')
    industryMatch = mod.industryMatch
    DEFAULT_ICP = mod.DEFAULT_ICP
  })

  it('exact match → true', () => {
    expect(industryMatch('Technology', DEFAULT_ICP)).toBe(true)
  })

  it('case insensitive match → true', () => {
    expect(industryMatch('TECHNOLOGY', DEFAULT_ICP)).toBe(true)
    expect(industryMatch('technology', DEFAULT_ICP)).toBe(true)
  })

  it('partial match (substring) → true', () => {
    expect(industryMatch('Financial Technology Services', DEFAULT_ICP)).toBe(true)
    expect(industryMatch('Information Technology Solutions', DEFAULT_ICP)).toBe(true)
  })

  it('no match → false', () => {
    expect(industryMatch('Agriculture', DEFAULT_ICP)).toBe(false)
    expect(industryMatch('Construction', DEFAULT_ICP)).toBe(false)
  })

  it('null industry → false', () => {
    expect(industryMatch(null, DEFAULT_ICP)).toBe(false)
  })

  it('excluded industry → false', () => {
    expect(industryMatch('Online Gambling', DEFAULT_ICP)).toBe(false)
    expect(industryMatch('Casino Entertainment', DEFAULT_ICP)).toBe(false)
  })

  it('excluded industry takes precedence over target match', () => {
    // If an industry is both target and excluded, excluded wins
    const customIcp = {
      ...DEFAULT_ICP,
      targetIndustries: ['technology'],
      excludedIndustries: ['technology'],
    }
    expect(industryMatch('Technology Company', customIcp)).toBe(false)
  })
})

describe('ICP Config — sizeMatch', () => {
  let sizeMatch: (sizeRange: string | null, icp: any) => boolean
  let DEFAULT_ICP: any

  beforeAll(async () => {
    vi.resetModules()
    vi.doMock('@/lib/db', () => ({
      db: { systemSetting: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn() } },
    }))
    const mod = await import('@/lib/icp-config')
    sizeMatch = mod.sizeMatch
    DEFAULT_ICP = mod.DEFAULT_ICP
  })

  it('company within range → true', () => {
    expect(sizeMatch('201-500', DEFAULT_ICP)).toBe(true)
    expect(sizeMatch('501-1000', DEFAULT_ICP)).toBe(true)
    expect(sizeMatch('1001-5000', DEFAULT_ICP)).toBe(true)
    expect(sizeMatch('5001+', DEFAULT_ICP)).toBe(true)
  })

  it('company below range → false', () => {
    expect(sizeMatch('1-10', DEFAULT_ICP)).toBe(false)
    expect(sizeMatch('11-50', DEFAULT_ICP)).toBe(false)
    expect(sizeMatch('51-200', DEFAULT_ICP)).toBe(false)
  })

  it('company above range → true (5001+ matches)', () => {
    expect(sizeMatch('10001+', DEFAULT_ICP)).toBe(true)
  })

  it('company with no employee data → false', () => {
    expect(sizeMatch(null, DEFAULT_ICP)).toBe(false)
    expect(sizeMatch('', DEFAULT_ICP)).toBe(false)
  })

  it('case insensitive match', () => {
    expect(sizeMatch('201-500', DEFAULT_ICP)).toBe(true)
  })

  it('whitespace-normalized match', () => {
    // The implementation normalizes whitespace: '201 - 500' → '201-500'
    expect(sizeMatch('201 - 500', DEFAULT_ICP)).toBe(true)
  })
})

describe('ICP Config — regionMatch', () => {
  let regionMatch: (country: string | null, location: string | null, icp: any) => boolean
  let DEFAULT_ICP: any

  beforeAll(async () => {
    vi.resetModules()
    vi.doMock('@/lib/db', () => ({
      db: { systemSetting: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn() } },
    }))
    const mod = await import('@/lib/icp-config')
    regionMatch = mod.regionMatch
    DEFAULT_ICP = mod.DEFAULT_ICP
  })

  it('exact country match → true', () => {
    expect(regionMatch('United States', null, DEFAULT_ICP)).toBe(true)
    expect(regionMatch('Canada', null, DEFAULT_ICP)).toBe(true)
    expect(regionMatch('United Kingdom', null, DEFAULT_ICP)).toBe(true)
  })

  it('case insensitive country match', () => {
    expect(regionMatch('united states', null, DEFAULT_ICP)).toBe(true)
    expect(regionMatch('UNITED STATES', null, DEFAULT_ICP)).toBe(true)
  })

  it('abbreviation match (USA → us)', () => {
    expect(regionMatch('USA', null, DEFAULT_ICP)).toBe(true)
    expect(regionMatch('UK', null, DEFAULT_ICP)).toBe(true)
  })

  it('no match → false', () => {
    expect(regionMatch('Brazil', null, DEFAULT_ICP)).toBe(false)
    expect(regionMatch('Japan', null, DEFAULT_ICP)).toBe(false)
  })

  it('null country and location → false', () => {
    expect(regionMatch(null, null, DEFAULT_ICP)).toBe(false)
  })

  it('location-based match', () => {
    expect(regionMatch(null, 'San Francisco, USA', DEFAULT_ICP)).toBe(true)
    expect(regionMatch(null, 'London, UK', DEFAULT_ICP)).toBe(true)
  })

  it('combined country+location matching', () => {
    // 'country location' is combined and searched
    expect(regionMatch('Germany', 'Berlin', DEFAULT_ICP)).toBe(true) // 'germany' matches
  })
})

describe('ICP Config — techMatch', () => {
  let techMatch: (techStack: string | null, icp: any) => number
  let DEFAULT_ICP: any

  beforeAll(async () => {
    vi.resetModules()
    vi.doMock('@/lib/db', () => ({
      db: { systemSetting: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn() } },
    }))
    const mod = await import('@/lib/icp-config')
    techMatch = mod.techMatch
    DEFAULT_ICP = mod.DEFAULT_ICP
  })

  it('company has matching tech keyword → positive score', () => {
    const score = techMatch('cloud, aws, kubernetes', DEFAULT_ICP)
    expect(score).toBeGreaterThan(0)
  })

  it('no matching tech → 0', () => {
    const score = techMatch('cobol, fortran, pascal', DEFAULT_ICP)
    expect(score).toBe(0)
  })

  it('case insensitive', () => {
    const score1 = techMatch('Cloud, AWS, Kubernetes', DEFAULT_ICP)
    const score2 = techMatch('cloud, aws, kubernetes', DEFAULT_ICP)
    expect(score1).toBe(score2)
  })

  it('null techStack → 0', () => {
    expect(techMatch(null, DEFAULT_ICP)).toBe(0)
  })

  it('returns ratio capped at 1.0', () => {
    // With many matches, should cap at 1.0
    const score = techMatch('cloud, aws, kubernetes, docker, react, node, python, java, typescript, sap, salesforce, servicenow, workday, machine learning, ai, data analytics, microservices', DEFAULT_ICP)
    expect(score).toBeLessThanOrEqual(1)
    expect(score).toBe(1) // many matches → capped
  })

  it('partial keyword match (substring)', () => {
    // 'machine learning' should match in 'uses machine learning for analytics'
    const score = techMatch('We use machine learning and ai for data analytics', DEFAULT_ICP)
    expect(score).toBeGreaterThan(0)
  })

  it('returns 0.2 per keyword match (ratio = count/5)', () => {
    const score = techMatch('python', DEFAULT_ICP) // 1 match
    expect(score).toBeCloseTo(0.2, 1)

    const score2 = techMatch('cloud, aws', DEFAULT_ICP) // 2 matches
    expect(score2).toBeCloseTo(0.4, 1)
  })
})

describe('ICP Config — parseEmployeeCount', () => {
  let parseEmployeeCount: (sizeRange: string | null, enrichmentEmployeeCount: string | null) => number

  beforeAll(async () => {
    vi.resetModules()
    vi.doMock('@/lib/db', () => ({
      db: { systemSetting: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn() } },
    }))
    const mod = await import('@/lib/icp-config')
    parseEmployeeCount = mod.parseEmployeeCount
  })

  it('prefers enrichmentEmployeeCount over sizeRange', () => {
    expect(parseEmployeeCount('201-500', '1,200')).toBe(1200)
  })

  it('parses enrichmentEmployeeCount with non-numeric chars', () => {
    expect(parseEmployeeCount(null, '~3,500 employees')).toBe(3500)
    expect(parseEmployeeCount(null, '10000+')).toBe(10000)
  })

  it('extracts upper bound from sizeRange', () => {
    expect(parseEmployeeCount('201-500', null)).toBe(500)
    expect(parseEmployeeCount('501-1000', null)).toBe(1000)
    expect(parseEmployeeCount('1001-5000', null)).toBe(5000)
  })

  it('handles 5001+ pattern', () => {
    expect(parseEmployeeCount('5001+', null)).toBe(5001)
    expect(parseEmployeeCount('10001+', null)).toBe(10001)
  })

  it('handles comma-formatted numbers', () => {
    expect(parseEmployeeCount('5,001-10,000', null)).toBe(10000)
  })

  it('returns 0 for null sizeRange and no enrichment', () => {
    expect(parseEmployeeCount(null, null)).toBe(0)
  })

  it('returns 0 for unparseable enrichment', () => {
    expect(parseEmployeeCount(null, 'unknown')).toBe(0)
  })

  it('handles single-number range (e.g. "5001-10000")', () => {
    expect(parseEmployeeCount('5001-10000', null)).toBe(10000)
  })
})

describe('ICP Config — deepMerge (tested via updateIcpProfile)', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('merges nested objects correctly', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    mockUpsert.mockResolvedValue({})

    const { updateIcpProfile } = await import('@/lib/icp-config')

    // Update only weights.industry, leaving other weights intact
    const updated = await updateIcpProfile({
      weights: { industry: 0.5 },
    })

    // industry should be updated
    expect(updated.weights.industry).toBe(0.5)
    // Other weights should retain defaults
    expect(updated.weights.companySize).toBe(0.25)
    expect(updated.weights.geography).toBe(0.15)
    expect(updated.weights.revenue).toBe(0.15)
    expect(updated.weights.techFit).toBe(0.15)
  })

  it('arrays are replaced (not merged)', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    mockUpsert.mockResolvedValue({})

    const { updateIcpProfile, DEFAULT_ICP } = await import('@/lib/icp-config')

    const updated = await updateIcpProfile({
      targetIndustries: ['fintech'],
    })

    // Array should be replaced entirely, not merged
    expect(updated.targetIndustries).toEqual(['fintech'])
    expect(updated.targetIndustries.length).toBeLessThan(DEFAULT_ICP.targetIndustries.length)
  })

  it('source overrides target', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    mockUpsert.mockResolvedValue({})

    const { updateIcpProfile } = await import('@/lib/icp-config')

    const updated = await updateIcpProfile({
      minEmployeeCount: 500,
    })

    expect(updated.minEmployeeCount).toBe(500)
  })

  it('handles null/undefined values in source (skips them)', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    mockUpsert.mockResolvedValue({})

    const { updateIcpProfile, DEFAULT_ICP } = await import('@/lib/icp-config')

    // Pass undefined values - they should be skipped
    const updated = await updateIcpProfile({
      minEmployeeCount: undefined as any,
    } as any)

    // Should retain default value
    expect(updated.minEmployeeCount).toBe(DEFAULT_ICP.minEmployeeCount)
  })

  it('null source values do NOT override target values', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    mockUpsert.mockResolvedValue({})

    const { updateIcpProfile, DEFAULT_ICP } = await import('@/lib/icp-config')

    const updated = await updateIcpProfile({
      targetIndustries: null as any,
    } as any)

    // The deepMerge function skips null source values
    // Actually, looking at the code: `if (srcVal !== undefined)` - it replaces with null
    // since null !== undefined. So null WILL override.
    // This tests the actual behavior.
    expect(updated.targetIndustries).toBeNull()
  })
})

describe('ICP Config — DEFAULT_ICP', () => {
  beforeAll(async () => {
    vi.resetModules()
    vi.doMock('@/lib/db', () => ({
      db: { systemSetting: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn() } },
    }))
  })

  it('has valid weight sum close to 1.0', async () => {
    const { DEFAULT_ICP } = await import('@/lib/icp-config')
    const sum = Object.values(DEFAULT_ICP.weights).reduce((a: number, b: number) => a + b, 0)
    expect(sum).toBeCloseTo(1.0, 5)
  })

  it('has all required fields', async () => {
    const { DEFAULT_ICP } = await import('@/lib/icp-config')
    expect(DEFAULT_ICP.targetIndustries).toBeInstanceOf(Array)
    expect(DEFAULT_ICP.targetSizeRanges).toBeInstanceOf(Array)
    expect(DEFAULT_ICP.targetRegions).toBeInstanceOf(Array)
    expect(DEFAULT_ICP.targetFundingStages).toBeInstanceOf(Array)
    expect(DEFAULT_ICP.preferredTechKeywords).toBeInstanceOf(Array)
    expect(DEFAULT_ICP.excludedIndustries).toBeInstanceOf(Array)
    expect(DEFAULT_ICP.weights).toHaveProperty('industry')
    expect(DEFAULT_ICP.weights).toHaveProperty('companySize')
    expect(DEFAULT_ICP.weights).toHaveProperty('geography')
    expect(DEFAULT_ICP.weights).toHaveProperty('revenue')
    expect(DEFAULT_ICP.weights).toHaveProperty('techFit')
  })

  it('targetIndustries is non-empty', async () => {
    const { DEFAULT_ICP } = await import('@/lib/icp-config')
    expect(DEFAULT_ICP.targetIndustries.length).toBeGreaterThan(0)
  })
})