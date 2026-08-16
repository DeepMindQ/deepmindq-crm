// ═══════════════════════════════════════════════════════════════════════════
// Session Management — Unit Tests
//
// Tests hashToken, createSession, getCurrentSession, requireAuth,
// destroyCurrentSession, validateSessionToken, destroySessionByToken,
// cleanupExpiredSessions, and AuthError from @/lib/session.ts.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (factories must be self-contained, no top-level variables) ──

vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  },
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('@/lib/session-manager', () => ({
  shouldRotateSession: vi.fn().mockReturnValue(false),
  enforceSessionLimit: vi.fn().mockResolvedValue(0),
}));

vi.mock('@/lib/db', () => ({
  db: {
    session: {
      create: vi.fn(),
      findUnique: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import { cookies } from 'next/headers';
import {
  hashToken,
  createSession,
  getCurrentSession,
  requireAuth,
  destroyCurrentSession,
  validateSessionToken,
  destroySessionByToken,
  cleanupExpiredSessions,
  AuthError,
} from '@/lib/session';
import { db } from '@/lib/db';

// ── Helpers ────────────────────────────────────────────────────────────

const mockSession = {
  id: 'session-1',
  userId: 'user-1',
  token: 'hashed-token',
  expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  createdAt: new Date(),
  user: {
    id: 'user-1',
    email: 'admin@example.com',
    name: 'Admin',
    role: 'admin',
  },
};

const mockCookieStore = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockCookieStore.get.mockReturnValue(undefined);
  mockCookieStore.set.mockReturnValue(undefined);
  mockCookieStore.delete.mockReturnValue(undefined);
  vi.mocked(cookies).mockResolvedValue(mockCookieStore as any);
  process.env.NODE_ENV = 'test';
});

// ── hashToken ──────────────────────────────────────────────────────────

describe('hashToken', () => {
  it('returns a 64-character hex string (SHA-256)', async () => {
    const hash = await hashToken('test-token');
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('produces deterministic hashes', async () => {
    const hash1 = await hashToken('same-input');
    const hash2 = await hashToken('same-input');
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different inputs', async () => {
    const hash1 = await hashToken('input-1');
    const hash2 = await hashToken('input-2');
    expect(hash1).not.toBe(hash2);
  });

  it('uses dmq_session: prefix in hash computation', async () => {
    const withPrefix = await hashToken('test');
    const encoder = new TextEncoder();
    const rawBuffer = await crypto.subtle.digest('SHA-256', encoder.encode('test'));
    const rawHash = Array.from(new Uint8Array(rawBuffer))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
    expect(withPrefix).not.toBe(rawHash);
  });
});

// ── AuthError ──────────────────────────────────────────────────────────

describe('AuthError', () => {
  it('extends Error', () => {
    const err = new AuthError('test');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(AuthError);
  });

  it('has default status of 401', () => {
    const err = new AuthError('unauthorized');
    expect(err.status).toBe(401);
    expect(err.name).toBe('AuthError');
    expect(err.message).toBe('unauthorized');
  });

  it('accepts custom status code', () => {
    const err = new AuthError('forbidden', 403);
    expect(err.status).toBe(403);
  });
});

// ── createSession ──────────────────────────────────────────────────────

describe('createSession', () => {
  it('creates a session and sets httpOnly cookie', async () => {
    vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(db.session.create).mockResolvedValue(mockSession);

    const result = await createSession('user-1');
    expect(result.token).toBeDefined();
    expect(result.token).toHaveLength(64);
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(mockCookieStore.set).toHaveBeenCalledWith(
      'dmq_session',
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' }),
    );
  });

  it('deletes expired sessions for user before creating new', async () => {
    vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 2 });
    vi.mocked(db.session.create).mockResolvedValue(mockSession);

    await createSession('user-1');
    expect(db.session.deleteMany).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        expiresAt: { lt: expect.any(Date) },
      },
    });
  });

  it('stores hashed token (not plaintext) in DB', async () => {
    vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(db.session.create).mockResolvedValue(mockSession);

    await createSession('user-1');
    const createCall = vi.mocked(db.session.create).mock.calls[0][0];
    const storedToken = createCall.data.token as string;
    expect(storedToken).toHaveLength(64);
    expect(storedToken).toMatch(/^[0-9a-f]{64}$/);
  });

  it('sets secure flag in production', async () => {
    process.env.NODE_ENV = 'production';
    vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(db.session.create).mockResolvedValue(mockSession);

    await createSession('user-1');
    const setOpts = mockCookieStore.set.mock.calls[0][2];
    expect(setOpts.secure).toBe(true);
    process.env.NODE_ENV = 'test';
  });

  it('does not set secure flag in non-production', async () => {
    process.env.NODE_ENV = 'development';
    vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 0 });
    vi.mocked(db.session.create).mockResolvedValue(mockSession);

    await createSession('user-1');
    const setOpts = mockCookieStore.set.mock.calls[0][2];
    expect(setOpts.secure).toBe(false);
    process.env.NODE_ENV = 'test';
  });
});

// ── getCurrentSession ──────────────────────────────────────────────────

describe('getCurrentSession', () => {
  it('returns null when no session cookie exists', async () => {
    const result = await getCurrentSession();
    expect(result).toBeNull();
  });

  it('returns user when valid session exists', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
    vi.mocked(db.session.findUnique).mockResolvedValue(mockSession);
    vi.mocked(db.session.update).mockResolvedValue(mockSession);

    const result = await getCurrentSession();
    expect(result).not.toBeNull();
    expect(result!.id).toBe('user-1');
    expect(result!.email).toBe('admin@example.com');
  });

  it('returns null when session is expired and deletes it', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'expired-token' });
    const expiredSession = {
      ...mockSession,
      expiresAt: new Date(Date.now() - 1000),
    };
    vi.mocked(db.session.findUnique).mockResolvedValue(expiredSession);
    vi.mocked(db.session.delete).mockResolvedValue(mockSession);

    const result = await getCurrentSession();
    expect(result).toBeNull();
    expect(db.session.delete).toHaveBeenCalledWith({ where: { id: 'session-1' } });
  });

  it('returns null when session not found in DB', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'unknown-token' });
    vi.mocked(db.session.findUnique).mockResolvedValue(null);

    const result = await getCurrentSession();
    expect(result).toBeNull();
  });

  it('returns null on any error (graceful failure)', async () => {
    vi.mocked(db.session.findUnique).mockRejectedValue(new Error('DB down'));
    mockCookieStore.get.mockReturnValue({ value: 'some-token' });

    const result = await getCurrentSession();
    expect(result).toBeNull();
  });

  it('extends session expiry (rolling expiry)', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
    vi.mocked(db.session.findUnique).mockResolvedValue(mockSession);
    vi.mocked(db.session.update).mockResolvedValue(mockSession);

    await getCurrentSession();
    expect(db.session.update).toHaveBeenCalledWith({
      where: { id: 'session-1' },
      data: { expiresAt: expect.any(Date) },
    });
  });
});

// ── requireAuth ────────────────────────────────────────────────────────

describe('requireAuth', () => {
  it('throws AuthError when no session exists', async () => {
    await expect(requireAuth()).rejects.toThrow(AuthError);
  });

  it('returns user when session exists', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'valid-token' });
    vi.mocked(db.session.findUnique).mockResolvedValue(mockSession);
    vi.mocked(db.session.update).mockResolvedValue(mockSession);

    const user = await requireAuth();
    expect(user.id).toBe('user-1');
  });
});

// ── destroyCurrentSession ──────────────────────────────────────────────

describe('destroyCurrentSession', () => {
  it('deletes session and clears cookie when token exists', async () => {
    mockCookieStore.get.mockReturnValue({ value: 'some-token' });
    vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 1 });

    await destroyCurrentSession();
    expect(db.session.deleteMany).toHaveBeenCalled();
    expect(mockCookieStore.delete).toHaveBeenCalledWith('dmq_session');
  });

  it('only clears cookie when no token exists', async () => {
    await destroyCurrentSession();
    expect(db.session.deleteMany).not.toHaveBeenCalled();
    expect(mockCookieStore.delete).toHaveBeenCalledWith('dmq_session');
  });
});

// ── validateSessionToken ───────────────────────────────────────────────

describe('validateSessionToken', () => {
  it('returns null for short tokens', async () => {
    const result = await validateSessionToken('short');
    expect(result).toBeNull();
  });

  it('returns null for empty string', async () => {
    const result = await validateSessionToken('');
    expect(result).toBeNull();
  });

  it('returns user for valid token', async () => {
    vi.mocked(db.session.findUnique).mockResolvedValue(mockSession);

    const result = await validateSessionToken('a'.repeat(32));
    expect(result).not.toBeNull();
    expect(result!.id).toBe('user-1');
  });

  it('returns null when session not found', async () => {
    vi.mocked(db.session.findUnique).mockResolvedValue(null);

    const result = await validateSessionToken('a'.repeat(32));
    expect(result).toBeNull();
  });

  it('returns null when session is expired', async () => {
    vi.mocked(db.session.findUnique).mockResolvedValue({
      ...mockSession,
      expiresAt: new Date(Date.now() - 1000),
    });

    const result = await validateSessionToken('a'.repeat(32));
    expect(result).toBeNull();
  });

  it('returns null on error', async () => {
    vi.mocked(db.session.findUnique).mockRejectedValue(new Error('DB error'));

    const result = await validateSessionToken('a'.repeat(32));
    expect(result).toBeNull();
  });

  it('does not set cookies or extend expiry', async () => {
    vi.mocked(db.session.findUnique).mockResolvedValue(mockSession);

    await validateSessionToken('a'.repeat(32));
    expect(mockCookieStore.set).not.toHaveBeenCalled();
  });
});

// ── destroySessionByToken ──────────────────────────────────────────────

describe('destroySessionByToken', () => {
  it('deletes session by hashed token', async () => {
    vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 1 });

    await destroySessionByToken('some-token');
    expect(db.session.deleteMany).toHaveBeenCalledWith({
      where: { token: expect.any(String) },
    });
  });

  it('does nothing for empty token', async () => {
    await destroySessionByToken('');
    expect(db.session.deleteMany).not.toHaveBeenCalled();
  });
});

// ── cleanupExpiredSessions ─────────────────────────────────────────────

describe('cleanupExpiredSessions', () => {
  it('returns count of deleted sessions', async () => {
    vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 5 });

    const count = await cleanupExpiredSessions();
    expect(count).toBe(5);
    expect(db.session.deleteMany).toHaveBeenCalledWith({
      where: { expiresAt: { lt: expect.any(Date) } },
    });
  });

  it('returns 0 when no expired sessions', async () => {
    vi.mocked(db.session.deleteMany).mockResolvedValue({ count: 0 });

    const count = await cleanupExpiredSessions();
    expect(count).toBe(0);
  });
});
