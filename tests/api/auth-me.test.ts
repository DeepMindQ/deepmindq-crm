/**
 * @vitest-environment node
 *
 * Current User (auth/me) API — Route Tests
 *
 * Tests GET /api/auth/me — session validation and user retrieval.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mocks ──────────────────────────────────────────────────────────────

const { mockGet, mockGetCurrentSession, mockCookieStore } = vi.hoisted(() => {
  const mockGet = vi.fn();
  const mockGetCurrentSession = vi.fn();
  const mockCookieStore = {
    get: mockGet,
  };
  return { mockGet, mockGetCurrentSession, mockCookieStore };
});

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue(mockCookieStore),
}));

vi.mock('@/lib/session', () => ({
  getCurrentSession: mockGetCurrentSession,
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

import { cookies } from 'next/headers';
import { GET } from '@/app/api/auth/me/route';

// ── Tests ──────────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Ensure cookies always resolves to the mock store by default
    vi.mocked(cookies).mockResolvedValue(mockCookieStore);
  });

  it('returns 401 when no session cookie exists', async () => {
    mockGet.mockReturnValue(undefined);
    const res = await GET();
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Not authenticated');
  });

  it('returns 401 when session token is too short (<16 chars)', async () => {
    mockGet.mockReturnValue({ value: 'short' });
    const res = await GET();
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Invalid session');
  });

  it('returns 401 when token is exactly 15 characters', async () => {
    mockGet.mockReturnValue({ value: 'a'.repeat(15) });
    const res = await GET();
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Invalid session');
  });

  it('returns user data when session is valid', async () => {
    mockGet.mockReturnValue({ value: 'a'.repeat(64) });
    const user = { id: 'user-1', email: 'admin@test.com', name: 'Admin', role: 'admin' };
    mockGetCurrentSession.mockResolvedValue(user);
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user).toEqual(user);
  });

  it('returns 401 with SESSION_DB_ERROR when getCurrentSession returns null', async () => {
    mockGet.mockReturnValue({ value: 'a'.repeat(32) });
    mockGetCurrentSession.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.error).toBe('Session validation unavailable');
    expect(data.code).toBe('SESSION_DB_ERROR');
  });

  it('returns 401 with SESSION_DB_ERROR when getCurrentSession throws', async () => {
    mockGet.mockReturnValue({ value: 'a'.repeat(32) });
    const { logger } = await import('@/lib/logger');
    mockGetCurrentSession.mockRejectedValue(new Error('DB connection lost'));
    const res = await GET();
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.code).toBe('SESSION_DB_ERROR');
    expect(logger.warn).toHaveBeenCalledWith(
      '[auth/me] DB session check failed, using cookie-based auth:',
      expect.objectContaining({ error: 'DB connection lost' }),
    );
  });

  it('returns 500 when cookies() throws unexpectedly', async () => {
    vi.mocked(cookies).mockRejectedValue(new Error('Headers unavailable'));
    const res = await GET();
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error).toBe('Internal server error');
  });

  it('does not call getCurrentSession when token is missing', async () => {
    mockGet.mockReturnValue(undefined);
    await GET();
    expect(mockGetCurrentSession).not.toHaveBeenCalled();
  });

  it('does not call getCurrentSession when token is too short', async () => {
    mockGet.mockReturnValue({ value: 'tiny' });
    await GET();
    expect(mockGetCurrentSession).not.toHaveBeenCalled();
  });

  it('returns valid 16-char token through to getCurrentSession', async () => {
    mockGet.mockReturnValue({ value: 'a'.repeat(16) });
    const user = { id: 'u1', email: 'a@b.com', name: 'Test', role: 'user' };
    mockGetCurrentSession.mockResolvedValue(user);
    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.user.id).toBe('u1');
  });

  it('returns JSON content type', async () => {
    mockGet.mockReturnValue({ value: 'a'.repeat(64) });
    mockGetCurrentSession.mockResolvedValue({
      id: '1',
      email: 'a@b.com',
      name: 'A',
      role: 'admin',
    });
    const res = await GET();
    expect(res.headers.get('content-type')).toContain('application/json');
  });

  it('returns 401 when getCurrentSession rejects with non-Error', async () => {
    mockGet.mockReturnValue({ value: 'a'.repeat(32) });
    mockGetCurrentSession.mockRejectedValue('string error');
    const res = await GET();
    // Non-Error rejections are caught by the inner try-catch → 401 SESSION_DB_ERROR
    expect(res.status).toBe(401);
    const data = await res.json();
    expect(data.code).toBe('SESSION_DB_ERROR');
  });
});
