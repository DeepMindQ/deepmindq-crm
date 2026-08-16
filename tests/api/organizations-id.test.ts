/**
 * @vitest-environment node
 * GET /api/organizations/[id] — Focused Route Tests
 *
 * Covers validation, auth, DB interactions, include clause, and edge cases.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────────────

const { mockFindUnique } = vi.hoisted(() => ({
  mockFindUnique: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  checkApiAuth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    organization: {
      findUnique: mockFindUnique,
    },
  },
}));

import { checkApiAuth } from '@/lib/api-auth';
import { GET } from '@/app/api/organizations/[id]/route';

// ── Helpers ────────────────────────────────────────────────────────────

const mockSession = { id: 'user-1', email: 'test@example.com', role: 'admin' as const };

function makeRequest(url: string): NextRequest {
  return new NextRequest(url);
}

const mockOrgDetail = {
  id: 'org-1',
  name: 'Acme Corp',
  domain: 'acme.com',
  industry: 'SaaS',
  employeeCount: 200,
  intelligenceScore: 75,
  trackingStatus: 'active',
  lastSignalAt: new Date('2025-01-15'),
  updatedAt: new Date('2025-01-15'),
  people: [{ id: 'p-1', name: 'Alice' }],
  signals: [{ id: 's-1', type: 'hiring', status: 'detected' }],
  insights: [{ id: 'i-1', status: 'active' }],
  evidence: [{ id: 'e-1' }],
  briefings: [{ id: 'b-1' }],
  _count: { signals: 5, insights: 2, evidence: 10, briefings: 1, people: 3 },
};

describe('GET /api/organizations/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Auth ──────────────────────────────────────────────────────

  it('returns 401 when checkApiAuth returns errorResponse', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      errorResponse: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });

    const req = makeRequest('http://localhost/api/organizations/org-1');
    const res = await GET(req, { params: Promise.resolve({ id: 'org-1' }) });
    expect(res.status).toBe(401);
  });

  it('passes request to checkApiAuth', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      errorResponse: new Response(JSON.stringify({ error: 'No' }), { status: 401 }),
    });

    const req = makeRequest('http://localhost/api/organizations/org-1');
    await GET(req, { params: Promise.resolve({ id: 'org-1' }) });
    expect(checkApiAuth).toHaveBeenCalledWith(req);
  });

  // ── Validation ────────────────────────────────────────────────

  it('returns 400 for empty string ID', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = makeRequest('http://localhost/api/organizations/');
    const res = await GET(req, { params: Promise.resolve({ id: '' }) });
    expect(res.status).toBe(400);

    const body = await res.json();
    expect(body.error).toContain('Invalid organization ID');
    expect(body.details).toBeDefined();
  });

  it('returns 400 with validation details for empty ID', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = makeRequest('http://localhost/api/organizations/');
    const res = await GET(req, { params: Promise.resolve({ id: '' }) });
    const body = await res.json();

    // zod safeParse().error.flatten() produces fieldErrors
    expect(body.details).toHaveProperty('fieldErrors');
  });

  // ── Success ──────────────────────────────────────────────────

  it('returns 200 with organization data', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockFindUnique.mockResolvedValue(mockOrgDetail);

    const req = makeRequest('http://localhost/api/organizations/org-1');
    const res = await GET(req, { params: Promise.resolve({ id: 'org-1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.id).toBe('org-1');
    expect(body.data.name).toBe('Acme Corp');
  });

  it('queries DB with the validated ID', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockFindUnique.mockResolvedValue(mockOrgDetail);

    const req = makeRequest('http://localhost/api/organizations/org-1');
    await GET(req, { params: Promise.resolve({ id: 'org-1' }) });

    expect(mockFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'org-1' } }),
    );
  });

  it('includes signals with status filter and take limit', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockFindUnique.mockResolvedValue(mockOrgDetail);

    const req = makeRequest('http://localhost/api/organizations/org-1');
    await GET(req, { params: Promise.resolve({ id: 'org-1' }) });

    const callArgs = mockFindUnique.mock.calls[0][0] as any;
    expect(callArgs.include.signals).toEqual({
      where: { status: { in: ['detected', 'validated', 'analyzed'] } },
      orderBy: { detectedAt: 'desc' },
      take: 20,
    });
  });

  it('includes insights with status=active filter and take limit', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockFindUnique.mockResolvedValue(mockOrgDetail);

    const req = makeRequest('http://localhost/api/organizations/org-1');
    await GET(req, { params: Promise.resolve({ id: 'org-1' }) });

    const callArgs = mockFindUnique.mock.calls[0][0] as any;
    expect(callArgs.include.insights).toEqual({
      where: { status: 'active' },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  });

  it('includes people ordered by updatedAt desc', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockFindUnique.mockResolvedValue(mockOrgDetail);

    const req = makeRequest('http://localhost/api/organizations/org-1');
    await GET(req, { params: Promise.resolve({ id: 'org-1' }) });

    const callArgs = mockFindUnique.mock.calls[0][0] as any;
    expect(callArgs.include.people).toEqual({
      orderBy: { updatedAt: 'desc' },
    });
  });

  it('includes evidence ordered by createdAt desc with take 20', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockFindUnique.mockResolvedValue(mockOrgDetail);

    const req = makeRequest('http://localhost/api/organizations/org-1');
    await GET(req, { params: Promise.resolve({ id: 'org-1' }) });

    const callArgs = mockFindUnique.mock.calls[0][0] as any;
    expect(callArgs.include.evidence).toEqual({
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  });

  it('includes briefings ordered by generatedAt desc with take 1', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockFindUnique.mockResolvedValue(mockOrgDetail);

    const req = makeRequest('http://localhost/api/organizations/org-1');
    await GET(req, { params: Promise.resolve({ id: 'org-1' }) });

    const callArgs = mockFindUnique.mock.calls[0][0] as any;
    expect(callArgs.include.briefings).toEqual({
      orderBy: { generatedAt: 'desc' },
      take: 1,
    });
  });

  it('includes _count with select for signals, insights, evidence, briefings, people', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockFindUnique.mockResolvedValue(mockOrgDetail);

    const req = makeRequest('http://localhost/api/organizations/org-1');
    await GET(req, { params: Promise.resolve({ id: 'org-1' }) });

    const callArgs = mockFindUnique.mock.calls[0][0] as any;
    expect(callArgs.include._count).toEqual({
      select: {
        signals: true,
        insights: true,
        evidence: true,
        briefings: true,
        people: true,
      },
    });
  });

  // ── 404 ──────────────────────────────────────────────────────

  it('returns 404 when organization not found', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockFindUnique.mockResolvedValue(null);

    const req = makeRequest('http://localhost/api/organizations/nonexistent');
    const res = await GET(req, { params: Promise.resolve({ id: 'nonexistent' }) });

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('Organization not found');
  });

  // ── 500 ──────────────────────────────────────────────────────

  it('returns 500 when DB throws an error', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockFindUnique.mockRejectedValue(new Error('Connection lost'));

    const req = makeRequest('http://localhost/api/organizations/org-1');
    const res = await GET(req, { params: Promise.resolve({ id: 'org-1' }) });

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to fetch organization');
  });

  it('returns 500 when DB rejects with non-Error', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockFindUnique.mockRejectedValue('string error');

    const req = makeRequest('http://localhost/api/organizations/org-1');
    const res = await GET(req, { params: Promise.resolve({ id: 'org-1' }) });
    expect(res.status).toBe(500);
  });

  // ── Additional edge cases ──────────────────────────────────────

  it('accepts valid UUID-like IDs', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockFindUnique.mockResolvedValue(mockOrgDetail);

    const req = makeRequest(
      'http://localhost/api/organizations/550e8400-e29b-41d4-a716-446655440000',
    );
    const res = await GET(req, {
      params: Promise.resolve({ id: '550e8400-e29b-41d4-a716-446655440000' }),
    });
    expect(res.status).toBe(200);
  });

  it('returns 200 for whitespace-only ID (zod min(1) allows spaces)', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockFindUnique.mockResolvedValue({ ...mockOrgDetail, id: '   ' });

    const req = makeRequest('http://localhost/api/organizations/org-1');
    const res = await GET(req, { params: Promise.resolve({ id: '   ' }) });
    expect(res.status).toBe(200); // zod.string().min(1) doesn't trim
  });

  it('returns organization with full include structure', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockFindUnique.mockResolvedValue(mockOrgDetail);

    const req = makeRequest('http://localhost/api/organizations/org-1');
    const res = await GET(req, { params: Promise.resolve({ id: 'org-1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveProperty('people');
    expect(body.data).toHaveProperty('signals');
    expect(body.data).toHaveProperty('insights');
    expect(body.data).toHaveProperty('evidence');
    expect(body.data).toHaveProperty('briefings');
    expect(body.data).toHaveProperty('_count');
  });

  it('handles organization with empty related data', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockFindUnique.mockResolvedValue({
      ...mockOrgDetail,
      people: [],
      signals: [],
      insights: [],
      evidence: [],
      briefings: [],
      _count: { signals: 0, insights: 0, evidence: 0, briefings: 0, people: 0 },
    });

    const req = makeRequest('http://localhost/api/organizations/empty-org');
    const res = await GET(req, { params: Promise.resolve({ id: 'empty-org' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.people).toEqual([]);
  });

  it('response body has data wrapper property', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockFindUnique.mockResolvedValue(mockOrgDetail);

    const req = makeRequest('http://localhost/api/organizations/org-1');
    const res = await GET(req, { params: Promise.resolve({ id: 'org-1' }) });
    const body = await res.json();

    expect(body).toHaveProperty('data');
    expect(body).not.toHaveProperty('error');
  });

  it('error response format for 404 contains error string', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockFindUnique.mockResolvedValue(null);

    const req = makeRequest('http://localhost/api/organizations/missing');
    const res = await GET(req, { params: Promise.resolve({ id: 'missing' }) });
    const body = await res.json();

    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
  });

  it('error response format for 400 contains error and details', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = makeRequest('http://localhost/api/organizations/org-1');
    const res = await GET(req, { params: Promise.resolve({ id: '' }) });
    const body = await res.json();

    expect(body).toHaveProperty('error');
    expect(body).toHaveProperty('details');
  });

  it('error response format for 500 contains error string', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockFindUnique.mockRejectedValue(new Error('DB down'));

    const req = makeRequest('http://localhost/api/organizations/org-1');
    const res = await GET(req, { params: Promise.resolve({ id: 'org-1' }) });
    const body = await res.json();

    expect(body).toHaveProperty('error');
    expect(typeof body.error).toBe('string');
  });
});
