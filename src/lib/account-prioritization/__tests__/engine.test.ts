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
  setupDefaultMocks()
})

// ── Import after mocks ──

const {
  classifyTier,
  computeAccountPriority,
  computeAllAccountPriorities,
  getPrioritizedCompanies,
  getICPProfile,
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

    it('throws for non-existent company', async () => {
      mockDbFindUnique.mockResolvedValueOnce(null)
      await expect(computeAccountPriority('nonexistent')).rejects.toThrow()
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
