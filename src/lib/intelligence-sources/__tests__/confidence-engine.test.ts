import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockIntelligenceObjectFindUnique,
  mockIntelligenceObjectUpdate,
  mockIntelligenceObjectFindMany,
} = vi.hoisted(() => ({
  mockIntelligenceObjectFindUnique: vi.fn(),
  mockIntelligenceObjectUpdate: vi.fn(),
  mockIntelligenceObjectFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    intelligenceObject: {
      findUnique: mockIntelligenceObjectFindUnique,
      update: mockIntelligenceObjectUpdate,
      findMany: mockIntelligenceObjectFindMany,
    },
  },
}))

import {
  calculateFreshness,
  calculateConfidence,
  generateConfidenceExplanation,
  recalculateObjectConfidence,
} from '../confidence-engine'

describe('Confidence Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── calculateFreshness ───────────────────────────────────

  describe('calculateFreshness', () => {
    it('returns high score for a recently captured date', () => {
      const capturedAt = new Date(Date.now() - 1000 * 60 * 60 * 24) // 1 day ago
      const result = calculateFreshness(capturedAt, 'rss')

      expect(result.score).toBeGreaterThanOrEqual(0.9)
      expect(result.maxDays).toBe(90) // rss from FRESHNESS_CONFIG
    })

    it('returns low score for an old captured date', () => {
      const capturedAt = new Date('2022-01-01') // ~3 years ago
      const result = calculateFreshness(capturedAt, 'rss')

      expect(result.score).toBeLessThanOrEqual(0.1)
      expect(result.maxDays).toBe(90) // rss from FRESHNESS_CONFIG
    })

    it('returns 0.3 score when capturedAt is null', () => {
      const result = calculateFreshness(null, 'csv')

      expect(result.score).toBe(0.3)
      expect(result.daysElapsed).toBe(-1)
    })

    it('returns 1.0 for a future or current date', () => {
      const capturedAt = new Date(Date.now() + 60000) // 1 minute from now
      const result = calculateFreshness(capturedAt, 'website')

      expect(result.score).toBe(1.0)
      expect(result.daysElapsed).toBe(0)
    })
  })

  // ─── calculateConfidence ──────────────────────────────────

  describe('calculateConfidence', () => {
    it('calculates composite score for CSV source with recent capture', () => {
      const result = calculateConfidence({
        sourceType: 'csv',
        capturedAt: new Date(),
        content: 'Acme Corp has acquired a major AI startup for strategic expansion into new markets globally. This move positions them well in the competitive landscape and is expected to drive significant revenue growth over the coming quarters.',
        originalConfidence: 0.5,
      })

      // CSV sourceQuality = 0.95, freshness ≈ 1.0, content > 200 chars → 0.7
      // composite = 0.95*0.35 + 1.0*0.35 + 0.7*0.3 = 0.3325 + 0.35 + 0.21 = 0.8925
      expect(result.composite).toBeGreaterThan(0.8)
      expect(result.sourceQuality).toBe(0.95)
      expect(result.contentValidation).toBe(0.7)
      expect(result.breakdown).toEqual({
        sourceQuality: 0.95,
        freshness: expect.any(Number),
        contentValidation: 0.7,
      })
    })

    it('gives lower composite for RSS source with short content', () => {
      const result = calculateConfidence({
        sourceType: 'rss',
        capturedAt: new Date('2024-01-01'),
        content: 'Short',
        originalConfidence: 0.5,
      })

      // RSS sourceQuality = 0.75, freshness decays over time, content 5 chars → 0.3
      expect(result.sourceQuality).toBe(0.75)
      expect(result.contentValidation).toBe(0.3)
      expect(result.composite).toBeLessThan(0.6)
    })

    it('returns 0.5 sourceQuality for unknown source type', () => {
      const result = calculateConfidence({
        sourceType: 'unknown_type',
        capturedAt: new Date(),
        content: 'Some content here that is long enough to pass validation thresholds.',
        originalConfidence: 0.5,
      })

      expect(result.sourceQuality).toBe(0.5)
    })

    it('assigns correct content validation tiers', () => {
      const longContent = 'A'.repeat(501)
      const medContent = 'A'.repeat(201)
      const shortContent = 'A'.repeat(51)
      const tinyContent = 'A'.repeat(10)

      expect(calculateConfidence({ sourceType: 'csv', capturedAt: null, content: longContent, originalConfidence: 0.5 }).contentValidation).toBe(0.9)
      expect(calculateConfidence({ sourceType: 'csv', capturedAt: null, content: medContent, originalConfidence: 0.5 }).contentValidation).toBe(0.7)
      expect(calculateConfidence({ sourceType: 'csv', capturedAt: null, content: shortContent, originalConfidence: 0.5 }).contentValidation).toBe(0.5)
      expect(calculateConfidence({ sourceType: 'csv', capturedAt: null, content: tinyContent, originalConfidence: 0.5 }).contentValidation).toBe(0.3)
    })

    it('clamps composite to [0, 1]', () => {
      const result = calculateConfidence({
        sourceType: 'rss',
        capturedAt: new Date('2000-01-01'),
        content: 'Tiny',
        originalConfidence: 0.5,
      })

      expect(result.composite).toBeGreaterThanOrEqual(0)
      expect(result.composite).toBeLessThanOrEqual(1)
    })
  })

  // ─── generateConfidenceExplanation ─────────────────────────

  describe('generateConfidenceExplanation', () => {
    it('returns a human-readable explanation string', () => {
      const result = calculateConfidence({
        sourceType: 'csv',
        capturedAt: new Date(),
        content: 'A'.repeat(300),
        originalConfidence: 0.5,
      })

      const explanation = generateConfidenceExplanation(result)

      expect(explanation).toContain('Confidence:')
      expect(explanation).toContain('Source quality')
      expect(explanation).toContain('Freshness')
      expect(explanation).toContain('Content validation')
    })

    it('includes unknown capture time penalty in explanation', () => {
      const result = calculateConfidence({
        sourceType: 'csv',
        capturedAt: null,
        content: 'A'.repeat(100),
        originalConfidence: 0.5,
      })

      const explanation = generateConfidenceExplanation(result)

      expect(explanation).toContain('unknown capture time')
    })
  })

  // ─── recalculateObjectConfidence ──────────────────────────

  describe('recalculateObjectConfidence', () => {
    it('fetches object, calculates confidence, updates, and returns all', async () => {
      const mockObj = {
        id: 'io-1',
        sourceType: 'csv',
        capturedAt: new Date(),
        content: 'A'.repeat(300),
        originalConfidence: 0.5,
        metadata: null,
      }

      mockIntelligenceObjectFindUnique.mockResolvedValue(mockObj)
      mockIntelligenceObjectUpdate.mockResolvedValue({
        ...mockObj,
        originalConfidence: expect.any(Number),
        confidenceBreakdown: '{}',
      })

      const { intelligenceObject, result, explanation } =
        await recalculateObjectConfidence('io-1')

      expect(intelligenceObject).toBeDefined()
      expect(result.composite).toBeGreaterThan(0)
      expect(explanation).toContain('Confidence:')
      expect(mockIntelligenceObjectUpdate).toHaveBeenCalledWith({
        where: { id: 'io-1' },
        data: expect.objectContaining({
          originalConfidence: expect.any(Number),
          confidenceBreakdown: expect.any(String),
        }),
      })
    })

    it('throws when intelligence object does not exist', async () => {
      mockIntelligenceObjectFindUnique.mockResolvedValue(null)

      await expect(recalculateObjectConfidence('nonexistent')).rejects.toThrow(
        'IntelligenceObject with id "nonexistent" not found',
      )
    })
  })
})