// ═══════════════════════════════════════════════════════════════════════════
// Recommendations API — Route Tests
//
// Tests for:
//   GET    /api/recommendations (list with filters and stats)
//   PATCH  /api/recommendations/[id] (update status + feedback)
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
    insight: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { GET as listRecommendations } from '@/app/api/recommendations/route';
import { PATCH as updateRecommendation } from '@/app/api/recommendations/[id]/route';

// ── Helpers ────────────────────────────────────────────────────────────

const mockSession = { id: 'user-1', email: 'test@example.com', role: 'admin' as const };

function makeUnauthedResponse() {
  return new Response(JSON.stringify({ error: 'Auth required' }), { status: 401 });
}

const mockInsight = {
  id: 'rec-1',
  title: 'Reach out to Acme Corp',
  narrative: 'Acme just raised Series B',
  recommendation: 'Send a congratulatory message',
  suggestedMessage: 'Congrats on the round!',
  confidence: 'high',
  confidenceScore: 0.92,
  status: 'active',
  category: 'recommendation',
  evidenceIds: ['sig-1'],
  signalIds: ['sig-2'],
  reasoningMethod: 'signal_chain',
  createdAt: '2025-01-15T00:00:00.000Z',
  updatedAt: '2025-01-15T00:00:00.000Z',
  organization: { name: 'Acme Corp', domain: 'acme.com', industry: 'SaaS' },
  signal: { id: 'sig-2', title: 'Series B', signalType: 'funding' },
  dismissedReason: null,
};

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/recommendations
// ═══════════════════════════════════════════════════════════════════════════

describe('GET /api/recommendations', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: null,
      errorResponse: makeUnauthedResponse(),
    });
    const res = await listRecommendations(new NextRequest('http://localhost/api/recommendations'));
    expect(res.status).toBe(401);
  });

  it('returns recommendations with default params and stats', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.insight.findMany).mockResolvedValue([mockInsight]);
    vi.mocked(db.insight.count)
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(3) // accepted (acted_upon)
      .mockResolvedValueOnce(4) // dismissed
      .mockResolvedValueOnce(3); // pending (active)

    const res = await listRecommendations(new NextRequest('http://localhost/api/recommendations'));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.recommendations).toHaveLength(1);
    expect(body.data.stats).toEqual({ total: 10, accepted: 3, dismissed: 4, pending: 3 });
    expect(db.insight.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { category: 'recommendation' },
        take: 50,
      }),
    );
  });

  it('maps DB status "active" to recommendation status "pending"', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.insight.findMany).mockResolvedValue([mockInsight]);
    vi.mocked(db.insight.count).mockResolvedValue(1);

    const res = await listRecommendations(new NextRequest('http://localhost/api/recommendations'));
    const body = await res.json();

    expect(body.data.recommendations[0].status).toBe('pending');
  });

  it('filters by status=pending (maps to "active")', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.insight.findMany).mockResolvedValue([]);
    vi.mocked(db.insight.count).mockResolvedValue(0);

    const res = await listRecommendations(
      new NextRequest('http://localhost/api/recommendations?status=pending'),
    );

    const callArgs = vi.mocked(db.insight.findMany).mock.calls[0][0] as any;
    expect(callArgs.where.status).toBe('active');
  });

  it('filters by status=accepted (maps to "acted_upon")', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.insight.findMany).mockResolvedValue([]);
    vi.mocked(db.insight.count).mockResolvedValue(0);

    const res = await listRecommendations(
      new NextRequest('http://localhost/api/recommendations?status=accepted'),
    );

    const callArgs = vi.mocked(db.insight.findMany).mock.calls[0][0] as any;
    expect(callArgs.where.status).toBe('acted_upon');
  });

  it('filters by type', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.insight.findMany).mockResolvedValue([]);
    vi.mocked(db.insight.count).mockResolvedValue(0);

    const res = await listRecommendations(
      new NextRequest('http://localhost/api/recommendations?type=signal_chain'),
    );

    const callArgs = vi.mocked(db.insight.findMany).mock.calls[0][0] as any;
    expect(callArgs.where.reasoningMethod).toBe('signal_chain');
  });

  it('respects custom limit', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.insight.findMany).mockResolvedValue([]);
    vi.mocked(db.insight.count).mockResolvedValue(0);

    const res = await listRecommendations(
      new NextRequest('http://localhost/api/recommendations?limit=10'),
    );

    expect(db.insight.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 10 }));
  });

  it('returns 400 for invalid limit', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const res = await listRecommendations(
      new NextRequest('http://localhost/api/recommendations?limit=abc'),
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid status', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });

    const res = await listRecommendations(
      new NextRequest('http://localhost/api/recommendations?status=invalid'),
    );
    expect(res.status).toBe(400);
  });

  it('includes organization and signal relations', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.insight.findMany).mockResolvedValue([mockInsight]);
    vi.mocked(db.insight.count).mockResolvedValue(1);

    const res = await listRecommendations(new NextRequest('http://localhost/api/recommendations'));
    const body = await res.json();

    expect(body.data.recommendations[0].organization).toEqual({
      name: 'Acme Corp',
      domain: 'acme.com',
      industry: 'SaaS',
    });
    expect(body.data.recommendations[0].signal).toEqual({
      id: 'sig-2',
      title: 'Series B',
      signalType: 'funding',
    });
  });

  it('returns 500 on database error', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.insight.findMany).mockRejectedValue(new Error('DB down'));

    const res = await listRecommendations(new NextRequest('http://localhost/api/recommendations'));
    expect(res.status).toBe(500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PATCH /api/recommendations/[id]
// ═══════════════════════════════════════════════════════════════════════════

describe('PATCH /api/recommendations/[id]', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: null,
      errorResponse: makeUnauthedResponse(),
    });
    const res = await updateRecommendation(
      new NextRequest('http://localhost/api/recommendations/rec-1', { method: 'PATCH' }),
      { params: Promise.resolve({ id: 'rec-1' }) },
    );
    expect(res.status).toBe(401);
  });

  it('returns 400 for empty ID', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    const res = await updateRecommendation(
      new NextRequest('http://localhost/api/recommendations/', { method: 'PATCH' }),
      { params: Promise.resolve({ id: '' }) },
    );
    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid body', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    const req = new NextRequest('http://localhost/api/recommendations/rec-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'invalid_status' }),
    });
    const res = await updateRecommendation(req, { params: Promise.resolve({ id: 'rec-1' }) });
    expect(res.status).toBe(400);
  });

  it('returns 404 when recommendation not found', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.insight.findUnique).mockResolvedValue(null);

    const req = new NextRequest('http://localhost/api/recommendations/rec-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'accepted' }),
    });
    const res = await updateRecommendation(req, { params: Promise.resolve({ id: 'rec-1' }) });
    expect(res.status).toBe(404);
  });

  it('returns 404 when insight exists but is not a recommendation', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.insight.findUnique).mockResolvedValue({ ...mockInsight, category: 'analysis' });

    const req = new NextRequest('http://localhost/api/recommendations/rec-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'accepted' }),
    });
    const res = await updateRecommendation(req, { params: Promise.resolve({ id: 'rec-1' }) });
    expect(res.status).toBe(404);
  });

  it('accepts a recommendation', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.insight.findUnique).mockResolvedValue(mockInsight);
    vi.mocked(db.insight.update).mockResolvedValue({
      ...mockInsight,
      status: 'acted_upon',
    });

    const req = new NextRequest('http://localhost/api/recommendations/rec-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'accepted' }),
    });
    const res = await updateRecommendation(req, { params: Promise.resolve({ id: 'rec-1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(db.insight.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'rec-1' },
        data: { status: 'acted_upon' },
      }),
    );
    expect(body.data.status).toBe('accepted');
  });

  it('dismisses a recommendation with feedback comment', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.insight.findUnique).mockResolvedValue(mockInsight);
    vi.mocked(db.insight.update).mockResolvedValue({
      ...mockInsight,
      status: 'dismissed',
      dismissedReason: 'Not relevant',
    });
    vi.mocked(db.auditLog.create).mockResolvedValue({ id: 'audit-1' });

    const req = new NextRequest('http://localhost/api/recommendations/rec-1', {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'dismissed',
        feedback: { sentiment: 'negative', comment: 'Not relevant' },
      }),
    });
    const res = await updateRecommendation(req, { params: Promise.resolve({ id: 'rec-1' }) });
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(db.insight.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'dismissed',
          dismissedReason: 'Not relevant',
        }),
      }),
    );
    // Audit log should be created for feedback
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'feedback',
          resource: 'recommendation:rec-1',
        }),
      }),
    );
    expect(body.data.feedback.sentiment).toBe('negative');
  });

  it('stores feedback without status change', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.insight.findUnique).mockResolvedValue(mockInsight);
    vi.mocked(db.insight.update).mockResolvedValue(mockInsight);
    vi.mocked(db.auditLog.create).mockResolvedValue({ id: 'audit-2' });

    const req = new NextRequest('http://localhost/api/recommendations/rec-1', {
      method: 'PATCH',
      body: JSON.stringify({
        feedback: { sentiment: 'positive', comment: 'Great suggestion!' },
      }),
    });
    const res = await updateRecommendation(req, { params: Promise.resolve({ id: 'rec-1' }) });

    expect(res.status).toBe(200);
    // Should still store dismissedReason from feedback comment
    expect(db.insight.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { dismissedReason: 'Great suggestion!' },
      }),
    );
  });

  it('returns 400 for feedback comment over 1000 chars', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.insight.findUnique).mockResolvedValue(mockInsight);

    const req = new NextRequest('http://localhost/api/recommendations/rec-1', {
      method: 'PATCH',
      body: JSON.stringify({
        feedback: { sentiment: 'positive', comment: 'x'.repeat(1001) },
      }),
    });
    const res = await updateRecommendation(req, { params: Promise.resolve({ id: 'rec-1' }) });
    expect(res.status).toBe(400);
  });

  it('returns 500 on database error', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.insight.findUnique).mockRejectedValue(new Error('DB down'));

    const req = new NextRequest('http://localhost/api/recommendations/rec-1', {
      method: 'PATCH',
      body: JSON.stringify({ status: 'accepted' }),
    });
    const res = await updateRecommendation(req, { params: Promise.resolve({ id: 'rec-1' }) });
    expect(res.status).toBe(500);
  });
});
