/**
 * @vitest-environment node
 *
 * AI Advisor Chat — Route Tests
 *
 * Tests POST /api/advisor/chat — Accept user message and return grounded response.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/api-auth', () => ({
  checkApiAuth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    signal: { findMany: vi.fn() },
    organization: { findMany: vi.fn() },
    insight: { findMany: vi.fn() },
  },
}));

import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { POST } from '@/app/api/advisor/chat/route';

// ── Helpers ────────────────────────────────────────────────────────────

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/advisor/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Test Data ──────────────────────────────────────────────────────────

const mockSignal = {
  id: 'sig-1',
  title: 'Series B funding round',
  signalType: 'funding',
  severity: 'high',
  organization: { name: 'Acme Corp', industry: 'Technology' },
};

const mockOrganization = {
  id: 'org-1',
  name: 'Globex Inc',
  industry: 'Finance',
  intelligenceScore: 85,
  lastSignalAt: new Date('2025-01-10'),
};

const mockRecommendation = {
  id: 'rec-1',
  title: 'Schedule outreach call',
  recommendation: 'Contact CEO directly for partnership discussion',
  category: 'recommendation',
  status: 'active',
  organization: { name: 'Initech' },
};

// ── POST /api/advisor/chat ────────────────────────────────────────────

describe('POST /api/advisor/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(db.signal.findMany).mockResolvedValue([]);
    vi.mocked(db.organization.findMany).mockResolvedValue([]);
    vi.mocked(db.insight.findMany).mockResolvedValue([]);
  });

  // ── Authentication ─────────────────────────────────────────────────

  it('returns 401 when no session is provided', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      errorResponse: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });

    const req = makeRequest({ message: 'Hello' });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  // ── Validation ─────────────────────────────────────────────────────

  it('returns 400 when message is missing', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});

    const req = makeRequest({});
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid request body');
  });

  it('returns 400 when message is empty string', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});

    const req = makeRequest({ message: '' });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('returns 400 when message exceeds 2000 characters', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});

    const req = makeRequest({ message: 'a'.repeat(2001) });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('accepts optional context field', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});

    const req = makeRequest({ message: 'Hello', context: 'Pipeline review' });
    const res = await POST(req);

    // Should not 400 — context is optional
    expect(res.status).toBe(200);
  });

  // ── Empty data response ───────────────────────────────────────────

  it('returns guidance message when no data is available', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});

    const req = makeRequest({ message: 'Tell me about my accounts' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.response).toContain("don't have any intelligence data");
    expect(body.data.sources).toEqual([]);
  });

  // ── Data-driven response ──────────────────────────────────────────

  it('includes signals in response when available', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(db.signal.findMany).mockResolvedValue([mockSignal]);
    vi.mocked(db.organization.findMany).mockResolvedValue([mockOrganization]);
    vi.mocked(db.insight.findMany).mockResolvedValue([mockRecommendation]);

    const req = makeRequest({ message: 'What signals do I have?' });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data.response).toContain('Recent Signals');
    expect(body.data.response).toContain('Series B funding round');
    expect(body.data.response).toContain('Acme Corp');
  });

  it('includes organizations in response when available', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(db.signal.findMany).mockResolvedValue([mockSignal]);
    vi.mocked(db.organization.findMany).mockResolvedValue([mockOrganization]);
    vi.mocked(db.insight.findMany).mockResolvedValue([mockRecommendation]);

    const req = makeRequest({ message: 'Show me my organizations' });
    const res = await POST(req);
    const body = await res.json();

    expect(body.data.response).toContain('Top Tracked Organizations');
    expect(body.data.response).toContain('Globex Inc');
    expect(body.data.response).toContain('Finance');
    expect(body.data.response).toContain('85');
  });

  it('includes recommendations in response when available', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(db.signal.findMany).mockResolvedValue([mockSignal]);
    vi.mocked(db.organization.findMany).mockResolvedValue([mockOrganization]);
    vi.mocked(db.insight.findMany).mockResolvedValue([mockRecommendation]);

    const req = makeRequest({ message: 'What should I do next?' });
    const res = await POST(req);
    const body = await res.json();

    expect(body.data.response).toContain('Pending Recommendations');
    expect(body.data.response).toContain('Contact CEO directly for partnership discussion');
  });

  it('returns sources array with correct types', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(db.signal.findMany).mockResolvedValue([mockSignal]);
    vi.mocked(db.organization.findMany).mockResolvedValue([mockOrganization]);
    vi.mocked(db.insight.findMany).mockResolvedValue([mockRecommendation]);

    const req = makeRequest({ message: 'Give me an overview' });
    const res = await POST(req);
    const body = await res.json();

    const types = body.data.sources.map((s: any) => s.type);
    expect(types).toContain('signal');
    expect(types).toContain('organization');
    expect(types).toContain('recommendation');
  });

  // ── Contextual guidance ─────────────────────────────────────────────

  it('adds recommendation suggestion when message contains "recommend"', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(db.signal.findMany).mockResolvedValue([mockSignal]);

    const req = makeRequest({ message: 'What are your recommendations?' });
    const res = await POST(req);
    const body = await res.json();

    expect(body.data.response).toContain('Suggestion');
    expect(body.data.response).toContain('Review your pending recommendations');
  });

  it('adds signal suggestion when message contains "signal"', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(db.signal.findMany).mockResolvedValue([mockSignal]);

    const req = makeRequest({ message: 'Show me recent signals' });
    const res = await POST(req);
    const body = await res.json();

    expect(body.data.response).toContain('Suggestion');
    expect(body.data.response).toContain('critical and high-severity signals');
  });

  it('adds pipeline suggestion when message contains "pipeline"', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(db.organization.findMany).mockResolvedValue([mockOrganization]);

    const req = makeRequest({ message: 'How is my pipeline looking?' });
    const res = await POST(req);
    const body = await res.json();

    expect(body.data.response).toContain('Suggestion');
    expect(body.data.response).toContain('intelligence scores');
  });

  it('adds default suggestion when no keywords match', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(db.signal.findMany).mockResolvedValue([mockSignal]);

    const req = makeRequest({ message: 'Hello there' });
    const res = await POST(req);
    const body = await res.json();

    expect(body.data.response).toContain('Ask me about specific organizations');
  });

  it('prepends context to response when context is provided', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(db.signal.findMany).mockResolvedValue([mockSignal]);

    const req = makeRequest({ message: 'Hello', context: 'Q1 Pipeline Review' });
    const res = await POST(req);
    const body = await res.json();

    expect(body.data.response).toContain('Context: Q1 Pipeline Review');
  });

  // ── DB query patterns ──────────────────────────────────────────────

  it('queries signals with active statuses ordered by detectedAt desc', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(db.signal.findMany).mockResolvedValue([]);

    const req = makeRequest({ message: 'Hello' });
    await POST(req);

    expect(db.signal.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: { in: ['detected', 'validated', 'analyzed'] } },
        orderBy: { detectedAt: 'desc' },
        take: 10,
      }),
    );
  });

  it('queries active organizations ordered by intelligence score', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});

    const req = makeRequest({ message: 'Hello' });
    await POST(req);

    expect(db.organization.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { trackingStatus: 'active' },
        orderBy: { intelligenceScore: 'desc' },
        take: 5,
      }),
    );
  });

  // ── Error handling ────────────────────────────────────────────────

  it('returns 500 when database query fails', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(db.signal.findMany).mockRejectedValue(new Error('DB down'));

    const req = makeRequest({ message: 'Hello' });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to generate advisor response');
  });

  it('returns 500 when JSON parsing fails', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});

    const req = new NextRequest('http://localhost/api/advisor/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
  });
});
