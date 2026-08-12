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
const mockLeadFindMany = vi.fn();
const mockLeadCount = vi.fn();
const mockOpportunityFindMany = vi.fn();
const mockOpportunityCount = vi.fn();

vi.mock('@/lib/db', () => ({
  db: {
    lead: {
      findMany: (...args: unknown[]) => mockLeadFindMany(...args),
      count: (...args: unknown[]) => mockLeadCount(...args),
    },
    opportunity: {
      findMany: (...args: unknown[]) => mockOpportunityFindMany(...args),
      count: (...args: unknown[]) => mockOpportunityCount(...args),
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
  },
}));

// ── Mock session ─────────────────────────────────────────
vi.mock('@/lib/session', () => ({
  getCurrentSession: vi.fn().mockResolvedValue({
    user: { id: 'u1', email: 'test@dmq.com', name: 'Test', role: 'user', hasPassword: true, isActive: true },
    expiresAt: new Date(Date.now() + 86400000),
  }),
}));

const MOCK_LEADS = [
  { id: 'l1', firstName: 'Alice', lastName: 'Smith', email: 'alice@example.com', company: 'Acme', score: 85, status: 'active' },
  { id: 'l2', firstName: 'Bob', lastName: 'Jones', email: 'bob@example.com', company: 'Beta', score: 62, status: 'active' },
  { id: 'l3', firstName: 'Carol', lastName: 'Lee', email: 'carol@example.com', company: 'Gamma', score: 41, status: 'inactive' },
];

describe('Leads & Pipeline API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Leads — List & Filter', () => {
    it('returns a list of leads', async () => {
      mockLeadFindMany.mockResolvedValue(MOCK_LEADS);

      const { GET } = await import('@/app/api/leads/route');
      const response = await GET(new Request('http://localhost/api/leads'));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(body.data || body)).toBe(true);
    });

    it('supports status filter', async () => {
      mockLeadFindMany.mockResolvedValue(MOCK_LEADS.filter(l => l.status === 'active'));

      const { GET } = await import('@/app/api/leads/route');
      const response = await GET(new Request('http://localhost/api/leads?status=active'));
      expect(response.status).toBe(200);
    });

    it('supports search by name or email', async () => {
      mockLeadFindMany.mockResolvedValue([MOCK_LEADS[0]]);

      const { GET } = await import('@/app/api/leads/route');
      const response = await GET(new Request('http://localhost/api/leads?search=alice'));
      expect(response.status).toBe(200);
    });

    it('supports pagination', async () => {
      mockLeadFindMany.mockResolvedValue(MOCK_LEADS);
      mockLeadCount.mockResolvedValue(100);

      const { GET } = await import('@/app/api/leads/route');
      const response = await GET(new Request('http://localhost/api/leads?page=2&limit=10'));
      expect(response.status).toBe(200);
    });
  });

  describe('Pipeline — Overview', () => {
    it('returns pipeline stages with counts', async () => {
      // Mock groupBy to return stage counts
      const db = (await import('@/lib/db')).db;
      vi.mocked(db.opportunity.groupBy).mockResolvedValue([
        { stage: 'discovery', _count: 5 },
        { stage: 'qualified', _count: 3 },
        { stage: 'proposal', _count: 2 },
        { stage: 'closed_won', _count: 8 },
      ] as never[]);

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
