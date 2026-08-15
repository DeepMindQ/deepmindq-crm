// ═══════════════════════════════════════════════════════════════════════════
// Knowledge Graph API — Route Tests
//
// Tests for:
//   GET  /api/knowledge-graph/connections/[id]
//   POST /api/knowledge-graph/discover
//   POST /api/knowledge-graph/merge
//   GET  /api/knowledge-graph/resolve
//   GET  /api/knowledge-graph/stats
//   GET  /api/knowledge-graph/subgraph/[id]
// ═══════════════════════════════════════════════════════════════════════════

/** @vitest-environment node */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/api-auth', () => ({
  checkApiAuth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    organization: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/intelligence/knowledge-graph', () => ({
  getConnections: vi.fn(),
  discoverRelationships: vi.fn(),
  mergeOrganizations: vi.fn(),
  resolveEntity: vi.fn(),
  getGraphStats: vi.fn(),
  computeIntelligenceScores: vi.fn(),
  getSubgraph: vi.fn(),
}));

import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import {
  getConnections,
  discoverRelationships,
  mergeOrganizations,
  resolveEntity,
  getGraphStats,
  computeIntelligenceScores,
  getSubgraph,
} from '@/lib/intelligence/knowledge-graph';
import { GET as getConnectionsRoute } from '@/app/api/knowledge-graph/connections/route';
import { POST as discoverRoute } from '@/app/api/knowledge-graph/discover/route';
import { POST as mergeRoute } from '@/app/api/knowledge-graph/merge/route';
import { GET as resolveRoute } from '@/app/api/knowledge-graph/resolve/route';
import { GET as statsRoute } from '@/app/api/knowledge-graph/stats/route';
import { GET as subgraphRoute } from '@/app/api/knowledge-graph/subgraph/route';

// ── Helpers ────────────────────────────────────────────────────────────

const mockSession = { id: 'user-1', email: 'test@example.com', role: 'admin' as const };

function makeUnauthedResponse() {
  return new Response(JSON.stringify({ error: 'Auth required' }), { status: 401 });
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/knowledge-graph/connections/[id]
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/knowledge-graph/connections/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: null,
      errorResponse: makeUnauthedResponse(),
    });
    const res = await getConnectionsRoute(
      new NextRequest('http://localhost/api/knowledge-graph/connections/org-1'),
      { params: Promise.resolve({ id: 'org-1' }) },
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 for empty entity ID', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    const res = await getConnectionsRoute(
      new NextRequest('http://localhost/api/knowledge-graph/connections/'),
      { params: Promise.resolve({ id: '' }) },
    );
    expect(res.status).toBe(400);
  });

  it('returns connections for a valid entity ID', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    const mockConnections = [
      { targetId: 'org-2', type: 'shared_domain', weight: 0.9 },
      { targetId: 'person-1', type: 'works_at', weight: 0.7 },
    ];
    vi.mocked(getConnections).mockResolvedValue(mockConnections);

    const res = await getConnectionsRoute(
      new NextRequest('http://localhost/api/knowledge-graph/connections/org-1'),
      { params: Promise.resolve({ id: 'org-1' }) },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(getConnections).toHaveBeenCalledWith('org-1');
  });

  it('returns 500 on error', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(getConnections).mockRejectedValue(new Error('Graph DB error'));

    const res = await getConnectionsRoute(
      new NextRequest('http://localhost/api/knowledge-graph/connections/org-1'),
      { params: Promise.resolve({ id: 'org-1' }) },
    );
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/knowledge-graph/discover
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/knowledge-graph/discover', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: null,
      errorResponse: makeUnauthedResponse(),
    });
    const req = new NextRequest('http://localhost/api/knowledge-graph/discover', {
      method: 'POST',
    });
    const res = await discoverRoute(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid body (bad sourceTypes)', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    const req = new NextRequest('http://localhost/api/knowledge-graph/discover', {
      method: 'POST',
      body: JSON.stringify({ sourceTypes: ['invalid_type'] }),
    });
    const res = await discoverRoute(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for maxDepth above 5', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    const req = new NextRequest('http://localhost/api/knowledge-graph/discover', {
      method: 'POST',
      body: JSON.stringify({ maxDepth: 10 }),
    });
    const res = await discoverRoute(req);
    expect(res.status).toBe(400);
  });

  it('discovers relationships with no options', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(discoverRelationships).mockResolvedValue(5);

    const req = new NextRequest('http://localhost/api/knowledge-graph/discover', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await discoverRoute(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.relationshipsCreated).toBe(5);
    expect(discoverRelationships).toHaveBeenCalledWith(undefined);
  });

  it('discovers relationships with organizationId', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(discoverRelationships).mockResolvedValue(3);

    const req = new NextRequest('http://localhost/api/knowledge-graph/discover', {
      method: 'POST',
      body: JSON.stringify({ organizationId: 'org-1' }),
    });
    const res = await discoverRoute(req);

    expect(res.status).toBe(200);
    expect(discoverRelationships).toHaveBeenCalledWith('org-1');
  });

  it('discovers relationships with all options', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(discoverRelationships).mockResolvedValue(10);

    const req = new NextRequest('http://localhost/api/knowledge-graph/discover', {
      method: 'POST',
      body: JSON.stringify({
        organizationId: 'org-1',
        maxDepth: 3,
        includeInactive: true,
        sourceTypes: ['signal', 'manual'],
      }),
    });
    const res = await discoverRoute(req);

    expect(res.status).toBe(200);
  });

  it('returns 500 on error', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(discoverRelationships).mockRejectedValue(new Error('Discovery failed'));

    const req = new NextRequest('http://localhost/api/knowledge-graph/discover', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const res = await discoverRoute(req);
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/knowledge-graph/merge
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/knowledge-graph/merge', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: null,
      errorResponse: makeUnauthedResponse(),
    });
    const req = new NextRequest('http://localhost/api/knowledge-graph/merge', { method: 'POST' });
    const res = await mergeRoute(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 for missing sourceId', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    const req = new NextRequest('http://localhost/api/knowledge-graph/merge', {
      method: 'POST',
      body: JSON.stringify({ targetId: 'org-1' }),
    });
    const res = await mergeRoute(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for missing targetId', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    const req = new NextRequest('http://localhost/api/knowledge-graph/merge', {
      method: 'POST',
      body: JSON.stringify({ sourceId: 'org-2' }),
    });
    const res = await mergeRoute(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when sourceId equals targetId', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    const req = new NextRequest('http://localhost/api/knowledge-graph/merge', {
      method: 'POST',
      body: JSON.stringify({ sourceId: 'org-1', targetId: 'org-1' }),
    });
    const res = await mergeRoute(req);
    expect(res.status).toBe(400);
  });

  it('returns 404 when source org not found', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.organization.findUnique)
      .mockResolvedValueOnce({ id: 'target-1', name: 'Target Corp' })
      .mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/knowledge-graph/merge', {
      method: 'POST',
      body: JSON.stringify({ sourceId: 'nonexistent', targetId: 'target-1' }),
    });
    const res = await mergeRoute(req);
    expect(res.status).toBe(404);
  });

  it('returns 404 when target org not found', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.organization.findUnique).mockResolvedValueOnce(null);

    const req = new NextRequest('http://localhost/api/knowledge-graph/merge', {
      method: 'POST',
      body: JSON.stringify({ sourceId: 'source-1', targetId: 'nonexistent' }),
    });
    const res = await mergeRoute(req);
    expect(res.status).toBe(404);
  });

  it('successfully merges two organizations', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.organization.findUnique)
      .mockResolvedValueOnce({ id: 'target-1', name: 'Target Corp' })
      .mockResolvedValueOnce({ id: 'source-1', name: 'Source Inc' });
    vi.mocked(mergeOrganizations).mockResolvedValue(undefined);

    const req = new NextRequest('http://localhost/api/knowledge-graph/merge', {
      method: 'POST',
      body: JSON.stringify({ sourceId: 'source-1', targetId: 'target-1' }),
    });
    const res = await mergeRoute(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.merged).toBe(true);
    expect(body.data.target).toBe('Target Corp');
    expect(body.data.source).toBe('Source Inc');
    expect(mergeOrganizations).toHaveBeenCalledWith('target-1', 'source-1');
  });

  it('returns 500 on error', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.organization.findUnique).mockRejectedValue(new Error('DB error'));

    const req = new NextRequest('http://localhost/api/knowledge-graph/merge', {
      method: 'POST',
      body: JSON.stringify({ sourceId: 's1', targetId: 't1' }),
    });
    const res = await mergeRoute(req);
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/knowledge-graph/resolve
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/knowledge-graph/resolve', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: null,
      errorResponse: makeUnauthedResponse(),
    });
    const res = await resolveRoute(new NextRequest('http://localhost/api/knowledge-graph/resolve'));
    expect(res.status).toBe(401);
  });

  it('returns 400 when no search params provided', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    const res = await resolveRoute(new NextRequest('http://localhost/api/knowledge-graph/resolve'));
    expect(res.status).toBe(400);
  });

  it('resolves by name', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    const mockMatches = [{ id: 'org-1', name: 'Acme Corp', score: 0.95 }];
    vi.mocked(resolveEntity).mockResolvedValue(mockMatches);

    const res = await resolveRoute(
      new NextRequest('http://localhost/api/knowledge-graph/resolve?name=Acme+Corp'),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(resolveEntity).toHaveBeenCalledWith({
      name: 'Acme Corp',
      domain: undefined,
      email: undefined,
      fuzzy: false,
    });
  });

  it('resolves by domain', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(resolveEntity).mockResolvedValue([]);

    const res = await resolveRoute(
      new NextRequest('http://localhost/api/knowledge-graph/resolve?domain=acme.com'),
    );

    expect(res.status).toBe(200);
    expect(resolveEntity).toHaveBeenCalledWith({
      name: undefined,
      domain: 'acme.com',
      email: undefined,
      fuzzy: false,
    });
  });

  it('resolves by email', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(resolveEntity).mockResolvedValue([]);

    const res = await resolveRoute(
      new NextRequest('http://localhost/api/knowledge-graph/resolve?email=john@acme.com'),
    );

    expect(res.status).toBe(200);
    expect(resolveEntity).toHaveBeenCalledWith({
      name: undefined,
      domain: undefined,
      email: 'john@acme.com',
      fuzzy: false,
    });
  });

  it('resolves with fuzzy=true', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(resolveEntity).mockResolvedValue([]);

    const res = await resolveRoute(
      new NextRequest('http://localhost/api/knowledge-graph/resolve?name=Acme&fuzzy=true'),
    );

    expect(res.status).toBe(200);
    expect(resolveEntity).toHaveBeenCalledWith(expect.objectContaining({ fuzzy: true }));
  });

  it('returns 400 for invalid fuzzy value', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    const res = await resolveRoute(
      new NextRequest('http://localhost/api/knowledge-graph/resolve?name=Acme&fuzzy=yes'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(resolveEntity).mockRejectedValue(new Error('Resolution error'));

    const res = await resolveRoute(
      new NextRequest('http://localhost/api/knowledge-graph/resolve?name=Acme'),
    );
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/knowledge-graph/stats
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/knowledge-graph/stats', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: null,
      errorResponse: makeUnauthedResponse(),
    });
    const res = await statsRoute(new NextRequest('http://localhost/api/knowledge-graph/stats'));
    expect(res.status).toBe(401);
  });

  it('returns graph stats without refresh', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    const mockStats = { nodes: 100, edges: 250, clusters: 5 };
    vi.mocked(getGraphStats).mockResolvedValue(mockStats);

    const res = await statsRoute(new NextRequest('http://localhost/api/knowledge-graph/stats'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual(mockStats);
    expect(computeIntelligenceScores).not.toHaveBeenCalled();
  });

  it('refreshes intelligence scores when refresh=true', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(computeIntelligenceScores).mockResolvedValue(undefined);
    vi.mocked(getGraphStats).mockResolvedValue({ nodes: 110, edges: 275, clusters: 6 });

    const res = await statsRoute(
      new NextRequest('http://localhost/api/knowledge-graph/stats?refresh=true'),
    );

    expect(res.status).toBe(200);
    expect(computeIntelligenceScores).toHaveBeenCalled();
  });

  it('does not refresh when refresh=false', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(getGraphStats).mockResolvedValue({ nodes: 100, edges: 250 });

    const res = await statsRoute(
      new NextRequest('http://localhost/api/knowledge-graph/stats?refresh=false'),
    );

    expect(computeIntelligenceScores).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid refresh param', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    const res = await statsRoute(
      new NextRequest('http://localhost/api/knowledge-graph/stats?refresh=yes'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 500 on error', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(getGraphStats).mockRejectedValue(new Error('Stats error'));

    const res = await statsRoute(new NextRequest('http://localhost/api/knowledge-graph/stats'));
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/knowledge-graph/subgraph/[id]
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/knowledge-graph/subgraph/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: null,
      errorResponse: makeUnauthedResponse(),
    });
    const res = await subgraphRoute(
      new NextRequest('http://localhost/api/knowledge-graph/subgraph/org-1'),
      { params: Promise.resolve({ id: 'org-1' }) },
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 for empty entity ID', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    const res = await subgraphRoute(
      new NextRequest('http://localhost/api/knowledge-graph/subgraph/'),
      { params: Promise.resolve({ id: '' }) },
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid depth', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    const res = await subgraphRoute(
      new NextRequest('http://localhost/api/knowledge-graph/subgraph/org-1?depth=abc'),
      { params: Promise.resolve({ id: 'org-1' }) },
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for depth above max (4)', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    const res = await subgraphRoute(
      new NextRequest('http://localhost/api/knowledge-graph/subgraph/org-1?depth=10'),
      { params: Promise.resolve({ id: 'org-1' }) },
    );
    expect(res.status).toBe(400);
  });

  it('returns subgraph with default depth', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    const mockSubgraph = { nodes: [{ id: 'org-1' }], edges: [] };
    vi.mocked(getSubgraph).mockResolvedValue(mockSubgraph);

    const res = await subgraphRoute(
      new NextRequest('http://localhost/api/knowledge-graph/subgraph/org-1'),
      { params: Promise.resolve({ id: 'org-1' }) },
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toBeDefined();
    expect(getSubgraph).toHaveBeenCalledWith('org-1', 2);
  });

  it('returns subgraph with custom depth', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(getSubgraph).mockResolvedValue({ nodes: [], edges: [] });

    const res = await subgraphRoute(
      new NextRequest('http://localhost/api/knowledge-graph/subgraph/org-1?depth=4'),
      { params: Promise.resolve({ id: 'org-1' }) },
    );

    expect(res.status).toBe(200);
    expect(getSubgraph).toHaveBeenCalledWith('org-1', 4);
  });

  it('returns 500 on error', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(getSubgraph).mockRejectedValue(new Error('Subgraph error'));

    const res = await subgraphRoute(
      new NextRequest('http://localhost/api/knowledge-graph/subgraph/org-1'),
      { params: Promise.resolve({ id: 'org-1' }) },
    );
    expect(res.status).toBe(500);
  });
});
