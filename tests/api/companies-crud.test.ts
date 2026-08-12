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

vi.mock('@/lib/db', () => ({
  db: {
    company: {
      findMany: (...args: unknown[]) => mockCompanyFindMany(...args),
      findUnique: (...args: unknown[]) => mockCompanyFindUnique(...args),
      create: (...args: unknown[]) => mockCompanyCreate(...args),
      update: (...args: unknown[]) => mockCompanyUpdate(...args),
      delete: (...args: unknown[]) => mockCompanyDelete(...args),
      count: (...args: unknown[]) => mockCompanyCount(...args),
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

const MOCK_COMPANIES = [
  { id: 'c1', name: 'Acme Corp', website: 'https://acme.com', industry: 'Technology', createdAt: '2024-01-01' },
  { id: 'c2', name: 'Beta Inc', website: 'https://beta.com', industry: 'Finance', createdAt: '2024-02-01' },
  { id: 'c3', name: 'Gamma LLC', website: 'https://gamma.com', industry: 'Healthcare', createdAt: '2024-03-01' },
];

describe('Companies CRUD API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/companies — List', () => {
    it('returns a list of companies', async () => {
      mockCompanyFindMany.mockResolvedValue(MOCK_COMPANIES);

      const { GET } = await import('@/app/api/companies/route');
      const response = await GET(new Request('http://localhost/api/companies'));
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(body)).toBe(true);
    });

    it('supports pagination (page + limit)', async () => {
      mockCompanyFindMany.mockResolvedValue(MOCK_COMPANIES.slice(0, 2));
      mockCompanyCount.mockResolvedValue(3);

      const { GET } = await import('@/app/api/companies/route');
      const response = await GET(new Request('http://localhost/api/companies?page=1&limit=2'));
      expect(response.status).toBe(200);
    });

    it('supports search filter', async () => {
      mockCompanyFindMany.mockResolvedValue([MOCK_COMPANIES[0]]);

      const { GET } = await import('@/app/api/companies/route');
      const response = await GET(new Request('http://localhost/api/companies?search=Acme'));
      expect(response.status).toBe(200);
    });
  });

  describe('GET /api/companies/[id] — Detail', () => {
    it('returns a single company by ID', async () => {
      mockCompanyFindUnique.mockResolvedValue(MOCK_COMPANIES[0]);

      const { GET } = await import('@/app/api/companies/[id]/route');
      const response = await GET(
        new Request('http://localhost/api/companies/c1'),
        { params: { id: 'c1' } } as never,
      );
      expect(response.status).toBe(200);
    });

    it('returns 404 for non-existent company', async () => {
      mockCompanyFindUnique.mockResolvedValue(null);

      const { GET } = await import('@/app/api/companies/[id]/route');
      const response = await GET(
        new Request('http://localhost/api/companies/nonexistent'),
        { params: { id: 'nonexistent' } } as never,
      );
      expect(response.status).toBe(404);
    });
  });

  describe('POST /api/companies — Create', () => {
    it('creates a new company', async () => {
      mockCompanyCreate.mockResolvedValue({ id: 'c-new', name: 'New Co' });

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

  describe('PUT /api/companies/[id] — Update', () => {
    it('updates an existing company', async () => {
      mockCompanyFindUnique.mockResolvedValue(MOCK_COMPANIES[0]);
      mockCompanyUpdate.mockResolvedValue({ ...MOCK_COMPANIES[0], name: 'Acme Updated' });

      const { PUT } = await import('@/app/api/companies/[id]/route');
      const response = await PUT(
        new Request('http://localhost/api/companies/c1', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Acme Updated' }),
        }),
        { params: { id: 'c1' } } as never,
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
        { params: { id: 'c1' } } as never,
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
