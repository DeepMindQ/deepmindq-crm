/**
 * Crunchbase Connector — Phase 2 Tests
 *
 * Tests config validation, feature flag gating, API key handling,
 * funding round parsing, and error paths (404, 401, 429).
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

const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

import { CrunchbaseConnector } from '@/lib/intelligence-sources/connectors/crunchbase-connector';

describe('Crunchbase Connector', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.ENABLE_CRUNCHBASE_CONNECTOR = 'true';
    process.env.CRUNCHBASE_API_KEY = 'test-cb-key-123';
    mockFetch.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    mockFetch.mockReset();
  });

  // ════════════════════════════════════════════════════════════
  // validateConfig (doesn't depend on feature flag)
  // ════════════════════════════════════════════════════════════

  describe('validateConfig', () => {
    it('should pass with a valid domain identifier', () => {
      const result = new CrunchbaseConnector().validateConfig({ identifier: 'acme.com' });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass with a valid permalink identifier', () => {
      const result = new CrunchbaseConnector().validateConfig({
        identifier: 'acme-corporation',
        identifierType: 'permalink',
      });
      expect(result.valid).toBe(true);
    });

    it('should fail when identifier is missing', () => {
      const result = new CrunchbaseConnector().validateConfig({});
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('"identifier" is required');
    });

    it('should fail when identifier is not a string', () => {
      const result = new CrunchbaseConnector().validateConfig({ identifier: 12345 });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('"identifier" is required');
    });

    it('should reject invalid identifierType', () => {
      const result = new CrunchbaseConnector().validateConfig({
        identifier: 'acme.com',
        identifierType: 'email',
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('"identifierType" must be one of');
    });

    it('should reject non-string apiKey when provided', () => {
      const result = new CrunchbaseConnector().validateConfig({
        identifier: 'acme.com',
        apiKey: 12345,
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('"apiKey" must be a string');
    });

    it('should reject non-positive maxRounds', () => {
      const result = new CrunchbaseConnector().validateConfig({
        identifier: 'acme.com',
        maxRounds: -5,
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('"maxRounds" must be a positive number');
    });

    it('should pass when apiKey is omitted (falls back to env)', () => {
      const result = new CrunchbaseConnector().validateConfig({ identifier: 'acme.com' });
      expect(result.valid).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════
  // Feature Flag (uses dynamic import to re-evaluate module constant)
  // ════════════════════════════════════════════════════════════

  describe('feature flag', () => {
    it('should return error when flag is off', async () => {
      process.env.ENABLE_CRUNCHBASE_CONNECTOR = '';
      const mod = await import('@/lib/intelligence-sources/connectors/crunchbase-connector');
      const offConnector = new mod.CrunchbaseConnector();
      const result = await offConnector.acquire({ identifier: 'acme.com' });
      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('disabled'),
      );
    });

    it('should return empty intelligenceObjects when disabled', async () => {
      process.env.ENABLE_CRUNCHBASE_CONNECTOR = 'false';
      const mod = await import('@/lib/intelligence-sources/connectors/crunchbase-connector');
      const offConnector = new mod.CrunchbaseConnector();
      const result = await offConnector.acquire({ identifier: 'acme.com' });
      expect(result.intelligenceObjects).toEqual([]);
    });
  });

  // ════════════════════════════════════════════════════════════
  // acquire (uses dynamic import so module constant is re-evaluated)
  // ════════════════════════════════════════════════════════════

  describe('acquire', () => {
    it('should fetch company data with funding rounds', async () => {
      // Mock the autocomplete/search response for resolvePermalink
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            entities: [
              {
                identifier: { value: 'acme-corporation' },
                name: 'Acme Corp',
              },
            ],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );
      // Mock the actual entity data response (flat format — fetchCrunchbaseApi wraps in {data:...})
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            uuid: 'abc-123',
            type: 'organization',
            properties: {
              name: 'Acme Corp',
              short_description: 'A tech company',
              website_url: 'https://acme.com',
              founded_on: '2015-01-15',
              num_employees_min: 51,
              num_employees_max: 200,
              categories: [{ name: 'SaaS' }],
              total_funding_usd: 50_000_000,
            },
            cards: {
              funding_rounds: {
                items: [
                  {
                    properties: {
                      investment_type: 'Series B',
                      money_raised_usd: 30_000_000,
                      announced_on: '2023-06-15',
                      pre_money_valuation_usd: 100_000_000,
                    },
                    relationships: [
                      { entity: { name: 'Sequoia Capital', properties: { investor_type: 'venture' } } },
                    ],
                  },
                ],
              },
              current_investors: { items: [] },
              acquisitions: { items: [] },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      );

      const mod = await import('@/lib/intelligence-sources/connectors/crunchbase-connector');
      const connector = new mod.CrunchbaseConnector();
      const result = await connector.acquire({
        identifier: 'acme.com',
        identifierType: 'domain',
      });

      expect(result.success).toBe(true);
      expect(result.intelligenceObjects.length).toBeGreaterThan(0);
    });

    it('should handle 404 not found gracefully', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ data: null, error: 'Organization not found (404)' }),
          { status: 404 },
        ),
      );

      const mod = await import('@/lib/intelligence-sources/connectors/crunchbase-connector');
      const connector = new mod.CrunchbaseConnector();
      const result = await connector.acquire({ identifier: 'nonexistent-domain-xyz.com' });
      expect(result).toBeDefined();
      expect(result.intelligenceObjects).toBeDefined();
    });

    it('should handle 401 authentication failure', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('', { status: 401 }),
      );

      const mod = await import('@/lib/intelligence-sources/connectors/crunchbase-connector');
      const connector = new mod.CrunchbaseConnector();
      const result = await connector.acquire({ identifier: 'acme.com' });
      expect(result).toBeDefined();
    });

    it('should handle 429 rate limiting with retry', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('', { status: 429, headers: { 'Retry-After': '1' } }),
      );
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: {
              uuid: 'abc',
              properties: { name: 'Acme' },
              cards: { funding_rounds: { items: [] } },
            },
          }),
          { status: 200 },
        ),
      );

      const mod = await import('@/lib/intelligence-sources/connectors/crunchbase-connector');
      const connector = new mod.CrunchbaseConnector();
      const result = await connector.acquire({ identifier: 'acme.com' });
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(result).toBeDefined();
    });

    it('should handle network failure gracefully', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      const mod = await import('@/lib/intelligence-sources/connectors/crunchbase-connector');
      const connector = new mod.CrunchbaseConnector();
      const result = await connector.acquire({ identifier: 'acme.com' });
      expect(result).toBeDefined();
      expect(result.intelligenceObjects).toBeDefined();
    });

    it('should return error when no API key is available', async () => {
      process.env.CRUNCHBASE_API_KEY = '';
      const mod = await import('@/lib/intelligence-sources/connectors/crunchbase-connector');
      const connector = new mod.CrunchbaseConnector();
      const result = await connector.acquire({ identifier: 'acme.com' });
      expect(result.success).toBe(false);
      expect(result.errors[0]).toContain('API key');
    });

    it('should parse multiple funding rounds', async () => {
      // Mock the autocomplete/search response for resolvePermalink
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            entities: [
              { identifier: { value: 'acme' }, name: 'Acme' },
            ],
          }),
          { status: 200 },
        ),
      );
      // Mock the actual entity data response (flat format — fetchCrunchbaseApi wraps in {data:...})
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            uuid: 'abc',
            properties: { name: 'Acme', total_funding_usd: 60_000_000 },
            cards: {
              funding_rounds: {
                items: [
                  {
                    properties: { investment_type: 'Seed', money_raised_usd: 5_000_000, announced_on: '2020-01-01' },
                    relationships: [],
                  },
                  {
                    properties: { investment_type: 'Series A', money_raised_usd: 15_000_000, announced_on: '2021-06-01' },
                    relationships: [],
                  },
                  {
                    properties: { investment_type: 'Series B', money_raised_usd: 40_000_000, announced_on: '2023-01-01' },
                    relationships: [],
                  },
                ],
              },
              current_investors: { items: [] },
              acquisitions: { items: [] },
            },
          }),
          { status: 200 },
        ),
      );

      const mod = await import('@/lib/intelligence-sources/connectors/crunchbase-connector');
      const connector = new mod.CrunchbaseConnector();
      const result = await connector.acquire({ identifier: 'acme.com' });
      expect(result.success).toBe(true);
      expect(result.intelligenceObjects.length).toBeGreaterThan(2);
    });
  });

  // ════════════════════════════════════════════════════════════
  // test (connectivity)
  // ════════════════════════════════════════════════════════════

  describe('test', () => {
    it('should return failure when flag is off', async () => {
      process.env.ENABLE_CRUNCHBASE_CONNECTOR = '';
      const mod = await import('@/lib/intelligence-sources/connectors/crunchbase-connector');
      const offConnector = new mod.CrunchbaseConnector();
      const result = await offConnector.test({ identifier: 'acme.com' });
      expect(result.success).toBe(false);
      expect(result.message).toContain('disabled');
    });

    it('should return failure when no API key', async () => {
      process.env.CRUNCHBASE_API_KEY = '';
      const mod = await import('@/lib/intelligence-sources/connectors/crunchbase-connector');
      const connector = new mod.CrunchbaseConnector();
      const result = await connector.test({ identifier: 'acme.com' });
      expect(result.success).toBe(false);
      expect(result.message).toContain('API key');
    });

    it('should succeed with valid config and reachable API', async () => {
      // Mock the autocomplete/search response for resolvePermalink
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            entities: [
              { identifier: { value: 'acme-corp' }, name: 'Acme Corp' },
            ],
          }),
          { status: 200 },
        ),
      );
      // Mock the basic entity fetch in the test() method (flat format)
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ uuid: 'abc', properties: { name: 'Acme Corp' } }),
          { status: 200 },
        ),
      );

      const mod = await import('@/lib/intelligence-sources/connectors/crunchbase-connector');
      const connector = new mod.CrunchbaseConnector();
      const result = await connector.test({ identifier: 'acme.com' });
      expect(result.success).toBe(true);
      expect(result.message).toContain('Acme Corp');
    });
  });
});
