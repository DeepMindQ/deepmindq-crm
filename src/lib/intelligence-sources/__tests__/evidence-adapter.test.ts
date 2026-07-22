import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so mock fns are available inside the hoisted vi.mock factory
const { mockEvidenceCreate } = vi.hoisted(() => ({
  mockEvidenceCreate: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    evidence: {
      create: mockEvidenceCreate,
    },
  },
}))

import { adaptToEvidence } from '../evidence-adapter'
import { sourceTypeToQualityTier } from '../types'

describe('Evidence Adapter', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── sourceTypeToQualityTier ───────────────────────────────

  describe('sourceTypeToQualityTier', () => {
    it('maps csv to premium (reliability 0.95 >= 0.9)', () => {
      expect(sourceTypeToQualityTier('csv')).toBe('premium')
    })

    it('maps excel to premium (reliability 0.95 >= 0.9)', () => {
      expect(sourceTypeToQualityTier('excel')).toBe('premium')
    })

    it('maps document to premium (reliability 0.9 >= 0.9)', () => {
      expect(sourceTypeToQualityTier('document')).toBe('premium')
    })

    it('maps website to standard (reliability 0.85, >= 0.7 but < 0.9)', () => {
      expect(sourceTypeToQualityTier('website')).toBe('standard')
    })

    it('maps human to standard (reliability 0.85)', () => {
      expect(sourceTypeToQualityTier('human')).toBe('standard')
    })

    it('maps rss to standard (reliability 0.75, >= 0.7 but < 0.9)', () => {
      expect(sourceTypeToQualityTier('rss')).toBe('standard')
    })
  })

  // ─── adaptToEvidence — happy path ──────────────────────────

  describe('adaptToEvidence — successful adaptation', () => {
    it('creates evidence with correct field mapping', async () => {
      mockEvidenceCreate.mockResolvedValue({ id: 'ev-1' })

      const result = await adaptToEvidence({
        intelligenceObjectId: 'io-1',
        companyId: 'co-1',
        sourceType: 'csv',
        sourceName: 'CSV Upload',
        sourceUrl: 'https://example.com/file.csv',
        content: 'Company: Acme Corp, Revenue: 100M',
        summary: 'Acme Corp makes 100M',
        capturedAt: new Date('2024-06-01'),
        originalConfidence: 0.95,
        metadata: { title: 'Acme Report', category: 'Strategy' },
      })

      expect(result.success).toBe(true)
      expect(result.evidenceId).toBe('ev-1')

      expect(mockEvidenceCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: 'co-1',
          sourceUrl: 'https://example.com/file.csv',
          sourceTitle: 'Acme Report',
          sourceName: 'CSV Upload',
          snippet: 'Acme Corp makes 100M',
          extractedField: 'Strategy',
          extractedValue: 'Company: Acme Corp, Revenue: 100M'.substring(0, 1000),
          relevanceScore: 0.95,
          confidence: 0.95,
          sourceQualityTier: 'premium',
          status: 'active',
        }),
      })
    })

    it('uses sourceType as sourceName when sourceName is omitted', async () => {
      mockEvidenceCreate.mockResolvedValue({ id: 'ev-2' })

      await adaptToEvidence({
        intelligenceObjectId: 'io-2',
        companyId: 'co-1',
        sourceType: 'rss',
        content: 'Some content',
        originalConfidence: 0.75,
      })

      expect(mockEvidenceCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sourceName: 'rss',
          }),
        }),
      )
    })

    it('generates internal URL when sourceUrl is missing', async () => {
      mockEvidenceCreate.mockResolvedValue({ id: 'ev-3' })

      await adaptToEvidence({
        intelligenceObjectId: 'io-3',
        companyId: 'co-1',
        sourceType: 'csv',
        content: 'Some content',
        originalConfidence: 0.95,
      })

      expect(mockEvidenceCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            sourceUrl: 'internal://acquisition/io-3',
          }),
        }),
      )
    })

    it('uses content.substring(0, 500) as snippet when summary is missing', async () => {
      mockEvidenceCreate.mockResolvedValue({ id: 'ev-4' })
      const longContent = 'A'.repeat(1000)

      await adaptToEvidence({
        intelligenceObjectId: 'io-4',
        companyId: 'co-1',
        sourceType: 'csv',
        content: longContent,
        originalConfidence: 0.95,
      })

      const callData = mockEvidenceCreate.mock.calls[0][0].data
      expect(callData.snippet).toBe('A'.repeat(500))
    })

    it('prefers summary over content for snippet', async () => {
      mockEvidenceCreate.mockResolvedValue({ id: 'ev-5' })

      await adaptToEvidence({
        intelligenceObjectId: 'io-5',
        companyId: 'co-1',
        sourceType: 'csv',
        content: 'A'.repeat(1000),
        summary: 'Short summary',
        originalConfidence: 0.95,
      })

      const callData = mockEvidenceCreate.mock.calls[0][0].data
      expect(callData.snippet).toBe('Short summary')
    })

    it('extracts category from metadata when present', async () => {
      mockEvidenceCreate.mockResolvedValue({ id: 'ev-6' })

      await adaptToEvidence({
        intelligenceObjectId: 'io-6',
        companyId: 'co-1',
        sourceType: 'csv',
        content: 'Some content',
        originalConfidence: 0.95,
        metadata: { category: 'Competitors' },
      })

      const callData = mockEvidenceCreate.mock.calls[0][0].data
      expect(callData.extractedField).toBe('Competitors')
    })

    it('sets sourceDate to provided capturedAt', async () => {
      const capturedAt = new Date('2024-03-15T12:00:00Z')
      mockEvidenceCreate.mockResolvedValue({ id: 'ev-7' })

      await adaptToEvidence({
        intelligenceObjectId: 'io-7',
        companyId: 'co-1',
        sourceType: 'csv',
        content: 'Content',
        capturedAt,
        originalConfidence: 0.95,
      })

      const callData = mockEvidenceCreate.mock.calls[0][0].data
      expect(callData.sourceDate).toEqual(capturedAt)
    })

    it('defaults sourceDate to current date when capturedAt is missing', async () => {
      mockEvidenceCreate.mockResolvedValue({ id: 'ev-8' })

      const beforeCall = new Date()
      await adaptToEvidence({
        intelligenceObjectId: 'io-8',
        companyId: 'co-1',
        sourceType: 'csv',
        content: 'Content',
        originalConfidence: 0.95,
      })
      const afterCall = new Date()

      const callData = mockEvidenceCreate.mock.calls[0][0].data
      expect(callData.sourceDate.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime())
      expect(callData.sourceDate.getTime()).toBeLessThanOrEqual(afterCall.getTime())
    })

    it('maps rss sourceType to standard quality tier', async () => {
      mockEvidenceCreate.mockResolvedValue({ id: 'ev-9' })

      await adaptToEvidence({
        intelligenceObjectId: 'io-9',
        companyId: 'co-1',
        sourceType: 'rss',
        content: 'News content',
        originalConfidence: 0.75,
      })

      const callData = mockEvidenceCreate.mock.calls[0][0].data
      expect(callData.sourceQualityTier).toBe('standard')
    })
  })

  // ─── adaptToEvidence — error handling ──────────────────────

  describe('adaptToEvidence — error handling', () => {
    it('never throws — returns error in result when DB fails', async () => {
      mockEvidenceCreate.mockRejectedValue(new Error('Database connection lost'))

      const result = await adaptToEvidence({
        intelligenceObjectId: 'io-err',
        companyId: 'co-1',
        sourceType: 'csv',
        content: 'Content',
        originalConfidence: 0.95,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Database connection lost')
      expect(result.evidenceId).toBeUndefined()
    })

    it('handles non-Error throws gracefully', async () => {
      mockEvidenceCreate.mockRejectedValue('string error')

      const result = await adaptToEvidence({
        intelligenceObjectId: 'io-err2',
        companyId: 'co-1',
        sourceType: 'csv',
        content: 'Content',
        originalConfidence: 0.95,
      })

      expect(result.success).toBe(false)
      expect(result.error).toBe('Unknown adapter error')
    })

    it('does not set extractedField when metadata has no category', async () => {
      mockEvidenceCreate.mockResolvedValue({ id: 'ev-10' })

      await adaptToEvidence({
        intelligenceObjectId: 'io-10',
        companyId: 'co-1',
        sourceType: 'csv',
        content: 'Content',
        originalConfidence: 0.95,
        metadata: { title: 'Report' },
      })

      const callData = mockEvidenceCreate.mock.calls[0][0].data
      expect(callData.extractedField).toBeUndefined()
    })
  })
})