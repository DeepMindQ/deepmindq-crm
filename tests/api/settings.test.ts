// ═══════════════════════════════════════════════════════════════════════════
// Settings API — Route Tests
//
// Tests GET /api/settings (read) and POST /api/settings (update / AI test / email test).
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/api-auth', () => ({
  checkApiAuth: vi.fn(),
}));

vi.mock('@/lib/rbac', () => ({
  authorizeRoute: vi.fn().mockReturnValue({ authorized: true }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

// Mock fetch for AI provider test
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

import { checkApiAuth } from '@/lib/api-auth';
import { GET, POST } from '@/app/api/settings/route';

// ── Helpers ────────────────────────────────────────────────────────────

const mockSession = { id: 'user-1', email: 'test@example.com', role: 'admin' as const };

function makeAuthRequest(url: string, init?: RequestInit): NextRequest {
  return new NextRequest(url, init);
}

// ── GET /api/settings ──────────────────────────────────────────────────

describe('GET /api/settings', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('returns 401 when no session', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: null,
      errorResponse: new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 }),
    });

    const req = new NextRequest('http://localhost/api/settings');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns settings structure with defaults', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    delete process.env.APP_NAME;
    delete process.env.NVIDIA_API_KEY;
    delete process.env.EMAIL_API_KEY;

    const req = makeAuthRequest('http://localhost/api/settings');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.appName).toBe('DeepMindQ Intelligence OS');
    expect(body.data.timezone).toBe('UTC');
    expect(body.data.language).toBe('en-US');
  });

  it('shows AI providers as disconnected when no keys', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    delete process.env.NVIDIA_API_KEY;
    delete process.env.FIREWORKS_API_KEY;
    delete process.env.GROQ_API_KEY;
    delete process.env.GEMINI_API_KEY;

    const req = makeAuthRequest('http://localhost/api/settings');
    const res = await GET(req);
    const body = await res.json();

    expect(body.data.aiProviders).toHaveLength(4);
    body.data.aiProviders.forEach((p: any) => {
      expect(p.status).toBe('disconnected');
    });
  });

  it('shows AI provider as connected when key exists', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    process.env.NVIDIA_API_KEY = 'nvapi-test-key';

    const req = makeAuthRequest('http://localhost/api/settings');
    const res = await GET(req);
    const body = await res.json();

    const nvidia = body.data.aiProviders.find((p: any) => p.name === 'NVIDIA');
    expect(nvidia.status).toBe('connected');
  });

  it('shows email configuration status', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    delete process.env.EMAIL_API_KEY;
    delete process.env.EMAIL_PROVIDER;
    delete process.env.EMAIL_FROM;

    const req = makeAuthRequest('http://localhost/api/settings');
    const res = await GET(req);
    const body = await res.json();

    expect(body.data.email.provider).toBe('resend');
    expect(body.data.email.configured).toBe(false);
    expect(body.data.email.from).toBe('noreply@deepmindq.com');
  });

  it('returns security settings with defaults', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    delete process.env.SESSION_TIMEOUT_MINUTES;
    delete process.env.MAX_CONCURRENT_SESSIONS;
    delete process.env.AUDIT_LOGGING;

    const req = makeAuthRequest('http://localhost/api/settings');
    const res = await GET(req);
    const body = await res.json();

    expect(body.data.sessionTimeout).toBe(30);
    expect(body.data.maxConcurrentSessions).toBe(5);
    expect(body.data.auditLogging).toBe(true);
  });
});

// ── POST /api/settings ─────────────────────────────────────────────────

describe('POST /api/settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockReset();
  });

  it('returns 401 when no session', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: null,
      errorResponse: new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 }),
    });

    const req = makeAuthRequest('http://localhost/api/settings', {
      method: 'POST',
      body: JSON.stringify({ appName: 'Test' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid data (bad type on sessionTimeout)', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = makeAuthRequest('http://localhost/api/settings', {
      method: 'POST',
      body: JSON.stringify({ sessionTimeout: 'not-a-number' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid settings');
  });

  it('returns 400 for sessionTimeout below minimum', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = makeAuthRequest('http://localhost/api/settings', {
      method: 'POST',
      body: JSON.stringify({ sessionTimeout: 2 }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid slackWebhook URL', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = makeAuthRequest('http://localhost/api/settings', {
      method: 'POST',
      body: JSON.stringify({ slackWebhook: 'not-a-url' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('accepts empty slackWebhook (allowed literal)', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = makeAuthRequest('http://localhost/api/settings', {
      method: 'POST',
      body: JSON.stringify({ slackWebhook: '' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
  });

  it('tests AI provider connection - success', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockFetch.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({}),
    });

    const req = makeAuthRequest('http://localhost/api/settings', {
      method: 'POST',
      body: JSON.stringify({
        aiProviderTest: { name: 'Groq', apiKey: 'gsk_test' },
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.provider).toBe('Groq');
    expect(body.data.status).toBe('connected');
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // Verify correct URL was called
    const calledUrl = mockFetch.mock.calls[0][0];
    expect(calledUrl).toContain('api.groq.com');
    expect(calledUrl).toContain('/chat/completions');
  });

  it('tests AI provider connection - failure (non-ok)', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: 'Unauthorized' }),
    });

    const req = makeAuthRequest('http://localhost/api/settings', {
      method: 'POST',
      body: JSON.stringify({
        aiProviderTest: { name: 'NVIDIA', apiKey: 'bad-key' },
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.status).toBe('disconnected');
    expect(body.data.statusCode).toBe(401);
  });

  it('tests AI provider connection - network error', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockFetch.mockRejectedValue(new Error('ECONNREFUSED'));

    const req = makeAuthRequest('http://localhost/api/settings', {
      method: 'POST',
      body: JSON.stringify({
        aiProviderTest: { name: 'Fireworks', apiKey: 'fw_test' },
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.status).toBe('disconnected');
    expect(body.data.error).toContain('ECONNREFUSED');
  });

  it('tests email configuration', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    delete process.env.EMAIL_API_KEY;

    const req = makeAuthRequest('http://localhost/api/settings', {
      method: 'POST',
      body: JSON.stringify({ emailTest: true }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.emailTest).toBe('failed');
    expect(body.data.configured).toBe(false);
  });

  it('acknowledges generic settings update', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = makeAuthRequest('http://localhost/api/settings', {
      method: 'POST',
      body: JSON.stringify({
        appName: 'My CRM',
        timezone: 'America/New_York',
        notifySignalAlerts: true,
      }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.updated).toEqual(
      expect.arrayContaining(['appName', 'timezone', 'notifySignalAlerts']),
    );
    expect(body.data.message).toContain('restart');
  });

  it('returns 500 when JSON parsing fails', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = makeAuthRequest('http://localhost/api/settings', {
      method: 'POST',
      body: 'not-json',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(500);
  });
});
