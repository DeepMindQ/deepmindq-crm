// ═══════════════════════════════════════════════════════════════════════════
// RBAC Enforcement — Unit Tests
//
// Tests role definitions, permission checks, route authorization,
// field-level permissions, and role hierarchy from rbac.ts + rbac-enforcement.ts.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock logger before importing modules that use it
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    fatal: vi.fn(),
  },
}));

vi.mock('@/lib/audit-logger', () => ({
  audit: vi.fn().mockResolvedValue(undefined),
  AuditCategory: {},
}));

vi.mock('@/lib/db', () => ({
  db: {
    user: {
      count: vi.fn().mockResolvedValue(2),
      findUnique: vi.fn().mockResolvedValue({ role: 'admin' }),
      update: vi.fn().mockResolvedValue({}),
    },
  },
}));

import {
  hasPermission,
  hasAnyPermission,
  authorizeRoute,
  getRolePermissions,
  getRoleDefinition,
  getAllRoles,
  generateAuthorizationReport,
  Permission,
} from '@/lib/rbac';

import {
  checkPermission,
  requirePermission,
  requireAnyPermission,
  hasFieldAccess,
  getRestrictedFields,
  filterObjectByRole,
  filterArrayByRole,
  getUserPermissionSummary,
  generateRoleComplianceMatrix,
  FIELD_PERMISSIONS,
} from '@/lib/rbac-enforcement';

// ── Admin Role Has All Permissions ──────────────────────────────────────

describe('Admin role has all permissions', () => {
  it('has companies:read permission', () => {
    expect(hasPermission('admin', 'companies:read')).toBe(true);
  });

  it('has companies:write permission', () => {
    expect(hasPermission('admin', 'companies:write')).toBe(true);
  });

  it('has companies:delete permission', () => {
    expect(hasPermission('admin', 'companies:delete')).toBe(true);
  });

  it('has users:manage permission', () => {
    expect(hasPermission('admin', 'users:manage')).toBe(true);
  });

  it('has audit:read permission', () => {
    expect(hasPermission('admin', 'audit:read')).toBe(true);
  });

  it('has settings:write permission', () => {
    expect(hasPermission('admin', 'settings:write')).toBe(true);
  });

  it('has ai:configure permission', () => {
    expect(hasPermission('admin', 'ai:configure')).toBe(true);
  });

  it('has analytics:export permission', () => {
    expect(hasPermission('admin', 'analytics:export')).toBe(true);
  });

  it('has every permission in the system', () => {
    const adminPerms = getRolePermissions('admin');
    const allPerms = getAllRoles().reduce<Permission[]>((acc, role) => {
      return [...acc, ...role.permissions];
    }, []);
    // Admin should have a superset of all permissions across all roles
    const uniqueAllPerms = [...new Set(allPerms)];
    for (const perm of uniqueAllPerms) {
      expect(adminPerms).toContain(perm);
    }
  });
});

// ── User Role Has Restricted Permissions ────────────────────────────────

describe('User role has restricted permissions', () => {
  it('has companies:read (read-only data access)', () => {
    expect(hasPermission('user', 'companies:read')).toBe(true);
  });

  it('does NOT have companies:write', () => {
    expect(hasPermission('user', 'companies:write')).toBe(false);
  });

  it('does NOT have companies:delete', () => {
    expect(hasPermission('user', 'companies:delete')).toBe(false);
  });

  it('does NOT have users:manage', () => {
    expect(hasPermission('user', 'users:manage')).toBe(false);
  });

  it('does NOT have audit:read', () => {
    expect(hasPermission('user', 'audit:read')).toBe(false);
  });

  it('does NOT have settings:write', () => {
    expect(hasPermission('user', 'settings:write')).toBe(false);
  });

  it('does NOT have analytics:export', () => {
    expect(hasPermission('user', 'analytics:export')).toBe(false);
  });

  it('has dashboard:read', () => {
    expect(hasPermission('user', 'dashboard:read')).toBe(true);
  });

  it('has ai:read but NOT ai:write', () => {
    expect(hasPermission('user', 'ai:read')).toBe(true);
    expect(hasPermission('user', 'ai:write')).toBe(false);
  });
});

// ── Unknown Role Gets No Permissions ────────────────────────────────────

describe('Unknown role gets no permissions', () => {
  it('returns false for completely unknown role', () => {
    expect(hasPermission('superadmin', 'companies:read')).toBe(false);
  });

  it('returns false for empty string role', () => {
    expect(hasPermission('', 'companies:read')).toBe(false);
  });

  it('returns false for null role', () => {
    expect(hasPermission(null as any, 'companies:read')).toBe(false);
  });

  it('returns false for undefined role', () => {
    expect(hasPermission(undefined as any, 'companies:read')).toBe(false);
  });

  it('returns false for whitespace-only role', () => {
    expect(hasPermission('   ', 'companies:read')).toBe(false);
  });

  it('returns empty permissions array for unknown role', () => {
    expect(getRolePermissions('hacker')).toEqual([]);
  });

  it('returns undefined role definition for unknown role', () => {
    expect(getRoleDefinition('nonexistent')).toBeUndefined();
  });
});

// ── Resource-Level Access Control ───────────────────────────────────────

describe('Resource-level access control', () => {
  it('user can read organizations (companies) via GET', () => {
    const result = authorizeRoute('/api/companies', 'GET', 'user');
    expect(result.authorized).toBe(true);
  });

  it('user cannot write organizations via POST', () => {
    const result = authorizeRoute('/api/companies', 'POST', 'user');
    expect(result.authorized).toBe(false);
    expect(result.reason).toContain('companies:write');
  });

  it('user cannot delete organizations via DELETE', () => {
    const result = authorizeRoute('/api/companies', 'DELETE', 'user');
    expect(result.authorized).toBe(false);
    expect(result.reason).toContain('companies:delete');
  });

  it('admin can write organizations via PUT', () => {
    const result = authorizeRoute('/api/companies', 'PUT', 'admin');
    expect(result.authorized).toBe(true);
  });

  it('user can read signals (ai:read)', () => {
    const result = authorizeRoute('/api/signals', 'GET', 'user');
    expect(result.authorized).toBe(true);
  });

  it('user cannot write feedback (requires ai:write)', () => {
    const result = authorizeRoute('/api/feedback', 'POST', 'user');
    expect(result.authorized).toBe(false);
    expect(result.reason).toContain('ai:write');
  });
});

// ── Permission Check Functions ──────────────────────────────────────────

describe('Permission check functions', () => {
  it('checkPermission returns allowed=true for valid permission', () => {
    const result = checkPermission('u1', 'admin', 'companies:delete');
    expect(result.allowed).toBe(true);
    expect(result.requiredPermission).toBe('companies:delete');
  });

  it('checkPermission returns allowed=false with reason for missing permission', () => {
    const result = checkPermission('u1', 'user', 'companies:delete');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("'user'");
    expect(result.reason).toContain('companies:delete');
  });

  it('requirePermission returns null when allowed', () => {
    const result = requirePermission('u1', 'admin', 'settings:write');
    expect(result).toBeNull();
  });

  it('requirePermission returns 403 Response when denied', () => {
    const result = requirePermission('u1', 'user', 'settings:write');
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it('requireAnyPermission returns null if user has any of the listed permissions', () => {
    const result = requireAnyPermission('u1', 'user', ['companies:write', 'companies:read']);
    expect(result).toBeNull();
  });

  it('requireAnyPermission returns 403 if user has none of the listed permissions', () => {
    const result = requireAnyPermission('u1', 'user', ['companies:write', 'companies:delete', 'users:manage']);
    expect(result).not.toBeNull();
    expect(result!.status).toBe(403);
  });

  it('hasAnyPermission returns true if any permission matches', () => {
    expect(hasAnyPermission('user', ['companies:read', 'companies:write'])).toBe(true);
  });

  it('hasAnyPermission returns false if no permission matches', () => {
    expect(hasAnyPermission('user', ['companies:write', 'companies:delete'])).toBe(false);
  });
});

// ── Role Hierarchy (admin > user) ───────────────────────────────────────

describe('Role hierarchy (admin > user)', () => {
  it('admin has strictly more permissions than user', () => {
    const adminPerms = new Set(getRolePermissions('admin'));
    const userPerms = new Set(getRolePermissions('user'));
    for (const perm of userPerms) {
      expect(adminPerms.has(perm)).toBe(true);
    }
    expect(adminPerms.size).toBeGreaterThan(userPerms.size);
  });

  it('admin can manage users, user cannot', () => {
    expect(hasPermission('admin', 'users:manage')).toBe(true);
    expect(hasPermission('user', 'users:manage')).toBe(false);
  });

  it('admin can view audit logs, user cannot', () => {
    const adminResult = authorizeRoute('/api/audit', 'GET', 'admin');
    expect(adminResult.authorized).toBe(true);
    const userResult = authorizeRoute('/api/audit', 'GET', 'user');
    expect(userResult.authorized).toBe(false);
  });

  it('admin can manage settings, user can only read', () => {
    expect(hasPermission('admin', 'settings:write')).toBe(true);
    expect(hasPermission('user', 'settings:write')).toBe(false);
    expect(hasPermission('user', 'settings:read')).toBe(true);
  });

  it('viewer has fewer permissions than user', () => {
    const viewerPerms = getRolePermissions('viewer');
    const userPerms = getRolePermissions('user');
    expect(viewerPerms.length).toBeLessThan(userPerms.length);
  });
});

// ── Specific Actions ───────────────────────────────────────────────────

describe('Specific action authorization', () => {
  it('read_organization — admin and user can, viewer cannot', () => {
    expect(authorizeRoute('/api/companies', 'GET', 'admin').authorized).toBe(true);
    expect(authorizeRoute('/api/companies', 'GET', 'user').authorized).toBe(true);
    expect(authorizeRoute('/api/companies', 'GET', 'viewer').authorized).toBe(false);
  });

  it('write_organization — only admin (and operator) can', () => {
    expect(authorizeRoute('/api/companies', 'POST', 'admin').authorized).toBe(true);
    expect(authorizeRoute('/api/companies', 'POST', 'operator').authorized).toBe(true);
    expect(authorizeRoute('/api/companies', 'POST', 'user').authorized).toBe(false);
  });

  it('delete_organization — only admin can', () => {
    expect(authorizeRoute('/api/companies', 'DELETE', 'admin').authorized).toBe(true);
    expect(authorizeRoute('/api/companies', 'DELETE', 'operator').authorized).toBe(false);
    expect(authorizeRoute('/api/companies', 'DELETE', 'user').authorized).toBe(false);
  });

  it('read_signals — all roles except viewer can', () => {
    expect(authorizeRoute('/api/signals', 'GET', 'admin').authorized).toBe(true);
    expect(authorizeRoute('/api/signals', 'GET', 'operator').authorized).toBe(true);
    expect(authorizeRoute('/api/signals', 'GET', 'user').authorized).toBe(true);
    expect(authorizeRoute('/api/signals', 'GET', 'viewer').authorized).toBe(false);
  });

  it('manage_users — only admin can via security/roles POST', () => {
    expect(authorizeRoute('/api/security/roles', 'POST', 'admin').authorized).toBe(true);
    expect(authorizeRoute('/api/security/roles', 'POST', 'operator').authorized).toBe(false);
    expect(authorizeRoute('/api/security/roles', 'POST', 'user').authorized).toBe(false);
  });

  it('view_audit — only admin', () => {
    expect(authorizeRoute('/api/audit-logs', 'GET', 'admin').authorized).toBe(true);
    expect(authorizeRoute('/api/audit-logs', 'GET', 'operator').authorized).toBe(false);
    expect(authorizeRoute('/api/audit-logs', 'GET', 'user').authorized).toBe(false);
  });

  it('manage_settings — only admin', () => {
    expect(authorizeRoute('/api/settings', 'PUT', 'admin').authorized).toBe(true);
    expect(authorizeRoute('/api/settings', 'PUT', 'operator').authorized).toBe(false);
    expect(authorizeRoute('/api/settings', 'PUT', 'user').authorized).toBe(false);
  });
});

// ── Route Authorization — Public Routes ─────────────────────────────────

describe('Route authorization — public routes', () => {
  it('health check is public and always authorized', () => {
    const result = authorizeRoute('/api/health', 'GET', 'unknown-role');
    expect(result.authorized).toBe(true);
  });

  it('request-otp is public', () => {
    const result = authorizeRoute('/api/request-otp', 'POST', '');
    expect(result.authorized).toBe(true);
  });

  it('webhooks are public (HMAC-verified separately)', () => {
    const result = authorizeRoute('/api/webhooks/crm/hubspot', 'POST', '');
    expect(result.authorized).toBe(true);
  });

  it('unmatched route is denied by default', () => {
    const result = authorizeRoute('/api/nonexistent', 'GET', 'admin');
    expect(result.authorized).toBe(false);
    expect(result.reason).toContain('no authorization configuration');
  });
});

// ── Field-Level Permissions ─────────────────────────────────────────────

describe('Field-level permissions', () => {
  it('admin can access revenueEstimate on Company', () => {
    expect(hasFieldAccess('admin', 'Company', 'revenueEstimate')).toBe(true);
  });

  it('user cannot access revenueEstimate on Company', () => {
    expect(hasFieldAccess('user', 'Company', 'revenueEstimate')).toBe(false);
  });

  it('operator can access phone on Contact', () => {
    expect(hasFieldAccess('operator', 'Contact', 'phone')).toBe(true);
  });

  it('user cannot access phone on Contact', () => {
    expect(hasFieldAccess('user', 'Contact', 'phone')).toBe(false);
  });

  it('nobody can read passwordHash on User', () => {
    expect(hasFieldAccess('admin', 'User', 'passwordHash')).toBe(false);
    expect(hasFieldAccess('user', 'User', 'passwordHash')).toBe(false);
  });

  it('unrestricted fields are accessible to all roles', () => {
    expect(hasFieldAccess('viewer', 'Company', 'name')).toBe(true);
    expect(hasFieldAccess('user', 'Company', 'name')).toBe(true);
  });

  it('getRestrictedFields returns correct fields for user on Company', () => {
    const restricted = getRestrictedFields('user', 'Company');
    expect(restricted).toContain('revenueEstimate');
    expect(restricted).toContain('internalSummary');
    expect(restricted).toContain('aiAnalysis');
  });

  it('getRestrictedFields returns empty for admin on Company', () => {
    const restricted = getRestrictedFields('admin', 'Company');
    // Admin can access all Company fields (revenueEstimate is admin-only, not restricted)
    expect(restricted).toEqual([]);
  });

  it('filterObjectByRole removes restricted fields for user', () => {
    const obj = { name: 'Acme', revenueEstimate: 5000000, internalSummary: 'secret' };
    const filtered = filterObjectByRole(obj, 'user', 'Company');
    expect(filtered.name).toBe('Acme');
    expect(filtered).not.toHaveProperty('revenueEstimate');
    expect(filtered).not.toHaveProperty('internalSummary');
  });

  it('filterArrayByRole filters all items in array', () => {
    const items = [
      { name: 'A', phone: '111' },
      { name: 'B', phone: '222' },
    ];
    const filtered = filterArrayByRole(items, 'user', 'Contact');
    expect(filtered).toHaveLength(2);
    expect(filtered[0]).not.toHaveProperty('phone');
    expect(filtered[1]).not.toHaveProperty('phone');
  });
});

// ── Compliance Matrix & Permission Summary ─────────────────────────────

describe('Compliance matrix and permission summary', () => {
  it('generateRoleComplianceMatrix returns entries for all roles', () => {
    const matrix = generateRoleComplianceMatrix();
    const roleNames = matrix.map(m => m.role);
    expect(roleNames).toContain('admin');
    expect(roleNames).toContain('operator');
    expect(roleNames).toContain('user');
    expect(roleNames).toContain('viewer');
  });

  it('admin has canManageUsers=true in compliance matrix', () => {
    const matrix = generateRoleComplianceMatrix();
    const admin = matrix.find(m => m.role === 'admin');
    expect(admin?.canManageUsers).toBe(true);
    expect(admin?.canConfigureSystem).toBe(true);
    expect(admin?.canManageAI).toBe(true);
  });

  it('user has canManageUsers=false in compliance matrix', () => {
    const matrix = generateRoleComplianceMatrix();
    const user = matrix.find(m => m.role === 'user');
    expect(user?.canManageUsers).toBe(false);
    expect(user?.canExportData).toBe(false);
  });

  it('getUserPermissionSummary includes all roles and field restrictions', () => {
    const summary = getUserPermissionSummary('admin');
    expect(summary.role).toBe('admin');
    expect(summary.roleDefinition).toBeDefined();
    expect(summary.permissions.length).toBeGreaterThan(0);
    expect(summary.allRoles.length).toBe(4);
    expect(summary.fieldRestrictions.length).toBeGreaterThan(0);
  });

  it('generateAuthorizationReport returns route configs', () => {
    const report = generateAuthorizationReport();
    expect(report.length).toBeGreaterThan(0);
    const health = report.find(r => r.path === '/api/health');
    expect(health).toBeDefined();
  });
});
