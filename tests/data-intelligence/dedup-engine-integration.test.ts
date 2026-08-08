/**
 * Integration-style tests for dedup engine DB-dependent functions.
 * Uses mocked Prisma client to test the full flow without a real database.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the db module before importing the engine
vi.mock('@/lib/db', () => ({
  db: {
    company: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    mergeRecord: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      count: vi.fn(),
    },
    contact: {
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    companySignal: {
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    companyNote: {
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    companyTimelineEvent: {
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    evidence: {
      count: vi.fn(),
      updateMany: vi.fn(),
    },
    companyResearchCard: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  childLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
}));

vi.mock('@/lib/audit-logger', () => ({
  audit: vi.fn(),
}));

vi.mock('@/lib/data-intelligence/deduplicator', () => ({
  invalidateDedupCache: vi.fn(),
}));

import { db } from '@/lib/db';

const mockedDb = vi.mocked(db);

describe('Dedup Engine — Integration Tests (Mocked DB)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('scanForDuplicates', () => {
    it('should return empty clusters when no companies exist', async () => {
      mockedDb.company.findMany.mockResolvedValue([]);
      mockedDb.mergeRecord.findMany.mockResolvedValue([]);

      const { scanForDuplicates } = await import('@/lib/data-intelligence/dedup-engine');
      const result = await scanForDuplicates();

      expect(result.totalCompaniesScanned).toBe(0);
      expect(result.clusters).toHaveLength(0);
    });

    it('should detect duplicates by domain', async () => {
      mockedDb.company.findMany.mockResolvedValue([
        {
          id: 'a', rawName: 'Acme Corp', normalizedName: 'acme corp', domain: 'acme.com',
          industry: 'tech', createdAt: new Date(), intelligenceScore: 50, status: 'prospect',
          _count: { contacts: 5, signals: 3, notes: 1 },
        },
        {
          id: 'b', rawName: 'Acme Inc', normalizedName: 'acme inc', domain: 'acme.com',
          industry: 'tech', createdAt: new Date(Date.now() - 86400000), intelligenceScore: 30, status: 'prospect',
          _count: { contacts: 2, signals: 1, notes: 0 },
        },
      ]);
      mockedDb.mergeRecord.findMany.mockResolvedValue([]);

      const { scanForDuplicates } = await import('@/lib/data-intelligence/dedup-engine');
      const result = await scanForDuplicates();

      expect(result.totalCompaniesScanned).toBe(2);
      expect(result.clustersFound).toBeGreaterThanOrEqual(1);
    });

    it('should exclude already-merged pairs', async () => {
      mockedDb.company.findMany.mockResolvedValue([
        {
          id: 'a', rawName: 'Acme Corp', normalizedName: 'acme corp', domain: 'acme.com',
          industry: 'tech', createdAt: new Date(), intelligenceScore: 50, status: 'prospect',
          _count: { contacts: 5, signals: 3, notes: 1 },
        },
        {
          id: 'b', rawName: 'Acme Inc', normalizedName: 'acme inc', domain: 'acme.com',
          industry: 'tech', createdAt: new Date(), intelligenceScore: 30, status: 'prospect',
          _count: { contacts: 2, signals: 1, notes: 0 },
        },
      ]);
      mockedDb.mergeRecord.findMany.mockResolvedValue([
        { survivorId: 'a', duplicateId: 'b' },
      ]);

      const { scanForDuplicates } = await import('@/lib/data-intelligence/dedup-engine');
      const result = await scanForDuplicates();

      expect(result.clustersFound).toBe(0);
    });
  });

  describe('mergeDuplicate', () => {
    it('should be idempotent — skip if already merged', async () => {
      mockedDb.mergeRecord.findFirst.mockResolvedValue({
        id: 'mr1', survivorId: 'survivor', duplicateId: 'duplicate',
      });
      mockedDb.company.findUnique.mockResolvedValue(null as any);

      const { mergeDuplicate } = await import('@/lib/data-intelligence/dedup-engine');
      const result = await mergeDuplicate({
        survivorId: 'survivor',
        duplicateId: 'duplicate',
        strategy: 'keep_survivor',
      });

      expect(result.success).toBe(true);
      expect(result.mergeRecordId).toBe('mr1');
      expect(mockedDb.company.delete).not.toHaveBeenCalled();
    });

    it('should fail if companies not found', async () => {
      mockedDb.mergeRecord.findFirst.mockResolvedValue(null);
      mockedDb.company.findUnique.mockResolvedValueOnce(null as any).mockResolvedValueOnce({ id: 'survivor' } as any);

      const { mergeDuplicate } = await import('@/lib/data-intelligence/dedup-engine');
      const result = await mergeDuplicate({
        survivorId: 'survivor',
        duplicateId: 'nonexistent',
        strategy: 'keep_survivor',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('getMergeHistory', () => {
    it('should handle deleted duplicate company gracefully', async () => {
      mockedDb.mergeRecord.findMany.mockResolvedValue([
        {
          id: 'mr1',
          survivorId: 'a',
          duplicateId: 'b',
          entityType: 'company',
          mergedBy: 'user1',
          mergedAt: new Date(),
          mergeReason: 'manual_merge',
          fieldsKept: { name: 'survivor' },
          survivor: { rawName: 'Survivor Corp' },
          duplicate: null, // Deleted!
        },
      ]);
      mockedDb.mergeRecord.count.mockResolvedValue(1);

      const { getMergeHistory } = await import('@/lib/data-intelligence/dedup-engine');
      const result = await getMergeHistory();

      expect(result.records).toHaveLength(1);
      expect(result.records[0].duplicateName).toBeUndefined(); // Optional chaining returns undefined for null duplicate
      expect(result.records[0].survivorName).toBe('Survivor Corp');
    });
  });
});
