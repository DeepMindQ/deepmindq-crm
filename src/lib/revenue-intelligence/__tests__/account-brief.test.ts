import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockCompanyFindUnique,
  mockIntelligenceObjectFindMany,
  mockIntelligenceObjectGroupBy,
  mockKnowledgeEntryFindMany,
  mockOpportunitySignalFindMany,
  mockAccountBriefUpsert,
  mockAccountBriefFindUnique,
  mockIntelligenceTimelineFindMany,
  mockEvidenceFindMany,
  mockDetectSignalsForCompany,
  mockCalculateAccountScore,
  mockGenerateExecutiveSummary,
  mockGenerateEngagementApproach,
  mockGetCompanyKnowledge,
} = vi.hoisted(() => ({
  mockCompanyFindUnique: vi.fn(),
  mockIntelligenceObjectFindMany: vi.fn(),
  mockIntelligenceObjectGroupBy: vi.fn(),
  mockKnowledgeEntryFindMany: vi.fn(),
  mockOpportunitySignalFindMany: vi.fn(),
  mockAccountBriefUpsert: vi.fn(),
  mockAccountBriefFindUnique: vi.fn(),
  mockIntelligenceTimelineFindMany: vi.fn(),
  mockEvidenceFindMany: vi.fn(),
  mockDetectSignalsForCompany: vi.fn(),
  mockCalculateAccountScore: vi.fn(),
  mockGenerateExecutiveSummary: vi.fn().mockResolvedValue('LLM summary'),
  mockGenerateEngagementApproach: vi.fn().mockResolvedValue('LLM engagement'),
  mockGetCompanyKnowledge: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    company: { findUnique: mockCompanyFindUnique },
    intelligenceObject: { findMany: mockIntelligenceObjectFindMany, groupBy: mockIntelligenceObjectGroupBy },
    knowledgeEntry: { findMany: mockKnowledgeEntryFindMany },
    opportunitySignal: { findMany: mockOpportunitySignalFindMany },
    accountBrief: { upsert: mockAccountBriefUpsert, findUnique: mockAccountBriefFindUnique },
    intelligenceTimeline: { findMany: mockIntelligenceTimelineFindMany },
    evidence: { findMany: mockEvidenceFindMany },
  },
}))

vi.mock('../signal-extraction', () => ({
  detectSignalsForCompany: mockDetectSignalsForCompany,
}))

vi.mock('../account-scoring', () => ({
  calculateAccountScore: mockCalculateAccountScore,
}))

vi.mock('../llm-helper', () => ({
  generateExecutiveSummary: mockGenerateExecutiveSummary,
  generateEngagementApproach: mockGenerateEngagementApproach,
}))

vi.mock('@/lib/intelligence-sources/knowledge-fabric', () => ({
  getCompanyKnowledge: mockGetCompanyKnowledge,
}))

vi.mock('@/lib/intelligence-sources/types', () => ({
  ALL_CATEGORIES: [
    'Strategy', 'Products', 'Technology', 'Leadership', 'Opportunities',
    'Stakeholders', 'Conversations', 'Platforms', 'Architecture',
    'Patents', 'Competitors', 'Partnerships', 'Market',
  ],
  FRESHNESS_CONFIG: {},
}))

import {
  generateBrief,
  getBrief,
  getOrCreateBrief,
} from '../account-brief'

describe('Account Brief', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset LLM mocks to default success
    mockGenerateExecutiveSummary.mockResolvedValue('LLM summary')
    mockGenerateEngagementApproach.mockResolvedValue('LLM engagement')
  })

  const companyId = 'comp-abc'
  const now = new Date('2025-01-15')

  const baseCompany = { id: companyId, name: 'Acme Corp', industry: 'Technology', website: 'acme.com' }

  describe('generateBrief', () => {
    it('gathers all data sources correctly', async () => {
      mockCompanyFindUnique.mockResolvedValue(baseCompany)
      mockIntelligenceObjectFindMany.mockResolvedValue([
        { id: 'obj-1', content: 'Acme launches AI platform', sourceType: 'website', capturedAt: now },
      ])
      mockKnowledgeEntryFindMany.mockResolvedValue([{ id: 'ke-1', category: 'Strategy', content: 'AI-first approach' }])
      mockOpportunitySignalFindMany.mockResolvedValue([{ id: 'sig-1', category: 'technology', score: 0.9, keyword: 'ai' }])
      mockDetectSignalsForCompany.mockResolvedValue([])
      mockCalculateAccountScore.mockResolvedValue({ compositeScore: 0.8, tier: 'HOT_ACCOUNT' })
      mockAccountBriefUpsert.mockResolvedValue({ id: 'ab-1' })

      const brief = await generateBrief(companyId)

      expect(mockCompanyFindUnique).toHaveBeenCalledWith({ where: { id: companyId } })
      expect(mockIntelligenceObjectFindMany).toHaveBeenCalled()
      expect(mockKnowledgeEntryFindMany).toHaveBeenCalledWith({ where: { companyId } })
      expect(mockOpportunitySignalFindMany).toHaveBeenCalled()
    })

    it('extracts themes from knowledge entries', async () => {
      mockCompanyFindUnique.mockResolvedValue(baseCompany)
      mockIntelligenceObjectFindMany.mockResolvedValue([])
      mockKnowledgeEntryFindMany.mockResolvedValue([
        { id: 'ke-1', category: 'Strategy', content: 'Expanding AI capabilities and cloud infrastructure' },
        { id: 'ke-2', category: 'Products', content: 'AI-driven analytics platform launch' },
        { id: 'ke-3', category: 'Technology', content: 'Migrating to cloud-native architecture' },
      ])
      mockOpportunitySignalFindMany.mockResolvedValue([])
      mockDetectSignalsForCompany.mockResolvedValue([])
      mockCalculateAccountScore.mockResolvedValue({ compositeScore: 0.75, tier: 'WARM_ACCOUNT' })
      mockAccountBriefUpsert.mockResolvedValue({ id: 'ab-1' })

      const brief = await generateBrief(companyId)

      expect(brief.themes).toBeDefined()
      expect(brief.themes.length).toBeGreaterThan(0)
    })

    it('maps signals to opportunity areas', async () => {
      mockCompanyFindUnique.mockResolvedValue(baseCompany)
      mockIntelligenceObjectFindMany.mockResolvedValue([])
      mockKnowledgeEntryFindMany.mockResolvedValue([])
      mockOpportunitySignalFindMany.mockResolvedValue([
        { id: 'sig-1', category: 'technology', score: 0.9, keyword: 'ai', status: 'ACTIVE' },
        { id: 'sig-2', category: 'growth', score: 0.8, keyword: 'hiring', status: 'ACTIVE' },
      ])
      mockDetectSignalsForCompany.mockResolvedValue([])
      mockCalculateAccountScore.mockResolvedValue({ compositeScore: 0.8, tier: 'HOT_ACCOUNT' })
      mockAccountBriefUpsert.mockResolvedValue({ id: 'ab-1' })

      const brief = await generateBrief(companyId)

      expect(brief.opportunityAreas).toBeDefined()
      expect(brief.opportunityAreas.length).toBeGreaterThanOrEqual(2)
    })

    it('extracts risks from pain signals', async () => {
      mockCompanyFindUnique.mockResolvedValue(baseCompany)
      mockIntelligenceObjectFindMany.mockResolvedValue([])
      mockKnowledgeEntryFindMany.mockResolvedValue([])
      mockOpportunitySignalFindMany.mockResolvedValue([
        { id: 'sig-1', category: 'pain', score: 0.85, keyword: 'layoff', status: 'ACTIVE' },
      ])
      mockDetectSignalsForCompany.mockResolvedValue([])
      mockCalculateAccountScore.mockResolvedValue({ compositeScore: 0.5, tier: 'WARM_ACCOUNT' })
      mockAccountBriefUpsert.mockResolvedValue({ id: 'ab-1' })

      const brief = await generateBrief(companyId)

      expect(brief.risks).toBeDefined()
      expect(brief.risks.length).toBeGreaterThanOrEqual(1)
    })

    it('builds evidence references', async () => {
      mockCompanyFindUnique.mockResolvedValue(baseCompany)
      mockIntelligenceObjectFindMany.mockResolvedValue([{ id: 'obj-1', content: 'AI strategy', sourceType: 'website', capturedAt: now }])
      mockKnowledgeEntryFindMany.mockResolvedValue([])
      mockOpportunitySignalFindMany.mockResolvedValue([])
      mockDetectSignalsForCompany.mockResolvedValue([])
      mockCalculateAccountScore.mockResolvedValue({ compositeScore: 0.7, tier: 'WARM_ACCOUNT' })
      mockEvidenceFindMany.mockResolvedValue([{ id: 'ev-1', title: 'Q4 Report', sourceType: 'csv' }])
      mockAccountBriefUpsert.mockResolvedValue({ id: 'ab-1' })

      const brief = await generateBrief(companyId)

      expect(brief.evidenceReferences).toBeDefined()
      expect(brief.evidenceReferences.length).toBeGreaterThanOrEqual(1)
    })

    it('calls LLM for summary and engagement', async () => {
      mockCompanyFindUnique.mockResolvedValue(baseCompany)
      mockIntelligenceObjectFindMany.mockResolvedValue([])
      mockKnowledgeEntryFindMany.mockResolvedValue([])
      mockOpportunitySignalFindMany.mockResolvedValue([])
      mockDetectSignalsForCompany.mockResolvedValue([])
      mockCalculateAccountScore.mockResolvedValue({ compositeScore: 0.8, tier: 'HOT_ACCOUNT' })
      mockAccountBriefUpsert.mockResolvedValue({ id: 'ab-1' })

      const brief = await generateBrief(companyId)

      expect(mockGenerateExecutiveSummary).toHaveBeenCalledWith(
        expect.objectContaining({ companyName: 'Acme Corp' }),
      )
      expect(mockGenerateEngagementApproach).toHaveBeenCalledWith(
        expect.objectContaining({ companyName: 'Acme Corp' }),
      )
      expect(brief.executiveSummary).toBe('LLM summary')
      expect(brief.engagementApproach).toBe('LLM engagement')
    })

    it('LLM failure falls back to template', async () => {
      mockGenerateExecutiveSummary.mockRejectedValue(new Error('LLM timeout'))
      mockGenerateEngagementApproach.mockRejectedValue(new Error('LLM timeout'))
      mockCompanyFindUnique.mockResolvedValue(baseCompany)
      mockIntelligenceObjectFindMany.mockResolvedValue([])
      mockKnowledgeEntryFindMany.mockResolvedValue([])
      mockOpportunitySignalFindMany.mockResolvedValue([])
      mockDetectSignalsForCompany.mockResolvedValue([])
      mockCalculateAccountScore.mockResolvedValue({ compositeScore: 0.8, tier: 'HOT_ACCOUNT' })
      mockAccountBriefUpsert.mockResolvedValue({ id: 'ab-1' })

      const brief = await generateBrief(companyId)

      expect(brief.executiveSummary).toContain('Acme Corp')
      expect(brief.engagementApproach).toContain('Acme Corp')
    })

    it('calculates confidence from intelligence objects', async () => {
      mockCompanyFindUnique.mockResolvedValue(baseCompany)
      mockIntelligenceObjectFindMany.mockResolvedValue([
        { id: 'obj-1', content: 'Data point', sourceType: 'website', capturedAt: now },
        { id: 'obj-2', content: 'Another point', sourceType: 'rss', capturedAt: now },
      ])
      mockIntelligenceObjectGroupBy.mockResolvedValue([{ _count: 2 }])
      mockKnowledgeEntryFindMany.mockResolvedValue([])
      mockOpportunitySignalFindMany.mockResolvedValue([])
      mockDetectSignalsForCompany.mockResolvedValue([])
      mockCalculateAccountScore.mockResolvedValue({ compositeScore: 0.7, tier: 'WARM_ACCOUNT' })
      mockAccountBriefUpsert.mockResolvedValue({ id: 'ab-1' })

      const brief = await generateBrief(companyId)

      expect(brief.confidence).toBeGreaterThanOrEqual(0)
      expect(brief.confidence).toBeLessThanOrEqual(1)
    })

    it('persists AccountBrief', async () => {
      mockCompanyFindUnique.mockResolvedValue(baseCompany)
      mockIntelligenceObjectFindMany.mockResolvedValue([])
      mockKnowledgeEntryFindMany.mockResolvedValue([])
      mockOpportunitySignalFindMany.mockResolvedValue([])
      mockDetectSignalsForCompany.mockResolvedValue([])
      mockCalculateAccountScore.mockResolvedValue({ compositeScore: 0.8, tier: 'HOT_ACCOUNT' })
      mockAccountBriefUpsert.mockResolvedValue({ id: 'ab-1' })

      await generateBrief(companyId)

      expect(mockAccountBriefUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId },
          create: expect.objectContaining({ companyId }),
          update: expect.objectContaining({ companyId }),
        }),
      )
    })
  })

  describe('getBrief', () => {
    it('returns null if not found', async () => {
      mockAccountBriefFindUnique.mockResolvedValue(null)
      const result = await getBrief(companyId)
      expect(result).toBeNull()
    })
  })

  describe('getOrCreateBrief', () => {
    it('returns cached if within 24h', async () => {
      const recentDate = new Date('2025-01-14T12:00:00Z') // within 24h of 2025-01-15
      mockAccountBriefFindUnique.mockResolvedValue({
        id: 'ab-1',
        companyId,
        updatedAt: recentDate,
        executiveSummary: 'Cached summary',
      })

      const brief = await getOrCreateBrief(companyId)

      expect(brief).toBeDefined()
      expect(brief.executiveSummary).toBe('Cached summary')
      expect(mockGenerateExecutiveSummary).not.toHaveBeenCalled()
    })

    it('generates new if stale or missing', async () => {
      mockAccountBriefFindUnique.mockResolvedValue(null)
      mockCompanyFindUnique.mockResolvedValue(baseCompany)
      mockIntelligenceObjectFindMany.mockResolvedValue([])
      mockKnowledgeEntryFindMany.mockResolvedValue([])
      mockOpportunitySignalFindMany.mockResolvedValue([])
      mockDetectSignalsForCompany.mockResolvedValue([])
      mockCalculateAccountScore.mockResolvedValue({ compositeScore: 0.8, tier: 'HOT_ACCOUNT' })
      mockAccountBriefUpsert.mockResolvedValue({ id: 'ab-2' })

      const brief = await getOrCreateBrief(companyId)

      expect(brief).toBeDefined()
      expect(mockGenerateExecutiveSummary).toHaveBeenCalled()
      expect(mockAccountBriefUpsert).toHaveBeenCalled()
    })
  })
})