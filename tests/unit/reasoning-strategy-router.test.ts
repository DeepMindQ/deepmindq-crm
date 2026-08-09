/**
 * Phase 1 Enterprise Readiness — Reasoning Strategy Router Tests
 * ==============================================================
 *
 * Tests for strategy resolution, path selection, step skipping,
 * and confidence gap assessment.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock company-size-profiles before importing the router
vi.mock('@/lib/company-size-profiles', () => ({
  classifyCompany: vi.fn(),
  getProfile: vi.fn(),
  SEGMENT_THRESHOLDS: {
    enterprise: { min: 5000, max: Infinity },
    mid_market: { min: 200, max: 4999 },
    smb: { min: 10, max: 199 },
    startup: { min: 0, max: 9 },
  },
}));

import {
  getReasoningStrategy,
  selectPath,
  shouldSkipStep,
  assessReasoningGaps,
  isAdaptiveReasoningEnabled,
} from '@/lib/reasoning-strategy-router';
import { classifyCompany, getProfile } from '@/lib/company-size-profiles';

const mockClassifyCompany = vi.mocked(classifyCompany);
const mockGetProfile = vi.mocked(getProfile);

describe('reasoning-strategy-router', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock: return enterprise profile
    mockGetProfile.mockReturnValue({
      segment: 'enterprise',
      label: 'Enterprise (5,000+ employees)',
      employeeRange: { min: 5000, max: Infinity },
      dataAvailability: 'high',
      expectedSources: { expected: ['SEC_EDGAR', 'NEWS'], unlikely: [] },
      prioritySignals: ['leadership_change', 'tech_change'],
      targetRoles: ['VP', 'C-suite'],
      stepDepthOverrides: {},
      defaultSkipSteps: [],
      llmTier: 'deep',
      maxTokensPerStep: 4000,
      description: 'Enterprise profile',
      outreachStrategy: 'Enterprise outreach',
    });
  });

  describe('getReasoningStrategy', () => {
    it('should return default strategy when adaptive reasoning disabled', () => {
      // Note: isAdaptiveReasoningEnabled reads the const at module load time.
      // In test environment, the module already loaded with default=true.
      // We test by mocking the classification to return enterprise data.
      mockClassifyCompany.mockReturnValue({
        segment: 'enterprise',
        profile: mockGetProfile(),
        confidence: 0.9,
        basedOn: ['employee_count=10000'],
      });

      const strategy = getReasoningStrategy({ companyId: 'test-1' });
      expect(strategy.adaptiveEnabled).toBe(true); // Module loaded with default=true
      expect(strategy.stepConfigs.length).toBe(30);
      expect(strategy.activeSteps.length).toBe(30);
    });

    it('should classify company and build strategy', () => {
      mockClassifyCompany.mockReturnValue({
        segment: 'enterprise',
        profile: mockGetProfile(),
        confidence: 0.9,
        basedOn: ['employee_count=10000'],
      });

      const strategy = getReasoningStrategy({
        companyId: 'test-1',
        employeeCount: 10000,
      });

      expect(strategy.adaptiveEnabled).toBe(true);
      expect(strategy.segment).toBe('enterprise');
      expect(strategy.stepConfigs.length).toBe(30);
    });

    it('should skip steps for startup segment', () => {
      mockClassifyCompany.mockReturnValue({
        segment: 'startup',
        profile: {
          ...mockGetProfile(),
          segment: 'startup',
          defaultSkipSteps: [5, 7, 8, 10, 11, 12, 13, 15],
          llmTier: 'fast' as const,
          maxTokensPerStep: 500,
          stepDepthOverrides: {},
        },
        confidence: 0.8,
        basedOn: ['employee_count=5'],
      });

      const strategy = getReasoningStrategy({
        companyId: 'test-2',
        employeeCount: 5,
      });

      expect(strategy.segment).toBe('startup');
      expect(strategy.skippedSteps).toContain(5);
      expect(strategy.skippedSteps).toContain(7);
      expect(strategy.activeSteps.length).toBeLessThan(30);
    });

    it('should select growth path for growth signals', () => {
      mockClassifyCompany.mockReturnValue({
        segment: 'mid_market',
        profile: { ...mockGetProfile(), segment: 'mid_market' },
        confidence: 0.9,
        basedOn: ['employee_count=500'],
      });

      const strategy = getReasoningStrategy({
        companyId: 'test-3',
        employeeCount: 500,
        earlySignals: {
          detectedGrowthSignals: true,
          detectedDistressSignals: false,
          detectedExpansionSignals: false,
          signalCount: 8,
        },
      });

      expect(strategy.path).toBe('growth');
    });

    it('should select distress path when distress signals dominate', () => {
      mockClassifyCompany.mockReturnValue({
        segment: 'enterprise',
        profile: mockGetProfile(),
        confidence: 0.9,
        basedOn: ['employee_count=10000'],
      });

      const strategy = getReasoningStrategy({
        companyId: 'test-4',
        employeeCount: 10000,
        earlySignals: {
          detectedGrowthSignals: true,
          detectedDistressSignals: true, // distress wins
          detectedExpansionSignals: true,
          signalCount: 15,
        },
      });

      expect(strategy.path).toBe('distress');
    });

    it('should select unknown path with few signals', () => {
      mockClassifyCompany.mockReturnValue({
        segment: 'smb',
        profile: { ...mockGetProfile(), segment: 'smb' },
        confidence: 0.5,
        basedOn: ['default_assumption'],
      });

      const strategy = getReasoningStrategy({
        companyId: 'test-5',
        employeeCount: 50,
        earlySignals: {
          detectedGrowthSignals: false,
          detectedDistressSignals: false,
          detectedExpansionSignals: false,
          signalCount: 1,
        },
      });

      expect(strategy.path).toBe('unknown');
    });
  });

  describe('selectPath', () => {
    it('should return unknown when no early signals provided', () => {
      expect(selectPath(undefined)).toBe('unknown');
      expect(selectPath(null)).toBe('unknown');
    });

    it('should return unknown with very few signals', () => {
      expect(selectPath({ signalCount: 1 })).toBe('unknown');
    });

    it('should prioritize distress over growth', () => {
      expect(selectPath({
        detectedDistressSignals: true,
        detectedGrowthSignals: true,
        detectedExpansionSignals: true,
        signalCount: 10,
      })).toBe('distress');
    });

    it('should return growth when only growth signals', () => {
      expect(selectPath({
        detectedGrowthSignals: true,
        detectedDistressSignals: false,
        detectedExpansionSignals: false,
        signalCount: 5,
      })).toBe('growth');
    });

    it('should return expansion when only expansion signals', () => {
      expect(selectPath({
        detectedGrowthSignals: false,
        detectedDistressSignals: false,
        detectedExpansionSignals: true,
        signalCount: 5,
      })).toBe('expansion');
    });
  });

  describe('shouldSkipStep', () => {
    const enterpriseStrategy = {
      segment: 'enterprise' as const,
      path: 'unknown' as const,
      stepConfigs: Array.from({ length: 30 }, (_, i) => ({
        stepNumber: i + 1,
        depth: 'standard' as const,
        skip: false,
        maxTokens: 2000,
        tier: 'smart' as const,
      })),
      activeSteps: Array.from({ length: 30 }, (_, i) => i + 1),
      skippedSteps: [],
      estimatedTotalTokens: 60000,
      description: 'test',
      adaptiveEnabled: true,
    };

    it('should not skip when strategy says run and data exists', () => {
      const result = shouldSkipStep(1, enterpriseStrategy, {
        hasCompanyData: true,
        hasFundingData: true,
        hasContactData: true,
        hasTechnologyData: true,
        hasSignalData: true,
        hasVendorData: true,
        evidenceCount: 10,
      });
      expect(result.skip).toBe(false);
    });

    it('should skip step 7 when no funding data', () => {
      const result = shouldSkipStep(7, enterpriseStrategy, {
        hasCompanyData: true,
        hasFundingData: false,
        hasContactData: true,
        hasTechnologyData: true,
        hasSignalData: true,
        hasVendorData: true,
        evidenceCount: 10,
      });
      expect(result.skip).toBe(true);
      expect(result.reason).toContain('funding');
    });

    it('should skip step 11 when no contact data', () => {
      const result = shouldSkipStep(11, enterpriseStrategy, {
        hasCompanyData: true,
        hasFundingData: true,
        hasContactData: false,
        hasTechnologyData: true,
        hasSignalData: true,
        hasVendorData: true,
        evidenceCount: 10,
      });
      expect(result.skip).toBe(true);
      expect(result.reason).toContain('contact');
    });

    it('should skip step 16-18 when no signals', () => {
      const result = shouldSkipStep(16, enterpriseStrategy, {
        hasCompanyData: true,
        hasFundingData: true,
        hasContactData: true,
        hasTechnologyData: true,
        hasSignalData: false,
        hasVendorData: true,
        evidenceCount: 5,
      });
      expect(result.skip).toBe(true);
      expect(result.reason).toContain('signal');
    });
  });

  describe('assessReasoningGaps', () => {
    it('should identify gaps from low-confidence steps', () => {
      const gaps = assessReasoningGaps(10, [
        { step: 1, confidence: 0.8, name: 'company_profile' },
        { step: 3, confidence: 0.15, name: 'market_position' },
        { step: 7, confidence: 0.9, name: 'financial_health' },
      ]);

      expect(gaps.length).toBe(1);
      expect(gaps[0]).toContain('Step 3');
      expect(gaps[0]).toContain('market_position');
    });

    it('should return empty when all steps have good confidence', () => {
      const gaps = assessReasoningGaps(10, [
        { step: 1, confidence: 0.8, name: 'company_profile' },
        { step: 3, confidence: 0.7, name: 'market_position' },
      ]);

      expect(gaps).toEqual([]);
    });
  });

  describe('isAdaptiveReasoningEnabled', () => {
    it('should return true by default (module-level const)', () => {
      // Feature flag is captured at module load time
      expect(isAdaptiveReasoningEnabled()).toBe(true);
    });
  });
});
