/**
 * WI-18.4 Phase 4 — E2E Journey Test Skeleton (Track D2)
 *
 * CRITICAL enterprise journey tests that verify the full API handler chain
 * works correctly for each core workflow. Uses vi.mock to mock DB and LLM
 * calls, but verifies the API contract end-to-end.
 *
 * These are API-level integration tests — NOT real browser tests.
 * Each journey is structured as a describe block calling route handlers directly.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Shared Mock Helpers ──────────────────────────────────────────────────

const MOCK_SESSION = {
  id: 'user-session-001',
  email: 'admin@deepmindq.com',
  name: 'Admin User',
  phone: null,
  company: null,
  designation: null,
  role: 'admin',
  hasPassword: false,
  avatarUrl: null,
};

/** Create a mock Request with JSON body */
function mockJsonRequest(url: string, body: unknown, method = 'POST'): Request {
  return new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/** Create a mock GET Request */
function mockGetRequest(url: string): Request {
  return new Request(url, { method: 'GET' });
}

/** Parse JSON from a Response */
async function parseJson(response: Response): Promise<any> {
  return response.json();
}

// ─── 1. Auth Flow Journey ──────────────────────────────────────────────────

describe('Journey: Auth Flow (request-otp → verify-otp → me)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POST /api/auth/request-otp validates email format', async () => {
    // Mock the env var so the handler doesn't fail at module level
    process.env.AUTHORIZED_EMAIL = 'admin@deepmindq.com';
    process.env.EMAIL_API_KEY = 'test-key';

    // Mock fetch (for Resend email sending)
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ id: 'email-123' }), { status: 200 }),
    );

    // Mock cookies — need to mock the next/headers module
    vi.doMock('next/headers', () => ({
      cookies: vi.fn().mockResolvedValue({
        get: vi.fn().mockReturnValue(undefined),
        set: vi.fn(),
        delete: vi.fn(),
      }),
    }));

    // Mock DB used for best-effort OTP storage
    vi.doMock('@/lib/db', () => ({
      db: {
        otpCode: {
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
          create: vi.fn().mockResolvedValue({ id: 'otp-1' }),
        },
        user: {
          findUnique: vi.fn().mockResolvedValue({
            id: 'user-1',
            email: 'admin@deepmindq.com',
            name: 'Admin',
            role: 'admin',
            isActive: true,
          }),
          create: vi.fn().mockResolvedValue({ id: 'user-1' }),
        },
      },
    }));

    vi.resetModules();
    const { POST } = await import('@/app/api/auth/request-otp/route');

    // Send invalid email
    const response = await POST(mockJsonRequest(
      'http://localhost/api/auth/request-otp',
      { email: 'not-an-email' },
    ));
    const body = await parseJson(response);

    expect(response.status).toBe(400);
    expect(body.error).toContain('valid email');

    fetchSpy.mockRestore();
    vi.doUnmock('next/headers');
    vi.doUnmock('@/lib/db');
    vi.resetModules();
  });

  it('POST /api/auth/verify-otp rejects invalid code format', async () => {
    process.env.AUTHORIZED_EMAIL = 'admin@deepmindq.com';

    vi.doMock('next/headers', () => ({
      cookies: vi.fn().mockResolvedValue({
        get: vi.fn().mockReturnValue(undefined),
        set: vi.fn(),
        delete: vi.fn(),
      }),
    }));

    vi.doMock('@/lib/db', () => ({
      db: {
        user: {
          findUnique: vi.fn().mockResolvedValue(MOCK_SESSION),
        },
        otpCode: {
          findFirst: vi.fn().mockResolvedValue(null),
          updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        },
      },
    }));

    vi.doMock('@/lib/session', () => ({
      createSession: vi.fn().mockResolvedValue({ token: 'session-token', expiresAt: new Date() }),
    }));

    vi.resetModules();
    const { POST } = await import('@/app/api/auth/verify-otp/route');

    // Send code that's too short
    const response = await POST(mockJsonRequest(
      'http://localhost/api/auth/verify-otp',
      { email: 'admin@deepmindq.com', code: '123', purpose: 'login' },
    ));
    const body = await parseJson(response);

    expect(response.status).toBe(400);
    expect(body.error).toContain('6 digits');

    vi.doUnmock('next/headers');
    vi.doUnmock('@/lib/db');
    vi.doUnmock('@/lib/session');
    vi.resetModules();
  });

  it('GET /api/auth/me returns 401 when no session cookie', async () => {
    vi.doMock('next/headers', () => ({
      cookies: vi.fn().mockResolvedValue({
        get: vi.fn().mockReturnValue(undefined),
      }),
    }));

    vi.doMock('@/lib/session', () => ({
      getCurrentSession: vi.fn().mockResolvedValue(null),
    }));

    vi.resetModules();
    const { GET } = await import('@/app/api/auth/me/route');

    const response = await GET();
    const body = await parseJson(response);

    expect(response.status).toBe(401);
    expect(body.error).toBeDefined();

    vi.doUnmock('next/headers');
    vi.doUnmock('@/lib/session');
    vi.resetModules();
  });

  it('GET /api/auth/me returns user data when session is valid', async () => {
    vi.doMock('next/headers', () => ({
      cookies: vi.fn().mockResolvedValue({
        get: vi.fn().mockReturnValue({ value: 'valid-session-token-32chars!!' }),
      }),
    }));

    vi.doMock('@/lib/session', () => ({
      getCurrentSession: vi.fn().mockResolvedValue(MOCK_SESSION),
    }));

    vi.resetModules();
    const { GET } = await import('@/app/api/auth/me/route');

    const response = await GET();
    const body = await parseJson(response);

    expect(response.status).toBe(200);
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe('admin@deepmindq.com');

    vi.doUnmock('next/headers');
    vi.doUnmock('@/lib/session');
    vi.resetModules();
  });
});

// ─── 2. Company CRUD Journey ──────────────────────────────────────────────

describe('Journey: Company CRUD (POST → GET → PATCH)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const MOCK_COMPANY = {
    id: 'company-001',
    rawName: 'Acme Corp',
    normalizedName: 'acme corp',
    domain: 'acme.com',
    industry: 'Technology',
    sizeRange: '51-200',
    location: 'San Francisco, CA',
    country: 'US',
    website: 'https://acme.com',
    tags: '[]',
    status: 'prospect',
    lifecycleStage: 'discovery',
    source: 'manual',
    intelligenceScore: null,
    accountPriorityScore: null,
    opportunityRecommendations: [],
    signals: [],
    contacts: [],
    notes: [],
    researchCard: null,
    accountScore: null,
    _count: { contacts: 0, notes: 0, signals: 0 },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  it('POST /api/companies creates a new company and returns 201', async () => {
    vi.doMock('@/lib/api-auth', () => ({
      checkApiAuth: vi.fn().mockResolvedValue({ session: MOCK_SESSION }),
      filterResponseByRole: vi.fn((data: any) => data),
      filterResponseArrayByRole: vi.fn((data: any[]) => data),
    }));

    vi.doMock('@/lib/db', () => ({
      db: {
        company: {
          findFirst: vi.fn().mockResolvedValue(null),
          create: vi.fn().mockResolvedValue(MOCK_COMPANY),
        },
      },
    }));

    vi.doMock('@/lib/intelligence-activation', () => ({
      activateIntelligenceAsync: vi.fn(),
    }));

    vi.resetModules();
    const { POST } = await import('@/app/api/companies/route');

    const response = await POST(mockJsonRequest(
      'http://localhost/api/companies',
      { name: 'Acme Corp', domain: 'https://acme.com', industry: 'Technology' },
    ));

    expect(response.status).toBe(201);
    const body = await parseJson(response);
    expect(body.company).toBeDefined();
    expect(body.company.rawName).toBe('Acme Corp');

    vi.doUnmock('@/lib/api-auth');
    vi.doUnmock('@/lib/db');
    vi.doUnmock('@/lib/intelligence-activation');
    vi.resetModules();
  });

  it('GET /api/companies/:id returns company by ID', async () => {
    vi.doMock('@/lib/api-auth', () => ({
      checkApiAuth: vi.fn().mockResolvedValue({ session: MOCK_SESSION }),
      filterResponseByRole: vi.fn((data: any) => data),
      filterResponseArrayByRole: vi.fn((data: any[]) => data),
    }));

    vi.doMock('@/lib/db', () => ({
      db: {
        company: {
          findUnique: vi.fn().mockResolvedValue(MOCK_COMPANY),
        },
      },
    }));

    vi.resetModules();
    const { GET } = await import('@/app/api/companies/[id]/route');

    const response = await GET(
      mockGetRequest('http://localhost/api/companies/company-001'),
      { params: Promise.resolve({ id: 'company-001' }) },
    );

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.rawName).toBe('Acme Corp');
    expect(body.domain).toBe('acme.com');

    vi.doUnmock('@/lib/api-auth');
    vi.doUnmock('@/lib/db');
    vi.resetModules();
  });

  it('GET /api/companies/:id returns 404 for nonexistent company', async () => {
    vi.doMock('@/lib/api-auth', () => ({
      checkApiAuth: vi.fn().mockResolvedValue({ session: MOCK_SESSION }),
      filterResponseByRole: vi.fn((data: any) => data),
      filterResponseArrayByRole: vi.fn((data: any[]) => data),
    }));

    vi.doMock('@/lib/db', () => ({
      db: {
        company: {
          findUnique: vi.fn().mockResolvedValue(null),
        },
      },
    }));

    vi.resetModules();
    const { GET } = await import('@/app/api/companies/[id]/route');

    const response = await GET(
      mockGetRequest('http://localhost/api/companies/nonexistent-id'),
      { params: Promise.resolve({ id: 'nonexistent-id' }) },
    );

    expect(response.status).toBe(404);
    const body = await parseJson(response);
    expect(body.error).toContain('not found');

    vi.doUnmock('@/lib/api-auth');
    vi.doUnmock('@/lib/db');
    vi.resetModules();
  });

  it('PATCH /api/companies/:id updates company fields', async () => {
    const updatedCompany = {
      ...MOCK_COMPANY,
      rawName: 'Acme Corp Updated',
      normalizedName: 'acme corp updated',
      industry: 'FinTech',
    };

    vi.doMock('@/lib/api-auth', () => ({
      checkApiAuth: vi.fn().mockResolvedValue({ session: MOCK_SESSION }),
      filterResponseByRole: vi.fn((data: any) => data),
      filterResponseArrayByRole: vi.fn((data: any[]) => data),
    }));

    vi.doMock('@/lib/db', () => ({
      db: {
        company: {
          findUnique: vi.fn().mockResolvedValue(MOCK_COMPANY),
          update: vi.fn().mockResolvedValue(updatedCompany),
        },
      },
    }));

    vi.resetModules();
    const { PATCH } = await import('@/app/api/companies/[id]/route');

    const response = await PATCH(
      mockJsonRequest(
        'http://localhost/api/companies/company-001',
        { rawName: 'Acme Corp Updated', industry: 'FinTech' },
        'PATCH',
      ),
      { params: Promise.resolve({ id: 'company-001' }) },
    );

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.rawName).toBe('Acme Corp Updated');
    expect(body.industry).toBe('FinTech');

    vi.doUnmock('@/lib/api-auth');
    vi.doUnmock('@/lib/db');
    vi.resetModules();
  });
});

// ─── 3. Contact Intelligence Journey ───────────────────────────────────────

describe('Journey: Contact Intelligence (POST /api/ai/contact-intelligence)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POST recalculates contact scores for a company', async () => {
    const mockContacts = [
      {
        id: 'contact-1',
        rawName: 'Jane Doe',
        email: 'jane@acme.com',
        title: 'VP of Engineering',
        role: 'Executive',
        emailHealth: 'valid',
        emailHealthScore: 10,
        linkedinUrl: 'https://linkedin.com/in/jane',
        phone: '+1234567890',
        location: 'San Francisco, CA',
        enrichmentData: null,
        engagementScore: 60,
        leadScore: 0,
        companyId: 'company-001',
        company: {
          industry: 'Technology',
          sizeRange: '51-200',
        },
      },
    ];

    vi.doMock('@/lib/api-auth', () => ({
      checkApiAuth: vi.fn().mockResolvedValue({ session: MOCK_SESSION }),
      filterResponseByRole: vi.fn((data: any) => data),
      filterResponseArrayByRole: vi.fn((data: any[]) => data),
    }));

    vi.doMock('@/lib/db', () => ({
      db: {
        contact: {
          findMany: vi.fn().mockResolvedValue(mockContacts),
          update: vi.fn().mockResolvedValue({}),
        },
      },
    }));

    vi.resetModules();
    const { POST } = await import('@/app/api/ai/contact-intelligence/route');

    const response = await POST(mockJsonRequest(
      'http://localhost/api/ai/contact-intelligence',
      { companyId: 'company-001' },
    ));

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.success).toBe(true);
    expect(body.data.updated).toBe(1);
    expect(body.data.message).toContain('1 contact scores');

    vi.doUnmock('@/lib/api-auth');
    vi.doUnmock('@/lib/db');
    vi.resetModules();
  });

  it('POST returns 400 when companyId is missing', async () => {
    vi.doMock('@/lib/api-auth', () => ({
      checkApiAuth: vi.fn().mockResolvedValue({ session: MOCK_SESSION }),
      filterResponseByRole: vi.fn((data: any) => data),
      filterResponseArrayByRole: vi.fn((data: any[]) => data),
    }));

    vi.doMock('@/lib/db', () => ({
      db: {
        contact: {
          findMany: vi.fn().mockResolvedValue([]),
          update: vi.fn(),
        },
      },
    }));

    vi.resetModules();
    const { POST } = await import('@/app/api/ai/contact-intelligence/route');

    const response = await POST(mockJsonRequest(
      'http://localhost/api/ai/contact-intelligence',
      {},
    ));

    expect(response.status).toBe(400);
    const body = await parseJson(response);
    expect(body.error).toContain('companyId');

    vi.doUnmock('@/lib/api-auth');
    vi.doUnmock('@/lib/db');
    vi.resetModules();
  });
});

// ─── 4. AI Chat Journey ───────────────────────────────────────────────────

describe('Journey: AI Chat (POST /api/ai/chat)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('POST returns a response message', async () => {
    vi.doMock('@/lib/api-auth', () => ({
      checkApiAuth: vi.fn().mockResolvedValue({ session: MOCK_SESSION }),
      filterResponseByRole: vi.fn((data: any) => data),
      filterResponseArrayByRole: vi.fn((data: any[]) => data),
    }));

    vi.doMock('@/lib/db', () => ({
      db: {
        company: { findUnique: vi.fn().mockResolvedValue(null) },
        contact: { findUnique: vi.fn().mockResolvedValue(null) },
        pursuit: { findUnique: vi.fn().mockResolvedValue(null) },
      },
    }));

    // Mock the AI governance to fall through to template response
    vi.doMock('@/lib/ai-governance', () => ({
      governedAICallAggregate: vi.fn().mockRejectedValue(new Error('LLM unavailable')),
    }));

    vi.resetModules();
    const { POST } = await import('@/app/api/ai/chat/route');

    const response = await POST(mockJsonRequest(
      'http://localhost/api/ai/chat',
      { message: 'What are my hottest leads?' },
    ));

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.success).toBe(true);
    expect(body.data.message).toBeTruthy();
    // Template fallback should mention leads
    expect(typeof body.data.message).toBe('string');

    vi.doUnmock('@/lib/api-auth');
    vi.doUnmock('@/lib/db');
    vi.doUnmock('@/lib/ai-governance');
    vi.resetModules();
  });

  it('POST returns 400 when message is missing', async () => {
    vi.doMock('@/lib/api-auth', () => ({
      checkApiAuth: vi.fn().mockResolvedValue({ session: MOCK_SESSION }),
      filterResponseByRole: vi.fn((data: any) => data),
      filterResponseArrayByRole: vi.fn((data: any[]) => data),
    }));

    vi.resetModules();
    const { POST } = await import('@/app/api/ai/chat/route');

    const response = await POST(mockJsonRequest(
      'http://localhost/api/ai/chat',
      {},
    ));

    expect(response.status).toBe(400);
    const body = await parseJson(response);
    expect(body.error).toContain('Message');

    vi.doUnmock('@/lib/api-auth');
    vi.resetModules();
  });

  it('POST includes context when companyId is provided', async () => {
    const mockCompany = {
      id: 'company-001',
      rawName: 'Acme Corp',
      domain: 'acme.com',
      industry: 'Technology',
      sizeRange: '51-200',
      country: 'US',
      location: 'San Francisco, CA',
      website: 'https://acme.com',
      status: 'active',
      intelligenceScore: 75,
      contacts: [],
      researchCard: null,
      timeline: [],
    };

    vi.doMock('@/lib/api-auth', () => ({
      checkApiAuth: vi.fn().mockResolvedValue({ session: MOCK_SESSION }),
      filterResponseByRole: vi.fn((data: any) => data),
      filterResponseArrayByRole: vi.fn((data: any[]) => data),
    }));

    vi.doMock('@/lib/db', () => ({
      db: {
        company: { findUnique: vi.fn().mockResolvedValue(mockCompany) },
        contact: { findUnique: vi.fn().mockResolvedValue(null) },
        pursuit: { findUnique: vi.fn().mockResolvedValue(null) },
      },
    }));

    vi.doMock('@/lib/ai-governance', () => ({
      governedAICallAggregate: vi.fn().mockResolvedValue({
        success: true,
        response: 'Based on Acme Corp\'s profile, here are my insights...',
      }),
    }));

    vi.resetModules();
    const { POST } = await import('@/app/api/ai/chat/route');

    const response = await POST(mockJsonRequest(
      'http://localhost/api/ai/chat',
      {
        message: 'Tell me about this company',
        context: { companyId: 'company-001' },
      },
    ));

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.success).toBe(true);
    expect(body.data.message).toContain('Acme Corp');
    expect(body.data.sources).toContain('Company: Acme Corp');

    vi.doUnmock('@/lib/api-auth');
    vi.doUnmock('@/lib/db');
    vi.doUnmock('@/lib/ai-governance');
    vi.resetModules();
  });
});

// ─── 5. Recommendation Flow Journey ───────────────────────────────────────

describe('Journey: Recommendation Flow (GET /api/ai/opportunities)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  const MOCK_OPPORTUNITIES = [
    {
      id: 'opp-001',
      opportunityTitle: 'Expand into APAC market',
      priority: 'high',
      opportunityScore: 92,
      status: 'pending_review',
      createdAt: new Date(),
      company: {
        id: 'company-001',
        normalizedName: 'acme corp',
        industry: 'Technology',
        sizeRange: '51-200',
      },
      signal: {
        id: 'signal-001',
        signalType: 'hiring',
        title: 'New VP Sales hired',
        severity: 'high',
      },
      capabilityMatch: null,
    },
  ];

  it('GET returns paginated opportunities with stats', async () => {
    vi.doMock('@/lib/api-auth', () => ({
      checkApiAuth: vi.fn().mockResolvedValue({ session: MOCK_SESSION }),
      filterResponseByRole: vi.fn((data: any) => data),
      filterResponseArrayByRole: vi.fn((data: any[]) => data),
    }));

    vi.doMock('@/lib/db', () => ({
      db: {
        opportunityRecommendation: {
          findMany: vi.fn()
            .mockResolvedValueOnce(MOCK_OPPORTUNITIES)
            .mockResolvedValueOnce([
                { priority: 'high', status: 'pending_review' },
                { priority: 'medium', status: 'accepted' },
                { priority: 'low', status: 'rejected' },
              ]),
          count: vi.fn().mockResolvedValue(1),
        },
      },
    }));

    vi.resetModules();
    const { GET } = await import('@/app/api/ai/opportunities/route');

    const response = await GET(
      mockGetRequest('http://localhost/api/ai/opportunities?status=pending_review&page=1'),
    );

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.success).toBe(true);
    expect(body.data.opportunities).toHaveLength(1);
    expect(body.data.opportunities[0].opportunityTitle).toBe('Expand into APAC market');
    expect(body.data.stats).toBeDefined();
    expect(body.data.stats.total).toBe(3);
    expect(body.data.stats.byPriority).toEqual({ high: 1, medium: 1, low: 1 });
    expect(body.data.pagination).toBeDefined();
    expect(body.data.pagination.page).toBe(1);
    expect(body.data.pagination.pageSize).toBe(20);

    vi.doUnmock('@/lib/api-auth');
    vi.doUnmock('@/lib/db');
    vi.resetModules();
  });

  it('GET filters by status parameter', async () => {
    vi.doMock('@/lib/api-auth', () => ({
      checkApiAuth: vi.fn().mockResolvedValue({ session: MOCK_SESSION }),
      filterResponseByRole: vi.fn((data: any) => data),
      filterResponseArrayByRole: vi.fn((data: any[]) => data),
    }));

    vi.doMock('@/lib/db', () => ({
      db: {
        opportunityRecommendation: {
          findMany: vi.fn()
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]),
          count: vi.fn().mockResolvedValue(0),
        },
      },
    }));

    vi.resetModules();
    const { GET } = await import('@/app/api/ai/opportunities/route');

    const response = await GET(
      mockGetRequest('http://localhost/api/ai/opportunities?status=rejected&page=1'),
    );

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    expect(body.data.opportunities).toHaveLength(0);
    expect(body.data.pagination.total).toBe(0);

    vi.doUnmock('@/lib/api-auth');
    vi.doUnmock('@/lib/db');
    vi.resetModules();
  });

  it('GET ignores invalid status and returns all', async () => {
    vi.doMock('@/lib/api-auth', () => ({
      checkApiAuth: vi.fn().mockResolvedValue({ session: MOCK_SESSION }),
      filterResponseByRole: vi.fn((data: any) => data),
      filterResponseArrayByRole: vi.fn((data: any[]) => data),
    }));

    vi.doMock('@/lib/db', () => ({
      db: {
        opportunityRecommendation: {
          findMany: vi.fn()
            .mockResolvedValueOnce(MOCK_OPPORTUNITIES)
            .mockResolvedValueOnce([{ priority: 'high', status: 'pending_review' }]),
          count: vi.fn().mockResolvedValue(1),
        },
      },
    }));

    vi.resetModules();
    const { GET } = await import('@/app/api/ai/opportunities/route');

    const response = await GET(
      mockGetRequest('http://localhost/api/ai/opportunities?status=invalid_status&page=1'),
    );

    expect(response.status).toBe(200);
    const body = await parseJson(response);
    // Invalid status should be ignored, all records returned
    expect(body.data.opportunities).toHaveLength(1);

    vi.doUnmock('@/lib/api-auth');
    vi.doUnmock('@/lib/db');
    vi.resetModules();
  });
});
