/**
 * @vitest-environment node
 *
 * Logout API — Route Tests
 *
 * Tests POST /api/auth/logout — session destruction.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────

vi.mock('@/lib/session', () => ({
  destroyCurrentSession: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { destroyCurrentSession } from '@/lib/session';
import { POST } from '@/app/api/auth/logout/route';

// ── Tests ──────────────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 200 and success message on successful logout', async () => {
    vi.mocked(destroyCurrentSession).mockResolvedValue(undefined);

    const res = await POST();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.message).toBe('Logged out');
  });

  it('calls destroyCurrentSession once', async () => {
    vi.mocked(destroyCurrentSession).mockResolvedValue(undefined);

    await POST();
    expect(destroyCurrentSession).toHaveBeenCalledTimes(1);
  });

  it('returns 500 when destroyCurrentSession throws', async () => {
    vi.mocked(destroyCurrentSession).mockRejectedValue(new Error('DB connection failed'));

    const res = await POST();
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Internal server error');
  });

  it('returns 500 for non-Error exceptions', async () => {
    vi.mocked(destroyCurrentSession).mockRejectedValue('unexpected string error');

    const res = await POST();
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Internal server error');
  });

  it('logs error when session destruction fails', async () => {
    const { logger } = await import('@/lib/logger');
    vi.mocked(destroyCurrentSession).mockRejectedValue(new Error('Session store down'));

    await POST();
    expect(logger.error).toHaveBeenCalledWith(
      '[auth/logout] Error:',
      expect.objectContaining({ error: expect.any(Error) }),
    );
  });

  it('returns JSON content type', async () => {
    vi.mocked(destroyCurrentSession).mockResolvedValue(undefined);

    const res = await POST();
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('handles successful logout even after prior errors are cleared', async () => {
    // First call fails
    vi.mocked(destroyCurrentSession).mockRejectedValueOnce(new Error('transient'));
    await POST();

    // Second call succeeds
    vi.mocked(destroyCurrentSession).mockResolvedValueOnce(undefined);
    const res = await POST();
    expect(res.status).toBe(200);
  });

  it('returns valid JSON structure', async () => {
    vi.mocked(destroyCurrentSession).mockResolvedValue(undefined);

    const res = await POST();
    const data = await res.json();
    expect(data).toHaveProperty('success');
    expect(data).toHaveProperty('message');
  });
});
