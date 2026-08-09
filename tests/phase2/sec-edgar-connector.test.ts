/**
 * SEC EDGAR Connector — Phase 2 Tests
 *
 * Tests config validation, feature flag gating, CIK resolution,
 * rate-limit handling, error paths, and connectivity checks.
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

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
global.fetch = mockFetch;

import { SecEdgarConnector } from '@/lib/intelligence-sources/connectors/sec-edgar-connector';

describe('SEC EDGAR Connector', () => {
  let connector: SecEdgarConnector;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    process.env.ENABLE_SEC_EDGAR_CONNECTOR = 'true';
    connector = new SecEdgarConnector();
    mockFetch.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
    mockFetch.mockReset();
  });

  // ════════════════════════════════════════════════════════════
  // validateConfig
  // ════════════════════════════════════════════════════════════

  describe('validateConfig', () => {
    it('should pass with a valid CIK', () => {
      const result = connector.validateConfig({ cik: '0000320193' });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass with a valid ticker', () => {
      const result = connector.validateConfig({ ticker: 'AAPL' });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should pass with companyName as identifier', () => {
      const result = connector.validateConfig({ companyName: 'Apple Inc' });
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should fail with no identifier provided', () => {
      const result = connector.validateConfig({});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain(
        'At least one of "cik", "ticker", or "companyName" is required',
      );
    });

    it('should fail with empty config object', () => {
      const result = connector.validateConfig({});
      expect(result.valid).toBe(false);
    });

    it('should validate filingTypes is an array when provided', () => {
      const result = connector.validateConfig({ ticker: 'AAPL', filingTypes: '10-K' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('filingTypes'))).toBe(true);
    });

    it('should validate maxFilings is a number when provided', () => {
      const result = connector.validateConfig({ ticker: 'AAPL', maxFilings: 'five' });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('maxFilings'))).toBe(true);
    });

    it('should reject non-string CIK', () => {
      const result = connector.validateConfig({ cik: 123456 });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('cik must be a string'))).toBe(true);
    });

    it('should accept valid filingTypes array', () => {
      const result = connector.validateConfig({
        ticker: 'AAPL',
        filingTypes: ['10-K', '10-Q'],
      });
      expect(result.valid).toBe(true);
    });
  });

  // ════════════════════════════════════════════════════════════
  // Feature Flag
  // ════════════════════════════════════════════════════════════

  describe('feature flag', () => {
    it('should return error when flag is off', async () => {
      process.env.ENABLE_SEC_EDGAR_CONNECTOR = '';
      // Re-instantiate to pick up new env
      const offConnector = new SecEdgarConnector();
      const result = await offConnector.acquire({ ticker: 'AAPL' });
      expect(result.success).toBe(false);
      expect(result.errors).toContainEqual(
        expect.stringContaining('disabled'),
      );
    });

    it('should return empty intelligenceObjects when flag is off', async () => {
      process.env.ENABLE_SEC_EDGAR_CONNECTOR = 'false';
      const offConnector = new SecEdgarConnector();
      const result = await offConnector.acquire({ ticker: 'AAPL' });
      expect(result.intelligenceObjects).toEqual([]);
    });
  });

  // ════════════════════════════════════════════════════════════
  // acquire
  // ════════════════════════════════════════════════════════════

  describe('acquire', () => {
    it('should fetch filings for a CIK and return intelligence objects', async () => {
      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 30);
      const recentDateStr = recentDate.toISOString().split('T')[0];
      const reportDate = new Date();
      reportDate.setDate(reportDate.getDate() - 60);
      const reportDateStr = reportDate.toISOString().split('T')[0];

      const submissionsData = {
        cik: '0000320193',
        name: 'Apple Inc.',
        tickers: ['AAPL'],
        filings: {
          recent: [
            {
              accessionNumber: '0000320193-25-000100',
              filingDate: recentDateStr,
              reportDate: reportDateStr,
              acceptanceDateTime: `${recentDateStr}T06:12:24.000Z`,
              act: '34',
              form: '10-K',
              fileNumber: '001-06955',
              filmNumber: '23120432',
              items: '',
              size: 1234567,
              isXBRL: true,
              isInlineXBRL: true,
              primaryDocument: 'doc.htm',
              primaryDocDescription: '',
            },
          ],
        },
      };
      // Mock submissions response for resolveCik (step 1)
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(submissionsData), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );
      // Mock submissions response for fetchSubmissions (step 2)
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(submissionsData), { status: 200, headers: { 'Content-Type': 'application/json' } }),
      );
      // Mock filing document fetch
      mockFetch.mockResolvedValueOnce(
        new Response('<html><body>Apple total revenue $383.3 billion</body></html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        }),
      );

      const result = await connector.acquire({ cik: '0000320193' });
      expect(result.success).toBe(true);
      expect(result.intelligenceObjects.length).toBeGreaterThan(0);
      expect(result.metadata.cik).toBe('0000320193');
    });

    it('should handle 404 company not found gracefully', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('Not Found', { status: 404 }),
      );

      const result = await connector.acquire({ cik: '9999999999' });
      // Should not throw, may return error or empty
      expect(result.intelligenceObjects).toBeDefined();
    });

    it('should handle rate limiting (429) with retry', async () => {
      // First call returns 429, second call succeeds
      mockFetch.mockResolvedValueOnce(
        new Response('Rate Limited', { status: 429 }),
      );
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({
          cik: '0000320193',
          name: 'Apple Inc.',
          tickers: ['AAPL'],
          filings: { recent: [] },
        })),
      );

      const result = await connector.acquire({ cik: '0000320193' });
      // Should have attempted the retry
      expect(mockFetch.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(result).toBeDefined();
    });

    it('should handle network failures gracefully', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      const result = await connector.acquire({ ticker: 'AAPL' });
      // Must not throw — non-throwing contract
      expect(result).toBeDefined();
      expect(result.intelligenceObjects).toBeDefined();
    });

    it('should resolve CIK from ticker via SEC ticker map', async () => {
      // Ticker map response
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            '0': { cik_str: 320193, ticker: 'AAPL', title: 'Apple Inc.' },
          }),
          { status: 200 },
        ),
      );
      // Submissions response
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            cik: '0000320193',
            name: 'Apple Inc.',
            tickers: ['AAPL'],
            filings: { recent: [] },
          }),
          { status: 200 },
        ),
      );

      const result = await connector.acquire({ ticker: 'AAPL' });
      expect(result).toBeDefined();
      // Verify ticker map was called
      const tickerMapCall = mockFetch.mock.calls.find((c) =>
        c[0].toString().includes('company_tickers.json'),
      );
      expect(tickerMapCall).toBeDefined();
    });

    it('should return no filings when date range excludes all results', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            cik: '0000320193',
            name: 'Apple Inc.',
            tickers: ['AAPL'],
            filings: { recent: [] },
          }),
          { status: 200 },
        ),
      );

      const result = await connector.acquire({
        cik: '0000320193',
        startDate: '2020-01-01',
        endDate: '2020-01-02',
      });
      expect(result.success).toBe(true);
      expect(result.intelligenceObjects).toHaveLength(0);
    });

    it('should include metadata with company info', async () => {
      // Mock submissions response for resolveCik (step 1)
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            cik: '0000320193',
            name: 'Apple Inc.',
            tickers: ['AAPL'],
            filings: { recent: [] },
          }),
          { status: 200 },
        ),
      );
      // Mock submissions response for fetchSubmissions (step 2)
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            cik: '0000320193',
            name: 'Apple Inc.',
            tickers: ['AAPL'],
            filings: { recent: [] },
          }),
          { status: 200 },
        ),
      );

      const result = await connector.acquire({ cik: '0000320193' });
      expect(result.metadata).toBeDefined();
      // When no filings are found, metadata has cik/ticker/companyName/filingCount but not provider
      expect(result.metadata.cik).toBe('0000320193');
    });
  });

  // ════════════════════════════════════════════════════════════
  // test (connectivity check)
  // ════════════════════════════════════════════════════════════

  describe('test', () => {
    it('should return success when SEC API is reachable', async () => {
      mockFetch.mockResolvedValueOnce(
        new Response('{}', { status: 200 }),
      );

      const result = await connector.test({ cik: '0000320193' });
      expect(result.success).toBe(true);
      expect(result.message).toContain('successful');
    });

    it('should return failure when SEC API is unreachable', async () => {
      mockFetch.mockResolvedValueOnce(null);

      const result = await connector.test({ cik: '0000320193' });
      expect(result.success).toBe(false);
      expect(result.message).toContain('Cannot reach');
    });

    it('should return failure when feature flag is off', async () => {
      process.env.ENABLE_SEC_EDGAR_CONNECTOR = '';
      const offConnector = new SecEdgarConnector();
      const result = await offConnector.test({ cik: '0000320193' });
      expect(result.success).toBe(false);
      expect(result.message).toContain('not enabled');
    });

    it('should fail validation with no identifier', async () => {
      const result = await connector.test({});
      expect(result.success).toBe(false);
      expect(result.message).toContain('required');
    });
  });
});
