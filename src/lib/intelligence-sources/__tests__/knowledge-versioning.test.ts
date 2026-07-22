import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockKnowledgeEntryFindUnique,
  mockKnowledgeEntryUpdate,
  mockKnowledgeVersionCreate,
  mockKnowledgeVersionFindUnique,
  mockKnowledgeVersionFindMany,
  mockKnowledgeVersionUpdate,
} = vi.hoisted(() => ({
  mockKnowledgeEntryFindUnique: vi.fn(),
  mockKnowledgeEntryUpdate: vi.fn(),
  mockKnowledgeVersionCreate: vi.fn(),
  mockKnowledgeVersionFindUnique: vi.fn(),
  mockKnowledgeVersionFindMany: vi.fn(),
  mockKnowledgeVersionUpdate: vi.fn(),
}))

vi.mock('@/lib/db', () => ({
  db: {
    knowledgeEntry: {
      findUnique: mockKnowledgeEntryFindUnique,
      update: mockKnowledgeEntryUpdate,
    },
    knowledgeVersion: {
      create: mockKnowledgeVersionCreate,
      findUnique: mockKnowledgeVersionFindUnique,
      findMany: mockKnowledgeVersionFindMany,
      update: mockKnowledgeVersionUpdate,
    },
  },
}))

import {
  createVersionSnapshot,
  createVersionOnUpdate,
  getVersionHistory,
  getVersion,
  compareVersions,
  restoreVersion,
} from '../knowledge-versioning'

describe('Knowledge Versioning', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // ─── createVersionSnapshot ────────────────────────────────

  describe('createVersionSnapshot', () => {
    it('creates a version record with current entry data', async () => {
      mockKnowledgeEntryFindUnique.mockResolvedValue({
        id: 'ke-1',
        version: 3,
        content: 'Current knowledge content',
      })
      mockKnowledgeVersionCreate.mockResolvedValue({
        id: 'kv-1',
        knowledgeEntryId: 'ke-1',
        version: 3,
        content: 'Current knowledge content',
        changedFields: '{"content":true}',
        changeReason: 'Manual snapshot',
        changedBy: 'user-1',
        createdAt: new Date('2024-06-15'),
      })

      const result = await createVersionSnapshot('ke-1', 'Manual snapshot', 'user-1')

      expect(result.id).toBe('kv-1')
      expect(result.version).toBe(3)
      expect(result.content).toBe('Current knowledge content')
      expect(result.changedFields).toEqual({ content: true })
      expect(mockKnowledgeVersionCreate).toHaveBeenCalledWith({
        data: {
          knowledgeEntryId: 'ke-1',
          version: 3,
          content: 'Current knowledge content',
          changedFields: '{"content":true}',
          changeReason: 'Manual snapshot',
          changedBy: 'user-1',
        },
      })
    })

    it('throws when entry does not exist', async () => {
      mockKnowledgeEntryFindUnique.mockResolvedValue(null)

      await expect(createVersionSnapshot('missing', 'reason')).rejects.toThrow(
        'KnowledgeEntry not found: missing',
      )
    })
  })

  // ─── createVersionOnUpdate ────────────────────────────────

  describe('createVersionOnUpdate', () => {
    it('snapshots first, then updates entry, returns both', async () => {
      const existingEntry = {
        id: 'ke-1',
        version: 1,
        content: 'Old content',
      }

      // findUnique is called: (1) in createVersionOnUpdate, (2) inside createVersionSnapshot
      mockKnowledgeEntryFindUnique
        .mockResolvedValueOnce(existingEntry)
        .mockResolvedValueOnce(existingEntry)

      mockKnowledgeVersionCreate.mockResolvedValue({
        id: 'kv-1',
        knowledgeEntryId: 'ke-1',
        version: 1,
        content: 'Old content',
        changedFields: '{"content":true}',
        changeReason: 'Updated from source',
        changedBy: 'system',
        createdAt: new Date('2024-06-15'),
      })

      mockKnowledgeVersionUpdate.mockResolvedValue({
        id: 'kv-1',
        changedFields: '{"content":true}',
      })

      mockKnowledgeEntryUpdate.mockResolvedValue({
        id: 'ke-1',
        content: 'New content',
        previousValue: 'Old content',
        version: 2,
      })

      const { entry, version } = await createVersionOnUpdate(
        'ke-1',
        'New content',
        'Updated from source',
      )

      expect(version.version).toBe(1)
      expect(version.content).toBe('Old content')
      expect(entry.content).toBe('New content')
      expect(entry.version).toBe(2)

      // Snapshot was created before update
      expect(mockKnowledgeVersionCreate).toHaveBeenCalledBefore(
        mockKnowledgeEntryUpdate,
      )
    })

    it('throws when new content is identical to current content', async () => {
      mockKnowledgeEntryFindUnique.mockResolvedValue({
        id: 'ke-1',
        version: 1,
        content: 'Same content',
      })

      await expect(
        createVersionOnUpdate('ke-1', 'Same content', 'No change'),
      ).rejects.toThrow(
        'New content is identical to current content for KnowledgeEntry: ke-1',
      )
    })

    it('throws when entry does not exist', async () => {
      mockKnowledgeEntryFindUnique.mockResolvedValue(null)

      await expect(
        createVersionOnUpdate('missing', 'New', 'reason'),
      ).rejects.toThrow('KnowledgeEntry not found: missing')
    })
  })

  // ─── getVersionHistory ────────────────────────────────────

  describe('getVersionHistory', () => {
    it('returns versions ordered by version DESC', async () => {
      mockKnowledgeEntryFindUnique.mockResolvedValue({ id: 'ke-1' })
      mockKnowledgeVersionFindMany.mockResolvedValue([
        { id: 'kv-3', knowledgeEntryId: 'ke-1', version: 3, content: 'V3', changedFields: '{}', changeReason: 'r3', changedBy: 'system', createdAt: new Date('2024-06-17') },
        { id: 'kv-2', knowledgeEntryId: 'ke-1', version: 2, content: 'V2', changedFields: '{}', changeReason: 'r2', changedBy: 'system', createdAt: new Date('2024-06-16') },
        { id: 'kv-1', knowledgeEntryId: 'ke-1', version: 1, content: 'V1', changedFields: '{}', changeReason: 'r1', changedBy: 'system', createdAt: new Date('2024-06-15') },
      ])

      const history = await getVersionHistory('ke-1')

      expect(history).toHaveLength(3)
      expect(history[0].version).toBe(3)
      expect(history[2].version).toBe(1)
      expect(mockKnowledgeVersionFindMany).toHaveBeenCalledWith({
        where: { knowledgeEntryId: 'ke-1' },
        orderBy: { version: 'desc' },
      })
    })

    it('throws when entry does not exist', async () => {
      mockKnowledgeEntryFindUnique.mockResolvedValue(null)

      await expect(getVersionHistory('missing')).rejects.toThrow(
        'KnowledgeEntry not found: missing',
      )
    })
  })

  // ─── getVersion ───────────────────────────────────────────

  describe('getVersion', () => {
    it('returns a specific version snapshot', async () => {
      mockKnowledgeEntryFindUnique.mockResolvedValue({ id: 'ke-1' })
      mockKnowledgeVersionFindUnique.mockResolvedValue({
        id: 'kv-2',
        knowledgeEntryId: 'ke-1',
        version: 2,
        content: 'Version 2 content',
        changedFields: '{"content":true}',
        changeReason: 'Update',
        changedBy: 'user-1',
        createdAt: new Date('2024-06-16'),
      })

      const result = await getVersion('ke-1', 2)

      expect(result).not.toBeNull()
      expect(result!.version).toBe(2)
      expect(result!.content).toBe('Version 2 content')
      expect(mockKnowledgeVersionFindUnique).toHaveBeenCalledWith({
        where: {
          knowledgeEntryId_version: {
            knowledgeEntryId: 'ke-1',
            version: 2,
          },
        },
      })
    })

    it('returns null when version does not exist', async () => {
      mockKnowledgeEntryFindUnique.mockResolvedValue({ id: 'ke-1' })
      mockKnowledgeVersionFindUnique.mockResolvedValue(null)

      const result = await getVersion('ke-1', 99)

      expect(result).toBeNull()
    })
  })

  // ─── compareVersions ──────────────────────────────────────

  describe('compareVersions', () => {
    it('returns diff with added and removed line counts', async () => {
      mockKnowledgeVersionFindUnique
        .mockResolvedValueOnce({
          id: 'kv-1',
          version: 1,
          content: 'Line one\nLine two\nLine three',
        })
        .mockResolvedValueOnce({
          id: 'kv-2',
          version: 2,
          content: 'Line one\nLine four\nLine three\nLine five',
        })

      const diff = await compareVersions('kv-1', 'kv-2')

      expect(diff.contentChanged).toBe(true)
      expect(diff.linesAdded).toBe(2) // "Line four", "Line five"
      expect(diff.linesRemoved).toBe(1) // "Line two"
      expect(diff.summary).toContain('2 lines added')
      expect(diff.summary).toContain('1 line removed')
    })

    it('throws when first version does not exist', async () => {
      mockKnowledgeVersionFindUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ id: 'kv-2', version: 2, content: 'content' })

      await expect(compareVersions('missing-1', 'kv-2')).rejects.toThrow(
        'KnowledgeVersion not found: missing-1',
      )
    })

    it('throws when second version does not exist', async () => {
      mockKnowledgeVersionFindUnique
        .mockResolvedValueOnce({ id: 'kv-1', version: 1, content: 'content' })
        .mockResolvedValueOnce(null)

      await expect(compareVersions('kv-1', 'missing-2')).rejects.toThrow(
        'KnowledgeVersion not found: missing-2',
      )
    })
  })

  // ─── restoreVersion ───────────────────────────────────────

  describe('restoreVersion', () => {
    it('snapshots current state, then restores old content', async () => {
      const targetVersion = {
        id: 'kv-1',
        knowledgeEntryId: 'ke-1',
        version: 1,
        content: 'Old restored content',
      }

      const currentEntry = {
        id: 'ke-1',
        content: 'Current newer content',
        version: 3,
      }

      mockKnowledgeVersionFindUnique.mockResolvedValue(targetVersion)
      mockKnowledgeEntryFindUnique
        .mockResolvedValueOnce(currentEntry) // for entry check in restoreVersion
        .mockResolvedValueOnce(currentEntry) // for createVersionSnapshot call

      mockKnowledgeVersionCreate.mockResolvedValue({
        id: 'kv-pre-restore',
        knowledgeEntryId: 'ke-1',
        version: 3,
        content: 'Current newer content',
        changedFields: '{"content":true}',
        changeReason: 'Restore to v1',
        changedBy: 'user-1',
        createdAt: new Date('2024-06-18'),
      })

      mockKnowledgeEntryUpdate.mockResolvedValue({
        id: 'ke-1',
        content: 'Old restored content',
        previousValue: 'Current newer content',
        version: 4,
      })

      const { entry, version } = await restoreVersion(
        'kv-1',
        'Restore to v1',
        'user-1',
      )

      expect(version.content).toBe('Current newer content')
      expect(entry.content).toBe('Old restored content')
      expect(entry.version).toBe(4)
      expect(mockKnowledgeEntryUpdate).toHaveBeenCalledWith({
        where: { id: 'ke-1' },
        data: expect.objectContaining({
          content: 'Old restored content',
          previousValue: 'Current newer content',
          version: { increment: 1 },
        }),
      })
    })

    it('throws when version does not exist', async () => {
      mockKnowledgeVersionFindUnique.mockResolvedValue(null)

      await expect(restoreVersion('missing', 'reason')).rejects.toThrow(
        'KnowledgeVersion not found: missing',
      )
    })
  })
})