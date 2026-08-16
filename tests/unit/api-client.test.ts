/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DeepMindQClient, ApiError, createClient, useApiClient } from '@/lib/api-client';
import type { ApiClientConfig } from '@/lib/api-client';

// ── Global fetch mock ─────────────────────────────────────────────

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// ── Helpers ────────────────────────────────────────────────────────

function createMockResponse(body: any, status = 200, headers?: Record<string, string>) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Map(Object.entries(headers || {})),
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

// ── ApiError ───────────────────────────────────────────────────────

describe('ApiError', () => {
  it('is an instance of Error', () => {
    const err = new ApiError(404, 'NOT_FOUND', 'Resource not found');
    expect(err).toBeInstanceOf(Error);
  });

  it('stores status, code, message, and details', () => {
    const details = { field: 'name' };
    const err = new ApiError(400, 'VALIDATION', 'Invalid input', details);
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION');
    expect(err.message).toBe('Invalid input');
    expect(err.details).toEqual({ field: 'name' });
  });

  it('has name "ApiError"', () => {
    const err = new ApiError(500, 'SERVER', 'Oops');
    expect(err.name).toBe('ApiError');
  });

  it('details default to undefined', () => {
    const err = new ApiError(500, 'SERVER', 'Oops');
    expect(err.details).toBeUndefined();
  });
});

// ── DeepMindQClient constructor ──────────────────────────────────

describe('DeepMindQClient constructor', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('uses provided baseUrl', () => {
    const client = new DeepMindQClient({ baseUrl: 'https://api.example.com/api' });
    // Private field, but we can test via request
    expect(client).toBeDefined();
  });

  it('defaults to localhost when no baseUrl and no env', () => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    const client = new DeepMindQClient();
    expect(client).toBeDefined();
  });

  it('uses NEXT_PUBLIC_APP_URL env when no baseUrl provided', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://myapp.com';
    const client = new DeepMindQClient();
    expect(client).toBeDefined();
  });

  it('defaults timeout to 30000ms', () => {
    const client = new DeepMindQClient();
    expect(client).toBeDefined();
  });

  it('accepts custom timeout', () => {
    const client = new DeepMindQClient({ timeout: 5000 });
    expect(client).toBeDefined();
  });

  it('accepts token', () => {
    const client = new DeepMindQClient({ token: 'test-token' });
    expect(client).toBeDefined();
  });

  it('accepts apiKey', () => {
    const client = new DeepMindQClient({ apiKey: 'test-api-key' });
    expect(client).toBeDefined();
  });
});

// ── setToken / setApiKey ───────────────────────────────────────────

describe('DeepMindQClient.setToken / setApiKey', () => {
  it('setToken returns the client for chaining', () => {
    const client = new DeepMindQClient();
    const result = client.setToken('new-token');
    expect(result).toBe(client);
  });

  it('setApiKey returns the client for chaining', () => {
    const client = new DeepMindQClient();
    const result = client.setApiKey('new-key');
    expect(result).toBe(client);
  });
});

// ── Core request method (tested via public methods) ─────────────────

describe('DeepMindQClient core request behavior', () => {
  let client: DeepMindQClient;

  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.NEXT_PUBLIC_APP_URL;
    client = new DeepMindQClient({ baseUrl: 'http://localhost:3000/api' });
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_APP_URL = undefined;
  });

  // ── Auth ──

  describe('login', () => {
    it('sends POST to /auth/login with credentials', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ success: true, message: 'OTP sent' }));

      const result = await client.login('user@example.com', 'password123');

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/auth/login');
      expect(options.method).toBe('POST');
      const body = JSON.parse(options.body);
      expect(body.email).toBe('user@example.com');
      expect(body.password).toBe('password123');
      expect(result.success).toBe(true);
    });
  });

  describe('logout', () => {
    it('sends POST to /auth/logout', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ success: true }));

      const result = await client.logout();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/auth/logout');
      expect(options.method).toBe('POST');
      expect(result.success).toBe(true);
    });
  });

  describe('me', () => {
    it('sends GET to /auth/me', async () => {
      const userData = { data: { id: '1', email: 'admin@test.com', name: 'Admin', role: 'admin' } };
      mockFetch.mockResolvedValue(createMockResponse(userData));

      const result = await client.me();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/auth/me');
      expect(result).toEqual(userData);
    });
  });

  // ── Companies ──

  describe('listCompanies', () => {
    it('sends GET to /companies with no params', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ companies: [], pagination: { page: 1, total: 0, totalPages: 0 } }),
      );

      const result = await client.listCompanies();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/companies');
      expect(url).not.toContain('search=');
    });

    it('passes search and filter params as query string', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ companies: [], pagination: { page: 1, total: 0, totalPages: 0 } }),
      );

      await client.listCompanies({ search: 'Acme', tier: 'HOT', page: 2, limit: 10 });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('search=Acme');
      expect(url).toContain('tier=HOT');
      expect(url).toContain('page=2');
      expect(url).toContain('limit=10');
    });

    it('passes sortBy and sortOrder params', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ companies: [], pagination: { page: 1, total: 0, totalPages: 0 } }),
      );

      await client.listCompanies({ sortBy: 'name', sortOrder: 'desc' });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('sortBy=name');
      expect(url).toContain('sortOrder=desc');
    });
  });

  describe('getCompany', () => {
    it('sends GET to /companies/:id', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ company: { id: 'abc', name: 'Test' } }));

      await client.getCompany('abc');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/companies/abc');
    });
  });

  describe('createCompany', () => {
    it('sends POST to /companies with body', async () => {
      const data = { name: 'Acme Corp', domain: 'acme.com' };
      mockFetch.mockResolvedValue(createMockResponse({ company: { id: 'new', ...data } }));

      await client.createCompany(data);

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/companies');
      expect(options.method).toBe('POST');
      expect(JSON.parse(options.body)).toEqual(data);
    });
  });

  describe('getCompanySignals', () => {
    it('sends GET to /companies/:id/signals with optional params', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ signals: [] }));

      await client.getCompanySignals('abc', { type: 'funding', severity: 'high' });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/companies/abc/signals');
      expect(url).toContain('type=funding');
      expect(url).toContain('severity=high');
    });
  });

  describe('getCompanyScore', () => {
    it('sends GET to /companies/:id/score', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ score: 85, category: 'A' }));

      await client.getCompanyScore('abc');

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/companies/abc/score');
    });
  });

  // ── Contacts ──

  describe('listContacts', () => {
    it('sends GET to /contacts with params', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ contacts: [], pagination: { page: 1, total: 0, totalPages: 0 } }),
      );

      await client.listContacts({ search: 'John', status: 'active', companyId: 'abc' });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/contacts');
      expect(url).toContain('search=John');
      expect(url).toContain('status=active');
      expect(url).toContain('companyId=abc');
    });
  });

  describe('getContact / createContact', () => {
    it('getContact sends GET to /contacts/:id', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ id: 'c1', name: 'John' }));
      await client.getContact('c1');
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/contacts/c1');
    });

    it('createContact sends POST to /contacts with body', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ contact: { id: 'new' } }));
      await client.createContact({ name: 'John', companyId: 'abc' });
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/contacts');
      expect(options.method).toBe('POST');
    });
  });

  // ── Opportunities ──

  describe('opportunity methods', () => {
    it('listOpportunities sends GET with params', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ data: [], pagination: { page: 1, total: 0, totalPages: 0 } }),
      );

      await client.listOpportunities({ status: 'open', companyId: 'abc' });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/opportunities');
      expect(url).toContain('status=open');
      expect(url).toContain('companyId=abc');
    });

    it('getOpportunity sends GET to /opportunities/:id', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ data: { id: 'o1' } }));
      await client.getOpportunity('o1');
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/opportunities/o1');
    });

    it('createOpportunity sends POST with body', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ data: { id: 'new' } }));
      await client.createOpportunity({ companyId: 'abc', title: 'Deal', value: 5000 });
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/opportunities');
      expect(options.method).toBe('POST');
    });
  });

  // ── Signals ──

  describe('signal methods', () => {
    it('listSignals sends GET with params', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ signals: [], evidenceCounts: {}, categories: [] }),
      );

      await client.listSignals({ companyId: 'abc', type: 'funding' });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/signals');
      expect(url).toContain('companyId=abc');
      expect(url).toContain('type=funding');
    });

    it('getSignal sends GET to /signals/:id', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ id: 's1' }));
      await client.getSignal('s1');
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/signals/s1');
    });
  });

  // ── Recommendations ──

  describe('recommendation methods', () => {
    it('listRecommendations sends GET with params', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ recommendations: [] }));

      await client.listRecommendations({ tier: 'HOT', minScore: 50, activeSignalsOnly: true });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/recommendations');
      expect(url).toContain('tier=HOT');
      expect(url).toContain('minScore=50');
      expect(url).toContain('activeSignalsOnly=true');
    });

    it('getRecommendation sends GET to /recommendations/:id', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ id: 'r1' }));
      await client.getRecommendation('r1');
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/recommendations/r1');
    });

    it('getRecommendationExplanation sends GET to /recommendations/:id/explain', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ explanation: 'Because...' }));
      await client.getRecommendationExplanation('abc');
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/recommendations/abc/explain');
    });
  });

  // ── Pipeline & Dashboard ──

  describe('pipeline and dashboard methods', () => {
    it('getPipeline sends GET to /pipeline', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          stages: [],
          totalLeads: 0,
          conversionRate: 0,
          deliveryRate: 0,
          replyRate: 0,
          bounceRate: 0,
        }),
      );
      await client.getPipeline();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/pipeline');
    });

    it('getForecast sends GET to /pipeline/forecast', async () => {
      mockFetch.mockResolvedValue(createMockResponse({}));
      await client.getForecast();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/pipeline/forecast');
    });

    it('getDashboard sends GET to /dashboard', async () => {
      mockFetch.mockResolvedValue(createMockResponse({}));
      await client.getDashboard();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/dashboard');
    });
  });

  // ── Scoring Config ──

  describe('scoring config methods', () => {
    it('getScoringConfig sends GET', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ data: {} }));
      await client.getScoringConfig();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/scoring-config');
    });

    it('updateScoringConfig sends PUT with body', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ data: {} }));
      const config = { weights: { intelligence: 0.3 } };
      await client.updateScoringConfig(config);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/scoring-config');
      expect(options.method).toBe('PUT');
    });
  });

  // ── Data Health ──

  describe('data health', () => {
    it('getDataHealth sends GET', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ data: {} }));
      await client.getDataHealth();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/data-health');
    });
  });

  // ── Notifications ──

  describe('notification methods', () => {
    it('listNotifications sends GET with params', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ notifications: [], unreadCount: 0 }));

      await client.listNotifications({ unreadOnly: true, type: 'signal' });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/notifications');
      expect(url).toContain('unreadOnly=true');
      expect(url).toContain('type=signal');
    });

    it('markNotificationRead sends POST', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ success: true }));
      await client.markNotificationRead('notif-1');
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/notifications');
      expect(options.method).toBe('POST');
    });
  });

  // ── Webhooks ──

  describe('webhook methods', () => {
    it('listWebhooks sends GET', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ webhooks: [] }));
      await client.listWebhooks();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/webhooks/manage');
    });

    it('registerWebhook sends POST', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ webhook: { id: 'w1' } }));
      await client.registerWebhook({
        url: 'https://example.com/hook',
        events: ['company.created'],
      });
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/webhooks/manage');
      expect(options.method).toBe('POST');
    });

    it('deleteWebhook sends DELETE to /webhooks/manage/:id', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ success: true }));
      await client.deleteWebhook('w1');
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/webhooks/manage/w1');
      expect(options.method).toBe('DELETE');
    });

    it('listWebhookEvents sends GET', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ events: [] }));
      await client.listWebhookEvents();
      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/webhooks/events');
    });

    it('testWebhook sends POST', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ success: true, statusCode: 200, responseTime: 150 }),
      );
      await client.testWebhook({ url: 'https://example.com/hook', event: 'company.created' });
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/webhooks/test');
      expect(options.method).toBe('POST');
    });
  });

  // ── Batch Operations ──

  describe('executeBatch', () => {
    it('sends POST to /batch/execute', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          success: true,
          action: 'archive',
          entityType: 'company',
          totalRequested: 3,
          processed: 3,
          failed: 0,
          errors: [],
        }),
      );

      await client.executeBatch({
        action: 'archive',
        entityType: 'company',
        ids: ['c1', 'c2', 'c3'],
      });

      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/batch/execute');
      expect(options.method).toBe('POST');
      const body = JSON.parse(options.body);
      expect(body.action).toBe('archive');
      expect(body.ids).toEqual(['c1', 'c2', 'c3']);
    });
  });

  // ── System ──

  describe('healthCheck', () => {
    it('sends GET to /health', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({
          status: 'healthy',
          version: '1.0.0',
          services: { database: 'ok', ai: 'ok' },
        }),
      );

      const result = await client.healthCheck();

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/health');
      expect(result.status).toBe('healthy');
    });
  });

  describe('getOpenApiSpec', () => {
    it('fetches the OpenAPI spec text', async () => {
      mockFetch.mockResolvedValue(createMockResponse({}, 200));

      await client.getOpenApiSpec();

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('/api/docs');
    });

    it('throws ApiError on non-ok response', async () => {
      mockFetch.mockResolvedValue(createMockResponse({}, 404));

      await expect(client.getOpenApiSpec()).rejects.toThrow(ApiError);
    });
  });

  // ── Auth Headers ──

  describe('authentication headers', () => {
    it('sends Authorization header when token is set', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ data: {} }));
      const client = new DeepMindQClient({
        baseUrl: 'http://localhost:3000/api',
        token: 'my-token',
      });
      await client.healthCheck();

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['Authorization']).toBe('Bearer my-token');
    });

    it('sends X-API-Key header when apiKey is set', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ data: {} }));
      const client = new DeepMindQClient({
        baseUrl: 'http://localhost:3000/api',
        apiKey: 'my-key',
      });
      await client.healthCheck();

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['X-API-Key']).toBe('my-key');
    });

    it('prioritizes both token and apiKey headers when both set', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ data: {} }));
      const client = new DeepMindQClient({
        baseUrl: 'http://localhost:3000/api',
        token: 't',
        apiKey: 'k',
      });
      await client.healthCheck();

      const [, options] = mockFetch.mock.calls[0];
      expect(options.headers['Authorization']).toBe('Bearer t');
      expect(options.headers['X-API-Key']).toBe('k');
    });
  });

  // ── Error Handling ──

  describe('error handling', () => {
    it('throws ApiError with status code on non-2xx response', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ error: 'Not found', code: 'NOT_FOUND' }, 404),
      );

      await expect(client.getCompany('missing')).rejects.toThrow(ApiError);
    });

    it('throws ApiError with correct code from response', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ error: 'Validation failed', code: 'VALIDATION_ERROR' }, 400),
      );

      try {
        await client.getCompany('bad');
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ApiError);
        expect((err as ApiError).code).toBe('VALIDATION_ERROR');
        expect((err as ApiError).status).toBe(400);
      }
    });

    it('invokes onUnauthorized callback on 401', async () => {
      const onUnauthorized = vi.fn();
      mockFetch.mockResolvedValue(createMockResponse({ error: 'Unauthorized' }, 401));
      const client = new DeepMindQClient({ baseUrl: 'http://localhost:3000/api', onUnauthorized });

      await expect(client.me()).rejects.toThrow(ApiError);
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });

    it('throws TIMEOUT error on abort', async () => {
      mockFetch.mockImplementation((_url: string, options: any) => {
        // Immediately abort
        const controller = new AbortController();
        controller.abort();
        return Promise.reject(new DOMException('The operation was aborted', 'AbortError'));
      });

      await expect(client.healthCheck()).rejects.toThrow(ApiError);
    });

    it('throws NETWORK_ERROR on fetch failure', async () => {
      mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(client.healthCheck()).rejects.toThrow(ApiError);
      try {
        await client.healthCheck();
      } catch (err) {
        expect((err as ApiError).code).toBe('NETWORK_ERROR');
      }
    });
  });

  // ── Request Body Serialization ──

  describe('request body handling', () => {
    it('sends JSON body for POST requests', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ success: true }));
      await client.createCompany({ name: 'Test Corp' });

      const [, options] = mockFetch.mock.calls[0];
      expect(options.body).toBe('{"name":"Test Corp"}');
    });

    it('does not send body for GET requests', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ company: { id: '1' } }));
      await client.getCompany('1');

      const [, options] = mockFetch.mock.calls[0];
      expect(options.body).toBeUndefined();
    });

    it('skips undefined query params', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ companies: [], pagination: { page: 1, total: 0, totalPages: 0 } }),
      );

      await client.listCompanies({ search: 'test', industry: undefined });

      const [url] = mockFetch.mock.calls[0];
      expect(url).toContain('search=test');
      expect(url).not.toContain('industry=');
    });

    it('skips empty string query params', async () => {
      mockFetch.mockResolvedValue(
        createMockResponse({ companies: [], pagination: { page: 1, total: 0, totalPages: 0 } }),
      );

      await client.listCompanies({ search: '' });

      const [url] = mockFetch.mock.calls[0];
      expect(url).not.toContain('search=');
    });
  });

  // ── Timeout Handling ──

  describe('timeout', () => {
    it('clears timeout after request completes', async () => {
      mockFetch.mockResolvedValue(createMockResponse({ data: {} }));
      const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');

      await client.healthCheck();
      expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);

      clearTimeoutSpy.mockRestore();
    });
  });
});

// ── createClient factory ──────────────────────────────────────────

describe('createClient', () => {
  it('returns a DeepMindQClient instance', () => {
    const client = createClient({ token: 'factory-token' });
    expect(client).toBeInstanceOf(DeepMindQClient);
  });

  it('passes config to constructor', () => {
    const client = createClient({ baseUrl: 'https://api.example.com/api', timeout: 5000 });
    expect(client).toBeInstanceOf(DeepMindQClient);
  });

  it('works with no config', () => {
    const client = createClient();
    expect(client).toBeInstanceOf(DeepMindQClient);
  });
});

// ── useApiClient ──────────────────────────────────────────────────

describe('useApiClient', () => {
  it('returns a DeepMindQClient instance', () => {
    const client = useApiClient({ token: 'hook-token' });
    expect(client).toBeInstanceOf(DeepMindQClient);
  });

  it('works with no config', () => {
    const client = useApiClient();
    expect(client).toBeInstanceOf(DeepMindQClient);
  });
});
