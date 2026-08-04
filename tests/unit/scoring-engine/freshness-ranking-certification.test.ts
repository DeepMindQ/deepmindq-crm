/**
 * DeepMindQ Enterprise Test Framework — Milestone 3
 * Section: Unit / Scoring Engine / Freshness Ranking Certification
 *
 * Tests the pure-function scoring engine (src/lib/scoring/freshness-ranking.ts).
 * Validates half-life decay model, source quality weights, composite ranking,
 * staleness classification, signal ranking, and sorting.
 *
 * All tests use PURE FUNCTIONS — no DB mocking required.
 */

import { describe, it, expect } from 'vitest'
import {
  computeFreshnessScore,
  computeFreshnessState,
  sourceQualityWeight,
  computeIntelligenceRanking,
  rankSignal,
  sortByIntelligenceRanking,
  SIGNAL_HALF_LIVES,
} from '@/lib/scoring/freshness-ranking'

describe('Freshness Ranking — Scoring Engine Certification', () => {
  // ── Half-Life Constants ────────────────────────────────────────

  describe('SIGNAL_HALF_LIVES — decay configuration', () => {
    it('should have a shorter half-life for news (14 days) vs expansion (60 days)', () => {
      expect(SIGNAL_HALF_LIVES.news).toBeLessThan(SIGNAL_HALF_LIVES.expansion)
    })

    it('should have a default half-life of 30 days', () => {
      expect(SIGNAL_HALF_LIVES._default).toBe(30)
    })

    it('news should decay fastest (14 days)', () => {
      expect(SIGNAL_HALF_LIVES.news).toBe(14)
    })

    it('regulatory should decay slowest (90 days)', () => {
      expect(SIGNAL_HALF_LIVES.regulatory).toBe(90)
    })
  })

  // ── Freshness Score — Decay Model ──────────────────────────────

  describe('computeFreshnessScore — exponential decay', () => {
    const now = new Date().toISOString()

    it('should return full confidence for a signal created today', () => {
      const score = computeFreshnessScore(95, now, now, 'news')
      expect(score).toBeCloseTo(95, 0) // ~95 with negligible decay
    })

    it('a fresh 85% signal should score higher than a stale 95% signal', () => {
      const freshDate = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString() // 1 day ago
      const staleDate = new Date(Date.now() - 240 * 24 * 60 * 60 * 1000).toISOString() // 240 days ago

      const freshScore = computeFreshnessScore(85, freshDate, freshDate, 'news')
      const staleScore = computeFreshnessScore(95, staleDate, staleDate, 'news')

      expect(freshScore).toBeGreaterThan(staleScore)
    })

    it('should decay to near-zero for very old news signals', () => {
      const oldDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString() // 120 days
      const score = computeFreshnessScore(95, oldDate, oldDate, 'news') // half-life 14d
      expect(score).toBeLessThan(1) // Effectively zero
    })

    it('should preserve more score for slow-decay signal types', () => {
      const date30DaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()

      const newsScore = computeFreshnessScore(90, date30DaysAgo, date30DaysAgo, 'news') // HL=14
      const expansionScore = computeFreshnessScore(90, date30DaysAgo, date30DaysAgo, 'expansion') // HL=60

      expect(expansionScore).toBeGreaterThan(newsScore)
    })

    it('should use signalDate over createdAt when available', () => {
      const signalDate = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() // 5 days ago
      const createdAt = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString() // 60 days ago

      const scoreWithSignalDate = computeFreshnessScore(90, signalDate, createdAt, 'news')
      const scoreWithCreatedAt = computeFreshnessScore(90, createdAt, createdAt, 'news')

      expect(scoreWithSignalDate).toBeGreaterThan(scoreWithCreatedAt)
    })

    it('should fall back to createdAt when signalDate is null', () => {
      const score = computeFreshnessScore(80, null, new Date().toISOString(), 'news')
      expect(score).toBeGreaterThan(70)
    })

    it('should use sourcePublishedDate as fallback between signalDate and createdAt', () => {
      const sourceDate = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
      const createdAt = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()

      const score = computeFreshnessScore(80, null, createdAt, 'news', sourceDate)
      const scoreCreatedAt = computeFreshnessScore(80, null, createdAt, 'news')

      expect(score).toBeGreaterThan(scoreCreatedAt)
    })
  })

  // ── Staleness Classification ──────────────────────────────────

  describe('computeFreshnessState — staleness labels', () => {
    it('should be "fresh" for signals within halfLife * 0.5', () => {
      const date = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString()
      const state = computeFreshnessState(date, date, 'news') // HL=14, threshold=7
      expect(state.staleness).toBe('fresh')
    })

    it('should be "aging" for signals within halfLife', () => {
      const date = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString()
      const state = computeFreshnessState(date, date, 'news') // HL=14, between 7 and 14
      expect(state.staleness).toBe('aging')
    })

    it('should be "stale" for signals within 2x halfLife', () => {
      const date = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString()
      const state = computeFreshnessState(date, date, 'news') // HL=14, between 14 and 28
      expect(state.staleness).toBe('stale')
    })

    it('should be "expired" for signals beyond 2x halfLife', () => {
      const date = new Date(Date.now() - 35 * 24 * 60 * 60 * 1000).toISOString()
      const state = computeFreshnessState(date, date, 'news') // HL=14, beyond 28
      expect(state.staleness).toBe('expired')
    })

    it('should return correct daysSinceSignal', () => {
      const daysAgo = 3
      const date = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000).toISOString()
      const state = computeFreshnessState(date, date, 'news')
      expect(state.daysSinceSignal).toBe(daysAgo)
    })
  })

  // ── Source Quality ─────────────────────────────────────────────

  describe('sourceQualityWeight — tier mapping', () => {
    it('premium sources should return 1.0', () => {
      expect(sourceQualityWeight('premium')).toBe(1.0)
    })

    it('standard sources should return 0.8', () => {
      expect(sourceQualityWeight('standard')).toBe(0.8)
    })

    it('low sources should return 0.6', () => {
      expect(sourceQualityWeight('low')).toBe(0.6)
    })

    it('unknown sources should return 0.7', () => {
      expect(sourceQualityWeight('unknown')).toBe(0.7)
      expect(sourceQualityWeight('')).toBe(0.7)
      expect(sourceQualityWeight('random')).toBe(0.7)
    })
  })

  // ── Composite Intelligence Ranking ──────────────────────────────

  describe('computeIntelligenceRanking — composite score', () => {
    it('should return a ranking score between 0 and 100', () => {
      const result = computeIntelligenceRanking({
        confidence: 80,
        signalDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        signalType: 'news',
        sourceQuality: 'premium',
        businessRelevance: 0.8,
        capabilityRelevance: 0.7,
      })
      expect(result.rankingScore).toBeGreaterThanOrEqual(0)
      expect(result.rankingScore).toBeLessThanOrEqual(100)
    })

    it('should include all 5 breakdown dimensions', () => {
      const result = computeIntelligenceRanking({
        confidence: 90,
        signalDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        signalType: 'funding',
        sourceQuality: 'standard',
        businessRelevance: 0.6,
        capabilityRelevance: 0.5,
      })
      expect(result.breakdown).toHaveProperty('confidenceScore')
      expect(result.breakdown).toHaveProperty('freshnessScore')
      expect(result.breakdown).toHaveProperty('sourceQualityScore')
      expect(result.breakdown).toHaveProperty('businessRelevanceScore')
      expect(result.breakdown).toHaveProperty('capabilityRelevanceScore')
    })

    it('freshness decay should significantly impact composite score', () => {
      // A very fresh signal with moderate other dimensions should beat
      // a very old signal even with high confidence and premium source,
      // because freshness is weighted 30% and old news (HL=14) decays to ~0
      const freshInput = {
        confidence: 80, signalDate: new Date().toISOString(),
        createdAt: new Date().toISOString(), signalType: 'funding', // HL=30, slower decay
        sourceQuality: 'premium', businessRelevance: 0.8, capabilityRelevance: 0.8,
      }
      const staleInput = {
        confidence: 95, signalDate: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        createdAt: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
        signalType: 'news', // HL=14, very fast decay — score ~0
        sourceQuality: 'premium', businessRelevance: 1.0, capabilityRelevance: 1.0,
      }
      const freshResult = computeIntelligenceRanking(freshInput)
      const staleResult = computeIntelligenceRanking(staleInput)
      // Fresh signal should score higher due to freshness weight dominating
      expect(freshResult.breakdown.freshnessScore).toBeGreaterThan(staleResult.breakdown.freshnessScore)
      expect(freshResult.rankingScore).toBeGreaterThan(staleResult.rankingScore)
    })

    it('should include freshness state in result', () => {
      const result = computeIntelligenceRanking({
        confidence: 80,
        signalDate: new Date().toISOString(),
        createdAt: new Date().toISOString(),
        signalType: 'news',
        sourceQuality: 'premium',
        businessRelevance: 0.9,
        capabilityRelevance: 0.8,
      })
      expect(result.freshness).toHaveProperty('staleness')
      expect(result.freshness).toHaveProperty('daysSinceSignal')
      expect(result.freshness).toHaveProperty('halfLife')
    })
  })

  // ── Signal Ranking Convenience ─────────────────────────────────

  describe('rankSignal — single signal ranking', () => {
    it('should rank a signal record correctly', () => {
      const result = rankSignal({
        confidence: 0.85,
        signalDate: '2024-12-01T00:00:00Z',
        createdAt: '2024-12-01T00:00:00Z',
        signalType: 'funding',
        sourceQuality: 'premium',
      }, 0.8, 0.7)

      expect(result).toHaveProperty('rankingScore')
      expect(result).toHaveProperty('breakdown')
      expect(result).toHaveProperty('freshness')
    })
  })

  describe('sortByIntelligenceRanking — sorting', () => {
    it('should sort signals by ranking score descending', () => {
      const items = [
        { rankingScore: 45, name: 'low' },
        { rankingScore: 92, name: 'high' },
        { rankingScore: 67, name: 'medium' },
      ]
      const sorted = sortByIntelligenceRanking(items)
      expect(sorted[0].name).toBe('high')
      expect(sorted[1].name).toBe('medium')
      expect(sorted[2].name).toBe('low')
    })

    it('should not mutate the original array', () => {
      const items = [
        { rankingScore: 30, name: 'a' },
        { rankingScore: 70, name: 'b' },
      ]
      const originalOrder = items.map(i => i.name)
      sortByIntelligenceRanking(items)
      expect(items.map(i => i.name)).toEqual(originalOrder)
    })
  })
})
