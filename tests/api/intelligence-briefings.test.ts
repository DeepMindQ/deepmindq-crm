/**
 * @vitest-environment node
 *
 * Intelligence Briefings API — Route Tests
 *
 * Tests GET /api/briefings/[id] — Fetch a briefing by organization ID.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/api-auth', () => ({
  checkApiAuth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    briefing: {
      findFirst: vi.fn(),
    },
  },
}));

import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { GET } from '@/app/api/briefings/[id]/route';

// ── Helpers ────────────────────────────────────────────────────────────

function makeRequest(id: string): NextRequest {
  return new NextRequest(`http://localhost/api/briefings/${id}`);
}

function makeParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

// ── Test Data ──────────────────────────────────────────────────────────

const mockBriefing = {
  id: 'briefing-1',
  organizationId: 'org-1',
  generatedAt: new Date('2025-01-15'),
  summary: 'Weekly intelligence briefing',
  organization: {
    id: 'org-1',
    name: 'Acme Corp',
    industry: 'Technology',
    people: [{ id: 'p-1', name: 'John Doe', role: 'CEO' }],
    signals: [
      {
        id: 's-1',
        title: 'Series B funding',
        status: 'detected',
        detectedAt: new Date('2025-01-10'),
      },
    ],
    insights: [
      {
        id: 'i-1',
        title: 'Growth opportunity',
        status: 'active',
        createdAt: new Date('2025-01-12'),
      },
    ],
  },
};

// ── GET /api/briefings/[id] ───────────────────────────────────────────

describe('GET /api/briefings/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Authentication ─────────────────────────────────────────────────

  it('returns 401 when no session is provided', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      errorResponse: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });

    const req = makeRequest('org-1');
    const res = await GET(req, makeParams('org-1'));

    expect(res.status).toBe(401);
  });

  // ── Validation ─────────────────────────────────────────────────────

  it('returns 400 when id is empty string', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});

    const req = makeRequest('');
    const res = await GET(req, makeParams(''));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid briefing ID');
  });

  // ── Successful retrieval ───────────────────────────────────────────

  it('returns 200 with briefing data when found', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(db.briefing.findFirst).mockResolvedValue(mockBriefing);

    const req = makeRequest('org-1');
    const res = await GET(req, makeParams('org-1'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toBeDefined();
    expect(body.data.id).toBe('briefing-1');
    expect(body.data.organizationId).toBe('org-1');
  });

  it('returns 404 when no briefing is found for the organization', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(db.briefing.findFirst).mockResolvedValue(null);

    const req = makeRequest('org-nonexistent');
    const res = await GET(req, makeParams('org-nonexistent'));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('No briefing found for this organization');
  });

  it('queries by organizationId from the params', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(db.briefing.findFirst).mockResolvedValue(mockBriefing);

    const req = makeRequest('org-42');
    await GET(req, makeParams('org-42'));

    expect(db.briefing.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: 'org-42' },
      }),
    );
  });

  it('orders by generatedAt desc', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(db.briefing.findFirst).mockResolvedValue(mockBriefing);

    const req = makeRequest('org-1');
    await GET(req, makeParams('org-1'));

    expect(db.briefing.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { generatedAt: 'desc' },
      }),
    );
  });

  it('includes organization with people, signals, and insights', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(db.briefing.findFirst).mockResolvedValue(mockBriefing);

    const req = makeRequest('org-1');
    await GET(req, makeParams('org-1'));

    expect(db.briefing.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          organization: expect.objectContaining({
            include: expect.objectContaining({
              people: true,
              signals: expect.any(Object),
              insights: expect.any(Object),
            }),
          }),
        }),
      }),
    );
  });

  it('filters signals by active statuses', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(db.briefing.findFirst).mockResolvedValue(mockBriefing);

    const req = makeRequest('org-1');
    await GET(req, makeParams('org-1'));

    const call = vi.mocked(db.briefing.findFirst).mock.calls[0][0];
    const signalInclude = call!.include!.organization!.include!.signals as any;
    expect(signalInclude.where.status.in).toEqual(
      expect.arrayContaining(['detected', 'validated', 'analyzed']),
    );
  });

  it('filters insights by active status', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(db.briefing.findFirst).mockResolvedValue(mockBriefing);

    const req = makeRequest('org-1');
    await GET(req, makeParams('org-1'));

    const call = vi.mocked(db.briefing.findFirst).mock.calls[0][0];
    const insightInclude = call!.include!.organization!.include!.insights as any;
    expect(insightInclude.where.status).toBe('active');
  });

  it('limits signals to 10 and insights to 10', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(db.briefing.findFirst).mockResolvedValue(mockBriefing);

    const req = makeRequest('org-1');
    await GET(req, makeParams('org-1'));

    const call = vi.mocked(db.briefing.findFirst).mock.calls[0][0];
    const signalInclude = call!.include!.organization!.include!.signals as any;
    const insightInclude = call!.include!.organization!.include!.insights as any;
    expect(signalInclude.take).toBe(10);
    expect(insightInclude.take).toBe(10);
  });

  // ── Error handling ────────────────────────────────────────────────

  it('returns 500 when database query fails', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(db.briefing.findFirst).mockRejectedValue(new Error('Connection lost'));

    const req = makeRequest('org-1');
    const res = await GET(req, makeParams('org-1'));

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to fetch briefing');
  });

  // ── Response data integrity ────────────────────────────────────────

  it('returns full organization data in response', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(db.briefing.findFirst).mockResolvedValue(mockBriefing);

    const req = makeRequest('org-1');
    const res = await GET(req, makeParams('org-1'));
    const body = await res.json();

    expect(body.data.organization).toBeDefined();
    expect(body.data.organization.name).toBe('Acme Corp');
    expect(body.data.organization.people).toHaveLength(1);
    expect(body.data.organization.signals).toHaveLength(1);
    expect(body.data.organization.insights).toHaveLength(1);
  });
});
