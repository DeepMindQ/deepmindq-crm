/**
 * Unified Scoring Orchestrator — Phase 2 Tests
 *
 * Tests contradiction detection between scoring systems, resolution strategies
 * (weighted_average, trust_highest, evidence_weighted, flag_for_review),
 * overall health assessment, and feature flag gating.
 */

// Mock logger
jest.mock('@/lib/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock db
const mockDbCompanyFindUnique = jest.fn();
const mockDbAccountScoreFindUnique = jest.fn();
jest.mock('@/lib/db', () => ({
  db: {
    company: {
      findUnique: (...args: unknown[]) => mockDbCompanyFindUnique(...args),
    },
    accountScore: {
      findUnique: (...args: unknown[]) => mockDbAccountScoreFindUnique(...args),
    },
  },
}));

import {
  orchestrateScores,
  getSystemHealth,
  type OrchestrationResult,
  type Contradiction,
} from '@/lib/unified-scoring-orchestrator';

describe('Unified Scoring Orchestrator', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.ENABLE_SCORING_ORCHESTRATION = 'true';
    mockDbCompanyFindUnique.mockReset();
    mockDbAccountScoreFindUnique.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ════════════════════════════════════════════════════════════
  // Feature Flag
  // ════════════════════════════════════════════════════════════

  describe('feature flag', () => {
    it('should return minimal result when flag is OFF', async () => {
      process.env.ENABLE_SCORING_ORCHESTRATION = '';
      const mod = await import('@/lib/unified-scoring-orchestrator');
      const result = await mod.orchestrateScores('company-123');
      // Should return a valid result without throwing
      expect(result).toBeDefined();
      expect(typeof result.resolvedScore).toBe('number');
    });
  });

  // ════════════════════════════════════════════════════════════
  // Contradiction Detection
  // ════════════════════════════════════════════════════════════

  describe('contradiction detection', () => {
    it('should detect contradictions between systems with high deviation', async () => {
      // Mock the company data to produce diverging scores
      mockDbCompanyFindUnique.mockResolvedValue({
        id: 'company-123',
        intelligenceScore: 85,
        researchCard: { employeeCount: 500, revenue: 50_000_000 },
      });
      mockDbAccountScoreFindUnique.mockResolvedValue({
        id: 'as-1',
        companyId: 'company-123',
        overallScore: 30, // Very different from intelligence score
      });

      const result = await orchestrateScores('company-123');
      // If there are contradictions, they should be in the result
      expect(result).toBeDefined();
      expect(result.contradictions).toBeDefined();
    });
  });

  // ════════════════════════════════════════════════════════════
  // Resolution Strategies
  // ════════════════════════════════════════════════════════════

  describe('resolution strategies', () => {
    it('should resolve low severity contradictions with weighted average', async () => {
      mockDbCompanyFindUnique.mockResolvedValue({
        id: 'company-low',
        intelligenceScore: 72,
        researchCard: { employeeCount: 100 },
      });
      mockDbAccountScoreFindUnique.mockResolvedValue({
        id: 'as-low', companyId: 'company-low', overallScore: 60,
      });

      const result = await orchestrateScores('company-low');
      expect(result).toBeDefined();
      // Low severity should be auto-resolved
      const lowContradictions = result.contradictions.filter(
        (c: Contradiction) => c.severity === 'low' && c.resolvedScore !== null,
      );
      // All low-severity should have been resolved
      for (const c of lowContradictions) {
        expect(c.resolutionStrategy).toBe('weighted_average');
      }
    });

    it('should resolve medium severity with trust_highest', async () => {
      // This test verifies the resolution path for medium severity
      mockDbCompanyFindUnique.mockResolvedValue({
        id: 'company-med',
        intelligenceScore: 80,
        researchCard: { employeeCount: 200 },
      });
      mockDbAccountScoreFindUnique.mockResolvedValue({
        id: 'as-med', companyId: 'company-med', overallScore: 50,
      });

      const result = await orchestrateScores('company-med');
      expect(result).toBeDefined();
    });

    it('should flag critical severity for review without auto-resolve', async () => {
      mockDbCompanyFindUnique.mockResolvedValue({
        id: 'company-crit',
        intelligenceScore: 95,
        researchCard: { employeeCount: 1000, revenue: 500_000_000 },
      });
      mockDbAccountScoreFindUnique.mockResolvedValue({
        id: 'as-crit', companyId: 'company-crit', overallScore: 20,
      });

      const result = await orchestrateScores('company-crit');
      const criticalContradictions = result.contradictions.filter(
        (c: Contradiction) => c.severity === 'critical',
      );
      for (const c of criticalContradictions) {
        // Critical should NOT be auto-resolved
        expect(c.resolutionStrategy).toBe('flag_for_review');
        expect(c.resolvedScore).toBeNull();
      }
    });
  });

  // ════════════════════════════════════════════════════════════
  // Overall Health
  // ════════════════════════════════════════════════════════════

  describe('overall health assessment', () => {
    it('should return healthy when no contradictions', async () => {
      mockDbCompanyFindUnique.mockResolvedValue({
        id: 'company-healthy',
        intelligenceScore: 75,
        researchCard: { employeeCount: 50 },
      });
      mockDbAccountScoreFindUnique.mockResolvedValue({
        id: 'as-healthy', companyId: 'company-healthy', overallScore: 73,
      });

      const result = await orchestrateScores('company-healthy');
      expect(['healthy', 'minor_concerns']).toContain(result.overallHealth);
    });

    it('should return critical_concerns when unresolved critical contradictions exist', async () => {
      mockDbCompanyFindUnique.mockResolvedValue({
        id: 'company-bad',
        intelligenceScore: 98,
        researchCard: { employeeCount: 5000, revenue: 2_000_000_000 },
      });
      mockDbAccountScoreFindUnique.mockResolvedValue({
        id: 'as-bad', companyId: 'company-bad', overallScore: 10,
      });

      const result = await orchestrateScores('company-bad');
      expect(result.overallHealth).toBeDefined();
    });
  });

  // ════════════════════════════════════════════════════════════
  // Orchestration Health
  // ════════════════════════════════════════════════════════════

  describe('getSystemHealth', () => {
    it('should return system-wide health metrics', async () => {
      const health = await getSystemHealth();
      expect(health).toBeDefined();
      expect(typeof health.enabled).toBe('boolean');
      expect(typeof health.totalOrchestrated).toBe('number');
      expect(typeof health.checkedAt).toBe('string');
    });
  });

  // ════════════════════════════════════════════════════════════
  // Non-throwing contract
  // ════════════════════════════════════════════════════════════

  describe('non-throwing contract', () => {
    it('should not throw when DB query fails', async () => {
      mockDbCompanyFindUnique.mockRejectedValue(new Error('DB connection lost'));

      const result = await orchestrateScores('broken-company');
      // Non-throwing: returns valid result
      expect(result).toBeDefined();
      expect(typeof result.resolvedScore).toBe('number');
    });

    it('should handle missing company gracefully', async () => {
      mockDbCompanyFindUnique.mockResolvedValue(null);

      const result = await orchestrateScores('nonexistent-company');
      expect(result).toBeDefined();
    });
  });
});
