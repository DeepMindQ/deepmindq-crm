/**
 * Unit Tests — RBAC Authorization (rbac.ts)
 * Split from auth-authz-certification.test.ts during M3 Stabilization
 *
 * Validates: hasPermission, hasAnyPermission, authorizeRoute,
 * getRolePermissions, getRoleDefinition, getAllRoles, generateAuthorizationReport
 */

import { describe, it, expect } from 'vitest';

describe('RBAC Authorization (rbac.ts)', () => {
  let hasPermission: any, hasAnyPermission: any, authorizeRoute: any, getRolePermissions: any;
  let getRoleDefinition: any, getAllRoles: any, generateAuthorizationReport: any, ROUTE_AUTHORIZATION_MATRIX: any;
  beforeAll(async () => {
    const mod = await import('@/lib/rbac');
    hasPermission = mod.hasPermission;
    hasAnyPermission = mod.hasAnyPermission;
    authorizeRoute = mod.authorizeRoute;
    getRolePermissions = mod.getRolePermissions;
    getRoleDefinition = mod.getRoleDefinition;
    getAllRoles = mod.getAllRoles;
    generateAuthorizationReport = mod.generateAuthorizationReport;
    ROUTE_AUTHORIZATION_MATRIX = mod.ROUTE_AUTHORIZATION_MATRIX;
  });

  describe('hasPermission', () => {
    it('admin has all permissions including dangerous ones', () => {
      expect(hasPermission('admin', 'companies:read')).toBe(true);
      expect(hasPermission('admin', 'companies:write')).toBe(true);
      expect(hasPermission('admin', 'companies:delete')).toBe(true);
      expect(hasPermission('admin', 'users:manage')).toBe(true);
      expect(hasPermission('admin', 'ai:configure')).toBe(true);
      expect(hasPermission('admin', 'settings:write')).toBe(true);
      expect(hasPermission('admin', 'audit:read')).toBe(true);
      expect(hasPermission('admin', 'knowledge:manage')).toBe(true);
    });

    it('operator has write but not delete/manage permissions', () => {
      expect(hasPermission('operator', 'companies:write')).toBe(true);
      expect(hasPermission('operator', 'contacts:write')).toBe(true);
      expect(hasPermission('operator', 'email:send')).toBe(true);
      expect(hasPermission('operator', 'companies:delete')).toBe(false);
      expect(hasPermission('operator', 'users:manage')).toBe(false);
      expect(hasPermission('operator', 'settings:write')).toBe(false);
      expect(hasPermission('operator', 'ai:configure')).toBe(false);
    });

    it('user has read-only permissions', () => {
      expect(hasPermission('user', 'companies:read')).toBe(true);
      expect(hasPermission('user', 'dashboard:read')).toBe(true);
      expect(hasPermission('user', 'ai:read')).toBe(true);
      expect(hasPermission('user', 'companies:write')).toBe(false);
      expect(hasPermission('user', 'users:manage')).toBe(false);
      expect(hasPermission('user', 'analytics:export')).toBe(false);
    });

    it('viewer has only dashboard/analytics/reports read', () => {
      expect(hasPermission('viewer', 'dashboard:read')).toBe(true);
      expect(hasPermission('viewer', 'analytics:read')).toBe(true);
      expect(hasPermission('viewer', 'reports:read')).toBe(true);
      expect(hasPermission('viewer', 'companies:read')).toBe(false);
      expect(hasPermission('viewer', 'ai:read')).toBe(false);
      expect(hasPermission('viewer', 'settings:read')).toBe(false);
    });

    it('returns false for null role (deny-by-default)', () => {
      expect(hasPermission(null as any, 'companies:read')).toBe(false);
    });

    it('returns false for undefined role (deny-by-default)', () => {
      expect(hasPermission(undefined as any, 'companies:read')).toBe(false);
    });

    it('returns false for empty string role', () => {
      expect(hasPermission('', 'companies:read')).toBe(false);
    });

    it('returns false for whitespace-only role', () => {
      expect(hasPermission('   ', 'companies:read')).toBe(false);
    });

    it('returns false for unknown role (deny-by-default)', () => {
      expect(hasPermission('superadmin', 'companies:read')).toBe(false);
      expect(hasPermission('root', 'companies:read')).toBe(false);
      expect(hasPermission('hacker', 'companies:delete')).toBe(false);
    });

    it('no privilege escalation: all non-admin roles are subsets of admin', () => {
      const adminPerms = new Set(getRolePermissions('admin'));
      for (const role of ['operator', 'user', 'viewer'] as const) {
        const perms = getRolePermissions(role);
        for (const p of perms) {
          expect(adminPerms.has(p)).toBe(true);
        }
      }
    });
  });

  describe('hasAnyPermission', () => {
    it('returns true if role has any of the listed permissions', () => {
      expect(hasAnyPermission('user', ['companies:write', 'companies:read'])).toBe(true);
    });

    it('returns false if role has none of the listed permissions', () => {
      expect(hasAnyPermission('viewer', ['companies:write', 'users:manage'])).toBe(false);
    });

    it('returns false for empty permissions list', () => {
      expect(hasAnyPermission('admin', [])).toBe(false);
    });

    it('returns false for null/undefined role', () => {
      expect(hasAnyPermission(null as any, ['companies:read'])).toBe(false);
      expect(hasAnyPermission(undefined as any, ['companies:read'])).toBe(false);
    });
  });

  describe('authorizeRoute', () => {
    it('allows public routes without any role check', () => {
      expect(authorizeRoute('/api/request-otp', 'POST', 'viewer')).toEqual({ authorized: true });
      expect(authorizeRoute('/api/verify-otp', 'POST', 'viewer')).toEqual({ authorized: true });
      expect(authorizeRoute('/api/health', 'GET', '')).toEqual({ authorized: true });
      expect(authorizeRoute('/api/ping', 'GET', 'nobody')).toEqual({ authorized: true });
      expect(authorizeRoute('/api/version', 'GET', '')).toEqual({ authorized: true });
    });

    it('allows admin to access protected routes', () => {
      const result = authorizeRoute('/api/companies', 'POST', 'admin');
      expect(result.authorized).toBe(true);
    });

    it('denies viewer from accessing write routes', () => {
      const result = authorizeRoute('/api/companies', 'POST', 'viewer');
      expect(result.authorized).toBe(false);
      expect(result.reason).toContain('viewer');
      expect(result.reason).toContain('companies:write');
    });

    it('denies user from accessing delete routes', () => {
      const result = authorizeRoute('/api/companies', 'DELETE', 'user');
      expect(result.authorized).toBe(false);
      expect(result.reason).toContain('companies:delete');
    });

    it('allows operator to access write routes but not manage', () => {
      expect(authorizeRoute('/api/companies', 'POST', 'operator').authorized).toBe(true);
      const manageResult = authorizeRoute('/api/admin/users', 'DELETE', 'operator');
      expect(manageResult.authorized).toBe(false);
    });

    it('denies unknown routes by default (deny-by-default)', () => {
      const result = authorizeRoute('/api/nonexistent-route', 'GET', 'admin');
      expect(result.authorized).toBe(false);
      expect(result.reason).toContain('no authorization configuration');
    });

    it('denies completely unknown path prefixes', () => {
      const result = authorizeRoute('/api/secret-backdoor', 'GET', 'admin');
      expect(result.authorized).toBe(false);
    });

    it('allows prefix-matched routes for appropriate roles', () => {
      expect(authorizeRoute('/api/ai/some-endpoint', 'GET', 'admin').authorized).toBe(true);
      expect(authorizeRoute('/api/ai/some-endpoint', 'POST', 'operator').authorized).toBe(true);
      expect(authorizeRoute('/api/ai/some-endpoint', 'GET', 'user').authorized).toBe(true);
      expect(authorizeRoute('/api/ai/some-endpoint', 'GET', 'viewer').authorized).toBe(false);
    });

    it('normalizes paths (removes trailing slashes and query params)', () => {
      const withSlash = authorizeRoute('/api/dashboard/', 'GET', 'user');
      const withoutSlash = authorizeRoute('/api/dashboard', 'GET', 'user');
      expect(withSlash.authorized).toBe(withoutSlash.authorized);

      const withQuery = authorizeRoute('/api/dashboard?foo=bar', 'GET', 'user');
      expect(withQuery.authorized).toBe(true);
    });

    it('supports public webhook and tracking routes', () => {
      expect(authorizeRoute('/api/webhooks/stripe', 'POST', 'nobody').authorized).toBe(true);
      expect(authorizeRoute('/api/tracking/pixel', 'GET', 'nobody').authorized).toBe(true);
      expect(authorizeRoute('/api/cron/process', 'POST', 'nobody').authorized).toBe(true);
      expect(authorizeRoute('/api/auth/login', 'POST', 'nobody').authorized).toBe(true);
    });
  });

  describe('getRolePermissions', () => {
    it('returns full permission set for admin (49+ permissions)', () => {
      const perms = getRolePermissions('admin');
      expect(perms.length).toBeGreaterThanOrEqual(49);
    });

    it('returns correct permission count for each role', () => {
      const adminCount = getRolePermissions('admin').length;
      const operatorCount = getRolePermissions('operator').length;
      const userCount = getRolePermissions('user').length;
      const viewerCount = getRolePermissions('viewer').length;

      expect(adminCount).toBeGreaterThan(operatorCount);
      expect(operatorCount).toBeGreaterThan(userCount);
      expect(userCount).toBeGreaterThan(viewerCount);
    });

    it('returns empty array for null/undefined/empty role', () => {
      expect(getRolePermissions(null as any)).toEqual([]);
      expect(getRolePermissions(undefined as any)).toEqual([]);
      expect(getRolePermissions('')).toEqual([]);
      expect(getRolePermissions('   ')).toEqual([]);
    });

    it('returns empty array for unknown role', () => {
      expect(getRolePermissions('superadmin')).toEqual([]);
      expect(getRolePermissions('nonexistent')).toEqual([]);
    });

    it('admin does not leak permissions to lower roles', () => {
      const adminPerms = new Set(getRolePermissions('admin'));
      const operatorPerms = new Set(getRolePermissions('operator'));
      const userPerms = new Set(getRolePermissions('user'));
      const viewerPerms = new Set(getRolePermissions('viewer'));
      for (const p of operatorPerms) expect(adminPerms.has(p)).toBe(true);
      for (const p of userPerms) expect(operatorPerms.has(p)).toBe(true);
      for (const p of viewerPerms) expect(userPerms.has(p)).toBe(true);
    });
  });

  describe('getRoleDefinition', () => {
    it('returns role definition for valid roles', () => {
      const admin = getRoleDefinition('admin');
      expect(admin).toBeDefined();
      expect(admin!.name).toBe('admin');
      expect(admin!.label).toBe('Administrator');
      expect(admin!.canManageUsers).toBe(true);
      expect(admin!.canConfigureSystem).toBe(true);

      const viewer = getRoleDefinition('viewer');
      expect(viewer!.canManageUsers).toBe(false);
      expect(viewer!.canAccessAllData).toBe(false);
    });

    it('returns undefined for invalid roles', () => {
      expect(getRoleDefinition(null as any)).toBeUndefined();
      expect(getRoleDefinition('')).toBeUndefined();
      expect(getRoleDefinition('superadmin')).toBeUndefined();
    });
  });

  describe('getAllRoles', () => {
    it('returns exactly 4 roles', () => {
      const roles = getAllRoles();
      expect(roles).toHaveLength(4);
      expect(roles.map(r => r.name)).toEqual(
        expect.arrayContaining(['admin', 'operator', 'user', 'viewer'])
      );
    });
  });

  describe('generateAuthorizationReport', () => {
    it('returns a non-empty report with all configured routes', () => {
      const report = generateAuthorizationReport();
      expect(report.length).toBeGreaterThan(0);
      expect(report.length).toBe(ROUTE_AUTHORIZATION_MATRIX.length);

      for (const entry of report) {
        expect(entry).toHaveProperty('path');
        expect(entry).toHaveProperty('methods');
      }
    });
  });

  describe('ROUTE_AUTHORIZATION_MATRIX completeness', () => {
    it('has auth routes marked as public', () => {
      const authRoute = ROUTE_AUTHORIZATION_MATRIX.find(r => r.path === '/api/auth/');
      expect(authRoute).toBeDefined();
      expect(authRoute!.public).toBe(true);
    });

    it('has webhook routes marked as public', () => {
      const webhookRoute = ROUTE_AUTHORIZATION_MATRIX.find(r => r.path === '/api/webhooks/');
      expect(webhookRoute).toBeDefined();
      expect(webhookRoute!.public).toBe(true);
    });

    it('has admin routes requiring settings permissions', () => {
      const adminRoute = ROUTE_AUTHORIZATION_MATRIX.find(r => r.path === '/api/admin/');
      expect(adminRoute).toBeDefined();
      expect(adminRoute!.methods['GET']).toContain('settings:read');
      expect(adminRoute!.methods['DELETE']).toContain('users:manage');
    });

    it('has session management route configured', () => {
      const sessionRoute = ROUTE_AUTHORIZATION_MATRIX.find(r => r.path === '/api/sessions');
      expect(sessionRoute).toBeDefined();
      expect(sessionRoute!.methods['GET']).toContain('settings:read');
    });
  });
});
