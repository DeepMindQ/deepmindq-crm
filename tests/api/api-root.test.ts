/**
 * @vitest-environment node
 *
 * API Root — Route Tests
 *
 * Tests GET /api — status endpoint with auth guard.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/api-auth', () => ({
  checkApiAuth: vi.fn(),
}));

import { checkApiAuth } from '@/lib/api-auth';
import { GET } from '@/app/api/route';

// ── Tests ──────────────────────────────────────────────────────────────

describe('GET /api', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({
        success: false,
        error: 'Authentication required',
        timestamp: '2025-01-01T00:00:00.000Z',
      }),
      { status: 401, headers: { 'Content-Type': 'application/json' } },
    );
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: null,
      errorResponse: unauthorizedResponse,
    });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it('returns 200 with status ok when authenticated', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: { id: 'u1', email: 'a@b.com', name: 'A', role: 'admin' },
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.status).toBe('ok');
    expect(data.version).toBe('1.0');
  });

  it('returns Cache-Control: no-store header', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: { id: 'u1', email: 'a@b.com', name: 'A', role: 'admin' },
    });

    const res = await GET();
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('returns Content-Type: application/json', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: { id: 'u1', email: 'a@b.com', name: 'A', role: 'admin' },
    });

    const res = await GET();
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('returns a valid ISO timestamp', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: { id: 'u1', email: 'a@b.com', name: 'A', role: 'admin' },
    });

    const res = await GET();
    const data = await res.json();
    const parsed = Date.parse(data.timestamp);
    expect(parsed).not.toBeNaN();
  });

  it('returns JSON with expected shape', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: { id: 'u1', email: 'a@b.com', name: 'A', role: 'admin' },
    });

    const res = await GET();
    const data = await res.json();
    expect(data).toHaveProperty('status');
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('timestamp');
  });

  it('passes no request argument to checkApiAuth (no RBAC check)', async () => {
    vi.mocked(checkApiAuth).mockResolvedValue({
      session: { id: 'u1', email: 'a@b.com', name: 'A', role: 'admin' },
    });

    await GET();
    expect(checkApiAuth).toHaveBeenCalledWith();
  });

  it('returns error response when checkApiAuth provides one', async () => {
    const forbiddenResponse = new Response(
      JSON.stringify({ success: false, error: 'Forbidden', timestamp: '2025-01-01T00:00:00.000Z' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } },
    );
    vi.mocked(checkApiAuth).mockResolvedValue({ session: null, errorResponse: forbiddenResponse });

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it('handles checkApiAuth throwing an error', async () => {
    vi.mocked(checkApiAuth).mockRejectedValue(new Error('Internal error'));

    // The route does not have try/catch, so this will propagate
    // Verify the behavior: it should throw
    await expect(GET()).rejects.toThrow('Internal error');
  });
});
