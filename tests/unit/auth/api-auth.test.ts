/**
 * Unit Tests — API Auth Guard (api-auth.ts)
 * Split from auth-authz-certification.test.ts during M3 Stabilization
 *
 * Validates: checkApiAuth, requireAdminRole
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/db', () => ({
  db: {
    user: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    session: { create: vi.fn(), findUnique: vi.fn(), findMany: vi.fn(), findFirst: vi.fn(), delete: vi.fn(), deleteMany: vi.fn() },
    otpCode: { create: vi.fn(), findFirst: vi.fn(), update: vi.fn(), updateMany: vi.fn() },
  },
}));

vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}));

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data: any, init?: any) => ({
      status: init?.status || 200,
      json: data,
      headers: new Headers(),
    })),
  },
}));

vi.mock('@/lib/session', async (importOriginal) => {
  const actual = await importOriginal() as Record<string, any>;
  return {
    ...actual,
    getCurrentSession: vi.fn(),
  };
});

describe('API Auth Guard (api-auth.ts)', () => {
  let checkApiAuth: any, requireAdminRole: any, getCurrentSession: any;
  beforeAll(async () => {
    try { const m = await import('@/lib/api-auth'); checkApiAuth = m.checkApiAuth; requireAdminRole = m.requireAdminRole; } catch {}
    try { const m = await import('@/lib/session'); getCurrentSession = m.getCurrentSession; } catch {}
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('checkApiAuth', () => {
    it('returns session when authenticated', async () => {
      const mockSession = {
        id: 'user-1', email: 'admin@test.com', name: 'Admin', role: 'admin', hasPassword: true,
      };
      getCurrentSession.mockResolvedValue(mockSession as any);

      const result = await checkApiAuth();
      expect(result.session).toEqual(mockSession);
      expect(result.errorResponse).toBeUndefined();
    });

    it('returns 401 error response when not authenticated', async () => {
      getCurrentSession.mockResolvedValue(null);

      const result = await checkApiAuth();
      expect(result.session).toBeNull();
      expect(result.errorResponse).toBeDefined();
      expect(result.errorResponse!.status).toBe(401);
    });

    it('returns 401 error response when getCurrentSession throws', async () => {
      getCurrentSession.mockRejectedValue(new Error('Cookie error'));

      const result = await checkApiAuth();
      expect(result.session).toBeNull();
      expect(result.errorResponse).toBeDefined();
      expect(result.errorResponse!.status).toBe(401);
    });
  });

  describe('requireAdminRole', () => {
    it('returns null when user has admin role', () => {
      const session = { id: 'u1', email: 'a@b.com', name: 'Admin', role: 'admin', hasPassword: true } as any;
      const result = requireAdminRole(session);
      expect(result).toBeNull();
    });

    it('returns 403 response for non-admin role', () => {
      const session = { id: 'u1', email: 'a@b.com', name: 'User', role: 'user', hasPassword: true } as any;
      const result = requireAdminRole(session);
      expect(result).toBeDefined();
      expect(result!.status).toBe(403);
    });

    it('returns 403 response for viewer role', () => {
      const session = { id: 'u1', email: 'a@b.com', name: 'Viewer', role: 'viewer', hasPassword: false } as any;
      const result = requireAdminRole(session);
      expect(result).toBeDefined();
      expect(result!.status).toBe(403);
    });

    it('returns 403 response for operator role', () => {
      const session = { id: 'u1', email: 'a@b.com', name: 'Op', role: 'operator', hasPassword: false } as any;
      const result = requireAdminRole(session);
      expect(result).toBeDefined();
      expect(result!.status).toBe(403);
    });
  });
});
