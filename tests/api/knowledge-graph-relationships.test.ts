/**
 * @vitest-environment node
 * /api/knowledge-graph/relationships — Route Tests
 *
 * Tests POST (create relationship) and GET (find connection paths).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────────────

const { mockCreateRelationship, mockGetConnectionPaths } = vi.hoisted(() => ({
  mockCreateRelationship: vi.fn(),
  mockGetConnectionPaths: vi.fn(),
}));

vi.mock('@/lib/api-auth', () => ({
  checkApiAuth: vi.fn(),
}));

vi.mock('@/lib/intelligence/knowledge-graph', () => ({
  createRelationship: mockCreateRelationship,
  getConnectionPaths: mockGetConnectionPaths,
}));

import { checkApiAuth } from '@/lib/api-auth';
import { POST, GET } from '@/app/api/knowledge-graph/relationships/route';

// ── Helpers ────────────────────────────────────────────────────────────

const mockSession = { id: 'user-1', email: 'test@example.com', role: 'admin' as const };

function makeRequest(url: string, body?: object): NextRequest {
  const req = new NextRequest(url, {
    ...(body ? { method: 'POST', body: JSON.stringify(body) } : {}),
  });
  if (body) {
    req.headers.set('Content-Type', 'application/json');
  }
  return req;
}

// ── POST ──────────────────────────────────────────────────────────────

describe('POST /api/knowledge-graph/relationships', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      errorResponse: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });

    const req = makeRequest('http://localhost/api/knowledge-graph/relationships');
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when body is missing type', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = makeRequest('http://localhost/api/knowledge-graph/relationships', {
      sourceOrgId: 'a',
      targetOrgId: 'b',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid request body');
  });

  it('returns 400 when missing source and target', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = makeRequest('http://localhost/api/knowledge-graph/relationships', {
      type: 'works_with',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when only source is provided', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = makeRequest('http://localhost/api/knowledge-graph/relationships', {
      type: 'works_with',
      sourceOrgId: 'org-a',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('creates relationship with org-to-org IDs', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    const mockEdge = { id: 'e-1', type: 'works_with', sourceOrgId: 'a', targetOrgId: 'b' };
    mockCreateRelationship.mockResolvedValue(mockEdge);

    const req = makeRequest('http://localhost/api/knowledge-graph/relationships', {
      type: 'works_with',
      label: 'Partnership',
      weight: 0.8,
      sourceOrgId: 'a',
      targetOrgId: 'b',
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.data).toEqual(mockEdge);
    expect(mockCreateRelationship).toHaveBeenCalledWith({
      type: 'works_with',
      label: 'Partnership',
      weight: 0.8,
      sourceOrgId: 'a',
      targetOrgId: 'b',
      sourcePersonId: undefined,
      targetPersonId: undefined,
      evidenceId: undefined,
    });
  });

  it('creates relationship with person IDs', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockCreateRelationship.mockResolvedValue({ id: 'e-2', type: 'reports_to' });

    const req = makeRequest('http://localhost/api/knowledge-graph/relationships', {
      type: 'reports_to',
      sourcePersonId: 'p-1',
      targetPersonId: 'p-2',
      evidenceId: 'ev-1',
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(mockCreateRelationship).toHaveBeenCalledWith(
      expect.objectContaining({
        sourcePersonId: 'p-1',
        targetPersonId: 'p-2',
        evidenceId: 'ev-1',
      }),
    );
  });

  it('creates relationship with mixed org and person IDs', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockCreateRelationship.mockResolvedValue({ id: 'e-3', type: 'employed_by' });

    const req = makeRequest('http://localhost/api/knowledge-graph/relationships', {
      type: 'employed_by',
      sourcePersonId: 'p-1',
      targetOrgId: 'org-a',
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(mockCreateRelationship).toHaveBeenCalledWith(
      expect.objectContaining({
        sourcePersonId: 'p-1',
        targetOrgId: 'org-a',
      }),
    );
  });

  it('returns 500 when createRelationship throws', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockCreateRelationship.mockRejectedValue(new Error('DB error'));

    const req = makeRequest('http://localhost/api/knowledge-graph/relationships', {
      type: 'works_with',
      sourceOrgId: 'a',
      targetOrgId: 'b',
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to create relationship');
  });

  it('validates weight range (rejects > 1)', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = makeRequest('http://localhost/api/knowledge-graph/relationships', {
      type: 'works_with',
      sourceOrgId: 'a',
      targetOrgId: 'b',
      weight: 1.5,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});

// ── GET ───────────────────────────────────────────────────────────────

describe('GET /api/knowledge-graph/relationships', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      errorResponse: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });

    const req = makeRequest(
      'http://localhost/api/knowledge-graph/relationships?source=org-a&target=org-b',
    );
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when missing source param', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = makeRequest('http://localhost/api/knowledge-graph/relationships?target=org-b');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('Invalid parameters');
  });

  it('returns 400 when missing target param', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = makeRequest('http://localhost/api/knowledge-graph/relationships?source=org-a');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns connection paths for valid source and target', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    const mockPaths = [{ nodes: ['a', 'b'], edges: ['e-1'] }];
    mockGetConnectionPaths.mockResolvedValue(mockPaths);

    const req = makeRequest(
      'http://localhost/api/knowledge-graph/relationships?source=org-a&target=org-b',
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual(mockPaths);
    expect(mockGetConnectionPaths).toHaveBeenCalledWith('org-a', 'org-b', 4);
  });

  it('passes maxHops to getConnectionPaths', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockGetConnectionPaths.mockResolvedValue([]);

    const req = makeRequest(
      'http://localhost/api/knowledge-graph/relationships?source=a&target=b&maxHops=7',
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockGetConnectionPaths).toHaveBeenCalledWith('a', 'b', 7);
  });

  it('passes maxHops=10 (the max allowed value)', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockGetConnectionPaths.mockResolvedValue([]);

    const req = makeRequest(
      'http://localhost/api/knowledge-graph/relationships?source=a&target=b&maxHops=10',
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockGetConnectionPaths).toHaveBeenCalledWith('a', 'b', 10);
  });

  it('returns 400 when maxHops exceeds 10', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = makeRequest(
      'http://localhost/api/knowledge-graph/relationships?source=a&target=b&maxHops=50',
    );
    const res = await GET(req);

    expect(res.status).toBe(400);
  });

  it('defaults maxHops to 4', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockGetConnectionPaths.mockResolvedValue([]);

    const req = makeRequest('http://localhost/api/knowledge-graph/relationships?source=a&target=b');
    await GET(req);

    expect(mockGetConnectionPaths).toHaveBeenCalledWith('a', 'b', 4);
  });

  it('returns 500 when getConnectionPaths throws', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockGetConnectionPaths.mockRejectedValue(new Error('Graph error'));

    const req = makeRequest('http://localhost/api/knowledge-graph/relationships?source=a&target=b');
    const res = await GET(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to find connection paths');
  });

  // ── Additional GET edge cases ──────────────────────────────────

  it('returns 400 when maxHops is 0 (below min 1)', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = makeRequest(
      'http://localhost/api/knowledge-graph/relationships?source=a&target=b&maxHops=0',
    );
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when source is empty string', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = makeRequest('http://localhost/api/knowledge-graph/relationships?source=&target=b');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when target is empty string', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = makeRequest('http://localhost/api/knowledge-graph/relationships?source=a&target=');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns empty paths array when no connections found', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockGetConnectionPaths.mockResolvedValue([]);

    const req = makeRequest(
      'http://localhost/api/knowledge-graph/relationships?source=isolated-a&target=isolated-b',
    );
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
  });

  it('returns 200 with data wrapper property', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockGetConnectionPaths.mockResolvedValue([{ path: 'short' }]);

    const req = makeRequest('http://localhost/api/knowledge-graph/relationships?source=a&target=b');
    const res = await GET(req);
    const body = await res.json();

    expect(body).toHaveProperty('data');
    expect(body).not.toHaveProperty('error');
  });

  it('handles maxHops as string (zod coerces to number)', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockGetConnectionPaths.mockResolvedValue([]);

    const req = makeRequest(
      'http://localhost/api/knowledge-graph/relationships?source=a&target=b&maxHops=3',
    );
    const res = await GET(req);

    expect(res.status).toBe(200);
    expect(mockGetConnectionPaths).toHaveBeenCalledWith('a', 'b', 3);
  });
});

// ── Additional POST edge cases ──────────────────────────────────

describe('POST /api/knowledge-graph/relationships — additional cases', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 400 when type is empty string', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = makeRequest('http://localhost/api/knowledge-graph/relationships', {
      type: '',
      sourceOrgId: 'a',
      targetOrgId: 'b',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when only target is provided', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = makeRequest('http://localhost/api/knowledge-graph/relationships', {
      type: 'works_with',
      targetOrgId: 'b',
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when weight is negative', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = makeRequest('http://localhost/api/knowledge-graph/relationships', {
      type: 'works_with',
      sourceOrgId: 'a',
      targetOrgId: 'b',
      weight: -0.5,
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('accepts weight of exactly 0', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockCreateRelationship.mockResolvedValue({ id: 'e-1', type: 'works_with', weight: 0 });

    const req = makeRequest('http://localhost/api/knowledge-graph/relationships', {
      type: 'works_with',
      sourceOrgId: 'a',
      targetOrgId: 'b',
      weight: 0,
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it('accepts weight of exactly 1', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockCreateRelationship.mockResolvedValue({ id: 'e-1', type: 'works_with', weight: 1 });

    const req = makeRequest('http://localhost/api/knowledge-graph/relationships', {
      type: 'works_with',
      sourceOrgId: 'a',
      targetOrgId: 'b',
      weight: 1,
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it('returns 201 with data wrapper property', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockCreateRelationship.mockResolvedValue({ id: 'e-1', type: 'works_with' });

    const req = makeRequest('http://localhost/api/knowledge-graph/relationships', {
      type: 'works_with',
      sourceOrgId: 'a',
      targetOrgId: 'b',
    });
    const res = await POST(req);
    const body = await res.json();

    expect(body).toHaveProperty('data');
    expect(body).not.toHaveProperty('error');
  });

  it('handles empty JSON body gracefully', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = new NextRequest('http://localhost/api/knowledge-graph/relationships', {
      method: 'POST',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('passes all optional fields to createRelationship', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    mockCreateRelationship.mockResolvedValue({ id: 'e-full' });

    const req = makeRequest('http://localhost/api/knowledge-graph/relationships', {
      type: 'partner',
      label: 'Strategic Partner',
      weight: 0.9,
      sourceOrgId: 'org-a',
      targetOrgId: 'org-b',
      sourcePersonId: 'p-a',
      targetPersonId: 'p-b',
      evidenceId: 'ev-1',
    });
    await POST(req);

    expect(mockCreateRelationship).toHaveBeenCalledWith({
      type: 'partner',
      label: 'Strategic Partner',
      weight: 0.9,
      sourceOrgId: 'org-a',
      targetOrgId: 'org-b',
      sourcePersonId: 'p-a',
      targetPersonId: 'p-b',
      evidenceId: 'ev-1',
    });
  });
});
