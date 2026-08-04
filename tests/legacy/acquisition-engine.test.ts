import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IConnector } from '../connector-interface'
import type { RawIntelligenceObject } from '../types'

// ─── Mock all dependencies using vi.hoisted ────────────────

const {
  mockResolveCompany,
  mockCreateUnverifiedCompany,
  mockAdaptToEvidence,
  mockCreateKnowledgeEntry,
  mockIntelObjCreate,
  mockIntelObjUpdate,
  mockConnectorRunUpdate,
  mockConnectorUpdate,
} = vi.hoisted(() => ({
  mockResolveCompany: vi.fn(),
  mockCreateUnverifiedCompany: vi.fn(),
  mockAdaptToEvidence: vi.fn(),
  mockCreateKnowledgeEntry: vi.fn(),
  mockIntelObjCreate: vi.fn(),
  mockIntelObjUpdate: vi.fn(),
  mockConnectorRunUpdate: vi.fn(),
  mockConnectorUpdate: vi.fn(),
}))

vi.mock('../company-resolution', () => ({
  resolveCompany: (...args: unknown[]) => mockResolveCompany(...args),
  createUnverifiedCompany: (...args: unknown[]) => mockCreateUnverifiedCompany(...args),
}))

vi.mock('../evidence-adapter', () => ({
  adaptToEvidence: (...args: unknown[]) => mockAdaptToEvidence(...args),
}))

vi.mock('../knowledge-fabric', () => ({
  createKnowledgeEntry: (...args: unknown[]) => mockCreateKnowledgeEntry(...args),
}))

vi.mock('@/lib/db', () => ({
  db: {
    intelligenceObject: {
      create: mockIntelObjCreate,
      update: mockIntelObjUpdate,
    },
    connectorRun: {
      update: mockConnectorRunUpdate,
    },
    connector: {
      update: mockConnectorUpdate,
    },
  },
}))

import {
  processIntelligenceObject,
  processAcquisitionResult,
} from '../acquisition-engine'
import type { AcquisitionContext } from '../acquisition-engine'

// ─── Helpers ─────────────────────────────────────────────────

const mockConnector: IConnector = {
  sourceType: 'csv',
  name: 'CSV File Upload',
  acquire: vi.fn(),
  validateConfig: vi.fn().mockReturnValue({ valid: true, errors: [] }),
  test: vi.fn(),
}

const baseContext: AcquisitionContext = {
  connectorId: 'conn-1',
  connectorRunId: 'run-1',
  connector: mockConnector,
  defaultCategory: 'Strategy',
}

const rawObject: RawIntelligenceObject = {
  companyIdentifier: 'Acme Corp',
  content: 'Revenue: 100M, Industry: Technology',
  summary: 'Acme makes 100M',
  sourceUrl: 'https://example.com/file.csv',
  capturedAt: new Date('2024-06-01'),
  category: 'Products',
  metadata: { rowIndex: 1 },
}

describe('Acquisition Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default: auto-resolved company
    mockResolveCompany.mockResolvedValue({
      resolved: true,
      candidate: {
        companyId: 'co-1',
        name: 'Acme Corp',
        confidence: 0.9,
        matchType: 'exact_name',
      },
      needsNewCompany: false,
    })

    // Default: successful evidence creation
    mockAdaptToEvidence.mockResolvedValue({ success: true, evidenceId: 'ev-1' })

    // Default: successful knowledge entry creation
    mockCreateKnowledgeEntry.mockResolvedValue({ id: 'ke-1' })

    // Default: successful intelligence object creation
    mockIntelObjCreate.mockResolvedValue({ id: 'io-1' })

    // Default: successful updates
    mockIntelObjUpdate.mockResolvedValue({})
    mockConnectorRunUpdate.mockResolvedValue({})
    mockConnectorUpdate.mockResolvedValue({})
  })

  // ─── Auto-resolved company ─────────────────────────────────

  describe('auto-resolved company', () => {
    it('creates IntelligenceObject, KnowledgeEntry, and Evidence', async () => {
      const result = await processIntelligenceObject(rawObject, baseContext)

      expect(result.success).toBe(true)
      expect(result.intelligenceObjectId).toBe('io-1')
      expect(result.knowledgeEntryId).toBe('ke-1')
      expect(result.evidenceId).toBe('ev-1')
      expect(result.companyCreated).toBe(false)
    })

    it('creates IntelligenceObject with correct fields from connector', async () => {
      await processIntelligenceObject(rawObject, baseContext)

      expect(mockIntelObjCreate).toHaveBeenCalledWith({
        data: expect.objectContaining({
          companyId: 'co-1',
          connectorId: 'conn-1',
          connectorRunId: 'run-1',
          sourceType: 'csv',
          sourceName: 'CSV File Upload',
          origin: 'csv_upload',
          content: rawObject.content,
          summary: rawObject.summary,
          sourceUrl: rawObject.sourceUrl,
          originalConfidence: 0.95,
          status: 'processing',
        }),
      })
    })

    it('creates knowledge entry with company and content', async () => {
      await processIntelligenceObject(rawObject, baseContext)

      expect(mockCreateKnowledgeEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          companyId: 'co-1',
          category: 'Products',
          content: rawObject.content,
          confidence: 0.95,
        }),
      )
    })

    it('adapts evidence with intelligence object id', async () => {
      await processIntelligenceObject(rawObject, baseContext)

      expect(mockAdaptToEvidence).toHaveBeenCalledWith(
        expect.objectContaining({
          intelligenceObjectId: 'io-1',
          companyId: 'co-1',
          sourceType: 'csv',
          sourceName: 'CSV File Upload',
        }),
      )
    })

    it('updates intelligence object status to active when evidence succeeds', async () => {
      await processIntelligenceObject(rawObject, baseContext)

      expect(mockIntelObjUpdate).toHaveBeenCalledWith({
        where: { id: 'io-1' },
        data: { status: 'active', evidenceId: 'ev-1' },
      })
    })

    it('increments connectorRun recordsAcquired', async () => {
      await processIntelligenceObject(rawObject, baseContext)

      expect(mockConnectorRunUpdate).toHaveBeenCalledWith({
        where: { id: 'run-1' },
        data: { recordsAcquired: { increment: 1 } },
      })
    })

    it('increments connector recordsAcquired', async () => {
      await processIntelligenceObject(rawObject, baseContext)

      expect(mockConnectorUpdate).toHaveBeenCalledWith({
        where: { id: 'conn-1' },
        data: { recordsAcquired: { increment: 1 } },
      })
    })

    it('uses defaultCategory when rawObject has no category', async () => {
      const rawNoCategory = { ...rawObject, category: undefined }

      await processIntelligenceObject(rawNoCategory, baseContext)

      expect(mockCreateKnowledgeEntry).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'Strategy' }),
      )
    })

    it('falls back to "Strategy" when no category anywhere', async () => {
      const rawNoCategory = { ...rawObject, category: undefined }
      const noCategoryContext: AcquisitionContext = {
        ...baseContext,
        defaultCategory: undefined,
      }

      await processIntelligenceObject(rawNoCategory, noCategoryContext)

      expect(mockCreateKnowledgeEntry).toHaveBeenCalledWith(
        expect.objectContaining({ category: 'Strategy' }),
      )
    })
  })

  // ─── Ambiguous match ───────────────────────────────────────

  describe('ambiguous company match', () => {
    it('returns error with candidate info when resolution is ambiguous', async () => {
      mockResolveCompany.mockResolvedValue({
        resolved: false,
        candidates: [
          { companyId: 'co-a', name: 'Acme Technology', confidence: 0.78, matchType: 'partial_name' as const },
          { companyId: 'co-b', name: 'Acme Financial', confidence: 0.72, matchType: 'partial_name' as const },
        ],
        needsNewCompany: false,
      })

      const result = await processIntelligenceObject(rawObject, baseContext)

      expect(result.success).toBe(false)
      expect(result.error).toContain('Ambiguous company match')
      expect(result.error).toContain('Acme Technology')
      expect(result.error).toContain('Acme Financial')
      expect(result.error).toContain('78%')
      expect(result.error).toContain('72%')
    })

    it('does not create IntelligenceObject when ambiguous', async () => {
      mockResolveCompany.mockResolvedValue({
        resolved: false,
        candidates: [{ companyId: 'co-x', name: 'Acme X', confidence: 0.7, matchType: 'partial_name' as const }],
        needsNewCompany: false,
      })

      await processIntelligenceObject(rawObject, baseContext)

      expect(mockIntelObjCreate).not.toHaveBeenCalled()
    })
  })

  // ─── New company creation ──────────────────────────────────

  describe('new company creation', () => {
    it('creates a new unverified company when needsNewCompany=true', async () => {
      mockResolveCompany.mockResolvedValue({
        resolved: false,
        needsNewCompany: true,
      })
      mockCreateUnverifiedCompany.mockResolvedValue({
        id: 'co-new-1',
        rawName: 'Brand New Startup',
      })

      const result = await processIntelligenceObject(
        { ...rawObject, companyIdentifier: 'Brand New Startup' },
        baseContext,
      )

      expect(result.success).toBe(true)
      expect(result.companyCreated).toBe(true)
      expect(mockCreateUnverifiedCompany).toHaveBeenCalledWith('Brand New Startup')
    })

    it('uses the new company ID for intelligence object creation', async () => {
      mockResolveCompany.mockResolvedValue({
        resolved: false,
        needsNewCompany: true,
      })
      mockCreateUnverifiedCompany.mockResolvedValue({ id: 'co-new-2' })

      await processIntelligenceObject(
        { ...rawObject, companyIdentifier: 'NewCo' },
        baseContext,
      )

      expect(mockIntelObjCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ companyId: 'co-new-2' }),
        }),
      )
    })
  })

  // ─── Evidence adapter failure ──────────────────────────────

  describe('evidence adapter failure', () => {
    it('sets status to pending_evidence_mapping when evidence fails', async () => {
      mockAdaptToEvidence.mockResolvedValue({
        success: false,
        error: 'DB connection lost',
      })

      const result = await processIntelligenceObject(rawObject, baseContext)

      expect(result.success).toBe(true) // pipeline continues
      expect(result.evidenceId).toBeUndefined()
      expect(mockIntelObjUpdate).toHaveBeenCalledWith({
        where: { id: 'io-1' },
        data: { status: 'pending_evidence_mapping' },
      })
    })
  })

  // ─── Knowledge entry failure (non-fatal) ───────────────────

  describe('knowledge entry failure (non-fatal)', () => {
    it('continues pipeline when knowledge entry creation fails', async () => {
      mockCreateKnowledgeEntry.mockRejectedValue(new Error('Invalid category'))

      const result = await processIntelligenceObject(rawObject, baseContext)

      expect(result.success).toBe(true)
      expect(result.knowledgeEntryId).toBeUndefined()
      // Evidence should still be created
      expect(mockAdaptToEvidence).toHaveBeenCalled()
    })

    it('still creates evidence even if knowledge fails', async () => {
      mockCreateKnowledgeEntry.mockRejectedValue(new Error('DB error'))

      await processIntelligenceObject(rawObject, baseContext)

      expect(mockAdaptToEvidence).toHaveBeenCalled()
      expect(mockIntelObjUpdate).toHaveBeenCalledWith({
        where: { id: 'io-1' },
        data: { status: 'active', evidenceId: 'ev-1' },
      })
    })
  })

  // ─── Processing errors ─────────────────────────────────────

  describe('processing errors', () => {
    it('returns error when intelligenceObject.create fails', async () => {
      mockIntelObjCreate.mockRejectedValue(new Error('DB write failed'))

      const result = await processIntelligenceObject(rawObject, baseContext)

      expect(result.success).toBe(false)
      expect(result.error).toBe('DB write failed')
    })
  })

  // ─── processAcquisitionResult (batch) ──────────────────────

  describe('processAcquisitionResult', () => {
    it('processes a batch of intelligence objects', async () => {
      const batchResult = await processAcquisitionResult(
        {
          intelligenceObjects: [
            { ...rawObject, companyIdentifier: 'Acme Corp' },
            { ...rawObject, companyIdentifier: 'Beta Inc' },
          ],
          errors: [],
          metadata: { source: 'csv' },
        },
        baseContext,
      )

      expect(batchResult.outcomes).toHaveLength(2)
      expect(batchResult.successCount).toBe(2)
      expect(batchResult.failCount).toBe(0)
    })

    it('counts successes and failures correctly', async () => {
      // First call succeeds, second returns ambiguous
      mockResolveCompany
        .mockResolvedValueOnce({
          resolved: true,
          candidate: { companyId: 'co-1', name: 'Acme Corp', confidence: 0.9, matchType: 'exact_name' as const },
          needsNewCompany: false,
        })
        .mockResolvedValueOnce({
          resolved: false,
          candidates: [{ companyId: 'co-x', name: 'Similar', confidence: 0.75, matchType: 'partial_name' as const }],
          needsNewCompany: false,
        })

      const batchResult = await processAcquisitionResult(
        {
          intelligenceObjects: [
            { ...rawObject, companyIdentifier: 'Acme Corp' },
            { ...rawObject, companyIdentifier: 'Ambiguous Corp' },
          ],
          errors: ['Some connector error'],
          metadata: { source: 'csv' },
        },
        baseContext,
      )

      expect(batchResult.successCount).toBe(1)
      expect(batchResult.failCount).toBe(1)
      expect(batchResult.totalErrors).toBe(1)
    })

    it('updates run with final counts and metadata', async () => {
      await processAcquisitionResult(
        {
          intelligenceObjects: [rawObject],
          errors: [],
          metadata: { source: 'csv_upload', totalRows: 5 },
        },
        baseContext,
      )

      // Should have been called — once from processIntelligenceObject (increment)
      // and once from processAcquisitionResult (final counts)
      expect(mockConnectorRunUpdate).toHaveBeenCalledTimes(2)

      // The second call (from processAcquisitionResult) should set final counts
      const finalCall = mockConnectorRunUpdate.mock.calls[1]
      expect(finalCall[0]).toEqual({
        where: { id: 'run-1' },
        data: expect.objectContaining({
          recordsAcquired: 1,
          errorsCount: 0,
          metadata: JSON.stringify({ source: 'csv_upload', totalRows: 5 }),
        }),
      })
    })
  })
})