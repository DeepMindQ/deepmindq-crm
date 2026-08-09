/**
 * Phase 4 — Item 7.3: Intelligence Maturity Index Tests
 *
 * Uses actual Prisma schema field names:
 *   CompanySignal: extractedAt, confidence, source
 *   OpportunityRecommendation: createdAt, confidenceScore, opportunityScore
 *   SignalCapabilityMatch: createdAt, matchScore
 *   Contact: createdAt
 *   AccountScore: updatedAt, score
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSignalFindMany = vi.fn();
const mockOpportunityFindMany = vi.fn();
const mockCapMatchFindMany = vi.fn();
const mockContactFindMany = vi.fn();
const mockAccountScoreFindMany = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    companySignal: { findMany: (...a: unknown[]) => mockSignalFindMany(...a) },
    opportunityRecommendation: { findMany: (...a: unknown[]) => mockOpportunityFindMany(...a) },
    signalCapabilityMatch: { findMany: (...a: unknown[]) => mockCapMatchFindMany(...a) },
    contact: { findMany: (...a: unknown[]) => mockContactFindMany(...a) },
    accountScore: { findMany: (...a: unknown[]) => mockAccountScoreFindMany(...a) },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('Intelligence Maturity Index (Phase 4.7.3)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignalFindMany.mockResolvedValue([]);
    mockOpportunityFindMany.mockResolvedValue([]);
    mockCapMatchFindMany.mockResolvedValue([]);
    mockContactFindMany.mockResolvedValue([]);
    mockAccountScoreFindMany.mockResolvedValue([]);
  });

  it('should return emerging level for company with no data', async () => {
    const { computeIntelligenceMaturityIndex } = await import('@/lib/intelligence-maturity-index');
    const result = await computeIntelligenceMaturityIndex('empty-company');
    expect(result.score).toBe(0);
    expect(result.level).toBe('emerging');
  });

  it('should return advanced/mature level for company with rich, fresh, diverse data', async () => {
    const now = new Date();
    mockSignalFindMany.mockResolvedValue([
      { extractedAt: now, confidence: 0.9, source: 'linkedin' },
      { extractedAt: now, confidence: 0.85, source: 'website' },
      { extractedAt: now, confidence: 0.8, source: 'crunchbase' },
      { extractedAt: now, confidence: 0.88, source: 'sec_edgar' },
      { extractedAt: now, confidence: 0.82, source: 'manual' },
      { extractedAt: now, confidence: 0.79, source: 'csv_import' },
    ]);
    mockOpportunityFindMany.mockResolvedValue([
      { createdAt: now, confidenceScore: 0.85, opportunityScore: 85 },
      { createdAt: now, confidenceScore: 0.9, opportunityScore: 90 },
      { createdAt: now, confidenceScore: 0.78, opportunityScore: 78 },
    ]);
    mockCapMatchFindMany.mockResolvedValue([
      { createdAt: now, matchScore: 0.9 },
      { createdAt: now, matchScore: 0.85 },
      { createdAt: now, matchScore: 0.88 },
    ]);
    mockContactFindMany.mockResolvedValue([
      { createdAt: now },
      { createdAt: now },
      { createdAt: now },
      { createdAt: now },
      { createdAt: now },
    ]);
    mockAccountScoreFindMany.mockResolvedValue([
      { updatedAt: now, score: 88 },
    ]);

    const { computeIntelligenceMaturityIndex } = await import('@/lib/intelligence-maturity-index');
    const result = await computeIntelligenceMaturityIndex('rich-company');
    expect(result.score).toBeGreaterThanOrEqual(41);
    expect(result.dimensions).toBeDefined();
    expect(result.dimensions.coverage.score).toBeGreaterThan(0);
    expect(result.dimensions.freshness.score).toBeGreaterThan(0);
    expect(result.dimensions.quality.score).toBeGreaterThan(0);
    expect(result.dimensions.diversity.score).toBeGreaterThan(0);
    expect(result.computedAt).toBeDefined();
  });

  it('should provide improvement suggestions for low-coverage companies', async () => {
    mockSignalFindMany.mockResolvedValue([
      { extractedAt: new Date(), confidence: 0.5, source: 'website' },
    ]);

    const { computeIntelligenceMaturityIndex } = await import('@/lib/intelligence-maturity-index');
    const result = await computeIntelligenceMaturityIndex('sparse-company');
    // 1 signal with 0.5 confidence gives coverage ~40, quality ~50
    expect(['emerging', 'developing', 'established']).toContain(result.level);
    expect(result.improvementSuggestions.length).toBeGreaterThan(0);
  });

  it('should compute freshness based on data recency', async () => {
    const oldDate = new Date('2023-01-01');
    mockSignalFindMany.mockResolvedValue([
      { extractedAt: oldDate, confidence: 0.9, source: 'website' },
    ]);

    const { computeIntelligenceMaturityIndex } = await import('@/lib/intelligence-maturity-index');
    const result = await computeIntelligenceMaturityIndex('stale-company');
    expect(result.dimensions.freshness.score).toBeLessThan(50);
  });
});
