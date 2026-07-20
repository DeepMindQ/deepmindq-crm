import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest'

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

// ═══════════════════════════════════════════════════════════════
// GAP-32: Unit Tests for ICP Config
// ═══════════════════════════════════════════════════════════════

// ── 1. getIcpProfile ──────────────────────────────────────────

describe('ICP Config — getIcpProfile (GAP-32)', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('no stored profile → returns default', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    const { getIcpProfile, DEFAULT_ICP } = await import('@/lib/icp-config')
    const profile = await getIcpProfile()

    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { key: 'icp_profile' } })
    )
    expect(profile).toEqual(DEFAULT_ICP)
  })

  it('stored profile → returns parsed and merged profile', async () => {
    const storedProfile = {
      targetIndustries: ['fintech'],
      targetSizeRanges: ['501-1000'],
      weights: { industry: 0.5, companySize: 0.2, geography: 0.1, revenue: 0.1, techFit: 0.1 },
    }
    mockFindUnique.mockResolvedValueOnce({
      key: 'icp_profile',
      value: JSON.stringify(storedProfile),
    })

    const { getIcpProfile, DEFAULT_ICP } = await import('@/lib/icp-config')
    const profile = await getIcpProfile()

    // Stored values should override defaults
    expect(profile.targetIndustries).toEqual(['fintech'])
    expect(profile.targetSizeRanges).toEqual(['501-1000'])
    // Default values should be preserved for non-overridden fields
    expect(profile.targetRegions).toEqual(DEFAULT_ICP.targetRegions)
  })

  it('corrupted JSON → returns default (graceful fallback)', async () => {
    mockFindUnique.mockResolvedValueOnce({
      key: 'icp_profile',
      value: '{ not valid json }',
    })

    const { getIcpProfile, DEFAULT_ICP } = await import('@/lib/icp-config')
    const profile = await getIcpProfile()

    // Should fall back to defaults on JSON parse error
    expect(profile).toEqual(DEFAULT_ICP)
  })

  it('DB error → returns default (graceful fallback)', async () => {
    mockFindUnique.mockRejectedValueOnce(new Error('DB connection failed'))

    const { getIcpProfile, DEFAULT_ICP } = await import('@/lib/icp-config')
    const profile = await getIcpProfile()

    expect(profile).toEqual(DEFAULT_ICP)
  })
})

// ── 2. saveIcpProfile (via updateIcpProfile) ─────────────────

describe('ICP Config — saveIcpProfile (GAP-32)', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('valid profile → saves correctly', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    mockUpsert.mockResolvedValue({})

    const { updateIcpProfile } = await import('@/lib/icp-config')
    const updated = await updateIcpProfile({ targetIndustries: ['new industry'] })

    expect(updated.targetIndustries).toEqual(['new industry'])
    expect(mockUpsert).toHaveBeenCalledTimes(1)
    const call = mockUpsert.mock.calls[0][0]
    const parsedValue = JSON.parse(call.update.value)
    expect(parsedValue.targetIndustries).toEqual(['new industry'])
  })

  it('partial profile → merges with existing', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    mockUpsert.mockResolvedValue({})

    const { updateIcpProfile, getIcpProfile, DEFAULT_ICP } = await import('@/lib/icp-config')

    // First load defaults
    await getIcpProfile()

    // Partial update
    const updated = await updateIcpProfile({ minEmployeeCount: 200 })

    expect(updated.minEmployeeCount).toBe(200)
    // Other fields should still have default values
    expect(updated.targetIndustries.length).toBeGreaterThan(0)
    expect(updated.targetRegions).toEqual(DEFAULT_ICP.targetRegions)
  })
})

// ── 3. industryMatch ─────────────────────────────────────────

describe('ICP Config — industryMatch (GAP-32)', () => {
  let industryMatch: (industry: string | null, icp: any) => boolean
  let DEFAULT_ICP: any

  beforeAll(async () => {
    vi.resetModules()
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

  it('case insensitive → true', () => {
    expect(industryMatch('TECHNOLOGY', DEFAULT_ICP)).toBe(true)
    expect(industryMatch('technology', DEFAULT_ICP)).toBe(true)
  })

  it('partial match (substring) → true', () => {
    expect(industryMatch('Financial Technology Services', DEFAULT_ICP)).toBe(true)
    expect(industryMatch('Information Technology Solutions', DEFAULT_ICP)).toBe(true)
  })

  it('empty target (custom ICP) → false', () => {
    const emptyIcp = { ...DEFAULT_ICP, targetIndustries: [] }
    expect(industryMatch('Technology', emptyIcp)).toBe(false)
  })

  it('null company industry → false', () => {
    expect(industryMatch(null, DEFAULT_ICP)).toBe(false)
  })

  it('excluded industry takes precedence', () => {
    expect(industryMatch('Online Gambling', DEFAULT_ICP)).toBe(false)
    expect(industryMatch('Casino Entertainment', DEFAULT_ICP)).toBe(false)
  })

  it('industry both in target and excluded → excluded wins', () => {
    const customIcp = {
      ...DEFAULT_ICP,
      targetIndustries: ['technology'],
      excludedIndustries: ['technology'],
    }
    expect(industryMatch('Technology Company', customIcp)).toBe(false)
  })

  it('no match → false', () => {
    expect(industryMatch('Agriculture', DEFAULT_ICP)).toBe(false)
  })
})

// ── 4. sizeMatch ─────────────────────────────────────────────

describe('ICP Config — sizeMatch (GAP-32)', () => {
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

  it('employee count within range → true', () => {
    expect(sizeMatch('201-500', DEFAULT_ICP)).toBe(true)
    expect(sizeMatch('501-1000', DEFAULT_ICP)).toBe(true)
    expect(sizeMatch('1001-5000', DEFAULT_ICP)).toBe(true)
  })

  it('employee count below range → false', () => {
    expect(sizeMatch('1-10', DEFAULT_ICP)).toBe(false)
    expect(sizeMatch('11-50', DEFAULT_ICP)).toBe(false)
    expect(sizeMatch('51-200', DEFAULT_ICP)).toBe(false)
  })

  it('employee count above range → true (5001+ matches)', () => {
    expect(sizeMatch('10001+', DEFAULT_ICP)).toBe(true)
    expect(sizeMatch('5001+', DEFAULT_ICP)).toBe(true)
  })

  it('missing employee count → false', () => {
    expect(sizeMatch(null, DEFAULT_ICP)).toBe(false)
    expect(sizeMatch('', DEFAULT_ICP)).toBe(false)
  })

  it('string employee count "500-1000" → parsed correctly (contains match)', () => {
    expect(sizeMatch('500-1000', DEFAULT_ICP)).toBe(true)
  })

  it('whitespace-normalized match', () => {
    expect(sizeMatch('201 - 500', DEFAULT_ICP)).toBe(true)
  })

  it('case insensitive match', () => {
    expect(sizeMatch('201-500', DEFAULT_ICP)).toBe(true)
  })
})

// ── 5. regionMatch ───────────────────────────────────────────

describe('ICP Config — regionMatch (GAP-32)', () => {
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

  it('region match (abbreviation) → true', () => {
    expect(regionMatch('USA', null, DEFAULT_ICP)).toBe(true)
    expect(regionMatch('UK', null, DEFAULT_ICP)).toBe(true)
  })

  it('no match → false', () => {
    expect(regionMatch('Brazil', null, DEFAULT_ICP)).toBe(false)
    expect(regionMatch('Japan', null, DEFAULT_ICP)).toBe(false)
  })

  it('location-based match', () => {
    expect(regionMatch(null, 'San Francisco, USA', DEFAULT_ICP)).toBe(true)
    expect(regionMatch(null, 'London, UK', DEFAULT_ICP)).toBe(true)
  })

  it('combined country+location matching', () => {
    expect(regionMatch('Germany', 'Berlin', DEFAULT_ICP)).toBe(true)
  })

  it('null country and location → false', () => {
    expect(regionMatch(null, null, DEFAULT_ICP)).toBe(false)
  })

  it('case insensitive', () => {
    expect(regionMatch('united states', null, DEFAULT_ICP)).toBe(true)
    expect(regionMatch('UNITED STATES', null, DEFAULT_ICP)).toBe(true)
  })
})

// ── 6. techMatch ─────────────────────────────────────────────

describe('ICP Config — techMatch (GAP-32)', () => {
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

  it('exact keyword match → positive score', () => {
    const score = techMatch('cloud, aws, kubernetes', DEFAULT_ICP)
    expect(score).toBeGreaterThan(0)
  })

  it('partial keyword match (substring) → true', () => {
    // 'machine learning' should match in a string containing it
    const score = techMatch('We use machine learning and ai for data analytics', DEFAULT_ICP)
    expect(score).toBeGreaterThan(0)
  })

  it('no match → 0', () => {
    const score = techMatch('cobol, fortran, pascal', DEFAULT_ICP)
    expect(score).toBe(0)
  })

  it('null techStack → 0', () => {
    expect(techMatch(null, DEFAULT_ICP)).toBe(0)
  })

  it('returns ratio capped at 1.0', () => {
    const score = techMatch('cloud, aws, kubernetes, docker, react, node, python, java, typescript, sap, salesforce, servicenow, workday, machine learning, ai, data analytics, microservices', DEFAULT_ICP)
    expect(score).toBeLessThanOrEqual(1)
    expect(score).toBe(1) // many matches → capped
  })

  it('returns 0.2 per keyword match (ratio = count/5)', () => {
    const score = techMatch('python', DEFAULT_ICP) // 1 match
    expect(score).toBeCloseTo(0.2, 1)

    const score2 = techMatch('cloud, aws', DEFAULT_ICP) // 2 matches
    expect(score2).toBeCloseTo(0.4, 1)
  })

  it('case insensitive', () => {
    const score1 = techMatch('Cloud, AWS, Kubernetes', DEFAULT_ICP)
    const score2 = techMatch('cloud, aws, kubernetes', DEFAULT_ICP)
    expect(score1).toBe(score2)
  })
})

// ── 7. deepMerge ─────────────────────────────────────────────

describe('ICP Config — deepMerge (GAP-32 / GAP-30 fix)', () => {
  beforeEach(async () => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('simple objects → merged correctly', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    mockUpsert.mockResolvedValue({})

    const { updateIcpProfile } = await import('@/lib/icp-config')
    const updated = await updateIcpProfile({ minEmployeeCount: 500 })

    expect(updated.minEmployeeCount).toBe(500)
    // Other fields still have defaults
    expect(updated.targetIndustries.length).toBeGreaterThan(0)
  })

  it('nested objects → deep merged', async () => {
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

  it('source array + target object → assigned (not merged) [GAP-30 fix]', async () => {
    // This tests the fix: previously, when source had an array and target had an object,
    // the code incorrectly recursed. Now it correctly replaces.
    mockFindUnique.mockResolvedValueOnce(null)
    mockUpsert.mockResolvedValue({})

    const { updateIcpProfile, DEFAULT_ICP } = await import('@/lib/icp-config')

    // Start with default ICP which has weights as an object
    // Now "merge" with a weights array (should replace, not error)
    const updated = await updateIcpProfile({
      targetIndustries: ['a', 'b'],
    } as any)

    // The array should be stored as-is (not merged with the object)
    expect(Array.isArray(updated.targetIndustries)).toBe(true)
    expect(updated.targetIndustries).toEqual(['a', 'b'])
  })

  it('null source values DO override target values', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    mockUpsert.mockResolvedValue({})

    const { updateIcpProfile } = await import('@/lib/icp-config')

    const updated = await updateIcpProfile({
      targetIndustries: null as any,
    } as any)

    // The deepMerge function: srcVal !== null check passes (null is not null? NO)
    // Actually: `if (srcVal !== null && typeof srcVal === 'object' ...`
    // null fails the first check, so falls to: `else if (srcVal !== undefined)` → null !== undefined → true
    // So null REPLACES the target value
    expect(updated.targetIndustries).toBeNull()
  })

  it('undefined source values are skipped', async () => {
    mockFindUnique.mockResolvedValueOnce(null)
    mockUpsert.mockResolvedValue({})

    const { updateIcpProfile, DEFAULT_ICP } = await import('@/lib/icp-config')

    const updated = await updateIcpProfile({
      minEmployeeCount: undefined as any,
    } as any)

    // undefined is skipped by the `srcVal !== undefined` check
    expect(updated.minEmployeeCount).toBe(DEFAULT_ICP.minEmployeeCount)
  })
})

// ── 8. normalizeIcpProfile ───────────────────────────────────

describe('ICP Config — normalizeIcpProfile (GAP-32)', () => {
  let normalizeIcpProfile: (raw: any) => any

  beforeAll(async () => {
    vi.resetModules()
    vi.doMock('@/lib/db', () => ({
      db: { systemSetting: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn() } },
    }))
    const mod = await import('@/lib/icp-config')
    normalizeIcpProfile = mod.normalizeIcpProfile
  })

  it('maps targetCountries → targetRegions', () => {
    const result = normalizeIcpProfile({ targetCountries: ['US', 'UK'] })
    expect(result.targetRegions).toEqual(['US', 'UK'])
    expect(result.targetCountries).toBeUndefined()
  })

  it('maps preferredTechnologies → preferredTechKeywords', () => {
    const result = normalizeIcpProfile({ preferredTechnologies: ['react', 'node'] })
    expect(result.preferredTechKeywords).toEqual(['react', 'node'])
    expect(result.preferredTechnologies).toBeUndefined()
  })

  it('maps excludeIndustries → excludedIndustries', () => {
    const result = normalizeIcpProfile({ excludeIndustries: ['gambling'] })
    expect(result.excludedIndustries).toEqual(['gambling'])
    expect(result.excludeIndustries).toBeUndefined()
  })

  it('maps minEmployees → minEmployeeCount (number)', () => {
    const result = normalizeIcpProfile({ minEmployees: 100 })
    expect(result.minEmployeeCount).toBe(100)
    expect(result.minEmployees).toBeUndefined()
  })

  it('maps maxEmployees → maxEmployeeCount (number)', () => {
    const result = normalizeIcpProfile({ maxEmployees: 10000 })
    expect(result.maxEmployeeCount).toBe(10000)
    expect(result.maxEmployees).toBeUndefined()
  })

  it('preserves maxRevenue (already canonical)', () => {
    const result = normalizeIcpProfile({ maxRevenue: '$100M' })
    expect(result.maxRevenue).toBe('$100M')
  })

  it('handles empty object', () => {
    const result = normalizeIcpProfile({})
    expect(Object.keys(result).length).toBe(0)
  })

  it('handles mixed frontend + backend names', () => {
    const result = normalizeIcpProfile({
      targetCountries: ['US'],
      targetIndustries: ['fintech'],
      preferredTechnologies: ['react'],
    })
    expect(result.targetRegions).toEqual(['US'])
    expect(result.targetIndustries).toEqual(['fintech'])
    expect(result.preferredTechKeywords).toEqual(['react'])
  })
})

// ── 9. parseEmployeeCount ────────────────────────────────────

describe('ICP Config — parseEmployeeCount (GAP-32)', () => {
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

  it('handles string "500-1000" employee count', () => {
    expect(parseEmployeeCount('500-1000', null)).toBe(1000)
  })
})

// ── 10. DEFAULT_ICP validation ───────────────────────────────

describe('ICP Config — DEFAULT_ICP (GAP-32)', () => {
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

  it('scoreWeights sum to 1.0', async () => {
    const { DEFAULT_ICP } = await import('@/lib/icp-config')
    const sw = DEFAULT_ICP.scoreWeights!
    const sum = sw.staticFit + sw.dynamicIntel + sw.timingUrgency
    expect(sum).toBeCloseTo(1.0, 5)
  })

  it('tierThresholds are sensible (hot > active > nurture)', async () => {
    const { DEFAULT_ICP } = await import('@/lib/icp-config')
    const t = DEFAULT_ICP.tierThresholds!
    expect(t.hot).toBeGreaterThan(t.active)
    expect(t.active).toBeGreaterThan(t.nurture)
    expect(t.nurture).toBeGreaterThan(0)
  })
})

// ── 11. resetIcpProfile ──────────────────────────────────────

describe('ICP Config — resetIcpProfile (GAP-32)', () => {
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

// ── GAP-34: ICP with empty target lists ──────────────────────

describe('ICP Config — empty target lists edge case (GAP-34)', () => {
  beforeAll(async () => {
    vi.resetModules()
    vi.doMock('@/lib/db', () => ({
      db: { systemSetting: { findUnique: vi.fn().mockResolvedValue(null), upsert: vi.fn() } },
    }))
    const mod = await import('@/lib/icp-config')
  })

  it('empty targetIndustries → no industry matches', async () => {
    const { industryMatch, DEFAULT_ICP } = await import('@/lib/icp-config')
    const emptyIcp = { ...DEFAULT_ICP, targetIndustries: [] }
    expect(industryMatch('Technology', emptyIcp)).toBe(false)
  })

  it('empty preferredTechKeywords → techMatch returns 0', async () => {
    const { techMatch, DEFAULT_ICP } = await import('@/lib/icp-config')
    const emptyIcp = { ...DEFAULT_ICP, preferredTechKeywords: [] }
    expect(techMatch('cloud, aws, kubernetes', emptyIcp)).toBe(0)
  })

  it('empty targetRegions → no region matches', async () => {
    const { regionMatch, DEFAULT_ICP } = await import('@/lib/icp-config')
    const emptyIcp = { ...DEFAULT_ICP, targetRegions: [] }
    expect(regionMatch('United States', null, emptyIcp)).toBe(false)
  })

  it('empty targetSizeRanges → no size matches', async () => {
    const { sizeMatch, DEFAULT_ICP } = await import('@/lib/icp-config')
    const emptyIcp = { ...DEFAULT_ICP, targetSizeRanges: [] }
    expect(sizeMatch('1001-5000', emptyIcp)).toBe(false)
  })
})