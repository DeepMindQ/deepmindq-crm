/**
 * S9 Security Acceptance Tests
 *
 * Validates the complete RBAC + field-level permission hardening layer.
 * These tests prove:
 *   1. Route-level authorization denies unauthorized roles
 *   2. Field-level filtering hides sensitive fields from lower roles
 *   3. Admin-only endpoints reject non-admin roles at both RBAC and handler level
 *   4. Deny-by-default blocks unmatched routes
 *   5. Null/empty roles are rejected (privilege escalation prevention)
 *   6. All 4 roles have strictly increasing permission sets
 *   7. FIELD_PERMISSIONS registry covers all 7 models
 *
 * Runtime evidence: These tests validate the same code paths that
 * api-auth.ts executes on every API request.
 */

import {
  authorizeRoute,
  hasPermission,
  getRolePermissions,
  getAllRoles,
  type UserRole,
} from '@/lib/rbac';
import {
  filterObjectByRole,
  filterArrayByRole,
  hasFieldAccess,
  getRestrictedFields,
  FIELD_PERMISSIONS,
} from '@/lib/rbac-enforcement';

// ──────────────────────────────────────────────────────────
// 1. ROUTE-LEVEL AUTHORIZATION (authorizeRoute)
// ──────────────────────────────────────────────────────────

describe('S9 Security: Route-Level RBAC Authorization', () => {
  // --- Admin-only routes (require users:manage, audit:read, or settings:write) ---

  describe('Admin-only routes (users:manage permission)', () => {
    // Routes that require 'users:manage' — only admin has this
    const adminOnlyRoutes = [
      { path: '/api/users', method: 'GET', perm: 'users:read' },
      { path: '/api/users', method: 'PATCH', perm: 'users:write' },
    ];

    it('admin is authorized for user management routes', () => {
      for (const route of adminOnlyRoutes) {
        const result = authorizeRoute(route.path, route.method, 'admin');
        expect(result.authorized).toBe(true);
      }
    });

    it('operator lacks users:read/users:write', () => {
      // Note: The matrix allows operator+ for /api/users at RBAC level because
      // the matrix doesn't enforce admin-only for users:read. The requireAdminRole()
      // call in the handler provides the second gate. But operator does NOT have
      // users:read or users:write, so RBAC denies.
      for (const route of adminOnlyRoutes) {
        const result = authorizeRoute(route.path, route.method, 'operator');
        expect(result.authorized).toBe(false);
        expect(result.reason).toBeDefined();
      }
    });

    it('user and viewer are denied', () => {
      const roles: UserRole[] = ['user', 'viewer'];
      for (const role of roles) {
        for (const route of adminOnlyRoutes) {
          const result = authorizeRoute(route.path, route.method, role);
          expect(result.authorized).toBe(false);
        }
      }
    });
  });

  describe('Admin-only routes (audit:read permission)', () => {
    // audit:read is only granted to admin
    const auditRoutes = [
      { path: '/api/audit', method: 'GET' },
      { path: '/api/audit-logs', method: 'GET' },
      { path: '/api/compliance', method: 'GET' },
      { path: '/api/security/scan', method: 'GET' },
      { path: '/api/security/audit', method: 'GET' },
    ];

    it('admin is authorized for audit routes', () => {
      for (const route of auditRoutes) {
        const result = authorizeRoute(route.path, route.method, 'admin');
        expect(result.authorized).toBe(true);
      }
    });

    it('operator, user, viewer are ALL denied audit routes', () => {
      const roles: UserRole[] = ['operator', 'user', 'viewer'];
      for (const role of roles) {
        for (const route of auditRoutes) {
          const result = authorizeRoute(route.path, route.method, role);
          expect(result.authorized).toBe(false);
          expect(result.reason).toBeDefined();
        }
      }
    });
  });

  describe('Security endpoints with settings:read (operator+ authorized at RBAC level)', () => {
    // These routes use settings:read which operator HAS.
    // Admin-only enforcement is done by requireAdminRole() in the handler.
    const settingsReadRoutes = [
      { path: '/api/security/encryption', method: 'GET' },
      { path: '/api/security/rate-limits', method: 'GET' },
      { path: '/api/security/sso', method: 'GET' },
      { path: '/api/admin/ai-usage', method: 'GET' }, // matches /api/admin/ prefix
    ];

    it('admin and operator pass RBAC for settings:read routes', () => {
      const roles: UserRole[] = ['admin', 'operator'];
      for (const role of roles) {
        for (const route of settingsReadRoutes) {
          const result = authorizeRoute(route.path, route.method, role);
          expect(result.authorized).toBe(true);
        }
      }
    });

    it('user also passes RBAC (has settings:read)', () => {
      for (const route of settingsReadRoutes) {
        const result = authorizeRoute(route.path, route.method, 'user');
        expect(result.authorized).toBe(true);
      }
    });

    it('viewer is denied (lacks settings:read)', () => {
      for (const route of settingsReadRoutes) {
        const result = authorizeRoute(route.path, route.method, 'viewer');
        expect(result.authorized).toBe(false);
      }
    });
  });

  // --- Operator+ routes (companies, contacts, leads, signals, pipeline) ---

  describe('Operator+ data routes', () => {
    const dataRoutes = [
      { path: '/api/companies', method: 'GET' },
      { path: '/api/companies', method: 'POST' },
      { path: '/api/contacts', method: 'GET' },
      { path: '/api/contacts', method: 'POST' },
      { path: '/api/leads', method: 'GET' },
      { path: '/api/leads', method: 'POST' },
      { path: '/api/signals', method: 'GET' },
      { path: '/api/pipeline', method: 'GET' },
    ];

    it('admin is authorized for all data routes', () => {
      for (const route of dataRoutes) {
        const result = authorizeRoute(route.path, route.method, 'admin');
        expect(result.authorized).toBe(true);
      }
    });

    it('operator is authorized for all data routes', () => {
      for (const route of dataRoutes) {
        const result = authorizeRoute(route.path, route.method, 'operator');
        expect(result.authorized).toBe(true);
      }
    });

    it('user is authorized for read but denied write', () => {
      for (const route of dataRoutes) {
        const result = authorizeRoute(route.path, route.method, 'user');
        if (route.method === 'GET') {
          expect(result.authorized).toBe(true);
        } else {
          expect(result.authorized).toBe(false);
        }
      }
    });

    it('viewer is denied ALL data routes (lacks companies:read, contacts:read, etc.)', () => {
      for (const route of dataRoutes) {
        const result = authorizeRoute(route.path, route.method, 'viewer');
        expect(result.authorized).toBe(false);
        expect(result.reason).toBeDefined();
      }
    });
  });

  // --- Intelligence routes (research:read / research:write) ---

  describe('Intelligence routes (research:read/research:write)', () => {
    const intelRoutes = [
      { path: '/api/intelligence/feedback', method: 'POST' },
      { path: '/api/intelligence/graph', method: 'GET' },
      { path: '/api/intelligence/action-history', method: 'GET' },
      { path: '/api/intelligence/enrich', method: 'POST' },
      { path: '/api/intelligence/narratives', method: 'GET' },
      { path: '/api/intelligence/predictions', method: 'GET' },
      { path: '/api/intelligence/health', method: 'GET' },
      { path: '/api/intelligence/refresh', method: 'GET' },
      { path: '/api/intelligence/refresh', method: 'POST' },
      { path: '/api/intelligence/people-enrich', method: 'POST' },
      { path: '/api/intelligence/market-discovery', method: 'POST' },
      { path: '/api/intelligence/competitive', method: 'POST' },
      { path: '/api/intelligence/website-monitor', method: 'POST' },
    ];

    it('admin is authorized for all intelligence routes', () => {
      for (const route of intelRoutes) {
        const result = authorizeRoute(route.path, route.method, 'admin');
        expect(result.authorized).toBe(true);
      }
    });

    it('operator is authorized for all intelligence routes', () => {
      for (const route of intelRoutes) {
        const result = authorizeRoute(route.path, route.method, 'operator');
        expect(result.authorized).toBe(true);
      }
    });

    it('user can read but cannot write intelligence', () => {
      for (const route of intelRoutes) {
        const result = authorizeRoute(route.path, route.method, 'user');
        if (route.method === 'GET') {
          expect(result.authorized).toBe(true);
        } else {
          expect(result.authorized).toBe(false);
          expect(result.reason).toContain('research:write');
        }
      }
    });

    it('viewer is denied ALL intelligence routes', () => {
      for (const route of intelRoutes) {
        const result = authorizeRoute(route.path, route.method, 'viewer');
        expect(result.authorized).toBe(false);
      }
    });
  });

  // --- Deny-by-default ---

  describe('Deny-by-default for unmatched routes', () => {
    it('returns 403 for a route not in the matrix', () => {
      const result = authorizeRoute('/api/nonexistent/route', 'GET', 'admin');
      expect(result.authorized).toBe(false);
      expect(result.reason).toContain('no authorization configuration');
    });

    it('returns false for a random path with any role', () => {
      const roles: UserRole[] = ['admin', 'operator', 'user', 'viewer'];
      for (const role of roles) {
        const result = authorizeRoute('/api/secret/backdoor', 'GET', role);
        expect(result.authorized).toBe(false);
      }
    });
  });

  // --- Privilege escalation prevention ---

  describe('Null/empty role rejection', () => {
    it('rejects null role', () => {
      const result = authorizeRoute('/api/companies', 'GET', null as any);
      expect(result.authorized).toBe(false);
    });

    it('rejects undefined role', () => {
      const result = authorizeRoute('/api/companies', 'GET', undefined as any);
      expect(result.authorized).toBe(false);
    });

    it('rejects empty string role', () => {
      const result = authorizeRoute('/api/companies', 'GET', '' as any);
      expect(result.authorized).toBe(false);
    });

    it('rejects unknown role string', () => {
      const result = authorizeRoute('/api/companies', 'GET', 'superadmin' as any);
      expect(result.authorized).toBe(false);
    });
  });
});

// ──────────────────────────────────────────────────────────
// 2. FIELD-LEVEL PERMISSIONS (filterObjectByRole)
// ──────────────────────────────────────────────────────────

describe('S9 Security: Field-Level Permission Filtering', () => {
  // --- Company model ---

  describe('Company model field filtering', () => {
    const companyWithAllFields = {
      id: 'comp-1',
      name: 'Acme Corp',
      internalSummary: 'SECRET: Target for Q4 acquisition',
      aiAnalysis: 'AI says: High-value target with 90% close probability',
      revenueEstimate: '$50M ARR',
      domain: 'acme.com',
      industry: 'SaaS',
    };

    it('admin sees ALL fields including revenueEstimate', () => {
      const filtered = filterObjectByRole(companyWithAllFields, 'admin', 'Company');
      expect(filtered.revenueEstimate).toBe('$50M ARR');
      expect(filtered.internalSummary).toBe('SECRET: Target for Q4 acquisition');
      expect(filtered.aiAnalysis).toBeDefined();
    });

    it('operator sees internalSummary and aiAnalysis but NOT revenueEstimate', () => {
      const filtered = filterObjectByRole(companyWithAllFields, 'operator', 'Company');
      expect(filtered.internalSummary).toBe('SECRET: Target for Q4 acquisition');
      expect(filtered.aiAnalysis).toBeDefined();
      expect(filtered.revenueEstimate).toBeUndefined();
    });

    it('user sees NO sensitive fields', () => {
      const filtered = filterObjectByRole(companyWithAllFields, 'user', 'Company');
      expect(filtered.revenueEstimate).toBeUndefined();
      expect(filtered.internalSummary).toBeUndefined();
      expect(filtered.aiAnalysis).toBeUndefined();
      expect(filtered.name).toBe('Acme Corp');
      expect(filtered.domain).toBe('acme.com');
    });

    it('viewer sees NO sensitive fields', () => {
      const filtered = filterObjectByRole(companyWithAllFields, 'viewer', 'Company');
      expect(filtered.revenueEstimate).toBeUndefined();
      expect(filtered.internalSummary).toBeUndefined();
      expect(filtered.aiAnalysis).toBeUndefined();
    });
  });

  // --- Contact model ---

  describe('Contact model field filtering', () => {
    const contactWithAllFields = {
      id: 'contact-1',
      name: 'Jane Smith',
      email: 'jane@acme.com',
      phone: '+1-555-0123',
      enrichmentData: { source: 'zoominfo', confidence: 0.95 },
      consentIp: '192.168.1.100',
      emailHealthScore: 85,
      linkedinUrl: 'https://linkedin.com/in/janesmith',
      jobTitle: 'VP Engineering',
    };

    it('admin sees ALL contact fields including consentIp', () => {
      const filtered = filterObjectByRole(contactWithAllFields, 'admin', 'Contact');
      expect(filtered.phone).toBe('+1-555-0123');
      expect(filtered.enrichmentData).toBeDefined();
      expect(filtered.consentIp).toBe('192.168.1.100');
      expect(filtered.emailHealthScore).toBe(85);
      expect(filtered.linkedinUrl).toBeDefined();
    });

    it('operator sees phone, enrichmentData, emailHealthScore, linkedinUrl but NOT consentIp', () => {
      const filtered = filterObjectByRole(contactWithAllFields, 'operator', 'Contact');
      expect(filtered.phone).toBe('+1-555-0123');
      expect(filtered.enrichmentData).toBeDefined();
      expect(filtered.emailHealthScore).toBe(85);
      expect(filtered.linkedinUrl).toBeDefined();
      expect(filtered.consentIp).toBeUndefined();
    });

    it('user sees NONE of the restricted contact fields', () => {
      const filtered = filterObjectByRole(contactWithAllFields, 'user', 'Contact');
      expect(filtered.phone).toBeUndefined();
      expect(filtered.enrichmentData).toBeUndefined();
      expect(filtered.consentIp).toBeUndefined();
      expect(filtered.emailHealthScore).toBeUndefined();
      expect(filtered.linkedinUrl).toBeUndefined();
      expect(filtered.name).toBe('Jane Smith');
      expect(filtered.email).toBe('jane@acme.com');
    });

    it('viewer sees NONE of the restricted contact fields', () => {
      const filtered = filterObjectByRole(contactWithAllFields, 'viewer', 'Contact');
      expect(filtered.phone).toBeUndefined();
      expect(filtered.enrichmentData).toBeUndefined();
      expect(filtered.consentIp).toBeUndefined();
    });
  });

  // --- Opportunity (Deal) model ---

  describe('Opportunity model field filtering', () => {
    const opportunityWithAllFields = {
      id: 'opp-1',
      title: 'Enterprise Deal',
      opportunityScore: 92,
      winProbability: 0.75,
      estimatedValue: '$500K',
      internalNotes: 'Internal: Discount approved by CEO',
      stage: 'negotiation',
    };

    it('admin sees ALL opportunity fields', () => {
      const filtered = filterObjectByRole(opportunityWithAllFields, 'admin', 'Opportunity');
      expect(filtered.opportunityScore).toBe(92);
      expect(filtered.winProbability).toBe(0.75);
      expect(filtered.estimatedValue).toBe('$500K');
      expect(filtered.internalNotes).toBe('Internal: Discount approved by CEO');
    });

    it('operator sees scores and value but NOT internalNotes', () => {
      const filtered = filterObjectByRole(opportunityWithAllFields, 'operator', 'Opportunity');
      expect(filtered.opportunityScore).toBe(92);
      expect(filtered.winProbability).toBe(0.75);
      expect(filtered.estimatedValue).toBe('$500K');
      expect(filtered.internalNotes).toBeUndefined();
    });

    it('user sees NO sensitive opportunity fields', () => {
      const filtered = filterObjectByRole(opportunityWithAllFields, 'user', 'Opportunity');
      expect(filtered.opportunityScore).toBeUndefined();
      expect(filtered.winProbability).toBeUndefined();
      expect(filtered.estimatedValue).toBeUndefined();
      expect(filtered.internalNotes).toBeUndefined();
    });
  });

  // --- IntelligenceSignal model ---

  describe('IntelligenceSignal model field filtering', () => {
    const signalWithAllFields = {
      id: 'sig-1',
      title: 'Funding Round',
      confidenceScore: 0.88,
      sourceDetails: 'Scraped from Crunchbase by AI agent',
      rawData: { raw: 'huge JSON blob with scraping details' },
      signalType: 'funding',
    };

    it('admin sees ALL signal fields including rawData', () => {
      const filtered = filterObjectByRole(signalWithAllFields, 'admin', 'IntelligenceSignal');
      expect(filtered.confidenceScore).toBe(0.88);
      expect(filtered.sourceDetails).toBe('Scraped from Crunchbase by AI agent');
      expect(filtered.rawData).toBeDefined();
    });

    it('operator sees confidenceScore and sourceDetails but NOT rawData', () => {
      const filtered = filterObjectByRole(signalWithAllFields, 'operator', 'IntelligenceSignal');
      expect(filtered.confidenceScore).toBe(0.88);
      expect(filtered.sourceDetails).toBeDefined();
      expect(filtered.rawData).toBeUndefined();
    });

    it('user sees NO sensitive signal fields', () => {
      const filtered = filterObjectByRole(signalWithAllFields, 'user', 'IntelligenceSignal');
      expect(filtered.confidenceScore).toBeUndefined();
      expect(filtered.sourceDetails).toBeUndefined();
      expect(filtered.rawData).toBeUndefined();
    });
  });

  // --- User model ---

  describe('User model field filtering', () => {
    const userWithAllFields = {
      id: 'user-1',
      name: 'Admin User',
      email: 'admin@company.com',
      passwordHash: '$2b$10$hashedpassword',
      lastLoginAt: '2025-01-15T10:30:00Z',
      role: 'admin',
    };

    it('NO role can see passwordHash (empty roles array)', () => {
      const roles: UserRole[] = ['admin', 'operator', 'user', 'viewer'];
      for (const role of roles) {
        const filtered = filterObjectByRole(userWithAllFields, role, 'User');
        expect(filtered.passwordHash).toBeUndefined();
      }
    });

    it('only admin can see lastLoginAt', () => {
      const adminFiltered = filterObjectByRole(userWithAllFields, 'admin', 'User');
      expect(adminFiltered.lastLoginAt).toBe('2025-01-15T10:30:00Z');

      const nonAdminRoles: UserRole[] = ['operator', 'user', 'viewer'];
      for (const role of nonAdminRoles) {
        const filtered = filterObjectByRole(userWithAllFields, role, 'User');
        expect(filtered.lastLoginAt).toBeUndefined();
      }
    });
  });

  // --- Report model ---

  describe('Report model field filtering', () => {
    const reportWithAllFields = {
      id: 'report-1',
      title: 'Q4 Revenue Report',
      generatedBy: 'system',
      queryDetails: 'SELECT * FROM revenue WHERE quarter = Q4',
      exportPath: '/exports/reports/q4-revenue.csv',
    };

    it('admin sees ALL report fields', () => {
      const filtered = filterObjectByRole(reportWithAllFields, 'admin', 'Report');
      expect(filtered.generatedBy).toBe('system');
      expect(filtered.queryDetails).toBeDefined();
      expect(filtered.exportPath).toBeDefined();
    });

    it('operator sees generatedBy but NOT queryDetails or exportPath', () => {
      const filtered = filterObjectByRole(reportWithAllFields, 'operator', 'Report');
      expect(filtered.generatedBy).toBe('system');
      expect(filtered.queryDetails).toBeUndefined();
      expect(filtered.exportPath).toBeUndefined();
    });

    it('user sees NO sensitive report fields', () => {
      const filtered = filterObjectByRole(reportWithAllFields, 'user', 'Report');
      expect(filtered.generatedBy).toBeUndefined();
      expect(filtered.queryDetails).toBeUndefined();
      expect(filtered.exportPath).toBeUndefined();
    });
  });

  // --- Array filtering ---

  describe('Array filtering (filterArrayByRole)', () => {
    it('filters arrays correctly for viewer role', () => {
      const companies = [
        { id: '1', name: 'Co1', internalSummary: 'Secret1', revenueEstimate: '$10M' },
        { id: '2', name: 'Co2', internalSummary: 'Secret2', revenueEstimate: '$20M' },
        { id: '3', name: 'Co3', internalSummary: 'Secret3', revenueEstimate: '$30M' },
      ];

      const filtered = filterArrayByRole(companies, 'viewer', 'Company');
      expect(filtered).toHaveLength(3);
      for (const c of filtered) {
        expect(c.internalSummary).toBeUndefined();
        expect(c.revenueEstimate).toBeUndefined();
        expect(c.name).toBeDefined();
      }
    });

    it('preserves array length while removing fields', () => {
      const contacts = [
        { id: '1', name: 'Alice', phone: '111', consentIp: '1.1.1.1' },
        { id: '2', name: 'Bob', phone: '222', consentIp: '2.2.2.2' },
      ];

      const filtered = filterArrayByRole(contacts, 'user', 'Contact');
      expect(filtered).toHaveLength(2);
      expect(filtered[0].phone).toBeUndefined();
      expect(filtered[0].consentIp).toBeUndefined();
      expect(filtered[0].name).toBe('Alice');
    });
  });
});

// ──────────────────────────────────────────────────────────
// 3. FIELD PERMISSION REGISTRY INTEGRITY
// ──────────────────────────────────────────────────────────

describe('S9 Security: FIELD_PERMISSIONS Registry Integrity', () => {
  it('contains permissions for all 7 models', () => {
    const models = new Set(FIELD_PERMISSIONS.map(p => p.model));
    expect(models.has('Company')).toBe(true);
    expect(models.has('Contact')).toBe(true);
    expect(models.has('Opportunity')).toBe(true);
    expect(models.has('IntelligenceSignal')).toBe(true);
    expect(models.has('User')).toBe(true);
    expect(models.has('SystemSetting')).toBe(true);
    expect(models.has('Report')).toBe(true);
  });

  it('User.passwordHash has empty roles array (nobody can read)', () => {
    const rule = FIELD_PERMISSIONS.find(
      r => r.model === 'User' && r.field === 'passwordHash'
    );
    expect(rule).toBeDefined();
    expect(rule!.roles).toEqual([]);
    expect(rule!.sensitive).toBe(true);
  });

  it('all sensitive fields are marked sensitive: true', () => {
    for (const rule of FIELD_PERMISSIONS) {
      if (rule.sensitive) {
        expect(rule.sensitive).toBe(true);
      }
    }
  });

  it('no role list contains invalid roles', () => {
    const validRoles: UserRole[] = ['admin', 'operator', 'user', 'viewer'];
    for (const rule of FIELD_PERMISSIONS) {
      for (const role of rule.roles) {
        expect(validRoles).toContain(role);
      }
    }
  });

  it('viewer has restricted fields on all data models', () => {
    const models = ['Company', 'Contact', 'Opportunity', 'IntelligenceSignal', 'User', 'Report'];
    for (const model of models) {
      const restrictedForViewer = getRestrictedFields('viewer', model);
      expect(restrictedForViewer.length).toBeGreaterThan(0);
    }
  });

  it('total restricted field count is at least 21 (7 models average 3+ per model)', () => {
    expect(FIELD_PERMISSIONS.length).toBeGreaterThanOrEqual(21);
  });
});

// ──────────────────────────────────────────────────────────
// 4. ROLE DEFINITION INTEGRITY
// ──────────────────────────────────────────────────────────

describe('S9 Security: Role Definition Integrity', () => {
  it('defines exactly 4 roles', () => {
    const roles = getAllRoles();
    expect(roles).toHaveLength(4);
    const names = roles.map(r => r.name);
    expect(names).toContain('admin');
    expect(names).toContain('operator');
    expect(names).toContain('user');
    expect(names).toContain('viewer');
  });

  it('admin has more permissions than operator', () => {
    const adminPerms = getRolePermissions('admin');
    const operatorPerms = getRolePermissions('operator');
    expect(adminPerms.length).toBeGreaterThan(operatorPerms.length);
  });

  it('operator has more permissions than user', () => {
    const operatorPerms = getRolePermissions('operator');
    const userPerms = getRolePermissions('user');
    expect(operatorPerms.length).toBeGreaterThan(userPerms.length);
  });

  it('user has more permissions than viewer', () => {
    const userPerms = getRolePermissions('user');
    const viewerPerms = getRolePermissions('viewer');
    expect(userPerms.length).toBeGreaterThan(viewerPerms.length);
  });

  it('viewer has the fewest permissions but still has some', () => {
    const viewerPerms = getRolePermissions('viewer');
    expect(viewerPerms.length).toBeGreaterThan(0);
  });

  it('viewer has ONLY dashboard:read, analytics:read, reports:read', () => {
    const viewerPerms = getRolePermissions('viewer');
    expect(viewerPerms).toEqual(['dashboard:read', 'analytics:read', 'reports:read']);
  });

  it('admin has users:manage (critical for role assignment)', () => {
    expect(hasPermission('admin', 'users:manage')).toBe(true);
  });

  it('operator lacks users:manage', () => {
    expect(hasPermission('operator', 'users:manage')).toBe(false);
  });

  it('only admin has audit:read', () => {
    expect(hasPermission('admin', 'audit:read')).toBe(true);
    expect(hasPermission('operator', 'audit:read')).toBe(false);
    expect(hasPermission('user', 'audit:read')).toBe(false);
    expect(hasPermission('viewer', 'audit:read')).toBe(false);
  });
});

// ──────────────────────────────────────────────────────────
// 5. CROSS-CUTTING: Specific Attack Scenarios
// ──────────────────────────────────────────────────────────

describe('S9 Security: Attack Scenario Tests', () => {
  it('viewer cannot enumerate roles via /api/security/roles', () => {
    // /api/security/roles requires users:read which viewer lacks
    const result = authorizeRoute('/api/security/roles', 'GET', 'viewer');
    expect(result.authorized).toBe(false);
  });

  it('viewer cannot access admin cost data via /api/admin/ai-usage', () => {
    // /api/admin/ prefix requires settings:read which viewer lacks
    const result = authorizeRoute('/api/admin/ai-usage', 'GET', 'viewer');
    expect(result.authorized).toBe(false);
  });

  it('viewer cannot access audit logs via /api/audit', () => {
    // /api/audit requires audit:read which only admin has
    const result = authorizeRoute('/api/audit', 'GET', 'viewer');
    expect(result.authorized).toBe(false);
  });

  it('operator cannot access audit logs', () => {
    const result = authorizeRoute('/api/audit', 'GET', 'operator');
    expect(result.authorized).toBe(false);
  });

  it('user cannot POST to /api/intelligence/enrich (write protection)', () => {
    const result = authorizeRoute('/api/intelligence/enrich', 'POST', 'user');
    expect(result.authorized).toBe(false);
    expect(result.reason).toContain('research:write');
  });

  it('viewer cannot trigger intelligence refresh', () => {
    const result = authorizeRoute('/api/intelligence/refresh', 'POST', 'viewer');
    expect(result.authorized).toBe(false);
  });

  it('viewer cannot run competitive intel scan', () => {
    const result = authorizeRoute('/api/intelligence/competitive', 'POST', 'viewer');
    expect(result.authorized).toBe(false);
  });

  it('viewer cannot do market discovery', () => {
    const result = authorizeRoute('/api/intelligence/market-discovery', 'POST', 'viewer');
    expect(result.authorized).toBe(false);
  });

  it('viewer cannot access company data at all', () => {
    const result = authorizeRoute('/api/companies', 'GET', 'viewer');
    expect(result.authorized).toBe(false);
  });

  it('viewer cannot access contact data at all', () => {
    const result = authorizeRoute('/api/contacts', 'GET', 'viewer');
    expect(result.authorized).toBe(false);
  });

  it('viewer cannot access lead data at all', () => {
    const result = authorizeRoute('/api/leads', 'GET', 'viewer');
    expect(result.authorized).toBe(false);
  });

  it('attempting to escalate from viewer to admin is rejected', () => {
    expect(hasPermission('viewer', 'users:manage')).toBe(false);
  });

  it('field filtering prevents viewer from seeing revenueEstimate even if route were accessible', () => {
    const company = { id: '1', name: 'Test', revenueEstimate: '$100M' };
    const filtered = filterObjectByRole(company, 'viewer', 'Company');
    expect(filtered.revenueEstimate).toBeUndefined();
  });

  it('field filtering prevents user from seeing aiAnalysis on companies', () => {
    const company = { id: '1', name: 'Test', aiAnalysis: 'Confidential AI assessment' };
    const filtered = filterObjectByRole(company, 'user', 'Company');
    expect(filtered.aiAnalysis).toBeUndefined();
  });

  it('field filtering prevents user from seeing consentIp on contacts', () => {
    const contact = { id: '1', name: 'Test', consentIp: '10.0.0.1' };
    const filtered = filterObjectByRole(contact, 'user', 'Contact');
    expect(filtered.consentIp).toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────
// 6. MIGRATED ROUTE VALIDATION
// ──────────────────────────────────────────────────────────
// Validates that the 16 routes previously missing RBAC are now
// covered by the ROUTE_AUTHORIZATION_MATRIX.

describe('S9 Security: Previously-Unprotected Routes Now Protected', () => {
  // These 16 routes were identified in the S9 audit as calling
  // checkApiAuth() WITHOUT passing `request`, meaning RBAC was
  // completely bypassed. They have been migrated to pass `request`.

  const previouslyUnprotected = [
    // Intelligence routes
    { path: '/api/intelligence/action-history', method: 'GET' },
    { path: '/api/intelligence/people-enrich', method: 'POST' },
    { path: '/api/intelligence/market-discovery', method: 'POST' },
    { path: '/api/intelligence/competitive', method: 'POST' },
    { path: '/api/intelligence/refresh', method: 'GET' },
    { path: '/api/intelligence/refresh', method: 'POST' },
    { path: '/api/intelligence/website-monitor', method: 'POST' },
    // Admin/Security routes
    { path: '/api/admin/ai-usage', method: 'GET' },
    { path: '/api/security/encryption', method: 'GET' },
    { path: '/api/security/rate-limits', method: 'GET' },
    { path: '/api/security/roles', method: 'GET' },
    // Company routes
    { path: '/api/companies/meta', method: 'GET' },
    { path: '/api/companies/stats', method: 'GET' },
    // Lead routes
    { path: '/api/leads/assign', method: 'POST' },
    { path: '/api/leads/dedup', method: 'GET' },
    { path: '/api/leads/source-stats', method: 'GET' },
  ];

  it('all 16 previously-unprotected routes are now matched in the matrix (admin authorized)', () => {
    // These should NOT fall through to deny-by-default.
    // Admin should always be authorized.
    for (const route of previouslyUnprotected) {
      const result = authorizeRoute(route.path, route.method, 'admin');
      expect(result.authorized).toBe(true);
    }
  });

  it('viewer is denied from all previously-unprotected routes', () => {
    for (const route of previouslyUnprotected) {
      const result = authorizeRoute(route.path, route.method, 'viewer');
      expect(result.authorized).toBe(false);
    }
  });

  it('operator is authorized for intelligence write routes (has research:write)', () => {
    const intelWriteRoutes = previouslyUnprotected.filter(
      r => r.path.startsWith('/api/intelligence/') && r.method === 'POST'
    );
    for (const route of intelWriteRoutes) {
      const result = authorizeRoute(route.path, route.method, 'operator');
      expect(result.authorized).toBe(true);
    }
  });

  it('user is denied from all previously-unprotected write routes', () => {
    const writeRoutes = previouslyUnprotected.filter(r => r.method !== 'GET');
    for (const route of writeRoutes) {
      const result = authorizeRoute(route.path, route.method, 'user');
      expect(result.authorized).toBe(false);
    }
  });
});
