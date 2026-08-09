/**
 * Phase 1 Enterprise Readiness — Company Size Profiles Tests
 * ============================================================
 *
 * Tests for company classification, target role resolution,
 * and source expectation logic.
 */

import { describe, it, expect } from 'vitest';
import {
  classifyCompany,
  getProfile,
  getAllProfiles,
  resolveTargetRoles,
  isSourceExpected,
  SEGMENT_THRESHOLDS,
  type CompanySegment,
} from '@/lib/company-size-profiles';

describe('company-size-profiles', () => {
  describe('classifyCompany', () => {
    it('should classify by employee count — enterprise', () => {
      const result = classifyCompany({ employeeCount: 10000 });
      expect(result.segment).toBe('enterprise');
      expect(result.confidence).toBe(0.95);
      expect(result.basedOn).toContain('employee_count=10000');
    });

    it('should classify by employee count — mid_market', () => {
      const result = classifyCompany({ employeeCount: 2500 });
      expect(result.segment).toBe('mid_market');
      expect(result.confidence).toBe(0.95);
    });

    it('should classify by employee count — smb', () => {
      const result = classifyCompany({ employeeCount: 50 });
      expect(result.segment).toBe('smb');
      expect(result.confidence).toBe(0.95);
    });

    it('should classify by employee count — startup', () => {
      const result = classifyCompany({ employeeCount: 5 });
      expect(result.segment).toBe('startup');
      expect(result.confidence).toBe(0.95);
    });

    it('should classify boundary: 5000 = enterprise', () => {
      const result = classifyCompany({ employeeCount: 5000 });
      expect(result.segment).toBe('enterprise');
    });

    it('should classify boundary: 200 = mid_market', () => {
      const result = classifyCompany({ employeeCount: 200 });
      expect(result.segment).toBe('mid_market');
    });

    it('should classify boundary: 10 = smb', () => {
      const result = classifyCompany({ employeeCount: 10 });
      expect(result.segment).toBe('smb');
    });

    it('should classify boundary: 9 = startup', () => {
      const result = classifyCompany({ employeeCount: 9 });
      expect(result.segment).toBe('startup');
    });

    it('should classify by revenue — enterprise ($1B+)', () => {
      const result = classifyCompany({ revenue: 2_000_000_000 });
      expect(result.segment).toBe('enterprise');
      expect(result.confidence).toBe(0.7);
    });

    it('should classify by revenue — mid_market ($50M+)', () => {
      const result = classifyCompany({ revenue: 100_000_000 });
      expect(result.segment).toBe('mid_market');
    });

    it('should classify by revenue — smb ($5M+)', () => {
      const result = classifyCompany({ revenue: 10_000_000 });
      expect(result.segment).toBe('smb');
    });

    it('should not classify by very low revenue alone', () => {
      const result = classifyCompany({ revenue: 1_000_000 });
      expect(result.segment).toBe('smb'); // defaults to smb
      expect(result.confidence).toBe(0.2);
    });

    it('should classify by company type — startup', () => {
      const result = classifyCompany({ companyType: 'early stage startup' });
      expect(result.segment).toBe('startup');
    });

    it('should classify by company type — enterprise', () => {
      const result = classifyCompany({ companyType: 'large enterprise' });
      expect(result.segment).toBe('enterprise');
    });

    it('should prioritize employee count over company type', () => {
      const result = classifyCompany({ employeeCount: 5, companyType: 'enterprise' });
      expect(result.segment).toBe('startup');
      expect(result.confidence).toBe(0.95);
    });

    it('should default to smb when no data available', () => {
      const result = classifyCompany({});
      expect(result.segment).toBe('smb');
      expect(result.confidence).toBe(0.2);
    });

    it('should handle zero employees', () => {
      const result = classifyCompany({ employeeCount: 0 });
      expect(result.segment).toBe('startup');
    });

    it('should handle null employee count', () => {
      const result = classifyCompany({ employeeCount: null });
      expect(result.segment).toBe('smb'); // default
    });
  });

  describe('getProfile', () => {
    it('should return enterprise profile with deep tier', () => {
      const profile = getProfile('enterprise');
      expect(profile.segment).toBe('enterprise');
      expect(profile.llmTier).toBe('deep');
      expect(profile.maxTokensPerStep).toBe(4000);
      expect(profile.defaultSkipSteps).toEqual([]);
      expect(profile.targetRoles.length).toBeGreaterThan(0);
    });

    it('should return startup profile with fast tier and many skips', () => {
      const profile = getProfile('startup');
      expect(profile.segment).toBe('startup');
      expect(profile.llmTier).toBe('fast');
      expect(profile.maxTokensPerStep).toBe(500);
      expect(profile.defaultSkipSteps.length).toBeGreaterThan(5);
    });

    it('should return smb profile with medium config', () => {
      const profile = getProfile('smb');
      expect(profile.segment).toBe('smb');
      expect(profile.llmTier).toBe('fast');
      expect(profile.defaultSkipSteps).toContain(7); // Funding skipped
      expect(profile.defaultSkipSteps).toContain(11); // Buying Committee skipped
    });

    it('should return mid_market profile with smart tier', () => {
      const profile = getProfile('mid_market');
      expect(profile.segment).toBe('mid_market');
      expect(profile.llmTier).toBe('smart');
      expect(profile.maxTokensPerStep).toBe(2000);
    });
  });

  describe('getAllProfiles', () => {
    it('should return all 4 segments', () => {
      const profiles = getAllProfiles();
      expect(Object.keys(profiles)).toEqual(['enterprise', 'mid_market', 'smb', 'startup']);
    });
  });

  describe('resolveTargetRoles', () => {
    it('should return segment defaults when no contacts', () => {
      const roles = resolveTargetRoles({ employeeCount: 5 });
      expect(roles).toContain('Founder / CEO');
    });

    it('should return enterprise roles for large companies', () => {
      const roles = resolveTargetRoles({ employeeCount: 10000 });
      expect(roles[0]).toContain('VP');
      expect(roles.length).toBeGreaterThan(1);
    });

    it('should use known contacts when available', () => {
      const roles = resolveTargetRoles({
        employeeCount: 500,
        knownContacts: [
          { role: 'CIO', level: 'executive' },
          { role: 'VP Engineering', level: 'vp' },
        ],
      });
      expect(roles).toContain('CIO');
      expect(roles).toContain('VP Engineering');
    });

    it('should add signal-specific roles', () => {
      const roles = resolveTargetRoles({
        employeeCount: 100,
        signals: [
          { signalType: 'funding' },
          { signalType: 'tech_change' },
        ],
      });
      expect(roles).toContain('CFO');
      expect(roles).toContain('CTO');
    });

    it('should limit to 5 roles max', () => {
      const roles = resolveTargetRoles({
        employeeCount: 10000,
        signals: [
          { signalType: 'funding' },
          { signalType: 'tech_change' },
          { signalType: 'hiring' },
        ],
      });
      expect(roles.length).toBeLessThanOrEqual(5);
    });

    it('should deduplicate roles', () => {
      const roles = resolveTargetRoles({
        employeeCount: 500,
        knownContacts: [
          { role: 'CTO' },
          { role: 'CTO' }, // duplicate
        ],
      });
      const ctoCount = roles.filter(r => r === 'CTO').length;
      expect(ctoCount).toBe(1);
    });
  });

  describe('isSourceExpected', () => {
    it('should mark SEC as expected for enterprise', () => {
      const result = isSourceExpected('enterprise', 'SEC_EDGAR');
      expect(result.expected).toBe(true);
      expect(result.priority).toBe('primary');
    });

    it('should mark SEC as unlikely for startup', () => {
      const result = isSourceExpected('startup', 'SEC_EDGAR');
      expect(result.expected).toBe(false);
      expect(result.priority).toBe('skip');
    });

    it('should mark unknown sources as secondary', () => {
      const result = isSourceExpected('mid_market', 'some_unknown_source');
      expect(result.expected).toBe(false);
      expect(result.priority).toBe('secondary');
    });

    it('should mark Crunchbase as unlikely for smb', () => {
      const result = isSourceExpected('smb', 'crunchbase');
      expect(result.expected).toBe(false);
      expect(result.priority).toBe('skip');
    });
  });

  describe('SEGMENT_THRESHOLDS', () => {
    it('should have correct boundaries', () => {
      expect(SEGMENT_THRESHOLDS.enterprise.min).toBe(5000);
      expect(SEGMENT_THRESHOLDS.mid_market.min).toBe(200);
      expect(SEGMENT_THRESHOLDS.smb.min).toBe(10);
      expect(SEGMENT_THRESHOLDS.startup.min).toBe(0);
    });
  });
});
