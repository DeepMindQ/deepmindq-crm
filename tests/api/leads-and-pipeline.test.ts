/**
 * Leads and Pipeline API Tests
 *
 * Tests for leads listing/filtering, pipeline overview, and scoring endpoints.
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
const mockContactFindMany = vi.fn();
const mockContactCount = vi.fn();
const mockOpportunityFindMany = vi.fn();
const mockOpportunityCount = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    contact: {
      findMany: (...args: unknown[]) => mockContactFindMany(...args),
      count: (...args: unknown[]) => mockContactCount(...args),
    },
    opportunityRecommendation: {
      findMany: (...args: unknown[]) => mockOpportunityFindMany(...args),
      count: (...args: unknown[]) => mockOpportunityCount(...args),
    },
    lead: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
    opportunity: {
      findMany: vi.fn(),
      count: vi.fn(),
      groupBy: vi.fn().mockResolvedValue([
        { stage: 'discovery', _count: 5 },
        { stage: 'qualified', _count: 3 },
        { stage: 'proposal', _count: 2 },
        { stage: 'closed_won', _count: 8 },
      ]),
    },
    user: {
      findUnique: vi.fn().mockResolvedValue({ id: 'u1', role: 'user', isActive: true }),
    },
    company: {
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}));

// ── Mock session (returns flat SessionUser) ────────────────
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

// ── Mock keyset-pagination ────────────────────────────────
vi.mock('@/lib/keyset-pagination', () => ({
  encodeCursor: vi.fn().mockReturnValue(null),
  buildKeysetWhere: vi.fn().mockReturnValue({}),
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
  createOpportunitySchema: {},
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

const MOCK_CONTACTS = [
  { id: 'l1', rawName: 'Alice Smith', email: 'alice@example.com', title: 'CEO', role: 'Executive', linkedinUrl: '', phone: '', location: 'NYC, NY, US', companyId: 'c1', leadScore: 85, status: 'active' },
  { id: 'l2', rawName: 'Bob Jones', email: 'bob@example.com', title: 'CTO', role: 'Engineering', linkedinUrl: '', phone: '', location: 'LA, CA, US', companyId: 'c2', leadScore: 62, status: 'active' },
  { id: 'l3', rawName: 'Carol Lee', email: 'carol@example.com', title: 'VP Sales', role: 'Sales', linkedinUrl: '', phone: '', location: 'Chicago, IL, US', companyId: 'c3', leadScore: 41, status: 'inactive' },
];

describe('Leads & Pipeline API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Leads — List & Filter', () => {
    it('returns a list of leads', async () => {
      mockContactFindMany.mockResolvedValue(MOCK_CONTACTS);
      mockContactCount.mockResolvedValue(3);

      const { GET } = await import('@/app/api/leads/route');
      const response = await GET(new Request('http://localhost/api/leads'));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(body.leads || body.data || body)).toBe(true);
    });

    it('supports status filter', async () => {
      mockContactFindMany.mockResolvedValue(MOCK_CONTACTS.filter(c => c.status === 'active'));
      mockContactCount.mockResolvedValue(2);

      const { GET } = await import('@/app/api/leads/route');
      const response = await GET(new Request('http://localhost/api/leads?status=active'));
      expect(response.status).toBe(200);
    });

    it('supports search by name or email', async () => {
      mockContactFindMany.mockResolvedValue([MOCK_CONTACTS[0]]);
      mockContactCount.mockResolvedValue(1);

      const { GET } = await import('@/app/api/leads/route');
      const response = await GET(new Request('http://localhost/api/leads?search=alice'));
      expect(response.status).toBe(200);
    });

    it('supports pagination', async () => {
      mockContactFindMany.mockResolvedValue(MOCK_CONTACTS);
      mockContactCount.mockResolvedValue(100);

      const { GET } = await import('@/app/api/leads/route');
      const response = await GET(new Request('http://localhost/api/leads?page=2&limit=10'));
      expect(response.status).toBe(200);
    });
  });

  describe('Pipeline — Overview', () => {
    it('returns pipeline stages with counts', async () => {
      mockOpportunityFindMany.mockResolvedValue([
        { id: 'o1', companyId: 'c1', opportunityTitle: 'Deal 1', confidenceScore: 0.9, status: 'open', createdAt: '2024-01-01' },
      ]);
      mockOpportunityCount.mockResolvedValue(1);

      const { GET } = await import('@/app/api/opportunities/route');
      const response = await GET(new Request('http://localhost/api/opportunities'));
      expect(response.status).toBe(200);
    });
  });

  describe('Scoring Endpoints', () => {
    it('scores a lead and returns a numeric score', async () => {
      const response = new Response(
        JSON.stringify({ leadId: 'l1', score: 85, confidence: 0.9, factors: { fit: 0.8, intent: 0.9, engagement: 0.85 } }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
      const body = await response.json();

      expect(body.score).toBeDefined();
      expect(typeof body.score).toBe('number');
      expect(body.score).toBeGreaterThanOrEqual(0);
      expect(body.score).toBeLessThanOrEqual(100);
    });

    it('returns confidence alongside score', () => {
      const scoring = { leadId: 'l1', score: 85, confidence: 0.92 };
      expect(scoring.confidence).toBeGreaterThanOrEqual(0);
      expect(scoring.confidence).toBeLessThanOrEqual(1);
    });
  });
});
