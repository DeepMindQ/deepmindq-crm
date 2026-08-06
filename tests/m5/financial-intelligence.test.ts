/**
 * M5 Phase 3 — Financial Intelligence Framework Unit Tests
 *
 * Tests financial data classification, priority merging, display formatting,
 * and profile computation. All pure computation — no database access.
 */

import { describe, it, expect } from 'vitest';
import {
  computeFinancialProfile,
  buildFieldConfidence,
  formatFinancialForDisplay,
  verifiedFinancialData,
  customerFinancialData,
  estimatedFinancialData,
  signalFinancialData,
  unknownFinancialData,
  type FinancialDataPoint,
  type CompanyFinancialProfile,
  type FinancialDataSource,
} from '@/lib/financial-intelligence-framework';

// ─── Financial Data Builders ──────────────────────────────────

describe('Financial Data Builders', () => {
  describe('verifiedFinancialData', () => {
    it('should create verified data point with correct TRUST', () => {
      const point = verifiedFinancialData('revenue', 1_200_000_000, '$1.2B', 'clearbit');
      expect(point.type).toBe('revenue');
      expect(point.numericValue).toBe(1_200_000_000);
      expect(point.displayValue).toBe('$1.2B');
      expect(point.source).toBe('known_verified');
      expect(point.provider).toBe('clearbit');
      expect(point.trust.source).toBe('verified_api');
      expect(point.trust.confidence).toBe('high');
    });

    it('should set rangeUpper/rangeLower to numericValue', () => {
      const point = verifiedFinancialData('employees', 5000, '5,000', 'clearbit');
      expect(point.rangeUpper).toBe(5000);
      expect(point.rangeLower).toBe(5000);
    });
  });

  describe('customerFinancialData', () => {
    it('should create customer data point', () => {
      const point = customerFinancialData('revenue', 50_000_000, '$50M');
      expect(point.source).toBe('known_customer');
      expect(point.provider).toBe('customer');
      expect(point.trust.source).toBe('customer_data');
    });
  });

  describe('estimatedFinancialData', () => {
    it('should create estimated data point with low confidence', () => {
      const point = estimatedFinancialData('revenue', '$10M-$50M', 'AI estimate');
      expect(point.source).toBe('estimated_ai');
      expect(point.numericValue).toBeNull(); // Estimates are never precise
      expect(point.trust.confidence).toBe('low');
      expect(point.trust.source).toBe('ai_inference');
    });
  });

  describe('signalFinancialData', () => {
    it('should create signal-based data point', () => {
      const point = signalFinancialData('growth_rate', '~25%', 'Job postings up', 4, 20, 30);
      expect(point.source).toBe('estimated_signal');
      expect(point.rangeLower).toBe(20);
      expect(point.rangeUpper).toBe(30);
    });

    it('should have low confidence with < 3 evidence items', () => {
      const point = signalFinancialData('growth_rate', '~25%', 'Weak signals', 2);
      expect(point.trust.confidence).toBe('low');
    });

    it('should have medium confidence with >= 3 evidence items', () => {
      const point = signalFinancialData('growth_rate', '~25%', 'Strong signals', 5);
      expect(point.trust.confidence).toBe('medium');
    });
  });

  describe('unknownFinancialData', () => {
    it('should create unknown data point', () => {
      const point = unknownFinancialData('revenue');
      expect(point.source).toBe('unknown');
      expect(point.numericValue).toBeNull();
      expect(point.displayValue).toBe('Unknown');
    });
  });
});

// ─── Display Formatting ───────────────────────────────────────

describe('formatFinancialForDisplay', () => {
  it('should return "Unknown" for unknown data', () => {
    const point = unknownFinancialData('revenue');
    expect(formatFinancialForDisplay(point)).toBe('Unknown');
  });

  it('should show verified checkmark for high confidence', () => {
    const point = verifiedFinancialData('revenue', 1_200_000_000, '$1.2B', 'clearbit');
    const display = formatFinancialForDisplay(point);
    expect(display).toContain('$1.2B');
    expect(display).toContain('✓');
    expect(display).toContain('Verified: clearbit');
  });

  it('should show question mark for low confidence estimates', () => {
    const point = estimatedFinancialData('revenue', '$10M-$50M', 'AI estimate');
    const display = formatFinancialForDisplay(point);
    expect(display).toContain('$10M-$50M');
    expect(display).toContain('?');
    expect(display).toContain('Estimated');
  });

  it('should show tilde for medium confidence', () => {
    const point = signalFinancialData('growth_rate', '~25%', 'Signals', 3);
    const display = formatFinancialForDisplay(point);
    expect(display).toContain('~');
  });
});

// ─── Financial Profile Computation ────────────────────────────

describe('computeFinancialProfile', () => {
  const baseParams = {
    companyId: 'comp_123',
    companyName: 'Test Corp',
  };

  it('should prioritize Clearbit data over AI estimates', () => {
    const profile = computeFinancialProfile({
      ...baseParams,
      clearbitRevenue: 1_200_000_000,
      clearbitEmployees: 5000,
      aiEstimatedRevenue: '$10M-$50M',
      aiEstimatedEmployees: '1,000-5,000',
    });

    expect(profile.revenue.source).toBe('known_verified');
    expect(profile.revenue.provider).toBe('clearbit');
    expect(profile.employees.source).toBe('known_verified');
  });

  it('should fall back to customer data when no Clearbit data', () => {
    const profile = computeFinancialProfile({
      ...baseParams,
      customerRevenue: '$50M',
      customerEmployees: '500',
      aiEstimatedRevenue: '$10M-$20M',
    });

    expect(profile.revenue.source).toBe('known_customer');
    expect(profile.employees.source).toBe('known_customer');
  });

  it('should fall back to AI estimates when no verified or customer data', () => {
    const profile = computeFinancialProfile({
      ...baseParams,
      aiEstimatedRevenue: '$10M-$50M',
      aiEstimatedEmployees: '1,000-5,000',
      aiEstimatedFundingStage: 'Series B',
    });

    expect(profile.revenue.source).toBe('estimated_ai');
    expect(profile.employees.source).toBe('estimated_ai');
    expect(profile.funding.source).toBe('estimated_ai');
  });

  it('should return unknown when no data at all', () => {
    const profile = computeFinancialProfile(baseParams);

    expect(profile.revenue.source).toBe('unknown');
    expect(profile.employees.source).toBe('unknown');
    expect(profile.funding.source).toBe('unknown');
    expect(profile.marketCap.source).toBe('unknown');
    expect(profile.valuation.source).toBe('unknown');
  });

  it('should compute knownDataCoverage correctly', () => {
    const profile = computeFinancialProfile({
      ...baseParams,
      clearbitRevenue: 1_200_000_000,
      clearbitEmployees: 5000,
    });

    // 6 fields total, 2 known (revenue, employees), rest unknown
    expect(profile.knownDataCoverage).toBe(Math.round((2 / 6) * 100));
  });

  it('should compute composite trust score from non-unknown fields', () => {
    const profile = computeFinancialProfile({
      ...baseParams,
      clearbitRevenue: 1_200_000_000,
      clearbitEmployees: 5000,
    });

    expect(profile.compositeTrustScore).toBeGreaterThan(0);
    expect(profile.compositeTrustGrade).toMatch(/^[A-F+]$/);
  });

  it('should handle revenue range from Clearbit', () => {
    const profile = computeFinancialProfile({
      ...baseParams,
      clearbitRevenueRange: '$10M-$50M',
    });

    expect(profile.revenue.source).toBe('known_verified');
    expect(profile.revenue.displayValue).toBe('$10M-$50M');
  });

  it('should set market_cap from Clearbit only (not from AI)', () => {
    const profile = computeFinancialProfile({
      ...baseParams,
      clearbitMarketCap: 3_000_000_000_000,
    });

    expect(profile.marketCap.source).toBe('known_verified');
    expect(profile.marketCap.numericValue).toBe(3_000_000_000_000);
  });

  it('should compute growth rate from signal data', () => {
    const profile = computeFinancialProfile({
      ...baseParams,
      signalBasedGrowthRate: '~25% YoY',
      signalGrowthEvidence: 5,
    });

    expect(profile.growthRate.source).toBe('estimated_signal');
  });

  it('should include computedAt timestamp', () => {
    const profile = computeFinancialProfile(baseParams);
    expect(profile.computedAt).toBeDefined();
    expect(new Date(profile.computedAt).getTime()).not.toBeNaN();
  });
});

// ─── buildFieldConfidence ──────────────────────────────────────

describe('buildFieldConfidence', () => {
  it('should map financial profile fields to confidence entries', () => {
    const profile = computeFinancialProfile({
      companyId: 'comp_123',
      companyName: 'Test Corp',
      clearbitRevenue: 1_200_000_000,
      clearbitEmployees: 5000,
    });

    const confidence = buildFieldConfidence(profile);
    expect(confidence).toHaveProperty('revenue');
    expect(confidence).toHaveProperty('employeeCount');
    expect(confidence.revenue!.source).toBe('known_verified');
    expect(confidence.revenue!.confidence).toBe(0.9);
    expect(confidence.revenue!.provider).toBe('clearbit');
  });

  it('should set correct confidence levels', () => {
    const profile = computeFinancialProfile({
      companyId: 'comp_123',
      companyName: 'Test Corp',
      aiEstimatedRevenue: '$10M-$50M',
    });

    const confidence = buildFieldConfidence(profile);
    // AI estimated = low confidence = 0.3
    expect(confidence.revenue!.confidence).toBe(0.3);
    expect(confidence.revenue!.source).toBe('estimated_ai');
  });

  it('should exclude unknown fields from output', () => {
    const profile = computeFinancialProfile({
      companyId: 'comp_123',
      companyName: 'Test Corp',
    });

    const confidence = buildFieldConfidence(profile);
    expect(Object.keys(confidence)).toHaveLength(0);
  });
});
