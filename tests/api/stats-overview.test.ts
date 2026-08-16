// ═══════════════════════════════════════════════════════════════════════════
// Stats Overview API — Route Tests
//
// Tests for:
//   GET /api/stats/overview
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
    organization: { count: vi.fn() },
    signal: { count: vi.fn() },
    briefing: { count: vi.fn() },
    dataIngestion: { count: vi.fn(), findMany: vi.fn() },
    person: { count: vi.fn() },
  },
}));

import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { GET as getOverview } from '@/app/api/stats/overview/route';

// ── Helpers ────────────────────────────────────────────────────────────

const mockSession = { id: 'user-1', email: 'test@example.com', role: 'admin' as const };

function makeUnauthedResponse() {
  return new Response(JSON.stringify({ error: 'Auth required' }), { status: 401 });
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/stats/overview
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/stats/overview', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: null,
      errorResponse: makeUnauthedResponse(),
    });
    const res = await getOverview(new NextRequest('http://localhost/api/stats/overview'));
    expect(res.status).toBe(401);
  });

  it('returns aggregated counts', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.organization.count).mockResolvedValue(42);
    vi.mocked(db.signal.count).mockResolvedValue(150);
    vi.mocked(db.briefing.count).mockResolvedValue(30);
    vi.mocked(db.dataIngestion.count).mockResolvedValue(10);
    vi.mocked(db.person.count).mockResolvedValue(500);
    vi.mocked(db.dataIngestion.findMany).mockResolvedValue([
      { processedRows: 200 },
      { processedRows: 300 },
      { processedRows: null },
    ]);

    const res = await getOverview(new NextRequest('http://localhost/api/stats/overview'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual({
      organizations: 42,
      signals: 150,
      briefings: 30,
      imports: 10,
      people: 500,
      totalRowsProcessed: 500, // 200 + 300 + 0
    });
  });

  it('counts only completed ingestions', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.organization.count).mockResolvedValue(0);
    vi.mocked(db.signal.count).mockResolvedValue(0);
    vi.mocked(db.briefing.count).mockResolvedValue(0);
    vi.mocked(db.person.count).mockResolvedValue(0);
    vi.mocked(db.dataIngestion.findMany).mockResolvedValue([]);

    await getOverview(new NextRequest('http://localhost/api/stats/overview'));

    expect(db.dataIngestion.count).toHaveBeenCalledWith({
      where: { status: 'completed' },
    });
  });

  it('handles null processedRows gracefully', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.organization.count).mockResolvedValue(0);
    vi.mocked(db.signal.count).mockResolvedValue(0);
    vi.mocked(db.briefing.count).mockResolvedValue(0);
    vi.mocked(db.dataIngestion.count).mockResolvedValue(0);
    vi.mocked(db.person.count).mockResolvedValue(0);
    vi.mocked(db.dataIngestion.findMany).mockResolvedValue([
      { processedRows: null },
      { processedRows: null },
    ]);

    const res = await getOverview(new NextRequest('http://localhost/api/stats/overview'));
    const body = await res.json();

    expect(body.data.totalRowsProcessed).toBe(0);
  });

  it('limits completed ingestion query to 50', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.organization.count).mockResolvedValue(0);
    vi.mocked(db.signal.count).mockResolvedValue(0);
    vi.mocked(db.briefing.count).mockResolvedValue(0);
    vi.mocked(db.dataIngestion.count).mockResolvedValue(0);
    vi.mocked(db.person.count).mockResolvedValue(0);
    vi.mocked(db.dataIngestion.findMany).mockResolvedValue([]);

    await getOverview(new NextRequest('http://localhost/api/stats/overview'));

    expect(db.dataIngestion.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 50 }));
  });

  it('returns 500 on database error', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.organization.count).mockRejectedValue(new Error('DB down'));

    const res = await getOverview(new NextRequest('http://localhost/api/stats/overview'));
    expect(res.status).toBe(500);
  });

  it('returns zero counts when no data exists', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.organization.count).mockResolvedValue(0);
    vi.mocked(db.signal.count).mockResolvedValue(0);
    vi.mocked(db.briefing.count).mockResolvedValue(0);
    vi.mocked(db.dataIngestion.count).mockResolvedValue(0);
    vi.mocked(db.person.count).mockResolvedValue(0);
    vi.mocked(db.dataIngestion.findMany).mockResolvedValue([]);

    const res = await getOverview(new NextRequest('http://localhost/api/stats/overview'));
    const body = await res.json();

    expect(body.data).toEqual({
      organizations: 0,
      signals: 0,
      briefings: 0,
      imports: 0,
      people: 0,
      totalRowsProcessed: 0,
    });
  });
});
