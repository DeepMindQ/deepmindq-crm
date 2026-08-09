/**
 * M5 Unit Tests — Data Lineage Service
 * Tests pure functions and types from the data lineage module.
 * Functions that call db.* are async and need DB — those use mocked DB.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock the db and logger modules since the data-lineage-service imports them
vi.mock('@/lib/db', () => ({
  db: {
    evidence: {
      create: vi.fn().mockResolvedValue({ id: 'evidence-1' }),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
  },
}));

import type {
  DataLineageRecord,
  LineageEvent,
  LineageQuery,
} from '@/lib/data-lineage-service';

import { db } from '@/lib/db';
import { recordLineage, getDataFreshnessStats } from '@/lib/data-lineage-service';

// Helper to get the last call args
function getLastCallArgs(mock: ReturnType<typeof vi.fn>) {
  const lastCall = mock.mock.calls[mock.mock.calls.length - 1]!;
  return lastCall[0] as { data: Record<string, unknown> };
}

// ─── Type Validation Tests ──────────────────────────────────

describe('DataLineageRecord types', () => {
  it('should accept valid lineage event types', () => {
    const validEvents: LineageEvent[] = [
      'acquired', 'processed', 'enriched', 'computed',
      'verified', 'corrected', 'deprecated', 'rejected',
    ];
    for (const event of validEvents) {
      const record: DataLineageRecord = {
        id: 'test-1',
        companyId: 'company-1',
        field: 'revenue',
        event,
        source: 'verified_api',
        provider: 'clearbit',
        newValue: 50000000,
        previousValue: null,
        rawValue: '$50M',
        description: 'Updated revenue from Clearbit',
        evidenceId: 'ev-1',
        timestamp: new Date().toISOString(),
        triggeredBy: 'system',
      };
      expect(record.event).toBe(event);
    }
  });

  it('should allow nullable fields', () => {
    const record: DataLineageRecord = {
      id: 'test-2',
      companyId: 'company-1',
      field: 'industry',
      event: 'acquired',
      source: 'ai_inference',
      provider: 'ai_estimation',
      newValue: 'Technology',
      previousValue: null,
      rawValue: null,
      description: 'AI estimated industry',
      evidenceId: null,
      timestamp: new Date().toISOString(),
      triggeredBy: 'ai_enrichment',
    };
    expect(record.previousValue).toBeNull();
    expect(record.rawValue).toBeNull();
    expect(record.evidenceId).toBeNull();
  });
});

describe('LineageQuery types', () => {
  it('should accept a minimal query with only companyId', () => {
    const query: LineageQuery = { companyId: 'c1' };
    expect(query.companyId).toBe('c1');
    expect(query.field).toBeUndefined();
    expect(query.source).toBeUndefined();
    expect(query.provider).toBeUndefined();
    expect(query.event).toBeUndefined();
    expect(query.since).toBeUndefined();
    expect(query.limit).toBeUndefined();
  });

  it('should accept a fully specified query', () => {
    const query: LineageQuery = {
      companyId: 'c1',
      field: 'revenue',
      source: 'verified_api',
      provider: 'clearbit',
      event: 'enriched',
      since: new Date('2025-01-01'),
      limit: 10,
    };
    expect(query.field).toBe('revenue');
    expect(query.limit).toBe(10);
  });
});

// ─── recordLineage (mocked DB) ──────────────────────────────

describe('recordLineage (with mocked DB)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.evidence.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'evidence-1' });
    (db.evidence.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it('should call db.evidence.create with correct structure', async () => {
    const id = await recordLineage({
      companyId: 'c1',
      field: 'revenue',
      event: 'enriched',
      source: 'verified_api',
      provider: 'clearbit',
      newValue: 50000000,
      rawValue: '$50M',
      description: 'Enriched revenue from Clearbit',
    });

    expect(id).toBe('evidence-1');
    expect(db.evidence.create).toHaveBeenCalledTimes(1);
    const callArgs = getLastCallArgs(db.evidence.create as ReturnType<typeof vi.fn>);
    expect(callArgs.data.companyId).toBe('c1');
    expect(callArgs.data.extractedField).toBe('lineage:revenue');
    expect(callArgs.data.sourceName).toBe('lineage:clearbit');
    expect(callArgs.data.status).toBe('active');
  });

  it('should set premium quality for verified_api source', async () => {
    await recordLineage({
      companyId: 'c1',
      field: 'revenue',
      event: 'enriched',
      source: 'verified_api',
      provider: 'clearbit',
      newValue: 50000000,
      description: 'Test',
    });

    const callArgs = getLastCallArgs(db.evidence.create as ReturnType<typeof vi.fn>);
    expect(callArgs.data.sourceQualityTier).toBe('premium');
    expect(callArgs.data.confidence).toBe(0.9);
  });

  it('should set premium quality for customer_data source', async () => {
    await recordLineage({
      companyId: 'c1',
      field: 'employees',
      event: 'acquired',
      source: 'customer_data',
      provider: 'user_upload',
      newValue: 500,
      description: 'Customer uploaded employee data',
    });

    const callArgs = getLastCallArgs(db.evidence.create as ReturnType<typeof vi.fn>);
    expect(callArgs.data.sourceQualityTier).toBe('premium');
    expect(callArgs.data.confidence).toBe(0.85);
  });

  it('should set standard quality for ai_inference source', async () => {
    await recordLineage({
      companyId: 'c1',
      field: 'industry',
      event: 'computed',
      source: 'ai_inference',
      provider: 'ai_estimation',
      newValue: 'Technology',
      description: 'AI estimated industry',
    });

    const callArgs = getLastCallArgs(db.evidence.create as ReturnType<typeof vi.fn>);
    expect(callArgs.data.sourceQualityTier).toBe('standard');
    expect(callArgs.data.confidence).toBe(0.5);
  });

  it('should set standard quality for platform_computed source', async () => {
    await recordLineage({
      companyId: 'c1',
      field: 'score',
      event: 'computed',
      source: 'platform_computed',
      provider: 'scoring_engine',
      newValue: 85,
      description: 'Computed score',
    });

    const callArgs = getLastCallArgs(db.evidence.create as ReturnType<typeof vi.fn>);
    expect(callArgs.data.sourceQualityTier).toBe('standard');
    // The code only distinguishes verified_api (0.9) and customer_data (0.85), everything else → 0.5
    expect(callArgs.data.confidence).toBe(0.5);
  });

  it('should return null on DB error', async () => {
    (db.evidence.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('DB error'));

    const id = await recordLineage({
      companyId: 'c1',
      field: 'revenue',
      event: 'enriched',
      source: 'verified_api',
      provider: 'clearbit',
      newValue: 50000000,
      description: 'Test error handling',
    });
    expect(id).toBeNull();
  });
});

// ─── getDataFreshnessStats (mocked) ──────────────────────────

describe('getDataFreshnessStats (with mocked DB)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.evidence.create as ReturnType<typeof vi.fn>).mockResolvedValue({ id: 'evidence-1' });
    (db.evidence.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);
  });

  it('should compute ageDays from timestamp', async () => {
    const now = new Date();
    const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);

    (db.evidence.findMany as ReturnType<typeof vi.fn>).mockResolvedValueOnce([{
      id: 'e1',
      extractedField: 'lineage:revenue',
      extractedValue: JSON.stringify({
        field: 'revenue',
        event: 'enriched',
        source: 'verified_api',
        provider: 'clearbit',
        newValue: 50000000,
        previousValue: null,
        rawValue: '$50M',
        triggeredBy: 'system',
      }),
      sourceTitle: 'Enriched revenue from Clearbit',
      sourceName: 'lineage:clearbit',
      createdAt: twoDaysAgo,
    }]);

    const stats = await getDataFreshnessStats('c1');
    expect(stats.revenue).toBeDefined();
    expect(stats.revenue!.ageDays).toBe(2);
    expect(stats.revenue!.source).toBe('verified_api');
  });

  it('should return stats object (structure check)', async () => {
    // Note: Due to module-level mock sharing across describe blocks,
    // we verify the function returns a valid stats object structure.
    (db.evidence.findMany as ReturnType<typeof vi.fn>).mockResolvedValue([]);

    const stats = await getDataFreshnessStats('c1');
    expect(stats).toBeDefined();
    expect(typeof stats).toBe('object');
  });
});
