/**
 * Phase 4 — API endpoint tests for new routes
 * Tests for /api/companies/:id/maturity, /temporal, /fusion
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the lib functions before importing the route handlers
vi.mock('@/lib/intelligence-maturity-index', () => ({
  computeIntelligenceMaturityIndex: vi.fn(),
}));

vi.mock('@/lib/intelligence-temporal-tracker', () => ({
  computeTemporalMetrics: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    companySignal: { findMany: vi.fn().mockResolvedValue([]) },
    evidence: { count: vi.fn().mockResolvedValue(0) },
  },
}));

vi.mock('@/lib/api-auth', () => ({
  checkApiAuth: vi.fn().mockResolvedValue({ errorResponse: null }),
}));

import { computeIntelligenceMaturityIndex } from '@/lib/intelligence-maturity-index';
import { computeTemporalMetrics } from '@/lib/intelligence-temporal-tracker';
import { GET as getMaturity } from '@/app/api/companies/[id]/maturity/route';
import { GET as getTemporal } from '@/app/api/companies/[id]/temporal/route';
import { GET as getFusion } from '@/app/api/companies/[id]/fusion/route';

const mockedComputeMaturity = vi.mocked(computeIntelligenceMaturityIndex);
const mockedComputeTemporal = vi.mocked(computeTemporalMetrics);

function createMockRequest(): Request {
  return new Request('http://localhost/api/companies/test-id/maturity', {
    headers: { 'Content-Type': 'application/json' },
  });
}

function createMockParams(id: string) {
  return Promise.resolve({ id });
}

// ── /api/companies/:id/maturity ──

describe('GET /api/companies/:id/maturity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 200 for valid company', async () => {
    const mockResult = {
      score: 72,
      level: 'advanced',
      dimensions: { coverage: { score: 80, weight: 0.3, details: '4/5 dimensions' }, freshness: { score: 65, weight: 0.25, details: 'Relatively fresh' }, quality: { score: 78, weight: 0.25, details: 'Good confidence' }, diversity: { score: 60, weight: 0.2, details: 'Multiple sources' } },
      improvementSuggestions: ['Refresh stale data'],
      computedAt: new Date().toISOString(),
    };
    mockedComputeMaturity.mockResolvedValueOnce(mockResult as any);

    const response = await getMaturity(createMockRequest() as any, { params: createMockParams('company-123') });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.score).toBe(72);
    expect(data.level).toBe('advanced');
    expect(mockedComputeMaturity).toHaveBeenCalledWith('company-123');
  });

  it('should return error for missing company', async () => {
    mockedComputeMaturity.mockRejectedValueOnce(new Error('Company not found'));

    const response = await getMaturity(createMockRequest() as any, { params: createMockParams('nonexistent') });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBeDefined();
  });
});

// ── /api/companies/:id/temporal ──

describe('GET /api/companies/:id/temporal', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 200 for valid company', async () => {
    const mockResult = {
      companyId: 'company-123',
      signalsLast7Days: 3,
      signalsLast30Days: 12,
      signalsPerWeek: 2.8,
      velocityTrend: 'accelerating',
      signalToDecisionLatencyHours: 48,
      medianSignalToDecisionLatencyHours: 36,
      lastIntelligenceUpdate: new Date().toISOString(),
      daysSinceLastUpdate: 1,
      growthTrend: 'growing',
      growthRatePercent: 25,
      computedAt: new Date().toISOString(),
    };
    mockedComputeTemporal.mockResolvedValueOnce(mockResult as any);

    const response = await getTemporal(createMockRequest() as any, { params: createMockParams('company-123') });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.companyId).toBe('company-123');
    expect(data.velocityTrend).toBe('accelerating');
    expect(mockedComputeTemporal).toHaveBeenCalledWith('company-123');
  });
});

// ── /api/companies/:id/fusion ──

describe('GET /api/companies/:id/fusion', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return 200 for valid company', async () => {
    const response = await getFusion(createMockRequest() as any, { params: createMockParams('company-123') });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.companyId).toBe('company-123');
    expect(data.fusionScore).toBeDefined();
    expect(data.grade).toBeDefined();
    expect(data.dimensions).toBeDefined();
  });

  it('should return F grade when no signals exist', async () => {
    const response = await getFusion(createMockRequest() as any, { params: createMockParams('empty-company') });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.grade).toBe('F');
    expect(data.fusionScore).toBe(0);
  });
});
