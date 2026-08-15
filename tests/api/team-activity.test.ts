// ═══════════════════════════════════════════════════════════════════════════
// Team Activity API — Route Tests
//
// Tests for:
//   GET /api/team-activity
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
    dataIngestion: { findMany: vi.fn() },
    signal: { findMany: vi.fn() },
    briefing: { findMany: vi.fn() },
  },
}));

import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { GET as getTeamActivity } from '@/app/api/team-activity/route';

// ── Helpers ────────────────────────────────────────────────────────────

const mockSession = { id: 'user-1', email: 'test@example.com', role: 'admin' as const };

function makeUnauthedResponse() {
  return new Response(JSON.stringify({ error: 'Auth required' }), { status: 401 });
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/team-activity
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/team-activity', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: null,
      errorResponse: makeUnauthedResponse(),
    });
    const res = await getTeamActivity(new NextRequest('http://localhost/api/team-activity'));
    expect(res.status).toBe(401);
  });

  it('returns combined activities from all sources', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findMany).mockResolvedValue([
      {
        id: 'ing-1',
        fileName: 'contacts.csv',
        status: 'completed',
        uploadedAt: '2025-01-15T10:00:00Z',
        fileType: 'csv',
      },
    ]);
    vi.mocked(db.signal.findMany).mockResolvedValue([
      {
        id: 'sig-1',
        signalType: 'funding',
        severity: 'high',
        title: 'Series B',
        detectedAt: '2025-01-15T09:00:00Z',
        organization: { name: 'Acme' },
      },
    ]);
    vi.mocked(db.briefing.findMany).mockResolvedValue([
      {
        id: 'br-1',
        executiveSummary: 'Acme is growing fast this quarter.',
        generatedAt: '2025-01-15T08:00:00Z',
        organization: { name: 'Acme' },
      },
    ]);

    const res = await getTeamActivity(new NextRequest('http://localhost/api/team-activity'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toHaveLength(3);
  });

  it('sorts activities by timestamp descending', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findMany).mockResolvedValue([
      {
        id: 'ing-1',
        fileName: 'a.csv',
        status: 'completed',
        uploadedAt: '2025-01-15T08:00:00Z',
        fileType: 'csv',
      },
    ]);
    vi.mocked(db.signal.findMany).mockResolvedValue([
      {
        id: 'sig-1',
        signalType: 'funding',
        severity: 'high',
        title: 'Series B',
        detectedAt: '2025-01-15T10:00:00Z',
        organization: { name: 'Acme' },
      },
    ]);
    vi.mocked(db.briefing.findMany).mockResolvedValue([
      {
        id: 'br-1',
        executiveSummary: 'Summary text.',
        generatedAt: '2025-01-15T09:00:00Z',
        organization: { name: 'Beta' },
      },
    ]);

    const res = await getTeamActivity(new NextRequest('http://localhost/api/team-activity'));
    const body = await res.json();

    expect(body.data[0].id).toBe('signal-sig-1');
    expect(body.data[1].id).toBe('briefing-br-1');
    expect(body.data[2].id).toBe('ingestion-ing-1');
  });

  it('respects limit parameter', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findMany).mockResolvedValue([]);
    vi.mocked(db.signal.findMany).mockResolvedValue([]);
    vi.mocked(db.briefing.findMany).mockResolvedValue([]);

    const res = await getTeamActivity(
      new NextRequest('http://localhost/api/team-activity?limit=5'),
    );
    const body = await res.json();

    expect(body.data.length).toBeLessThanOrEqual(5);
  });

  it('returns 400 for invalid limit', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const res = await getTeamActivity(
      new NextRequest('http://localhost/api/team-activity?limit=abc'),
    );
    expect(res.status).toBe(400);
  });

  it('truncates briefing description to 120 chars', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findMany).mockResolvedValue([]);
    vi.mocked(db.signal.findMany).mockResolvedValue([]);
    vi.mocked(db.briefing.findMany).mockResolvedValue([
      {
        id: 'br-1',
        executiveSummary: 'A'.repeat(200),
        generatedAt: '2025-01-15T10:00:00Z',
        organization: { name: 'Acme' },
      },
    ]);

    const res = await getTeamActivity(new NextRequest('http://localhost/api/team-activity'));
    const body = await res.json();

    expect(body.data[0].description.length).toBe(120);
  });

  it('handles signal without organization', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findMany).mockResolvedValue([]);
    vi.mocked(db.signal.findMany).mockResolvedValue([
      {
        id: 'sig-1',
        signalType: 'funding',
        severity: 'high',
        title: 'Series B',
        detectedAt: '2025-01-15T10:00:00Z',
        organization: null,
      },
    ]);
    vi.mocked(db.briefing.findMany).mockResolvedValue([]);

    const res = await getTeamActivity(new NextRequest('http://localhost/api/team-activity'));
    const body = await res.json();

    expect(body.data[0].description).toContain('Unknown');
  });

  it('handles briefing without organization', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findMany).mockResolvedValue([]);
    vi.mocked(db.signal.findMany).mockResolvedValue([]);
    vi.mocked(db.briefing.findMany).mockResolvedValue([
      {
        id: 'br-1',
        executiveSummary: 'Summary',
        generatedAt: '2025-01-15T10:00:00Z',
        organization: null,
      },
    ]);

    const res = await getTeamActivity(new NextRequest('http://localhost/api/team-activity'));
    const body = await res.json();

    expect(body.data[0].title).toContain('Organization');
  });

  it('returns 500 on database error', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findMany).mockRejectedValue(new Error('DB down'));

    const res = await getTeamActivity(new NextRequest('http://localhost/api/team-activity'));
    expect(res.status).toBe(500);
  });

  it('ingestion activities include correct entity type', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findMany).mockResolvedValue([
      {
        id: 'ing-1',
        fileName: 'data.csv',
        status: 'completed',
        uploadedAt: '2025-01-15T10:00:00Z',
        fileType: 'csv',
      },
    ]);
    vi.mocked(db.signal.findMany).mockResolvedValue([]);
    vi.mocked(db.briefing.findMany).mockResolvedValue([]);

    const res = await getTeamActivity(new NextRequest('http://localhost/api/team-activity'));
    const body = await res.json();

    expect(body.data[0].type).toBe('ingestion_upload');
    expect(body.data[0].entityType).toBe('ingestion');
    expect(body.data[0].entityId).toBe('ing-1');
  });

  it('signal activities include severity and signal type', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.dataIngestion.findMany).mockResolvedValue([]);
    vi.mocked(db.signal.findMany).mockResolvedValue([
      {
        id: 'sig-1',
        signalType: 'leadership',
        severity: 'critical',
        title: 'New CTO',
        detectedAt: '2025-01-15T10:00:00Z',
        organization: { name: 'Acme' },
      },
    ]);
    vi.mocked(db.briefing.findMany).mockResolvedValue([]);

    const res = await getTeamActivity(new NextRequest('http://localhost/api/team-activity'));
    const body = await res.json();

    expect(body.data[0].description).toContain('critical');
    expect(body.data[0].description).toContain('leadership');
  });
});
