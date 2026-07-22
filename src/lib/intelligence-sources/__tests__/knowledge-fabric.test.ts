import { describe, it, expect, vi, beforeEach } from 'vitest'

// Use vi.hoisted so mock fns are available inside the hoisted vi.mock factory
const {
  mockKnowledgeEntryCreate,
  mockKnowledgeEntryUpdate,
  mockKnowledgeEntryFindUnique,
  mockKnowledgeEntryFindMany,
} = vi.hoisted(() => ({
  mockKnowledgeEntryCreate: vi.fn(),
  mockKnowledgeEntryUpdate: vi.fn(),
  mockKnowledgeEntryFindUnique: vi.fn(),
  mockKnowledgeEntryFindMany: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    knowledgeEntry: {
      create: mockKnowledgeEntryCreate,
      update: mockKnowledgeEntryUpdate,
      findUnique: mockKnowledgeEntryFindUnique,
      findMany: mockKnowledgeEntryFindMany,
    },
  },
}))

import {
  createKnowledgeEntry,
  updateKnowledgeEntry,
  getCompanyKnowledge,
  getKnowledgeByCategory,
  searchKnowledge,
} from '../knowledge-fabric'
import { ALL_CATEGORIES } from '../types'

describe('Knowledge Fabric', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── createKnowledgeEntry ──────────────────────────────────

  describe('createKnowledgeEntry', () => {
    it('creates a knowledge entry with valid category', async () => {
      mockKnowledgeEntryCreate.mockResolvedValue({
        id: 'ke-1',
        companyId: 'co-1',
        category: 'Strategy',
        content: 'Acme is pursuing AI-first strategy',
      })

      const result = await createKnowledgeEntry({
        companyId: 'co-1',
        category: 'Strategy',
        content: 'Acme is pursuing AI-first strategy',
        source: 'csv:upload',
        confidence: 0.9,
      })

      expect(result.id).toBe('ke-1')
      expect(mockKnowledgeEntryCreate).toHaveBeenCalledWith({
        data: {
          companyId: 'co-1',
          category: 'Strategy',
          subCategory: null,
          content: 'Acme is pursuing AI-first strategy',
          source: 'csv:upload',
          intelligenceObjectId: null,
          confidence: 0.9,
        },
      })
    })

    it('creates entry with subCategory when provided', async () => {
      mockKnowledgeEntryCreate.mockResolvedValue({ id: 'ke-2' })

      await createKnowledgeEntry({
        companyId: 'co-1',
        category: 'Technology',
        subCategory: 'Cloud',
        content: 'Uses AWS',
      })

      expect(mockKnowledgeEntryCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ subCategory: 'Cloud' }),
        }),
      )
    })

    it('creates entry with intelligenceObjectId when provided', async () => {
      mockKnowledgeEntryCreate.mockResolvedValue({ id: 'ke-3' })

      await createKnowledgeEntry({
        companyId: 'co-1',
        category: 'Products',
        content: 'New widget launched',
        intelligenceObjectId: 'io-1',
      })

      expect(mockKnowledgeEntryCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ intelligenceObjectId: 'io-1' }),
        }),
      )
    })

    it('defaults confidence to 0.5 when not provided', async () => {
      mockKnowledgeEntryCreate.mockResolvedValue({ id: 'ke-4' })

      await createKnowledgeEntry({
        companyId: 'co-1',
        category: 'Leadership',
        content: 'New CEO appointed',
      })

      expect(mockKnowledgeEntryCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ confidence: 0.5 }),
        }),
      )
    })

    it('defaults source to null when not provided', async () => {
      mockKnowledgeEntryCreate.mockResolvedValue({ id: 'ke-5' })

      await createKnowledgeEntry({
        companyId: 'co-1',
        category: 'Market',
        content: 'Market is growing',
      })

      expect(mockKnowledgeEntryCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ source: null }),
        }),
      )
    })

    it('throws on invalid category', async () => {
      await expect(
        createKnowledgeEntry({
          companyId: 'co-1',
          category: 'InvalidCategory',
          content: 'Some content',
        }),
      ).rejects.toThrow('Invalid knowledge category: InvalidCategory')
    })

    it('includes the list of valid categories in the error message', async () => {
      await expect(
        createKnowledgeEntry({
          companyId: 'co-1',
          category: 'BadCat',
          content: 'Some content',
        }),
      ).rejects.toThrow(ALL_CATEGORIES.join(', '))
    })

    it('accepts all 13 valid categories', async () => {
      mockKnowledgeEntryCreate.mockResolvedValue({ id: 'ke-all' })

      for (const category of ALL_CATEGORIES) {
        await createKnowledgeEntry({
          companyId: 'co-1',
          category,
          content: `Content for ${category}`,
        })
      }

      expect(mockKnowledgeEntryCreate).toHaveBeenCalledTimes(ALL_CATEGORIES.length)
    })
  })

  // ─── updateKnowledgeEntry ──────────────────────────────────

  describe('updateKnowledgeEntry', () => {
    it('updates content and stores previousValue', async () => {
      mockKnowledgeEntryFindUnique.mockResolvedValue({
        id: 'ke-1',
        content: 'Old content',
        version: 1,
      })
      mockKnowledgeEntryUpdate.mockResolvedValue({
        id: 'ke-1',
        content: 'New content',
        previousValue: 'Old content',
        changeReason: 'Updated from new source',
        version: 2,
      })

      const result = await updateKnowledgeEntry('ke-1', 'New content', 'Updated from new source')

      expect(result.version).toBe(2)
      expect(mockKnowledgeEntryUpdate).toHaveBeenCalledWith({
        where: { id: 'ke-1' },
        data: expect.objectContaining({
          content: 'New content',
          previousValue: 'Old content',
          changeReason: 'Updated from new source',
          version: { increment: 1 },
        }),
      })
    })

    it('throws when entry does not exist', async () => {
      mockKnowledgeEntryFindUnique.mockResolvedValue(null)

      await expect(
        updateKnowledgeEntry('nonexistent', 'New', 'Reason'),
      ).rejects.toThrow('Knowledge entry not found: nonexistent')
    })
  })

  // ─── getCompanyKnowledge ───────────────────────────────────

  describe('getCompanyKnowledge', () => {
    it('returns entries grouped by category', async () => {
      const mockEntries = [
        { id: 'ke-1', category: 'Strategy', updatedAt: new Date('2024-01-01') },
        { id: 'ke-2', category: 'Products', updatedAt: new Date('2024-01-02') },
        { id: 'ke-3', category: 'Strategy', updatedAt: new Date('2024-01-03') },
        { id: 'ke-4', category: 'Technology', updatedAt: new Date('2024-01-04') },
      ]
      mockKnowledgeEntryFindMany.mockResolvedValue(mockEntries)

      const result = await getCompanyKnowledge('co-1')

      expect(result.entries).toHaveLength(4)
      expect(result.grouped['Strategy']).toHaveLength(2)
      expect(result.grouped['Products']).toHaveLength(1)
      expect(result.grouped['Technology']).toHaveLength(1)
    })

    it('queries with correct companyId and ordering', async () => {
      mockKnowledgeEntryFindMany.mockResolvedValue([])

      await getCompanyKnowledge('co-abc')

      expect(mockKnowledgeEntryFindMany).toHaveBeenCalledWith({
        where: { companyId: 'co-abc' },
        orderBy: [{ category: 'asc' }, { updatedAt: 'desc' }],
      })
    })

    it('returns empty grouped object when no entries', async () => {
      mockKnowledgeEntryFindMany.mockResolvedValue([])

      const result = await getCompanyKnowledge('co-empty')

      expect(result.entries).toHaveLength(0)
      expect(Object.keys(result.grouped)).toHaveLength(0)
    })
  })

  // ─── getKnowledgeByCategory ────────────────────────────────

  describe('getKnowledgeByCategory', () => {
    it('queries by companyId and category', async () => {
      mockKnowledgeEntryFindMany.mockResolvedValue([
        { id: 'ke-cat', category: 'Products' },
      ])

      await getKnowledgeByCategory('co-1', 'Products')

      expect(mockKnowledgeEntryFindMany).toHaveBeenCalledWith({
        where: { companyId: 'co-1', category: 'Products' },
        orderBy: { updatedAt: 'desc' },
      })
    })
  })

  // ─── searchKnowledge ───────────────────────────────────────

  describe('searchKnowledge', () => {
    it('uses contains filter for keyword search', async () => {
      mockKnowledgeEntryFindMany.mockResolvedValue([
        { id: 'ke-search', content: 'Acme uses AI strategy' },
      ])

      await searchKnowledge('co-1', 'AI')

      expect(mockKnowledgeEntryFindMany).toHaveBeenCalledWith({
        where: {
          companyId: 'co-1',
          content: { contains: 'AI' },
        },
        orderBy: { updatedAt: 'desc' },
        take: 50,
      })
    })

    it('limits results to 50', async () => {
      mockKnowledgeEntryFindMany.mockResolvedValue([])

      await searchKnowledge('co-1', 'anything')

      expect(mockKnowledgeEntryFindMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 50 }),
      )
    })
  })
})