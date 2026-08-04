/**
 * Ticket 4: Account Prioritization Engine — Unit Tests
 *
 * Tests for:
 * - classifyTier() boundaries
 * - computeAccountPriority() score range (0-100)
 * - PriorityScoreHistory creation on score change
 * - Batch compute functionality
 * - ICP profile loading
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Mock dependencies ──

const mockDbFindUnique = vi.fn()
const mockDbUpdate = vi.fn()
const mockDbTransaction = vi.fn()
const mockDbFindMany = vi.fn()
const mockDbGroupBy = vi.fn()
const mockDbAggregate = vi.fn()
const mockDbCount = vi.fn()
const mockCompanyResearchCardFindUnique = vi.fn()
const mockCompanySignalFindMany = vi.fn()
const mockEvidenceAggregate = vi.fn()
const mockContactCount = vi.fn()
const mockSignalCapabilityMatchAggregate = vi.fn()
const mockOpportunityRecommendationCount = vi.fn()
const mockCompanyTimelineEventCount = vi.fn()
const mockSystemSettingFindUnique = vi.fn()
const mockPriorityScoreHistoryCreate = vi.fn()
const mockAccountScoreFindUnique = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    company: {
      findUnique: (...args: unknown[]) => mockDbFindUnique(...args),
      findMany: (...args: unknown[]) => mockDbFindMany(...args),
      update: (...args: unknown[]) => mockDbUpdate(...args),
      count: (...args: unknown[]) => mockDbCount(...args),
      groupBy: (...args: unknown[]) => mockDbGroupBy(...args),
    },
    $transaction: (...args: unknown[]) => mockDbTransaction(...args),
    companyResearchCard: {
      findUnique: (...args: unknown[]) => mockCompanyResearchCardFindUnique(...args),
    },
    companySignal: {
      findMany: (...args: unknown[]) => mockCompanySignalFindMany(...args),
    },
    evidence: {
      aggregate: (...args: unknown[]) => mockEvidenceAggregate(...args),
    },
    contact: {
      count: (...args: unknown[]) => mockContactCount(...args),
    },
    signalCapabilityMatch: {
      aggregate: (...args: unknown[]) => mockSignalCapabilityMatchAggregate(...args),
    },
    opportunityRecommendation: {
      count: (...args: unknown[]) => mockOpportunityRecommendationCount(...args),
    },
    companyTimelineEvent: {
      count: (...args: unknown[]) => mockCompanyTimelineEventCount(...args),
    },
    systemSetting: {
      findUnique: (...args: unknown[]) => mockSystemSettingFindUnique(...args),
    },
    priorityScoreHistory: {
      create: (...args: unknown[]) => mockPriorityScoreHistoryCreate(...args),
    },
    accountScore: {
      findUnique: (...args: unknown[]) => mockAccountScoreFindUnique(...args),
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}))

// ── Helper: Setup default mock returns ──

function setupDefaultMocks() {
  mockDbFindUnique.mockResolvedValue({
    id: 'company-1',
    industry: 'Technology',
    sizeRange: '500-1000',
    country: 'US',
    accountPriorityScore: 50,
    priorityTier: 'ACTIVE',
  })
  mockCompanyResearchCardFindUnique.mockResolvedValue({
    techStack: JSON.stringify(['AWS', 'React', 'Python']),
    structuredTechLandscape: null,
  })
  mockCompanySignalFindMany.mockResolvedValue([])
  mockEvidenceAggregate.mockResolvedValue({ _count: 0, _avg: { confidence: 0 } })
  mockContactCount.mockResolvedValue(0)
  mockSignalCapabilityMatchAggregate.mockResolvedValue({ _count: 0, _avg: { matchScore: 0 } })
  mockOpportunityRecommendationCount.mockResolvedValue(0)
  mockCompanyTimelineEventCount.mockResolvedValue(0)
  mockSystemSettingFindUnique.mockResolvedValue({
    key: 'icp_profile',
    value: JSON.stringify({
      targetIndustries: ['Technology', 'SaaS', 'Software'],
      targetSizeRanges: ['500-1000', '1000-5000'],
      targetCountries: ['US', 'UK', 'India'],
      preferredTechnologies: ['AWS', 'React', 'Python', 'Node.js'],
    }),
  })
  mockDbTransaction.mockImplementation(async (ops: unknown[]) => {
    for (const op of ops) {
      await op
    }
  })
  mockDbUpdate.mockResolvedValue({})
  mockPriorityScoreHistoryCreate.mockResolvedValue({ id: 'history-1' })
  mockAccountScoreFindUnique.mockResolvedValue(null)
  mockDbGroupBy.mockResolvedValue([
    { priorityTier: 'HOT', _count: 5 },
    { priorityTier: 'ACTIVE', _count: 10 },
    { priorityTier: 'NURTURE', _count: 20 },
    { priorityTier: 'LOW', _count: 15 },
  ])
  mockDbFindMany.mockResolvedValue([{ id: 'company-1' }])
}

beforeEach(() => {
  vi.clearAllMocks()
  invalidateICPCache()
  setupDefaultMocks()
})

// ── Import after mocks ──

const {
  classifyTier,
  computeAccountPriority,
  computeAllAccountPriorities,
  getPrioritizedCompanies,
  getICPProfile,
  invalidateICPCache,
} = await import('@/lib/account-prioritization/engine')

// ═══════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════

describe('Account Prioritization Engine', () => {
  describe('classifyTier()', () => {
    it('returns HOT for scores >= 90', () => {
      expect(classifyTier(90)).toBe('HOT')
      expect(classifyTier(95)).toBe('HOT')
      expect(classifyTier(100)).toBe('HOT')
    })

    it('returns ACTIVE for scores 70-89', () => {
      expect(classifyTier(70)).toBe('ACTIVE')
      expect(classifyTier(85)).toBe('ACTIVE')
    })

    it('returns NURTURE for scores 50-69', () => {
      expect(classifyTier(50)).toBe('NURTURE')
      expect(classifyTier(65)).toBe('NURTURE')
    })

    it('returns LOW for scores < 50', () => {
      expect(classifyTier(0)).toBe('LOW')
      expect(classifyTier(25)).toBe('LOW')
      expect(classifyTier(49)).toBe('LOW')
    })
  })

  describe('computeAccountPriority()', () => {
    it('returns composite score in 0-100 range', async () => {
      const result = await computeAccountPriority('company-1')
      expect(result.priority.composite).toBeGreaterThanOrEqual(0)
      expect(result.priority.composite).toBeLessThanOrEqual(100)
    })

    it('returns valid tier classification', async () => {
      const result = await computeAccountPriority('company-1')
      expect(['HOT', 'ACTIVE', 'NURTURE', 'LOW']).toContain(result.priority.tier)
    })

    it('persists to PriorityScoreHistory via transaction', async () => {
      await computeAccountPriority('company-1')
      expect(mockDbTransaction).toHaveBeenCalled()
      expect(mockPriorityScoreHistoryCreate).toHaveBeenCalled()
    })

    it('captures previous score for history tracking', async () => {
      // The first findUnique now includes accountPriorityScore/priorityTier
      mockDbFindUnique.mockResolvedValue({
        id: 'company-1',
        industry: 'Technology',
        sizeRange: '500-1000',
        country: 'US',
        accountPriorityScore: 42,
        priorityTier: 'NURTURE',
      })

      await computeAccountPriority('company-1')
      const historyCall = mockPriorityScoreHistoryCreate.mock.calls[0][0] as { data: Record<string, unknown> }
      expect(historyCall.data.previousScore).toBe(42)
      expect(historyCall.data.previousTier).toBe('NURTURE')
    })

    it('accepts triggerType parameter for history', async () => {
      await computeAccountPriority('company-1', 'batch')
      const historyCall = mockPriorityScoreHistoryCreate.mock.calls[0][0] as { data: Record<string, unknown> }
      expect(historyCall.data.triggerType).toBe('batch')
    })

    it('includes all three dimension scores in breakdown', async () => {
      const result = await computeAccountPriority('company-1')
      expect(typeof result.priority.staticFit.score).toBe('number')
      expect(typeof result.priority.dynamicIntelligence.score).toBe('number')
      expect(typeof result.priority.timingUrgency.score).toBe('number')
    })

    it('computes sub-dimension scores within 0-100', async () => {
      const result = await computeAccountPriority('company-1')
      const { staticFit, dynamicIntelligence, timingUrgency } = result.priority
      expect(staticFit.score).toBeGreaterThanOrEqual(0)
      expect(staticFit.score).toBeLessThanOrEqual(100)
      expect(dynamicIntelligence.score).toBeGreaterThanOrEqual(0)
      expect(dynamicIntelligence.score).toBeLessThanOrEqual(100)
      expect(timingUrgency.score).toBeGreaterThanOrEqual(0)
      expect(timingUrgency.score).toBeLessThanOrEqual(100)
    })

    it('returns graceful zero-result for non-existent company (B10)', async () => {
      mockDbFindUnique.mockResolvedValueOnce(null)
      const result = await computeAccountPriority('nonexistent')
      expect(result.companyId).toBe('nonexistent')
      expect(result.priority.composite).toBe(0)
      expect(result.priority.tier).toBe('LOW')
      expect(result.priority.staticFit.score).toBe(0)
      expect(result.priority.dynamicIntelligence.score).toBe(0)
      expect(result.priority.timingUrgency.score).toBe(0)
      expect(result.computedAt).toBeDefined()
    })
  })

  describe('computeAllAccountPriorities()', () => {
    it('processes all non-archived companies', async () => {
      mockDbFindMany.mockResolvedValueOnce([{ id: 'c1' }, { id: 'c2' }, { id: 'c3' }])
      const { computed } = await computeAllAccountPriorities()
      expect(computed).toBe(3)
    })

    it('uses batch trigger type', async () => {
      mockDbFindMany.mockResolvedValueOnce([{ id: 'c1' }])
      await computeAllAccountPriorities()
      const historyCall = mockPriorityScoreHistoryCreate.mock.calls[0][0] as { data: Record<string, unknown> }
      expect(historyCall.data.triggerType).toBe('batch')
    })
  })

  describe('getICPProfile()', () => {
    it('returns default ICP when no setting exists', async () => {
      mockSystemSettingFindUnique.mockResolvedValueOnce(null)
      const icp = await getICPProfile()
      expect(icp.targetIndustries).toEqual([])
      expect(icp.targetCountries).toEqual([])
    })

    it('parses JSON value from SystemSetting', async () => {
      mockSystemSettingFindUnique.mockResolvedValueOnce({
        key: 'icp_profile',
        value: JSON.stringify({ targetIndustries: ['SaaS'], targetCountries: ['US'] }),
      })
      const icp = await getICPProfile()
      expect(icp.targetIndustries).toEqual(['SaaS'])
      expect(icp.targetCountries).toEqual(['US'])
    })
  })

  describe('getPrioritizedCompanies()', () => {
    it('returns companies with tier distribution', async () => {
      mockDbFindMany.mockResolvedValueOnce([{ id: 'c1', rawName: 'Test Corp' }])
      mockDbCount.mockResolvedValueOnce(1)
      const result = await getPrioritizedCompanies({})
      expect(result.companies).toHaveLength(1)
      expect(result.total).toBe(1)
      expect(result.tierDistribution).toBeDefined()
    })
  })
})

// ═══════════════════════════════════════════════════════════════
// Additional Edge-Case Tests
// ═══════════════════════════════════════════════════════════════

describe('scoreStaticFit edge cases', () => {
  it('returns 0 industry score when company is in excludeIndustries', async () => {
    vi.clearAllMocks()
    mockDbFindUnique.mockResolvedValue({
      id: 'company-exclude',
      industry: 'Healthcare',
      sizeRange: '500-1000',
      country: 'US',
      accountPriorityScore: null,
      priorityTier: null,
    })
    mockCompanyResearchCardFindUnique.mockResolvedValue({
      techStack: null,
      structuredTechLandscape: null,
    })
    mockCompanySignalFindMany.mockResolvedValue([])
    mockEvidenceAggregate.mockResolvedValue({ _count: 0, _avg: { confidence: 0 } })
    mockContactCount.mockResolvedValue(0)
    mockSignalCapabilityMatchAggregate.mockResolvedValue({ _count: 0, _avg: { matchScore: 0 } })
    mockOpportunityRecommendationCount.mockResolvedValue(0)
    mockCompanyTimelineEventCount.mockResolvedValue(0)
    mockSystemSettingFindUnique.mockResolvedValue({
      key: 'icp_profile',
      value: JSON.stringify({
        targetIndustries: ['Technology'],
        targetSizeRanges: ['500-1000'],
        targetCountries: ['US'],
        preferredTechnologies: [],
        excludeIndustries: ['Healthcare'],
      }),
    })
    mockDbTransaction.mockImplementation(async (ops: unknown[]) => {
      for (const op of ops) await op
    })
    mockDbUpdate.mockResolvedValue({})
    mockPriorityScoreHistoryCreate.mockResolvedValue({ id: 'h-1' })

    const result = await computeAccountPriority('company-exclude')
    expect(result.priority.staticFit.industry).toBe(0)
  })

  it('handles partial keyword overlap (20 points)', async () => {
    vi.clearAllMocks()
    mockDbFindUnique.mockResolvedValue({
      id: 'company-finance',
      industry: 'Software',
      sizeRange: '500-1000',
      country: 'US',
      accountPriorityScore: null,
      priorityTier: null,
    })
    mockCompanyResearchCardFindUnique.mockResolvedValue({
      techStack: null,
      structuredTechLandscape: null,
    })
    mockCompanySignalFindMany.mockResolvedValue([])
    mockEvidenceAggregate.mockResolvedValue({ _count: 0, _avg: { confidence: 0 } })
    mockContactCount.mockResolvedValue(0)
    mockSignalCapabilityMatchAggregate.mockResolvedValue({ _count: 0, _avg: { matchScore: 0 } })
    mockOpportunityRecommendationCount.mockResolvedValue(0)
    mockCompanyTimelineEventCount.mockResolvedValue(0)
    mockSystemSettingFindUnique.mockResolvedValue({
      key: 'icp_profile',
      value: JSON.stringify({
        targetIndustries: ['Enterprise Software'],
        targetSizeRanges: ['500-1000'],
        targetCountries: ['US'],
        preferredTechnologies: [],
      }),
    })
    mockDbTransaction.mockImplementation(async (ops: unknown[]) => {
      for (const op of ops) await op
    })
    mockDbUpdate.mockResolvedValue({})
    mockPriorityScoreHistoryCreate.mockResolvedValue({ id: 'h-2' })

    const result = await computeAccountPriority('company-finance')
    expect(result.priority.staticFit.industry).toBe(20)
  })

  it('returns neutral industry score (15) when ICP has no target industries', async () => {
    vi.clearAllMocks()
    mockDbFindUnique.mockResolvedValue({
      id: 'company-no-targets',
      industry: 'Manufacturing',
      sizeRange: '500-1000',
      country: 'US',
      accountPriorityScore: null,
      priorityTier: null,
    })
    mockCompanyResearchCardFindUnique.mockResolvedValue({
      techStack: null,
      structuredTechLandscape: null,
    })
    mockCompanySignalFindMany.mockResolvedValue([])
    mockEvidenceAggregate.mockResolvedValue({ _count: 0, _avg: { confidence: 0 } })
    mockContactCount.mockResolvedValue(0)
    mockSignalCapabilityMatchAggregate.mockResolvedValue({ _count: 0, _avg: { matchScore: 0 } })
    mockOpportunityRecommendationCount.mockResolvedValue(0)
    mockCompanyTimelineEventCount.mockResolvedValue(0)
    mockSystemSettingFindUnique.mockResolvedValue({
      key: 'icp_profile',
      value: JSON.stringify({
        targetIndustries: [],
        targetSizeRanges: [],
        targetCountries: [],
        preferredTechnologies: [],
      }),
    })
    mockDbTransaction.mockImplementation(async (ops: unknown[]) => {
      for (const op of ops) await op
    })
    mockDbUpdate.mockResolvedValue({})
    mockPriorityScoreHistoryCreate.mockResolvedValue({ id: 'h-3' })

    const result = await computeAccountPriority('company-no-targets')
    expect(result.priority.staticFit.industry).toBe(15)
  })

  it('matches size range correctly', async () => {
    vi.clearAllMocks()
    mockDbFindUnique.mockResolvedValue({
      id: 'company-size',
      industry: 'Technology',
      sizeRange: '750',
      country: 'US',
      accountPriorityScore: null,
      priorityTier: null,
    })
    mockCompanyResearchCardFindUnique.mockResolvedValue({
      techStack: null,
      structuredTechLandscape: null,
    })
    mockCompanySignalFindMany.mockResolvedValue([])
    mockEvidenceAggregate.mockResolvedValue({ _count: 0, _avg: { confidence: 0 } })
    mockContactCount.mockResolvedValue(0)
    mockSignalCapabilityMatchAggregate.mockResolvedValue({ _count: 0, _avg: { matchScore: 0 } })
    mockOpportunityRecommendationCount.mockResolvedValue(0)
    mockCompanyTimelineEventCount.mockResolvedValue(0)
    mockSystemSettingFindUnique.mockResolvedValue({
      key: 'icp_profile',
      value: JSON.stringify({
        targetIndustries: ['Technology'],
        targetSizeRanges: ['500-1000'],
        targetCountries: ['US'],
        preferredTechnologies: [],
      }),
    })
    mockDbTransaction.mockImplementation(async (ops: unknown[]) => {
      for (const op of ops) await op
    })
    mockDbUpdate.mockResolvedValue({})
    mockPriorityScoreHistoryCreate.mockResolvedValue({ id: 'h-4' })

    const result = await computeAccountPriority('company-size')
    expect(result.priority.staticFit.size).toBe(25)
  })
})

describe('scoreTimingUrgency edge cases', () => {
  it('returns max signalRecency (40) for same-day signals', async () => {
    vi.clearAllMocks()
    mockDbFindUnique.mockResolvedValue({
      id: 'company-today',
      industry: 'Technology',
      sizeRange: '500-1000',
      country: 'US',
      accountPriorityScore: null,
      priorityTier: null,
    })
    mockCompanyResearchCardFindUnique.mockResolvedValue({
      techStack: null,
      structuredTechLandscape: null,
    })
    mockCompanySignalFindMany.mockResolvedValue([
      {
        impact: 'high',
        signalDate: new Date().toISOString(),
        createdAt: new Date(),
      },
    ])
    mockEvidenceAggregate.mockResolvedValue({ _count: 0, _avg: { confidence: 0 } })
    mockContactCount.mockResolvedValue(0)
    mockSignalCapabilityMatchAggregate.mockResolvedValue({ _count: 0, _avg: { matchScore: 0 } })
    mockOpportunityRecommendationCount.mockResolvedValue(0)
    mockCompanyTimelineEventCount.mockResolvedValue(0)
    mockSystemSettingFindUnique.mockResolvedValue({
      key: 'icp_profile',
      value: JSON.stringify({
        targetIndustries: ['Technology'],
        targetSizeRanges: ['500-1000'],
        targetCountries: ['US'],
        preferredTechnologies: [],
      }),
    })
    mockDbTransaction.mockImplementation(async (ops: unknown[]) => {
      for (const op of ops) await op
    })
    mockDbUpdate.mockResolvedValue({})
    mockPriorityScoreHistoryCreate.mockResolvedValue({ id: 'h-5' })

    const result = await computeAccountPriority('company-today')
    expect(result.priority.timingUrgency.signalRecency).toBe(40)
  })

  it('returns min signalRecency (3) for very old signals', async () => {
    vi.clearAllMocks()
    const oldDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000)
    mockDbFindUnique.mockResolvedValue({
      id: 'company-old',
      industry: 'Technology',
      sizeRange: '500-1000',
      country: 'US',
      accountPriorityScore: null,
      priorityTier: null,
    })
    mockCompanyResearchCardFindUnique.mockResolvedValue({
      techStack: null,
      structuredTechLandscape: null,
    })
    mockCompanySignalFindMany.mockResolvedValue([
      {
        impact: 'high',
        signalDate: oldDate.toISOString(),
        createdAt: oldDate,
      },
    ])
    mockEvidenceAggregate.mockResolvedValue({ _count: 0, _avg: { confidence: 0 } })
    mockContactCount.mockResolvedValue(0)
    mockSignalCapabilityMatchAggregate.mockResolvedValue({ _count: 0, _avg: { matchScore: 0 } })
    mockOpportunityRecommendationCount.mockResolvedValue(0)
    mockCompanyTimelineEventCount.mockResolvedValue(0)
    mockSystemSettingFindUnique.mockResolvedValue({
      key: 'icp_profile',
      value: JSON.stringify({
        targetIndustries: ['Technology'],
        targetSizeRanges: ['500-1000'],
        targetCountries: ['US'],
        preferredTechnologies: [],
      }),
    })
    mockDbTransaction.mockImplementation(async (ops: unknown[]) => {
      for (const op of ops) await op
    })
    mockDbUpdate.mockResolvedValue({})
    mockPriorityScoreHistoryCreate.mockResolvedValue({ id: 'h-6' })

    const result = await computeAccountPriority('company-old')
    expect(result.priority.timingUrgency.signalRecency).toBe(3)
  })

  it('returns 0 timing when no signals exist', async () => {
    vi.clearAllMocks()
    mockDbFindUnique.mockResolvedValue({
      id: 'company-no-sig',
      industry: 'Technology',
      sizeRange: '500-1000',
      country: 'US',
      accountPriorityScore: null,
      priorityTier: null,
    })
    mockCompanyResearchCardFindUnique.mockResolvedValue({
      techStack: null,
      structuredTechLandscape: null,
    })
    mockCompanySignalFindMany.mockResolvedValue([])
    mockEvidenceAggregate.mockResolvedValue({ _count: 0, _avg: { confidence: 0 } })
    mockContactCount.mockResolvedValue(0)
    mockSignalCapabilityMatchAggregate.mockResolvedValue({ _count: 0, _avg: { matchScore: 0 } })
    mockOpportunityRecommendationCount.mockResolvedValue(0)
    mockCompanyTimelineEventCount.mockResolvedValue(0)
    mockSystemSettingFindUnique.mockResolvedValue({
      key: 'icp_profile',
      value: JSON.stringify({
        targetIndustries: ['Technology'],
        targetSizeRanges: ['500-1000'],
        targetCountries: ['US'],
        preferredTechnologies: [],
      }),
    })
    mockDbTransaction.mockImplementation(async (ops: unknown[]) => {
      for (const op of ops) await op
    })
    mockDbUpdate.mockResolvedValue({})
    mockPriorityScoreHistoryCreate.mockResolvedValue({ id: 'h-7' })

    const result = await computeAccountPriority('company-no-sig')
    expect(result.priority.timingUrgency.score).toBe(0)
  })
})

describe('getPrioritizedCompanies with filters', () => {
  it('supports sortBy parameter', async () => {
    vi.clearAllMocks()
    mockDbFindMany.mockResolvedValue([])
    mockDbCount.mockResolvedValue(0)
    mockDbGroupBy.mockResolvedValue([])

    await getPrioritizedCompanies({ sortBy: 'intelligenceScore' })
    expect(mockDbFindMany).toHaveBeenCalledTimes(1)
    const callArgs = mockDbFindMany.mock.calls[0][0] as { orderBy: Record<string, unknown> }
    expect(callArgs.orderBy).toHaveProperty('intelligenceScore')
  })

  it('supports search filter', async () => {
    vi.clearAllMocks()
    mockDbFindMany.mockResolvedValue([])
    mockDbCount.mockResolvedValue(0)
    mockDbGroupBy.mockResolvedValue([])

    await getPrioritizedCompanies({ search: 'Test' })
    expect(mockDbFindMany).toHaveBeenCalledTimes(1)
    const callArgs = mockDbFindMany.mock.calls[0][0] as { where: Record<string, unknown> }
    expect(callArgs.where).toHaveProperty('OR')
    const orConditions = callArgs.where.OR as Array<Record<string, unknown>>
    expect(orConditions.length).toBeGreaterThan(0)
    // Verify one of the OR conditions searches rawName
    const hasRawNameSearch = orConditions.some(
      (cond: Record<string, unknown>) =>
        typeof cond.rawName === 'object' && cond.rawName !== null && 'contains' in (cond.rawName as object)
    )
    expect(hasRawNameSearch).toBe(true)
  })
})

describe('parseEmployeeRange edge cases', () => {
  it('handles 10000+ size range', async () => {
    vi.clearAllMocks()
    mockDbFindUnique.mockResolvedValue({
      id: 'company-10k',
      industry: 'Technology',
      sizeRange: '10000+',
      country: 'US',
      accountPriorityScore: null,
      priorityTier: null,
    })
    mockCompanyResearchCardFindUnique.mockResolvedValue({
      techStack: null,
      structuredTechLandscape: null,
    })
    mockCompanySignalFindMany.mockResolvedValue([])
    mockEvidenceAggregate.mockResolvedValue({ _count: 0, _avg: { confidence: 0 } })
    mockContactCount.mockResolvedValue(0)
    mockSignalCapabilityMatchAggregate.mockResolvedValue({ _count: 0, _avg: { matchScore: 0 } })
    mockOpportunityRecommendationCount.mockResolvedValue(0)
    mockCompanyTimelineEventCount.mockResolvedValue(0)
    mockSystemSettingFindUnique.mockResolvedValue({
      key: 'icp_profile',
      value: JSON.stringify({
        targetIndustries: ['Technology'],
        targetSizeRanges: ['10000+'],
        targetCountries: ['US'],
        preferredTechnologies: [],
      }),
    })
    mockDbTransaction.mockImplementation(async (ops: unknown[]) => {
      for (const op of ops) await op
    })
    mockDbUpdate.mockResolvedValue({})
    mockPriorityScoreHistoryCreate.mockResolvedValue({ id: 'h-8' })

    const result = await computeAccountPriority('company-10k')
    expect(result.priority.staticFit.size).toBe(25)
  })

  it('handles comma-formatted range', async () => {
    vi.clearAllMocks()
    mockDbFindUnique.mockResolvedValue({
      id: 'company-comma',
      industry: 'Technology',
      sizeRange: '1,000-5,000',
      country: 'US',
      accountPriorityScore: null,
      priorityTier: null,
    })
    mockCompanyResearchCardFindUnique.mockResolvedValue({
      techStack: null,
      structuredTechLandscape: null,
    })
    mockCompanySignalFindMany.mockResolvedValue([])
    mockEvidenceAggregate.mockResolvedValue({ _count: 0, _avg: { confidence: 0 } })
    mockContactCount.mockResolvedValue(0)
    mockSignalCapabilityMatchAggregate.mockResolvedValue({ _count: 0, _avg: { matchScore: 0 } })
    mockOpportunityRecommendationCount.mockResolvedValue(0)
    mockCompanyTimelineEventCount.mockResolvedValue(0)
    mockSystemSettingFindUnique.mockResolvedValue({
      key: 'icp_profile',
      value: JSON.stringify({
        targetIndustries: ['Technology'],
        targetSizeRanges: ['1,000-5,000'],
        targetCountries: ['US'],
        preferredTechnologies: [],
      }),
    })
    mockDbTransaction.mockImplementation(async (ops: unknown[]) => {
      for (const op of ops) await op
    })
    mockDbUpdate.mockResolvedValue({})
    mockPriorityScoreHistoryCreate.mockResolvedValue({ id: 'h-9' })

    const result = await computeAccountPriority('company-comma')
    expect(result.priority.staticFit.size).toBe(25)
  })
})
