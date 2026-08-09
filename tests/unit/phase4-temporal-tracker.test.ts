/**
 * Phase 4 — Item 7.4: Temporal Intelligence Tracking Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSignalFindMany = vi.fn();
const mockOpportunityFindMany = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    companySignal: { findMany: (...a: unknown[]) => mockSignalFindMany(...a) },
    opportunityRecommendation: { findMany: (...a: unknown[]) => mockOpportunityFindMany(...a) },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

describe('Temporal Intelligence Tracking (Phase 4.7.4)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSignalFindMany.mockResolvedValue([]);
    mockOpportunityFindMany.mockResolvedValue([]);
  });

  it('should return zero metrics for company with no intelligence', async () => {
    const { computeTemporalMetrics } = await import('@/lib/intelligence-temporal-tracker');
    const result = await computeTemporalMetrics('empty-company');
    expect(result.companyId).toBe('empty-company');
    expect(result.signalsLast7Days).toBe(0);
    expect(result.signalsLast30Days).toBe(0);
    expect(result.signalsPerWeek).toBe(0);
    expect(result.velocityTrend).toBe('stable');
    expect(result.growthTrend).toBe('stable');
    expect(result.signalToDecisionLatencyHours).toBeNull();
    expect(result.computedAt).toBeDefined();
  });

  it('should compute velocity metrics from recent signals', async () => {
    const now = new Date();
    // Use extractedAt (actual Prisma field name for CompanySignal)
    mockSignalFindMany.mockResolvedValue([
      { extractedAt: now },
      { extractedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000) },
      { extractedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) },
      { extractedAt: new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000) },
      { extractedAt: new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000) },
    ]);
    mockOpportunityFindMany.mockResolvedValue([
      { createdAt: now },
    ]);

    const { computeTemporalMetrics } = await import('@/lib/intelligence-temporal-tracker');
    const result = await computeTemporalMetrics('active-company');
    expect(result.signalsLast7Days).toBe(3); // 0, 2, 5 days ago
    expect(result.signalsLast30Days).toBe(4); // 0, 2, 5, 15 days ago
    expect(result.signalsPerWeek).toBeGreaterThan(0);
    expect(result.lastIntelligenceUpdate).toBeDefined();
    expect(result.daysSinceLastUpdate).toBe(0);
  });

  it('should detect accelerating velocity trend', async () => {
    const now = new Date();
    mockSignalFindMany.mockResolvedValue([
      { extractedAt: now },
      { extractedAt: now },
      { extractedAt: now },
      { extractedAt: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) },
      { extractedAt: new Date(now.getTime() - 20 * 24 * 60 * 60 * 1000) },
    ]);

    const { computeTemporalMetrics } = await import('@/lib/intelligence-temporal-tracker');
    const result = await computeTemporalMetrics('accelerating-company');
    // 3 in last 7d vs 0 in previous 7d → accelerating
    expect(result.velocityTrend).toBe('accelerating');
  });

  it('should compute signal-to-decision latency', async () => {
    const signalTime = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
    const oppTime = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000); // 1 day ago

    mockSignalFindMany.mockResolvedValue([
      { extractedAt: signalTime },
    ]);
    mockOpportunityFindMany.mockResolvedValue([
      { createdAt: oppTime },
    ]);

    const { computeTemporalMetrics } = await import('@/lib/intelligence-temporal-tracker');
    const result = await computeTemporalMetrics('latency-company');
    expect(result.signalToDecisionLatencyHours).not.toBeNull();
    // Signal was 3 days ago, opp was 1 day ago → ~48 hours latency
    expect(result.signalToDecisionLatencyHours!).toBeGreaterThan(40);
    expect(result.signalToDecisionLatencyHours!).toBeLessThan(56);
  });

  it('should compute growth trend from signal history', async () => {
    const now = new Date();
    mockSignalFindMany.mockResolvedValue([
      { extractedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000) },
      { extractedAt: new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000) },
      { extractedAt: new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000) },
      { extractedAt: new Date(now.getTime() - 25 * 24 * 60 * 60 * 1000) },
      { extractedAt: new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000) },
    ]);

    const { computeTemporalMetrics } = await import('@/lib/intelligence-temporal-tracker');
    const result = await computeTemporalMetrics('growth-company');
    expect(result.growthTrend).toBeDefined();
    expect(['growing', 'stable', 'declining']).toContain(result.growthTrend);
    expect(result.growthRatePercent).toBeDefined();
  });
});
