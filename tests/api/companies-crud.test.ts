/**
 * Companies CRUD API Tests
 *
 * Tests for GET/POST/PUT/DELETE operations on /api/companies.
 * Mocks database layer for unit-level API testing.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock next/server ───────────────────────────────────────
vi.mock('next/server', () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) =>
      new Response(JSON.stringify(data), {
        status: init?.status || 200,
        headers: { 'Content-Type': 'application/json' },
      }),
  },
}));

// ── Mock DB ───────────────────────────────────────────────
const mockCompanyFindMany = vi.fn();
const mockCompanyFindUnique = vi.fn();
const mockCompanyCreate = vi.fn();
const mockCompanyUpdate = vi.fn();
const mockCompanyDelete = vi.fn();
const mockCompanyCount = vi.fn();
const mockCompanyFindFirst = vi.fn();
const mockCompanyGroupBy = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    company: {
      findMany: (...args: unknown[]) => mockCompanyFindMany(...args),
      findUnique: (...args: unknown[]) => mockCompanyFindUnique(...args),
      create: (...args: unknown[]) => mockCompanyCreate(...args),
      update: (...args: unknown[]) => mockCompanyUpdate(...args),
      delete: (...args: unknown[]) => mockCompanyDelete(...args),
      count: (...args: unknown[]) => mockCompanyCount(...args),
      findFirst: (...args: unknown[]) => mockCompanyFindFirst(...args),
      groupBy: (...args: unknown[]) => mockCompanyGroupBy(...args),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: 'u1', role: 'user', isActive: true }),
    },
  },
}));

// ── Mock session (returns flat SessionUser, not {user:...}) ──
vi.mock('@/lib/session', () => ({
  getCurrentSession: vi.fn().mockResolvedValue({
    id: 'u1',
    email: 'test@dmq.com',
    name: 'Test',
    role: 'admin',
    hasPassword: true,
    isActive: true,
    phone: null,
    company: null,
    designation: null,
    avatarUrl: null,
  }),
  destroyCurrentSession: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock api-logging-middleware (pass-through) ─────────────
vi.mock('@/lib/api-logging-middleware', () => ({
  withApiLogging: (handler: Function) => handler,
}));

// ── Mock apiHelpers ───────────────────────────────────────
vi.mock('@/lib/apiHelpers', () => ({
  validateBody: vi.fn().mockImplementation((_schema: unknown, body: unknown) => body),
  sanitize: vi.fn().mockImplementation((s: string) => s),
  safeInt: vi.fn().mockImplementation((val: string | null, def: number) => val ? parseInt(val, 10) || def : def),
  apiError: vi.fn().mockImplementation((msg: string, status: number) =>
    new Response(JSON.stringify({ error: msg }), { status, headers: { 'Content-Type': 'application/json' } })
  ),
  apiSuccess: vi.fn().mockImplementation((data: unknown, status?: number) =>
    new Response(JSON.stringify({ success: true, data }), {
      status: status || 200,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
}));

// ── Mock validations ──────────────────────────────────────
vi.mock('@/lib/validations', () => ({
  createCompanySchema: {},
  updateCompanySchema: {},
}));

// ── Mock intelligence-activation ──────────────────────────
vi.mock('@/lib/intelligence-activation', () => ({
  activateIntelligenceAsync: vi.fn(),
}));

// ── Mock rbac-enforcement ─────────────────────────────────
vi.mock('@/lib/rbac-enforcement', () => ({
  filterObjectByRole: vi.fn().mockImplementation((obj: unknown) => obj),
  filterArrayByRole: vi.fn().mockImplementation((arr: unknown[]) => arr),
}));

// ── Mock audit-logger (imported transitively by rbac.ts) ──
vi.mock('@/lib/audit-logger', () => ({
  audit: vi.fn().mockResolvedValue(undefined),
}));

// ── Mock logger ──────────────────────────────────────────
vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

const MOCK_COMPANIES = [
  { id: 'c1', name: 'Acme Corp', website: 'https://acme.com', industry: 'Technology', createdAt: '2024-01-01', rawName: 'Acme Corp', normalizedName: 'acme corp', domain: 'acme.com', status: 'prospect', priorityTier: 'HOT', accountPriorityScore: 80, intelligenceScore: 75, _count: { contacts: 5, signals: 2, opportunityRecommendations: 1 }, researchCard: null, accountScore: null, opportunityRecommendations: [{ opportunityScore: 85 }], signals: [] },
  { id: 'c2', name: 'Beta Inc', website: 'https://beta.com', industry: 'Finance', createdAt: '2024-02-01', rawName: 'Beta Inc', normalizedName: 'beta inc', domain: 'beta.com', status: 'prospect', priorityTier: 'ACTIVE', accountPriorityScore: 60, intelligenceScore: 50, _count: { contacts: 3, signals: 1, opportunityRecommendations: 0 }, researchCard: { id: 'rc1' }, accountScore: { score: 70, category: 'warm' }, opportunityRecommendations: [], signals: [{ id: 's1', title: 'Funding', signalType: 'funding', impact: 'high' }] },
  { id: 'c3', name: 'Gamma LLC', website: 'https://gamma.com', industry: 'Healthcare', createdAt: '2024-03-01', rawName: 'Gamma LLC', normalizedName: 'gamma llc', domain: 'gamma.com', status: 'prospect', priorityTier: null, accountPriorityScore: null, intelligenceScore: null, _count: { contacts: 0, signals: 0, opportunityRecommendations: 2 }, researchCard: null, accountScore: null, opportunityRecommendations: [], signals: [] },
];

describe('Companies CRUD API', () => {
  let mockGetCurrentSession: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    // Restore default session mock
    const session = await import('@/lib/session');
    mockGetCurrentSession = vi.mocked(session.getCurrentSession);
    mockGetCurrentSession.mockResolvedValue({
      id: 'u1',
      email: 'test@dmq.com',
      name: 'Test',
      role: 'admin',
      hasPassword: true,
      isActive: true,
      phone: null,
      company: null,
      designation: null,
      avatarUrl: null,
    });
  });

  describe('GET /api/companies — List', () => {
    it('returns a list of companies', async () => {
      mockCompanyFindMany.mockResolvedValue(MOCK_COMPANIES);
      mockCompanyCount.mockResolvedValue(3);
      mockCompanyGroupBy
        .mockResolvedValueOnce([{ priorityTier: 'HOT', _count: 1 }])
        .mockResolvedValueOnce([{ status: 'prospect', _count: 3 }]);

      const { GET } = await import('@/app/api/companies/route');
      const response = await GET(new Request('http://localhost/api/companies'));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body.companies || Array.isArray(body)).toBeTruthy();
    });

    it('supports pagination (page + limit)', async () => {
      mockCompanyFindMany.mockResolvedValue(MOCK_COMPANIES.slice(0, 2));
      mockCompanyCount.mockResolvedValue(3);
      mockCompanyGroupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const { GET } = await import('@/app/api/companies/route');
      const response = await GET(new Request('http://localhost/api/companies?page=1&limit=2'));
      expect(response.status).toBe(200);
    });

    it('supports search filter', async () => {
      mockCompanyFindMany.mockResolvedValue([MOCK_COMPANIES[0]]);
      mockCompanyCount.mockResolvedValue(1);
      mockCompanyGroupBy
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const { GET } = await import('@/app/api/companies/route');
      const response = await GET(new Request('http://localhost/api/companies?search=Acme'));
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/companies/[id] — Detail', () => {
    it('returns a single company by ID', async () => {
      mockCompanyFindUnique.mockResolvedValue({
        ...MOCK_COMPANIES[0],
        _count: { contacts: 5, notes: 2, signals: 3 },
      });

      const { GET } = await import('@/app/api/companies/[id]/route');
      const response = await GET(
        new Request('http://localhost/api/companies/c1'),
        { params: Promise.resolve({ id: 'c1' }) } as never,
      );
      expect(response.status).toBe(200);
    });

    it('returns 404 for non-existent company', async () => {
      mockCompanyFindUnique.mockResolvedValue(null);

      const { GET } = await import('@/app/api/companies/[id]/route');
      const response = await GET(
        new Request('http://localhost/api/companies/nonexistent'),
        { params: Promise.resolve({ id: 'nonexistent' }) } as never,
      );
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/companies — Create', () => {
    it('creates a new company', async () => {
      mockCompanyFindFirst.mockResolvedValue(null);
      mockCompanyCreate.mockResolvedValue({ id: 'c-new', name: 'New Co', _count: { contacts: 0, signals: 0 } });

      const { POST } = await import('@/app/api/companies/route');
      const response = await POST(
        new Request('http://localhost/api/companies', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'New Co', website: 'https://new.co' }),
        }),
      );
      expect(response.status).toBeLessThan(400);
      expect(mockCompanyCreate).toHaveBeenCalled();
    });
  });

  describe('PATCH /api/companies/[id] — Update', () => {
    it('updates an existing company', async () => {
      mockCompanyFindUnique.mockResolvedValue({
        ...MOCK_COMPANIES[0],
        _count: { contacts: 5, notes: 2, signals: 3 },
      });
      mockCompanyUpdate.mockResolvedValue({
        ...MOCK_COMPANIES[0],
        name: 'Acme Updated',
        _count: { contacts: 5, notes: 2, signals: 3 },
      });

      const { PATCH } = await import('@/app/api/companies/[id]/route');
      const response = await PATCH(
        new Request('http://localhost/api/companies/c1', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Acme Updated' }),
        }),
        { params: Promise.resolve({ id: 'c1' }) } as never,
      );
      expect(response.status).toBeLessThan(400);
    });
  });

  describe('DELETE /api/companies/[id] — Delete', () => {
    it('deletes a company', async () => {
      mockCompanyFindUnique.mockResolvedValue(MOCK_COMPANIES[0]);
      mockCompanyDelete.mockResolvedValue(MOCK_COMPANIES[0]);

      const { DELETE } = await import('@/app/api/companies/[id]/route');
      const response = await DELETE(
        new Request('http://localhost/api/companies/c1', { method: 'DELETE' }),
        { params: Promise.resolve({ id: 'c1' }) } as never,
      );
      expect(response.status).toBeLessThan(400);
    });
  });

  describe('Authorization', () => {
    it('rejects unauthenticated requests with 401', async () => {
      const { getCurrentSession } = await import('@/lib/session');
      vi.mocked(getCurrentSession).mockResolvedValue(null);

      const { GET } = await import('@/app/api/companies/route');
      const response = await GET(new Request('http://localhost/api/companies'));
      expect(response.status).toBe(401);
    });
  });
});
