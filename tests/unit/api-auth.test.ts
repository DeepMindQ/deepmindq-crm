/**
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkApiAuth,
  requireAdminRole,
  filterResponseByRole,
  filterResponseArrayByRole,
} from '@/lib/api-auth';

// ── Mocks ──────────────────────────────────────────────────────────

vi.mock('next/server', () => ({
  NextResponse: {
    json: vi.fn((data, init) => ({
      status: init?.status || 200,
      body: data,
      headers: new Map(),
      json: () => Promise.resolve(data),
    })),
  },
}));

vi.mock('@/lib/session', () => ({
  getCurrentSession: vi.fn(),
}));

vi.mock('@/lib/rbac', () => ({
  authorizeRoute: vi.fn(),
}));

vi.mock('@/lib/rbac-enforcement', () => ({
  filterObjectByRole: vi.fn((obj, role, model) => {
    // Simple mock: remove 'secret' field for non-admin roles
    if (role !== 'admin') {
      const filtered = { ...obj };
      delete (filtered as Record<string, unknown>).secret;
      return filtered;
    }
    return obj;
  }),
  filterArrayByRole: vi.fn((items, role, model) => {
    // Simple mock: filter each item
    if (role !== 'admin') {
      return items.map((item: any) => {
        const filtered = { ...item };
        delete filtered.secret;
        return filtered;
      });
    }
    return items;
  }),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  },
}));

// Import mocked modules
import { getCurrentSession } from '@/lib/session';
import { authorizeRoute } from '@/lib/rbac';
import { filterObjectByRole, filterArrayByRole } from '@/lib/rbac-enforcement';
import { NextResponse } from 'next/server';

// ── checkApiAuth ──────────────────────────────────────────────────

describe('checkApiAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 401 when no session exists', async () => {
    (getCurrentSession as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    const result = await checkApiAuth();
    expect(result.session).toBeNull();
    expect(result.errorResponse).toBeDefined();
    expect(result.errorResponse!.status).toBe(401);
  });

  it('returns session when authenticated and no request provided', async () => {
    const mockSession = { id: '1', email: 'admin@test.com', name: 'Admin', role: 'admin' };
    (getCurrentSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);

    const result = await checkApiAuth();
    expect(result.session).toEqual(mockSession);
    expect(result.errorResponse).toBeUndefined();
    expect(authorizeRoute).not.toHaveBeenCalled();
  });

  it('returns session when RBAC check passes', async () => {
    const mockSession = { id: '1', email: 'admin@test.com', name: 'Admin', role: 'admin' };
    (getCurrentSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
    (authorizeRoute as ReturnType<typeof vi.fn>).mockReturnValue({
      authorized: true,
    });

    const request = new Request('http://localhost:3000/api/companies', { method: 'GET' });
    const result = await checkApiAuth(request);
    expect(result.session).toEqual(mockSession);
    expect(result.errorResponse).toBeUndefined();
  });

  it('returns 403 when RBAC check fails', async () => {
    const mockSession = { id: '2', email: 'user@test.com', name: 'User', role: 'user' };
    (getCurrentSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
    (authorizeRoute as ReturnType<typeof vi.fn>).mockReturnValue({
      authorized: false,
      reason: 'Insufficient permissions for admin-only route',
      requiredPermissions: ['admin'],
    });

    const request = new Request('http://localhost:3000/api/admin/settings', { method: 'GET' });
    const result = await checkApiAuth(request);
    expect(result.session).toBeNull();
    expect(result.errorResponse).toBeDefined();
    expect(result.errorResponse!.status).toBe(403);
  });

  it('returns 401 when getCurrentSession throws', async () => {
    (getCurrentSession as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('DB error'));

    const result = await checkApiAuth();
    expect(result.session).toBeNull();
    expect(result.errorResponse).toBeDefined();
    expect(result.errorResponse!.status).toBe(401);
  });

  it('passes correct pathname and method to authorizeRoute', async () => {
    const mockSession = { id: '1', email: 'admin@test.com', name: 'Admin', role: 'admin' };
    (getCurrentSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
    (authorizeRoute as ReturnType<typeof vi.fn>).mockReturnValue({ authorized: true });

    const request = new Request('http://localhost:3000/api/companies?page=1', { method: 'GET' });
    await checkApiAuth(request);
    expect(authorizeRoute).toHaveBeenCalledWith('/api/companies', 'GET', 'admin');
  });

  it('handles POST requests correctly', async () => {
    const mockSession = { id: '1', email: 'user@test.com', name: 'User', role: 'user' };
    (getCurrentSession as ReturnType<typeof vi.fn>).mockResolvedValue(mockSession);
    (authorizeRoute as ReturnType<typeof vi.fn>).mockReturnValue({ authorized: true });

    const request = new Request('http://localhost:3000/api/companies', { method: 'POST' });
    await checkApiAuth(request);
    expect(authorizeRoute).toHaveBeenCalledWith('/api/companies', 'POST', 'user');
  });
});

// ── requireAdminRole ──────────────────────────────────────────────

describe('requireAdminRole', () => {
  it('returns null for admin role', () => {
    const session = { id: '1', email: 'admin@test.com', name: 'Admin', role: 'admin' } as any;
    const result = requireAdminRole(session);
    expect(result).toBeNull();
  });

  it('returns 403 response for non-admin role', () => {
    const session = { id: '2', email: 'user@test.com', name: 'User', role: 'user' } as any;
    const result = requireAdminRole(session);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it('returns 403 response for viewer role', () => {
    const session = { id: '3', email: 'viewer@test.com', name: 'Viewer', role: 'viewer' } as any;
    const result = requireAdminRole(session);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });
});

// ── filterResponseByRole ───────────────────────────────────────────

describe('filterResponseByRole', () => {
  it('delegates to filterObjectByRole with correct args', () => {
    const data = { id: '1', name: 'Test', secret: 'hidden' };
    const session = { id: '1', email: 'test@test.com', name: 'Test', role: 'user' } as any;

    const result = filterResponseByRole(data, session, 'Company');
    expect(filterObjectByRole).toHaveBeenCalledWith(data, 'user', 'Company');
  });

  it('returns filtered result for non-admin', () => {
    const data = { id: '1', name: 'Test', secret: 'hidden' };
    const session = { id: '1', email: 'user@test.com', name: 'Test', role: 'user' } as any;

    const result = filterResponseByRole(data, session, 'Company');
    expect(result).toEqual({ id: '1', name: 'Test' });
  });

  it('passes through for admin', () => {
    const data = { id: '1', name: 'Test', secret: 'hidden' };
    const session = { id: '1', email: 'admin@test.com', name: 'Admin', role: 'admin' } as any;

    const result = filterResponseByRole(data, session, 'Company');
    expect(result).toEqual({ id: '1', name: 'Test', secret: 'hidden' });
  });
});

// ── filterResponseArrayByRole ──────────────────────────────────────

describe('filterResponseArrayByRole', () => {
  it('delegates to filterArrayByRole with correct args', () => {
    const items = [
      { id: '1', secret: 'a' },
      { id: '2', secret: 'b' },
    ];
    const session = { id: '1', email: 'test@test.com', name: 'Test', role: 'user' } as any;

    const result = filterResponseArrayByRole(items, session, 'Contact');
    expect(filterArrayByRole).toHaveBeenCalledWith(items, 'user', 'Contact');
  });

  it('returns filtered array for non-admin', () => {
    const items = [
      { id: '1', secret: 'a' },
      { id: '2', secret: 'b' },
    ];
    const session = { id: '1', email: 'user@test.com', name: 'Test', role: 'user' } as any;

    const result = filterResponseArrayByRole(items, session, 'Contact');
    expect(result).toEqual([{ id: '1' }, { id: '2' }]);
  });

  it('passes through all items for admin', () => {
    const items = [
      { id: '1', secret: 'a' },
      { id: '2', secret: 'b' },
    ];
    const session = { id: '1', email: 'admin@test.com', name: 'Admin', role: 'admin' } as any;

    const result = filterResponseArrayByRole(items, session, 'Contact');
    expect(result).toEqual([
      { id: '1', secret: 'a' },
      { id: '2', secret: 'b' },
    ]);
  });
});
