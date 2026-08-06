/**
 * M5 Unit Tests — Clearbit Connector
 * Tests the Clearbit connector with mocked fetch.
 */

import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ClearbitConnector } from '@/lib/intelligence-sources/connectors/clearbit-connector';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock env
const originalEnv = process.env;

function createSuccessResponse(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as unknown as Response;
}

function createErrorResponse(status: number, statusText: string): Response {
  return {
    ok: false,
    status,
    statusText,
    headers: new Headers(),
    json: () => Promise.resolve({}),
    text: () => Promise.resolve(''),
  } as unknown as Response;
}

const sampleClearbitResponse = {
  id: 'abc-123',
  name: 'Acme Corp',
  legalName: 'Acme Corporation',
  domain: 'acme.com',
  type: 'private',
  category: {
    industry: 'Technology',
    sector: 'Information Technology',
    subIndustry: 'SaaS',
    industryGroup: 'Software',
  },
  description: 'A leading SaaS company.',
  foundedYear: 2015,
  location: 'San Francisco, CA',
  employees: 500,
  employeesRange: '201-500',
  annualRevenue: 50000000,
  revenueRange: '$10M - $50M',
  totalFunding: 25000000,
  totalFundingCurrency: 'USD',
  logo: 'https://logo.clearbit.com/acme.com',
  tech: ['React', 'AWS', 'Node.js'],
  techCategories: ['Frontend', 'Cloud'],
  metrics: {
    alexaGlobalRank: 10000,
    employees: 500,
    marketCap: null,
  },
};

describe('ClearbitConnector', () => {
  let connector: ClearbitConnector;

  beforeEach(() => {
    vi.resetAllMocks();
    process.env = { ...originalEnv, CLEARBIT_API_KEY: 'test-api-key' };
    connector = new ClearbitConnector();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // ── validateConfig ──────────────────────────────────────────

  describe('validateConfig', () => {
    it('should pass when domain is provided', () => {
      const result = connector.validateConfig({ domain: 'acme.com' });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass when companyName is provided', () => {
      const result = connector.validateConfig({ companyName: 'Acme Corp' });
      expect(result.valid).toBe(true);
    });

    it('should fail when neither domain nor companyName is provided', () => {
      const result = connector.validateConfig({});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Either "domain" or "companyName" is required');
    });

    it('should fail when domain is not a string', () => {
      const result = connector.validateConfig({ domain: 123 });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('domain must be a string');
    });

    it('should fail when companyName is not a string', () => {
      const result = connector.validateConfig({ companyName: [] });
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('companyName must be a string');
    });
  });

  // ── test ───────────────────────────────────────────────────

  describe('test', () => {
    it('should fail config validation', async () => {
      const result = await connector.test({});
      expect(result.success).toBe(false);
      expect(result.message).toContain('required');
    });

    it('should fail when no API key is configured', async () => {
      process.env.CLEARBIT_API_KEY = '';
      const result = await connector.test({ domain: 'acme.com' });
      expect(result.success).toBe(false);
      expect(result.message).toContain('CLEARBIT_API_KEY not configured');
    });

    it('should succeed on 200 response', async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse(sampleClearbitResponse));
      const result = await connector.test({ domain: 'acme.com' });
      expect(result.success).toBe(true);
      expect(result.message).toContain('successful');
    });

    it('should handle 404 from test', async () => {
      mockFetch.mockResolvedValueOnce(createErrorResponse(404, 'Not Found'));
      const result = await connector.test({ domain: 'nonexistent.example' });
      expect(result.success).toBe(false);
      expect(result.message).toContain('not found');
    });
  });

  // ── acquire — Successful Enrichment ────────────────────────

  describe('acquire (successful enrichment)', () => {
    it('should return intelligence objects on success', async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse(sampleClearbitResponse));

      const result = await connector.acquire({ domain: 'acme.com' });
      expect(result.success).toBe(true);
      expect(result.intelligenceObjects.length).toBeGreaterThan(0);
    });

    it('should include company profile intelligence object', async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse(sampleClearbitResponse));

      const result = await connector.acquire({ domain: 'acme.com' });
      const profile = result.intelligenceObjects.find(
        o => o.metadata?.enrichmentType === 'company_profile'
      );
      expect(profile).toBeDefined();
      expect(profile!.content).toContain('Acme Corp');
      expect(profile!.metadata?.source).toBe('verified_api');
    });

    it('should include tech stack when tech data exists', async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse(sampleClearbitResponse));

      const result = await connector.acquire({ domain: 'acme.com' });
      const tech = result.intelligenceObjects.find(
        o => o.metadata?.enrichmentType === 'tech_stack'
      );
      expect(tech).toBeDefined();
      expect(tech!.content).toContain('React');
    });

    it('should include financial intelligence when financial data exists', async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse(sampleClearbitResponse));

      const result = await connector.acquire({ domain: 'acme.com' });
      const financial = result.intelligenceObjects.find(
        o => o.metadata?.enrichmentType === 'financial_intelligence'
      );
      expect(financial).toBeDefined();
      expect(financial!.content).toContain('Revenue');
    });

    it('should include industry intelligence when category exists', async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse(sampleClearbitResponse));

      const result = await connector.acquire({ domain: 'acme.com' });
      const industry = result.intelligenceObjects.find(
        o => o.metadata?.enrichmentType === 'industry_intelligence'
      );
      expect(industry).toBeDefined();
      expect(industry!.content).toContain('Technology');
    });

    it('should set companyIdentifier on all intelligence objects', async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse(sampleClearbitResponse));

      const result = await connector.acquire({ domain: 'acme.com' });
      for (const obj of result.intelligenceObjects) {
        expect(obj.companyIdentifier).toBe('Acme Corp');
      }
    });

    it('should attach TRUST metadata to profile', async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse(sampleClearbitResponse));

      const result = await connector.acquire({ domain: 'acme.com' });
      const profile = result.intelligenceObjects.find(
        o => o.metadata?.enrichmentType === 'company_profile'
      );
      expect(profile!.metadata?.name).toBeDefined();
      expect(profile!.metadata?.name?.source).toBe('verified_api');
      expect(profile!.metadata?.employees?.source).toBe('verified_api');
    });

    it('should mark estimated fields with medium confidence', async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse(sampleClearbitResponse));

      const result = await connector.acquire({ domain: 'acme.com' });
      const profile = result.intelligenceObjects.find(
        o => o.metadata?.enrichmentType === 'company_profile'
      );
      // employees and annualRevenue are estimated fields
      expect(profile!.metadata?.employees?.confidence).toBe('medium');
      expect(profile!.metadata?.revenue?.confidence).toBe('medium');
    });

    it('should mark verified fields with high confidence', async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse(sampleClearbitResponse));

      const result = await connector.acquire({ domain: 'acme.com' });
      const profile = result.intelligenceObjects.find(
        o => o.metadata?.enrichmentType === 'company_profile'
      );
      expect(profile!.metadata?.name?.confidence).toBe('high');
      expect(profile!.metadata?.domain?.confidence).toBe('high');
    });
  });

  // ── acquire — Error Handling ──────────────────────────────

  describe('acquire (error handling)', () => {
    it('should return error when config validation fails', async () => {
      const result = await connector.acquire({});
      expect(result.success).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it('should return error when no API key', async () => {
      process.env.CLEARBIT_API_KEY = '';
      const result = await connector.acquire({ domain: 'acme.com' });
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('CLEARBIT_API_KEY');
    });

    it('should handle 404 gracefully', async () => {
      mockFetch.mockResolvedValueOnce(createErrorResponse(404, 'Not Found'));
      const result = await connector.acquire({ domain: 'nonexistent.example' });
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('No company data found');
    });

    it('should handle network error gracefully', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network timeout'));
      const result = await connector.acquire({ domain: 'acme.com' });
      // The connector retries, so after all retries fail it should error
      expect(result.success).toBe(false);
    });

    it('should handle 500 error with retries', async () => {
      // First two calls fail with 500, third succeeds
      mockFetch
        .mockRejectedValueOnce(new Error('500 Internal Server Error'))
        .mockRejectedValueOnce(new Error('500 Internal Server Error'))
        .mockResolvedValueOnce(createSuccessResponse(sampleClearbitResponse));

      const result = await connector.acquire({ domain: 'acme.com' });
      expect(result.success).toBe(true);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  // ── Domain → Name Fallback ─────────────────────────────────

  describe('domain to name fallback', () => {
    it('should use domain as companyName fallback when 404 then search succeeds', async () => {
      // Domain lookup returns 404
      mockFetch
        .mockResolvedValueOnce(createErrorResponse(404, 'Not Found'))
        // Name search returns results
        .mockResolvedValueOnce(createSuccessResponse({
          results: [{
            name: 'Found By Name',
            domain: 'acme.com',
          }],
        }));

      const result = await connector.acquire({ domain: 'acme.com' });
      expect(result.success).toBe(true);
    });

    it('should return error when both domain and name search fail', async () => {
      mockFetch
        .mockResolvedValueOnce(createErrorResponse(404, 'Not Found'))
        .mockRejectedValueOnce(new Error('Search failed'));

      const result = await connector.acquire({ domain: 'nonexistent.example' });
      expect(result.success).toBe(false);
    });
  });

  // ── Rate Limiting ──────────────────────────────────────────

  describe('rate limiting', () => {
    it('should include rateLimitRemaining in metadata', async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse(sampleClearbitResponse));
      const result = await connector.acquire({ domain: 'acme.com' });
      expect(result.metadata).toHaveProperty('rateLimitRemaining');
      expect(typeof result.metadata.rateLimitRemaining).toBe('number');
    });
  });

  // ── Connector Properties ───────────────────────────────────

  describe('connector properties', () => {
    it('should have sourceType = "clearbit"', () => {
      expect(connector.sourceType).toBe('clearbit');
    });

    it('should have a descriptive name', () => {
      expect(connector.name).toContain('Clearbit');
    });
  });

  // ── Tech Stack Disabled ────────────────────────────────────

  describe('tech enrichment toggle', () => {
    it('should not include tech intelligence when enrichTech=false', async () => {
      mockFetch.mockResolvedValueOnce(createSuccessResponse(sampleClearbitResponse));
      const result = await connector.acquire({ domain: 'acme.com', enrichTech: false });
      const tech = result.intelligenceObjects.find(
        o => o.metadata?.enrichmentType === 'tech_stack'
      );
      expect(tech).toBeUndefined();
    });
  });

  // ── Minimal Response ──────────────────────────────────────

  describe('minimal company response', () => {
    it('should handle company with minimal data', async () => {
      const minimalResponse = {
        name: 'Minimal Corp',
        domain: 'minimal.com',
      };
      mockFetch.mockResolvedValueOnce(createSuccessResponse(minimalResponse));

      const result = await connector.acquire({ domain: 'minimal.com' });
      expect(result.success).toBe(true);
      // Should still have company profile
      const profile = result.intelligenceObjects.find(
        o => o.metadata?.enrichmentType === 'company_profile'
      );
      expect(profile).toBeDefined();
      // Should NOT have financial or industry (no data)
      const financial = result.intelligenceObjects.find(
        o => o.metadata?.enrichmentType === 'financial_intelligence'
      );
      expect(financial).toBeUndefined();
    });
  });
});
