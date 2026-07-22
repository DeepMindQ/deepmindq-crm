import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockIntelligenceObjectFindMany,
  mockIntelligenceObjectFindUnique,
  mockIntelligenceObjectUpdate,
  mockIntelligenceAssociationCreate,
  mockIntelligenceAssociationFindUnique,
  mockIntelligenceAssociationUpdate,
  mockIntelligenceAssociationFindMany,
  mockTransaction,
} = vi.hoisted(() => ({
  mockIntelligenceObjectFindMany: vi.fn(),
  mockIntelligenceObjectFindUnique: vi.fn(),
  mockIntelligenceObjectUpdate: vi.fn(),
  mockIntelligenceAssociationCreate: vi.fn(),
  mockIntelligenceAssociationFindUnique: vi.fn(),
  mockIntelligenceAssociationUpdate: vi.fn(),
  mockIntelligenceAssociationFindMany: vi.fn(),
  mockTransaction: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    intelligenceObject: {
      findMany: mockIntelligenceObjectFindMany,
      findUnique: mockIntelligenceObjectFindUnique,
      update: mockIntelligenceObjectUpdate,
    },
    intelligenceAssociation: {
      create: mockIntelligenceAssociationCreate,
      findUnique: mockIntelligenceAssociationFindUnique,
      update: mockIntelligenceAssociationUpdate,
      findMany: mockIntelligenceAssociationFindMany,
    },
    $transaction: mockTransaction,
  },
}))

import {
  detectDuplicates,
  createAssociation,
  detectConflicts,
  mergeDuplicates,
  resolveAssociation,
  getAssociations,
} from '../association-engine'

describe('Association Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── detectDuplicates ─────────────────────────────────────

  describe('detectDuplicates', () => {
    it('returns 1 group with 1 match when 2 of 3 objects are similar', async () => {
      mockIntelligenceObjectFindMany.mockResolvedValue([
        {
          id: 'io-1',
          content: 'Acme Corp acquired a major AI startup for strategic expansion',
          sourceType: 'csv',
          metadata: null,
        },
        {
          id: 'io-2',
          content: 'Acme Corp acquired a major AI startup for strategic growth',
          sourceType: 'rss',
          metadata: null,
        },
        {
          id: 'io-3',
          content: 'Completely unrelated information about something else entirely',
          sourceType: 'website',
          metadata: null,
        },
      ])

      const result = await detectDuplicates('co-1')

      expect(result).toHaveLength(1)
      expect(result[0].objectId).toBe('io-1')
      expect(result[0].matches).toHaveLength(1)
      expect(result[0].matches[0].objectId).toBe('io-2')
      expect(result[0].matches[0].similarity).toBeGreaterThanOrEqual(0.6)
    })

    it('returns empty array when no duplicates found', async () => {
      mockIntelligenceObjectFindMany.mockResolvedValue([
        { id: 'io-a', content: 'First unique piece of intelligence', sourceType: 'csv', metadata: null },
        { id: 'io-b', content: 'Second entirely different piece of data', sourceType: 'rss', metadata: null },
      ])

      const result = await detectDuplicates('co-1')

      expect(result).toHaveLength(0)
    })

    it('queries with correct companyId and status filter', async () => {
      mockIntelligenceObjectFindMany.mockResolvedValue([])

      await detectDuplicates('co-abc')

      expect(mockIntelligenceObjectFindMany).toHaveBeenCalledWith({
        where: {
          companyId: 'co-abc',
          status: { in: ['new', 'active'] },
        },
        select: expect.objectContaining({
          id: true,
          content: true,
          sourceType: true,
          metadata: true,
        }),
      })
    })

    it('throws when companyId is empty', async () => {
      await expect(detectDuplicates('')).rejects.toThrow(
        'companyId is required for duplicate detection',
      )
    })
  })

  // ─── createAssociation ────────────────────────────────────

  describe('createAssociation', () => {
    it('creates an association record with valid input', async () => {
      mockIntelligenceObjectFindUnique
        .mockResolvedValueOnce({ id: 'io-1', companyId: 'co-1' })
        .mockResolvedValueOnce({ id: 'io-2', companyId: 'co-1' })
      mockIntelligenceAssociationCreate.mockResolvedValue({
        id: 'assoc-1',
        companyId: 'co-1',
        sourceId: 'io-1',
        targetId: 'io-2',
        associationType: 'duplicate',
        confidence: 0.8,
      })

      const result = await createAssociation({
        sourceId: 'io-1',
        targetId: 'io-2',
        associationType: 'duplicate',
        confidence: 0.8,
      })

      expect(result.id).toBe('assoc-1')
      expect(mockIntelligenceAssociationCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: 'co-1',
          sourceId: 'io-1',
          targetId: 'io-2',
          associationType: 'duplicate',
          confidence: 0.8,
        }),
      })
    })

    it('throws when sourceId and targetId are the same', async () => {
      await expect(
        createAssociation({
          sourceId: 'io-1',
          targetId: 'io-1',
          associationType: 'duplicate',
        }),
      ).rejects.toThrow('sourceId and targetId must be different objects')
    })

    it('throws when source object does not exist', async () => {
      mockIntelligenceObjectFindUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'io-2', companyId: 'co-1' })

      await expect(
        createAssociation({
          sourceId: 'io-missing',
          targetId: 'io-2',
          associationType: 'supports',
        }),
      ).rejects.toThrow('Source intelligence object not found: io-missing')
    })

    it('defaults confidence to 0.5 when not provided', async () => {
      mockIntelligenceObjectFindUnique
        .mockResolvedValueOnce({ id: 'io-1', companyId: 'co-1' })
        .mockResolvedValueOnce({ id: 'io-2', companyId: 'co-1' })
      mockIntelligenceAssociationCreate.mockResolvedValue({ id: 'assoc-2' })

      await createAssociation({
        sourceId: 'io-1',
        targetId: 'io-2',
        associationType: 'extends',
      })

      expect(mockIntelligenceAssociationCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ confidence: 0.5 }),
        }),
      )
    })
  })

  // ─── detectConflicts ──────────────────────────────────────

  describe('detectConflicts', () => {
    it('returns confidence_divergence conflict for same category with different confidence', async () => {
      mockIntelligenceObjectFindMany.mockResolvedValue([
        {
          id: 'io-a',
          content: 'Acme launched a new cloud product',
          metadata: JSON.stringify({ category: 'Products' }),
          capturedAt: new Date('2024-06-01'),
          originalConfidence: 0.9,
          sourceType: 'csv',
          sourceName: 'Internal Data',
        },
        {
          id: 'io-b',
          content: 'Acme expanded its enterprise offering suite',
          metadata: JSON.stringify({ category: 'Products' }),
          capturedAt: new Date('2024-06-05'),
          originalConfidence: 0.4,
          sourceType: 'rss',
          sourceName: 'TechCrunch',
        },
      ])

      const conflicts = await detectConflicts('co-1')

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].conflictType).toBe('confidence_divergence')
      expect(conflicts[0].category).toBe('Products')
      expect(conflicts[0].severity).toBe('medium')
    })

    it('returns contradiction conflict for opposite sentiment in same category', async () => {
      mockIntelligenceObjectFindMany.mockResolvedValue([
        {
          id: 'io-x',
          content: 'Acme acquired CloudVentures and expanded into enterprise',
          metadata: JSON.stringify({ category: 'Strategy' }),
          capturedAt: new Date('2024-06-01'),
          originalConfidence: 0.8,
          sourceType: 'csv',
          sourceName: 'Internal',
        },
        {
          id: 'io-y',
          content: 'Acme discontinued its cloud operations entirely',
          metadata: JSON.stringify({ category: 'Strategy' }),
          capturedAt: new Date('2024-06-05'),
          originalConfidence: 0.8,
          sourceType: 'rss',
          sourceName: 'NewsFeed',
        },
      ])

      const conflicts = await detectConflicts('co-1')

      expect(conflicts).toHaveLength(1)
      expect(conflicts[0].conflictType).toBe('contradiction')
      expect(conflicts[0].severity).toBe('high')
    })

    it('throws when companyId is empty', async () => {
      await expect(detectConflicts('')).rejects.toThrow(
        'companyId is required for conflict detection',
      )
    })
  })

  // ─── mergeDuplicates ─────────────────────────────────────

  describe('mergeDuplicates', () => {
    it('keeps target and supersedes source when keepTarget is true', async () => {
      const keptObj = {
        id: 'io-target', companyId: 'co-1', content: 'Target content',
        status: 'active', metadata: '{}', sourceType: 'csv', capturedAt: null,
      }
      const discardedObj = {
        id: 'io-source', companyId: 'co-1', content: 'Source content',
        status: 'active', metadata: '{}', sourceType: 'rss', capturedAt: null,
      }

      mockIntelligenceObjectFindUnique
        .mockResolvedValueOnce(discardedObj)
        .mockResolvedValueOnce(keptObj)

      mockTransaction.mockImplementation(async (ops: any[]) => {
        return [
          { ...keptObj, metadata: JSON.stringify({ mergedFrom: 'io-source' }) },
          { ...discardedObj, status: 'superseded' },
          { id: 'assoc-dup' },
          { id: 'assoc-sup' },
        ]
      })

      const { merged, superseded } = await mergeDuplicates('io-source', 'io-target', true)

      expect(superseded.status).toBe('superseded')
      expect(mockTransaction).toHaveBeenCalled()
    })

    it('throws when merging an object with itself', async () => {
      await expect(mergeDuplicates('io-1', 'io-1', true)).rejects.toThrow(
        'Cannot merge an object with itself',
      )
    })
  })

  // ─── resolveAssociation ───────────────────────────────────

  describe('resolveAssociation', () => {
    it('marks association as resolved with the given action', async () => {
      mockIntelligenceAssociationFindUnique.mockResolvedValue({
        id: 'assoc-1',
        resolved: false,
      })
      mockIntelligenceAssociationUpdate.mockResolvedValue({
        id: 'assoc-1',
        resolved: true,
        resolvedAction: 'merged',
        source: { id: 'io-1', content: 'Source', sourceType: 'csv' },
        target: { id: 'io-2', content: 'Target', sourceType: 'rss' },
      })

      const result = await resolveAssociation('assoc-1', 'merged')

      expect(result.resolved).toBe(true)
      expect(mockIntelligenceAssociationUpdate).toHaveBeenCalledWith({
        where: { id: 'assoc-1' },
        data: {
          resolved: true,
          resolvedAt: expect.any(Date),
          resolvedAction: 'merged',
        },
        include: {
          source: { select: expect.any(Object) },
          target: { select: expect.any(Object) },
        },
      })
    })

    it('throws when association does not exist', async () => {
      mockIntelligenceAssociationFindUnique.mockResolvedValue(null)

      await expect(resolveAssociation('nonexistent', 'dismissed')).rejects.toThrow(
        'Association not found: nonexistent',
      )
    })
  })

  // ─── getAssociations ─────────────────────────────────────

  describe('getAssociations', () => {
    it('returns filtered results with type and unresolvedOnly filters', async () => {
      mockIntelligenceAssociationFindMany.mockResolvedValue([
        {
          id: 'assoc-1',
          associationType: 'duplicate',
          resolved: false,
          source: { id: 'io-1', content: 'A', sourceType: 'csv' },
          target: { id: 'io-2', content: 'B', sourceType: 'rss' },
        },
      ])

      const result = await getAssociations('co-1', {
        type: 'duplicate',
        unresolvedOnly: true,
      })

      expect(result).toHaveLength(1)
      expect(mockIntelligenceAssociationFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'co-1',
            associationType: 'duplicate',
            resolved: false,
          }),
          orderBy: { createdAt: 'desc' },
        }),
      )
    })

    it('throws when companyId is empty', async () => {
      await expect(getAssociations('')).rejects.toThrow(
        'companyId is required for fetching associations',
      )
    })
  })
})