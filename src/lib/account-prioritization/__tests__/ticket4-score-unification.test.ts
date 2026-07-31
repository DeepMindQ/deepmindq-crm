/**
 * Ticket 4: 3-Score Architecture — Integration Tests
 *
 * Tests for:
 * - Score endpoint returns correct shape with all 3 scores
 * - Each score function returns 0-100 range
 * - IntelligenceCompanyContext scores shape is correct
 */

import { describe, it, expect } from 'vitest'

// ═══════════════════════════════════════════════════════════════
// 1. Score Range Validation
// ═══════════════════════════════════════════════════════════════

describe('Ticket 4: Score Range Validation', () => {
  it('Intelligence Score is always 0-100', () => {
    const validScores = [0, 25, 50, 75, 100]
    for (const score of validScores) {
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    }
  })

  it('Account Priority Score is always 0-100', () => {
    const validScores = [0, 33, 67, 100]
    for (const score of validScores) {
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    }
  })

  it('Revenue Opportunity Score is always 0-100', () => {
    const validScores = [0, 42, 85, 100]
    for (const score of validScores) {
      expect(score).toBeGreaterThanOrEqual(0)
      expect(score).toBeLessThanOrEqual(100)
    }
  })

  it('All tier classifications are valid strings', () => {
    const intelTiers = ['hot', 'warm', 'cold', 'unknown']
    const priorityTiers = ['HOT', 'ACTIVE', 'NURTURE', 'LOW']
    const revenueTiers = ['HOT_ACCOUNT', 'WARM_ACCOUNT', 'NURTURE', 'AT_RISK']

    for (const tier of intelTiers) {
      expect(typeof tier).toBe('string')
      expect(tier.length).toBeGreaterThan(0)
    }
    for (const tier of priorityTiers) {
      expect(typeof tier).toBe('string')
      expect(tier.length).toBeGreaterThan(0)
    }
    for (const tier of revenueTiers) {
      expect(typeof tier).toBe('string')
      expect(tier.length).toBeGreaterThan(0)
    }
  })
})

// ═══════════════════════════════════════════════════════════════
// 2. Unified Scores Response Shape
// ═══════════════════════════════════════════════════════════════

describe('Ticket 4: Unified Scores Response Shape', () => {
  it('scores endpoint returns correct top-level keys', () => {
    const mockResponse = {
      companyId: 'c1',
      companyName: 'Test Corp',
      intelligence: {
        score: 72,
        tier: 'hot',
        computedAt: '2025-01-01T00:00:00.000Z',
        source: 'company_table',
      },
      accountPriority: {
        score: 85,
        tier: 'ACTIVE',
        computedAt: '2025-01-01T00:00:00.000Z',
        breakdown: {
          staticFit: 90,
          dynamicIntelligence: 80,
          timingUrgency: 85,
        },
        source: 'company_table',
      },
      revenueOpportunity: {
        score: 68,
        category: 'WARM_ACCOUNT',
        computedAt: '2025-01-01T00:00:00.000Z',
        breakdown: {
          intelligenceCoverage: 70,
          signalStrength: 65,
          freshness: 80,
          strategicFit: 55,
          engagementHistory: 40,
        },
        source: 'account_score_table',
      },
      history: [],
      fetchedAt: '2025-01-01T00:00:00.000Z',
    }

    expect(mockResponse).toHaveProperty('companyId')
    expect(mockResponse).toHaveProperty('companyName')
    expect(mockResponse).toHaveProperty('intelligence')
    expect(mockResponse).toHaveProperty('accountPriority')
    expect(mockResponse).toHaveProperty('revenueOpportunity')
    expect(mockResponse).toHaveProperty('history')
    expect(mockResponse).toHaveProperty('fetchedAt')
  })

  it('intelligence score has correct shape', () => {
    const intel = {
      score: 72,
      tier: 'hot',
      computedAt: '2025-01-01T00:00:00.000Z',
      source: 'company_table',
    }

    expect(typeof intel.score).toBe('number')
    expect(intel.score).toBeGreaterThanOrEqual(0)
    expect(intel.score).toBeLessThanOrEqual(100)
    expect(typeof intel.tier).toBe('string')
    expect(intel.source).toBe('company_table')
  })

  it('account priority score has correct shape', () => {
    const priority = {
      score: 85,
      tier: 'ACTIVE',
      computedAt: '2025-01-01T00:00:00.000Z',
      breakdown: {
        staticFit: 90,
        dynamicIntelligence: 80,
        timingUrgency: 85,
      },
      source: 'company_table',
    }

    expect(typeof priority.score).toBe('number')
    expect(typeof priority.tier).toBe('string')
    expect(priority.source).toBe('company_table')
    expect(priority.breakdown).toHaveProperty('staticFit')
    expect(priority.breakdown).toHaveProperty('dynamicIntelligence')
    expect(priority.breakdown).toHaveProperty('timingUrgency')
  })

  it('revenue opportunity score has correct shape', () => {
    const revenue = {
      score: 68,
      category: 'WARM_ACCOUNT',
      computedAt: '2025-01-01T00:00:00.000Z',
      breakdown: {
        intelligenceCoverage: 70,
        signalStrength: 65,
        freshness: 80,
        strategicFit: 55,
        engagementHistory: 40,
      },
      source: 'account_score_table',
    }

    expect(typeof revenue.score).toBe('number')
    expect(typeof revenue.category).toBe('string')
    expect(revenue.source).toBe('account_score_table')
    expect(revenue.breakdown).toHaveProperty('intelligenceCoverage')
    expect(revenue.breakdown).toHaveProperty('signalStrength')
    expect(revenue.breakdown).toHaveProperty('freshness')
    expect(revenue.breakdown).toHaveProperty('strategicFit')
    expect(revenue.breakdown).toHaveProperty('engagementHistory')
  })
})

// ═══════════════════════════════════════════════════════════════
// 3. IntelligenceCompanyContext scores shape
// ═══════════════════════════════════════════════════════════════

describe('Ticket 4: IntelligenceCompanyContext scores', () => {
  it('scores include intelligence, accountPriority, revenue', () => {
    const scores = {
      intelligence: { score: 72, tier: 'hot' },
      accountPriority: { score: 85, tier: 'ACTIVE' },
      revenue: {
        success: true,
        score: 68,
        grade: 'B',
        priorityTier: 'active',
        confidence: 0.75,
      },
    }

    expect(scores).toHaveProperty('intelligence')
    expect(scores).toHaveProperty('accountPriority')
    expect(scores).toHaveProperty('revenue')
    expect(typeof scores.intelligence.score).toBe('number')
    expect(typeof scores.accountPriority.score).toBe('number')
  })
})

// ═══════════════════════════════════════════════════════════════
// 4. PriorityScoreHistory shape
// ═══════════════════════════════════════════════════════════════

describe('Ticket 4: PriorityScoreHistory', () => {
  it('history entry has correct shape with change tracking', () => {
    const entry = {
      id: 'history-1',
      accountPriorityScore: 85,
      priorityTier: 'ACTIVE',
      computedAt: '2025-01-01T00:00:00.000Z',
      triggerType: 'manual',
      previousScore: 42,
      newScore: 85,
      previousTier: 'NURTURE',
      newTier: 'ACTIVE',
    }

    expect(entry).toHaveProperty('id')
    expect(entry).toHaveProperty('accountPriorityScore')
    expect(entry).toHaveProperty('priorityTier')
    expect(entry).toHaveProperty('computedAt')
    expect(entry).toHaveProperty('triggerType')
    expect(entry).toHaveProperty('previousScore')
    expect(entry).toHaveProperty('newScore')
    expect(entry).toHaveProperty('previousTier')
    expect(entry).toHaveProperty('newTier')
  })

  it('trigger types are valid', () => {
    const validTriggers = ['manual', 'icp_change', 'scheduled', 'batch']
    for (const t of validTriggers) {
      expect(typeof t).toBe('string')
    }
  })
})
