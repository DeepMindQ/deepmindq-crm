/**
 * @vitest-environment node
 *
 * Feedback API — Route Tests
 *
 * Tests POST /api/feedback — Receive and persist user feedback.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/api-auth', () => ({
  checkApiAuth: vi.fn(),
}));

vi.mock('@/lib/db', () => ({
  db: {
    auditLog: {
      create: vi.fn(),
    },
  },
}));

import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { POST } from '@/app/api/feedback/route';

// ── Helpers ────────────────────────────────────────────────────────────

const mockSession = { id: 'user-1', email: 'test@example.com', role: 'admin' as const };

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/feedback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Test Data ──────────────────────────────────────────────────────────

const mockAuditEntry = {
  id: 'audit-1',
  action: 'feedback',
  createdAt: new Date('2025-01-15T10:30:00Z'),
};

// ── POST /api/feedback ────────────────────────────────────────────────

describe('POST /api/feedback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Authentication ─────────────────────────────────────────────────

  it('returns 401 when no session is provided', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      errorResponse: new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    });

    const req = makeRequest({ sentiment: 'positive', itemId: 'item-1', itemType: 'signal' });
    const res = await POST(req);

    expect(res.status).toBe(401);
  });

  // ── Validation ─────────────────────────────────────────────────────

  it('returns 400 when sentiment is missing', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});

    const req = makeRequest({ itemId: 'item-1', itemType: 'signal' });
    const res = await POST(req);

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid request body');
  });

  it('returns 400 when itemId is missing', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});

    const req = makeRequest({ sentiment: 'positive', itemType: 'signal' });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('returns 400 when itemType is missing', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});

    const req = makeRequest({ sentiment: 'positive', itemId: 'item-1' });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('returns 400 when sentiment has invalid value', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});

    const req = makeRequest({ sentiment: 'happy', itemId: 'item-1', itemType: 'signal' });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it('returns 400 when itemId exceeds max length', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});

    const longId = 'a'.repeat(101);
    const req = makeRequest({ sentiment: 'positive', itemId: longId, itemType: 'signal' });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  // ── Successful feedback ─────────────────────────────────────────────

  it('returns 200 with feedback data on valid request', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(db.auditLog.create).mockResolvedValue(mockAuditEntry);

    const req = makeRequest({
      sentiment: 'positive',
      itemId: 'item-1',
      itemType: 'signal',
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toBeDefined();
    expect(body.data.sentiment).toBe('positive');
    expect(body.data.itemId).toBe('item-1');
    expect(body.data.itemType).toBe('signal');
    expect(body.data.id).toBe('audit-1');
  });

  it('persists feedback with correct action resource', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(db.auditLog.create).mockResolvedValue(mockAuditEntry);

    const req = makeRequest({
      sentiment: 'negative',
      itemId: 'item-2',
      itemType: 'recommendation',
    });
    await POST(req);

    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'feedback',
          resource: 'recommendation',
        }),
      }),
    );
  });

  it('includes context when provided', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(db.auditLog.create).mockResolvedValue(mockAuditEntry);

    const req = makeRequest({
      sentiment: 'neutral',
      itemId: 'item-3',
      itemType: 'organization',
      context: 'During pipeline review',
    });
    await POST(req);

    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          details: expect.stringContaining('During pipeline review'),
        }),
      }),
    );
  });

  it('includes comment when provided', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(db.auditLog.create).mockResolvedValue(mockAuditEntry);

    const req = makeRequest({
      sentiment: 'positive',
      itemId: 'item-4',
      itemType: 'signal',
      comment: 'Great insight on this funding event',
    });
    await POST(req);

    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          details: expect.stringContaining('Great insight on this funding event'),
        }),
      }),
    );
  });

  it('returns createdAt from audit entry', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    const createdAt = new Date('2025-03-01T12:00:00Z');
    vi.mocked(db.auditLog.create).mockResolvedValue({ ...mockAuditEntry, createdAt });

    const req = makeRequest({
      sentiment: 'positive',
      itemId: 'item-5',
      itemType: 'signal',
    });
    const res = await POST(req);
    const body = await res.json();

    expect(body.data.createdAt).toBe(createdAt.toISOString());
  });

  it('accepts all three valid sentiment values', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(db.auditLog.create).mockResolvedValue(mockAuditEntry);

    for (const sentiment of ['positive', 'negative', 'neutral']) {
      vi.clearAllMocks();
      vi.mocked(checkApiAuth).mockResolvedValue({});
      vi.mocked(db.auditLog.create).mockResolvedValue(mockAuditEntry);

      const req = makeRequest({ sentiment, itemId: 'item-x', itemType: 'signal' });
      const res = await POST(req);

      expect(res.status).toBe(200);
    }
  });

  // ── Error handling ────────────────────────────────────────────────

  it('returns 500 when database create fails', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});
    vi.mocked(db.auditLog.create).mockRejectedValue(new Error('DB connection lost'));

    const req = makeRequest({
      sentiment: 'positive',
      itemId: 'item-1',
      itemType: 'signal',
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('Failed to submit feedback');
  });

  it('returns 500 when JSON parsing fails', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({});

    const req = new NextRequest('http://localhost/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    const res = await POST(req);

    expect(res.status).toBe(500);
  });
});
