// ═══════════════════════════════════════════════════════════════════════════
// People API — Route Tests
//
// Tests GET /api/people (list with search, role, org filters, sort, pagination).
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/api-auth', () => ({
  checkApiAuth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    person: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}));

vi.mock('@/lib/rbac', () => ({
  authorizeRoute: vi.fn().mockReturnValue({ authorized: true }),
}));

import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { GET } from '@/app/api/people/route';

// ── Helpers ────────────────────────────────────────────────────────────

const mockSession = { id: 'user-1', email: 'test@example.com', role: 'admin' as const };

function makeAuthRequest(url: string): NextRequest {
  return new NextRequest(url);
}

// ── Test Data ──────────────────────────────────────────────────────────

const mockPerson1 = {
  id: 'person-1',
  fullName: 'Alice Johnson',
  email: 'alice@acme.com',
  title: 'CTO',
  role: 'executive',
  department: 'Engineering',
  seniority: 'senior',
  linkedInUrl: 'https://linkedin.com/in/alice',
  notes: null,
  organizationId: 'org-1',
  source: 'manual',
  firstSeenAt: new Date('2025-01-10'),
  updatedAt: new Date('2025-01-15'),
  organization: { id: 'org-1', name: 'Acme Corp' },
};

const mockPerson2 = {
  id: 'person-2',
  fullName: 'Bob Smith',
  email: 'bob@beta.io',
  title: 'VP Sales',
  role: 'decision_maker',
  department: 'Sales',
  seniority: 'director',
  linkedInUrl: null,
  notes: 'Key contact',
  organizationId: 'org-2',
  source: 'enrichment',
  firstSeenAt: new Date('2025-01-05'),
  updatedAt: new Date('2025-01-14'),
  organization: { id: 'org-2', name: 'Beta Inc' },
};

// ── GET /api/people ────────────────────────────────────────────────────

describe('GET /api/people', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no session', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: null,
      errorResponse: new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 }),
    });

    const req = new NextRequest('http://localhost/api/people');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns people with pagination defaults', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.person.findMany).mockResolvedValue([mockPerson1, mockPerson2]);
    vi.mocked(db.person.count).mockResolvedValue(2);

    const req = makeAuthRequest('http://localhost/api/people');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(body.pagination).toEqual({ page: 1, limit: 50, total: 2, pages: 1 });
  });

  it('searches across name, email, title, and department', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.person.findMany).mockResolvedValue([mockPerson1]);
    vi.mocked(db.person.count).mockResolvedValue(1);

    const req = makeAuthRequest('http://localhost/api/people?search=Alice');
    await GET(req);

    expect(db.person.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { fullName: { contains: 'Alice', mode: 'insensitive' } },
            { email: { contains: 'Alice', mode: 'insensitive' } },
            { title: { contains: 'Alice', mode: 'insensitive' } },
            { department: { contains: 'Alice', mode: 'insensitive' } },
          ],
        }),
      }),
    );
  });

  it('searches by email', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.person.findMany).mockResolvedValue([mockPerson1]);
    vi.mocked(db.person.count).mockResolvedValue(1);

    const req = makeAuthRequest('http://localhost/api/people?search=alice@acme.com');
    await GET(req);

    // Should pass search to all OR fields — DB will match on email
    const callArgs = vi.mocked(db.person.findMany).mock.calls[0][0] as any;
    expect(callArgs.where.OR).toBeDefined();
    expect(callArgs.where.OR).toHaveLength(4);
  });

  it('filters by role', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.person.findMany).mockResolvedValue([mockPerson1]);
    vi.mocked(db.person.count).mockResolvedValue(1);

    const req = makeAuthRequest('http://localhost/api/people?role=executive');
    await GET(req);

    expect(db.person.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: 'executive' }),
      }),
    );
  });

  it('does not filter when role=all', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.person.findMany).mockResolvedValue([mockPerson1, mockPerson2]);
    vi.mocked(db.person.count).mockResolvedValue(2);

    const req = makeAuthRequest('http://localhost/api/people?role=all');
    await GET(req);

    const callArgs = vi.mocked(db.person.findMany).mock.calls[0][0] as any;
    expect(callArgs.where.role).toBeUndefined();
  });

  it('filters by organization (name or domain)', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.person.findMany).mockResolvedValue([mockPerson1]);
    vi.mocked(db.person.count).mockResolvedValue(1);

    const req = makeAuthRequest('http://localhost/api/people?organization=Acme');
    await GET(req);

    expect(db.person.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organization: {
            OR: [
              { name: { contains: 'Acme', mode: 'insensitive' } },
              { domain: { contains: 'Acme', mode: 'insensitive' } },
            ],
          },
        }),
      }),
    );
  });

  it('sorts by fullName ascending', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.person.findMany).mockResolvedValue([mockPerson1, mockPerson2]);
    vi.mocked(db.person.count).mockResolvedValue(2);

    const req = makeAuthRequest('http://localhost/api/people?sort=fullName&sortDir=asc');
    await GET(req);

    expect(db.person.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { fullName: 'asc' },
      }),
    );
  });

  it('sorts by email descending', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.person.findMany).mockResolvedValue([]);
    vi.mocked(db.person.count).mockResolvedValue(0);

    const req = makeAuthRequest('http://localhost/api/people?sort=email&sortDir=desc');
    await GET(req);

    expect(db.person.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { email: 'desc' },
      }),
    );
  });

  it('sorts by createdAt', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.person.findMany).mockResolvedValue([]);
    vi.mocked(db.person.count).mockResolvedValue(0);

    const req = makeAuthRequest('http://localhost/api/people?sort=createdAt&sortDir=asc');
    await GET(req);

    expect(db.person.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { createdAt: 'asc' },
      }),
    );
  });

  it('defaults sort to updatedAt desc', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.person.findMany).mockResolvedValue([]);
    vi.mocked(db.person.count).mockResolvedValue(0);

    const req = makeAuthRequest('http://localhost/api/people');
    await GET(req);

    expect(db.person.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { updatedAt: 'desc' },
      }),
    );
  });

  it('paginates correctly with page and limit', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.person.findMany).mockResolvedValue([]);
    vi.mocked(db.person.count).mockResolvedValue(55);

    const req = makeAuthRequest('http://localhost/api/people?page=2&limit=10');
    const res = await GET(req);
    const body = await res.json();

    expect(db.person.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
    expect(body.pagination).toEqual({ page: 2, limit: 10, total: 55, pages: 6 });
  });

  it('returns 400 for invalid sort field', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = makeAuthRequest('http://localhost/api/people?sort=invalidField');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid sortDir', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = makeAuthRequest('http://localhost/api/people?sortDir=horizontal');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('includes organization relation in response', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.person.findMany).mockResolvedValue([mockPerson1]);
    vi.mocked(db.person.count).mockResolvedValue(1);

    const req = makeAuthRequest('http://localhost/api/people');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data[0].organization).toEqual({ id: 'org-1', name: 'Acme Corp' });
  });

  it('returns 500 when db throws', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.person.findMany).mockRejectedValue(new Error('DB down'));

    const req = makeAuthRequest('http://localhost/api/people');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });
});
