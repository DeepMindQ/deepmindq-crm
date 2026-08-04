import { describe, it, expect } from 'vitest'
import { hasPermission, authorizeRoute, getRolePermissions, getAllRoles, ROUTE_AUTHORIZATION_MATRIX } from '@/lib/rbac'
import type { Permission, UserRole } from '@/lib/rbac'

describe('Business Rules — RBAC Permission Counts', () => {
  it('admin has 49 permissions', () => expect(getRolePermissions('admin').length).toBe(49));
  it('operator has 37 permissions', () => expect(getRolePermissions('operator').length).toBe(37));
  it('user has 19 permissions', () => expect(getRolePermissions('user').length).toBe(19));
  it('viewer has 3 permissions', () => expect(getRolePermissions('viewer').length).toBe(3));
});

describe('Business Rules — Permission Hierarchy (Subset Rule)', () => {
  it('viewer perms subset of user perms', () => {
    const vp = new Set(getRolePermissions('viewer'));
    const up = new Set(getRolePermissions('user'));
    for (const p of vp) expect(up.has(p as Permission)).toBe(true);
  });
  it('user perms subset of operator perms', () => {
    const up = new Set(getRolePermissions('user'));
    const op = new Set(getRolePermissions('operator'));
    for (const p of up) expect(op.has(p as Permission)).toBe(true);
  });
  it('operator perms subset of admin perms', () => {
    const op = new Set(getRolePermissions('operator'));
    const ap = new Set(getRolePermissions('admin'));
    for (const p of op) expect(ap.has(p as Permission)).toBe(true);
  });
});

describe('Business Rules — Deny by Default', () => {
  it('denies unknown role', () => expect(hasPermission('hacker', 'companies:read')).toBe(false));
  it('denies empty role', () => expect(hasPermission('', 'companies:read')).toBe(false));
  it('denies null role', () => expect(hasPermission(null as any, 'companies:read')).toBe(false));
  it('denies undefined role', () => expect(hasPermission(undefined as any, 'companies:read')).toBe(false));
});

describe('Business Rules — Route Matrix', () => {
  it('has 50+ routes configured', () => expect(ROUTE_AUTHORIZATION_MATRIX.length).toBeGreaterThanOrEqual(50));
  it('denies unmatched routes', () => expect(authorizeRoute('/api/unknown', 'GET', 'admin').authorized).toBe(false));
  it('allows public routes', () => expect(authorizeRoute('/api/health', 'GET', 'viewer').authorized).toBe(true));
});