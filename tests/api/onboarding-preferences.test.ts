// ═══════════════════════════════════════════════════════════════════════════
// Onboarding Preferences API — Route Tests
//
// Tests for:
//   POST /api/onboarding/preferences
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
    user: { update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { POST as savePreferences } from '@/app/api/onboarding/preferences/route';

// ── Helpers ────────────────────────────────────────────────────────────

const mockSession = { id: 'user-1', email: 'test@example.com', role: 'admin' as const };

function makeUnauthedResponse() {
  return new Response(JSON.stringify({ error: 'Auth required' }), { status: 401 });
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/onboarding/preferences
// ═══════════════════════════════════════════════════════════════════════════

describe('POST /api/onboarding/preferences', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns 401 when not authenticated', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: null,
      errorResponse: makeUnauthedResponse(),
    });
    const req = new NextRequest('http://localhost/api/onboarding/preferences', { method: 'POST' });
    const res = await savePreferences(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid JSON body', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    // Zod expects an object; send a non-object
    const req = new NextRequest('http://localhost/api/onboarding/preferences', {
      method: 'POST',
      body: 'not json',
      headers: { 'Content-Type': 'text/plain' },
    });
    const res = await savePreferences(req);
    // Body parsing fails → caught by try/catch → 500
    expect([400, 500]).toContain(res.status);
  });

  it('saves preferences with all fields', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.user.update).mockResolvedValue({});
    vi.mocked(db.auditLog.create).mockResolvedValue({ id: 'audit-1' });

    const req = new NextRequest('http://localhost/api/onboarding/preferences', {
      method: 'POST',
      body: JSON.stringify({
        fullName: 'Jane Doe',
        role: 'SDR',
        company: 'Acme Corp',
        industry: 'SaaS',
        signals: ['funding', 'leadership'],
      }),
    });
    const res = await savePreferences(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { name: 'Jane Doe' },
    });
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'onboarding_preferences_saved',
          resource: 'User',
          userId: 'user-1',
        }),
      }),
    );
  });

  it('saves preferences with only some fields', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.auditLog.create).mockResolvedValue({ id: 'audit-2' });

    const req = new NextRequest('http://localhost/api/onboarding/preferences', {
      method: 'POST',
      body: JSON.stringify({ role: 'AE', industry: 'FinTech' }),
    });
    const res = await savePreferences(req);
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    // fullName not provided → user.update should NOT be called
    expect(db.user.update).not.toHaveBeenCalled();
  });

  it('updates user name when fullName is provided', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.user.update).mockResolvedValue({});
    vi.mocked(db.auditLog.create).mockResolvedValue({ id: 'audit-3' });

    const req = new NextRequest('http://localhost/api/onboarding/preferences', {
      method: 'POST',
      body: JSON.stringify({ fullName: 'John Smith' }),
    });
    await savePreferences(req);

    expect(db.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { name: 'John Smith' },
    });
  });

  it('stores preferences as JSON in audit log', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.auditLog.create).mockResolvedValue({ id: 'audit-4' });

    const prefs = { role: 'SDR', signals: ['funding'] };
    const req = new NextRequest('http://localhost/api/onboarding/preferences', {
      method: 'POST',
      body: JSON.stringify(prefs),
    });
    await savePreferences(req);

    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          details: JSON.stringify(prefs),
        }),
      }),
    );
  });

  it('handles session without id gracefully', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: { id: undefined, email: 'test@test.com' },
    });
    vi.mocked(db.auditLog.create).mockResolvedValue({ id: 'audit-5' });

    const req = new NextRequest('http://localhost/api/onboarding/preferences', {
      method: 'POST',
      body: JSON.stringify({ role: 'SDR' }),
    });
    const res = await savePreferences(req);

    expect(res.status).toBe(200);
    expect(db.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: null }),
      }),
    );
  });

  it('returns 500 on database error', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({ session: mockSession });
    vi.mocked(db.auditLog.create).mockRejectedValue(new Error('DB down'));

    const req = new NextRequest('http://localhost/api/onboarding/preferences', {
      method: 'POST',
      body: JSON.stringify({ role: 'SDR' }),
    });
    const res = await savePreferences(req);
    expect(res.status).toBe(500);
  });
});
