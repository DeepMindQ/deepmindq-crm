import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockCompanyFindUnique,
  mockOpportunitySignalFindMany,
  mockAccountScoreFindFirst,
} = vi.hoisted(() => ({
  mockCompanyFindUnique: vi.fn(),
  mockOpportunitySignalFindMany: vi.fn(),
  mockAccountScoreFindFirst: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    company: { findUnique: mockCompanyFindUnique },
    opportunitySignal: { findMany: mockOpportunitySignalFindMany },
    accountScore: { findFirst: mockAccountScoreFindFirst },
  },
}))

import { generateRecommendations } from '@/lib/revenue-intelligence/recommendation-generator'

describe('recommendation-generator', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  const companyId = 'comp-abc'

  const baseCompany = {
    id: companyId,
    rawName: 'Acme Corp',
    industry: 'Technology',
    status: 'prospect',
    lifecycleStage: 'discovery',
    engagementScore: 60,
  }

  function setupMocks(overrides?: {
    company?: typeof baseCompany
    signals?: Array<{ signalType: string; title: string; score: number; status: string }>
    score?: { score: number; category: string } | null
  }) {
    mockCompanyFindUnique.mockResolvedValue(
      overrides?.company !== undefined ? overrides.company : baseCompany,
    )
    mockOpportunitySignalFindMany.mockResolvedValue(
      overrides?.signals !== undefined ? overrides.signals : [],
    )
    mockAccountScoreFindFirst.mockResolvedValue(
      overrides?.score !== undefined ? overrides.score : null,
    )
  }

  it('returns empty array when company has no signals and no score', async () => {
    setupMocks({ signals: [], score: null })
    const recs = await generateRecommendations(companyId)
    expect(recs).toHaveLength(0)
  })

  it('generates high-priority engagement rec for high score', async () => {
    setupMocks({
      signals: [],
      score: { score: 85, category: 'HOT_ACCOUNT' },
    })
    const recs = await generateRecommendations(companyId)
    expect(recs.length).toBeGreaterThanOrEqual(1)
    const engage = recs.find(r => r.action.includes('strategic engagement'))
    expect(engage).toBeDefined()
    expect(engage!.priority).toBe('high')
    expect(engage!.companyId).toBe(companyId)
  })

  it('generates tech recommendation for technology signals', async () => {
    setupMocks({
      signals: [
        { signalType: 'TECHNOLOGY', title: 'Cloud migration', score: 80, status: 'new' },
      ],
    })
    const recs = await generateRecommendations(companyId)
    const tech = recs.find(r => r.action.includes('technology'))
    expect(tech).toBeDefined()
    expect(tech!.targetDecisionMaker).toContain('CTO')
  })

  it('generates pain recommendation for pain signals', async () => {
    setupMocks({
      signals: [
        { signalType: 'PAIN', title: 'Legacy tech debt crisis', score: 75, status: 'validated' },
      ],
    })
    const recs = await generateRecommendations(companyId)
    const pain = recs.find(r => r.action.includes('pain'))
    expect(pain).toBeDefined()
    expect(pain!.confidence).toBe(0.9)
  })

  it('generates growth recommendation for growth signals', async () => {
    setupMocks({
      signals: [
        { signalType: 'GROWTH', title: 'Hiring 200 engineers', score: 70, status: 'new' },
      ],
    })
    const recs = await generateRecommendations(companyId)
    const growth = recs.find(r => r.action.includes('expansion'))
    expect(growth).toBeDefined()
    expect(growth!.priority).toBe('medium')
  })

  it('generates leadership recommendation for leadership signals', async () => {
    setupMocks({
      signals: [
        { signalType: 'LEADERSHIP', title: 'New CTO appointed', score: 65, status: 'new' },
      ],
    })
    const recs = await generateRecommendations(companyId)
    const leadership = recs.find(r => r.action.includes('relationship'))
    expect(leadership).toBeDefined()
    expect(leadership!.targetDecisionMaker).toContain('C-suite')
  })

  it('sorts recommendations by priority', async () => {
    setupMocks({
      signals: [
        { signalType: 'GROWTH', title: 'Expanding to Europe', score: 70, status: 'new' },
        { signalType: 'TECHNOLOGY', title: 'AI initiative', score: 80, status: 'new' },
        { signalType: 'PAIN', title: 'Data breach', score: 75, status: 'validated' },
      ],
      score: { score: 85, category: 'HOT_ACCOUNT' },
    })
    const recs = await generateRecommendations(companyId)
    const priorities = recs.map(r => r.priority)
    // high should all come before medium
    const lastHighIdx = Math.max(...priorities.map((p, i) => p === 'high' ? i : -1))
    const firstMediumIdx = priorities.indexOf('medium')
    if (firstMediumIdx !== -1 && lastHighIdx !== -1) {
      expect(lastHighIdx).toBeLessThan(firstMediumIdx)
    }
  })

  it('throws when company not found', async () => {
    setupMocks({ company: null })
    await expect(generateRecommendations(companyId)).rejects.toThrow('not found')
  })

  it('includes supporting signals on recommendations', async () => {
    setupMocks({
      signals: [
        { signalType: 'TECHNOLOGY', title: 'Cloud migration', score: 80, status: 'new' },
        { signalType: 'TECHNOLOGY', title: 'Kubernetes adoption', score: 75, status: 'new' },
      ],
    })
    const recs = await generateRecommendations(companyId)
    const tech = recs.find(r => r.action.includes('technology'))
    expect(tech!.supportingSignals.length).toBeGreaterThanOrEqual(1)
    expect(tech!.supportingSignals[0]).toHaveProperty('type')
    expect(tech!.supportingSignals[0]).toHaveProperty('title')
    expect(tech!.supportingSignals[0]).toHaveProperty('score')
  })
})
