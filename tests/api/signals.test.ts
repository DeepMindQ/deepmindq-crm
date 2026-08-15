// ═══════════════════════════════════════════════════════════════════════════
// Signals API — Route Tests
//
// Tests GET /api/signals (list with filters).
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/api-auth', () => ({
  checkApiAuth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    signal: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock('@/lib/rbac', () => ({
  authorizeRoute: vi.fn().mockReturnValue({ authorized: true }),
}));

import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { GET } from '@/app/api/signals/route';

// ── Helpers ────────────────────────────────────────────────────────────

const mockSession = { id: 'user-1', email: 'test@example.com', role: 'admin' as const };

function makeAuthRequest(url: string): NextRequest {
  return new NextRequest(url);
}

// ── Test Data ──────────────────────────────────────────────────────────

const mockSignal1 = {
  id: 'sig-1',
  type: 'funding',
  severity: 'high',
  status: 'detected',
  title: 'Series B funding round',
  detectedAt: new Date('2025-01-15'),
  organizationId: 'org-1',
  evidence: [],
  organization: { name: 'Acme Corp', domain: 'acme.com', industry: 'SaaS' },
};

const mockSignal2 = {
  id: 'sig-2',
  type: 'leadership',
  severity: 'critical',
  status: 'validated',
  title: 'New CTO hired',
  detectedAt: new Date('2025-01-14'),
  organizationId: 'org-2',
  evidence: [],
  organization: { name: 'Beta Inc', domain: 'beta.io', industry: 'FinTech' },
};

const mockSignal3 = {
  id: 'sig-3',
  type: 'market',
  severity: 'low',
  status: 'analyzed',
  title: 'Market expansion to EU',
  detectedAt: new Date('2025-01-13'),
  organizationId: 'org-1',
  evidence: [],
  organization: { name: 'Acme Corp', domain: 'acme.com', industry: 'SaaS' },
};

// ── GET /api/signals ───────────────────────────────────────────────────

describe('GET /api/signals', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no session', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: null,
      errorResponse: new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 }),
    });

    const req = new NextRequest('http://localhost/api/signals');
    const res = await GET(req);
    expect(res.status).toBe(401);
  });

  it('returns signals with default params', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.signal.findMany).mockResolvedValue([mockSignal1, mockSignal2]);

    const req = makeAuthRequest('http://localhost/api/signals');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(2);
    // Default limit is 50, default status is 'detected,validated,analyzed'
    expect(db.signal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 50 }),
    );
  });

  it('filters by severity', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.signal.findMany).mockResolvedValue([mockSignal2]);

    const req = makeAuthRequest('http://localhost/api/signals?severity=critical');
    await GET(req);

    expect(db.signal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ severity: 'critical' }),
      }),
    );
  });

  it('filters by status (comma-separated)', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.signal.findMany).mockResolvedValue([mockSignal1]);

    const req = makeAuthRequest('http://localhost/api/signals?status=detected');
    await GET(req);

    expect(db.signal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['detected'] },
        }),
      }),
    );
  });

  it('filters by multiple statuses', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.signal.findMany).mockResolvedValue([mockSignal1, mockSignal2, mockSignal3]);

    const req = makeAuthRequest('http://localhost/api/signals?status=detected,analyzed');
    await GET(req);

    expect(db.signal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ['detected', 'analyzed'] },
        }),
      }),
    );
  });

  it('filters by organizationId', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.signal.findMany).mockResolvedValue([mockSignal1, mockSignal3]);

    const req = makeAuthRequest('http://localhost/api/signals?organizationId=org-1');
    await GET(req);

    expect(db.signal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ organizationId: 'org-1' }),
      }),
    );
  });

  it('combines severity and organizationId filters', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.signal.findMany).mockResolvedValue([]);

    const req = makeAuthRequest('http://localhost/api/signals?severity=high&organizationId=org-2');
    await GET(req);

    const callArgs = vi.mocked(db.signal.findMany).mock.calls[0][0] as any;
    expect(callArgs.where.severity).toBe('high');
    expect(callArgs.where.organizationId).toBe('org-2');
  });

  it('respects custom limit', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.signal.findMany).mockResolvedValue([mockSignal1]);

    const req = makeAuthRequest('http://localhost/api/signals?limit=5');
    await GET(req);

    expect(db.signal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 }),
    );
  });

  it('returns 400 for invalid severity', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = makeAuthRequest('http://localhost/api/signals?severity=urgent');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 for limit above max', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const req = makeAuthRequest('http://localhost/api/signals?limit=200');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('includes organization relation in response', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.signal.findMany).mockResolvedValue([mockSignal1]);

    const req = makeAuthRequest('http://localhost/api/signals');
    const res = await GET(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data[0].organization).toEqual({
      name: 'Acme Corp',
      domain: 'acme.com',
      industry: 'SaaS',
    });
  });

  it('returns 500 when db throws', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.signal.findMany).mockRejectedValue(new Error('DB down'));

    const req = makeAuthRequest('http://localhost/api/signals');
    const res = await GET(req);
    expect(res.status).toBe(500);
  });

  it('orders signals by detectedAt desc', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.signal.findMany).mockResolvedValue([mockSignal1, mockSignal2]);

    const req = makeAuthRequest('http://localhost/api/signals');
    await GET(req);

    expect(db.signal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { detectedAt: 'desc' },
      }),
    );
  });
});
