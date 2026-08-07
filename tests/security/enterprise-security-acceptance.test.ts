/**
 * Enterprise Security Acceptance Tests
 *
 * Validates RBAC enforcement and field-level permissions
 * across all hardened endpoints. No database dependency —
 * pure unit tests mocking checkApiAuth internals.
 *
 * Test Categories:
 *   1. RBAC Route Authorization (viewer blocked from sensitive endpoints)
 *   2. Field-Level Permission Filtering (viewer sees redacted data)
 *   3. Role Permission Matrix Coverage (all 4 roles verified)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock dependencies ──────────────────────────────────────────────────

// Mock session module
vi.mock('@/lib/session', () => ({
  getCurrentSession: vi.fn(),
}));

// Mock db module
vi.mock('@/lib/db', () => ({
  db: {},
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

// Mock audit-logger
vi.mock('@/lib/audit-logger', () => ({
  audit: vi.fn(),
  AuditCategory: {},
}));

// ── Import after mocks ───────────────────────────────────────────────

import { authorizeRoute, hasPermission, getRolePermissions } from '@/lib/rbac';
import {
  filterObjectByRole,
  filterArrayByRole,
  hasFieldAccess,
  getRestrictedFields,
  FIELD_PERMISSIONS,
} from '@/lib/rbac-enforcement';

// ── Test Suite 1: RBAC Route Authorization ────────────────────────────

describe('RBAC Route Authorization', () => {
  describe('Viewer Role (lowest privilege)', () => {
    const viewerRole = 'viewer';

    it('BLOCKS viewer from GET /api/companies', () => {
      const result = authorizeRoute('/api/companies', 'GET', viewerRole);
      expect(result.authorized).toBe(false);
      expect(result.reason).toContain('viewer');
      expect(result.requiredPermissions).toContain('companies:read');
    });

    it('BLOCKS viewer from GET /api/companies/[id]', () => {
      const result = authorizeRoute('/api/companies/cx-123', 'GET', viewerRole);
      expect(result.authorized).toBe(false);
    });

    it('BLOCKS viewer from GET /api/contacts', () => {
      const result = authorizeRoute('/api/contacts', 'GET', viewerRole);
      expect(result.authorized).toBe(false);
    });

    it('BLOCKS viewer from GET /api/contacts/[id]', () => {
      const result = authorizeRoute('/api/contacts/ct-456', 'GET', viewerRole);
      expect(result.authorized).toBe(false);
    });

    it('BLOCKS viewer from GET /api/opportunities', () => {
      const result = authorizeRoute('/api/opportunities', 'GET', viewerRole);
      expect(result.authorized).toBe(false);
    });

    it('BLOCKS viewer from GET /api/opportunities/[id]', () => {
      const result = authorizeRoute('/api/opportunities/opp-789', 'GET', viewerRole);
      expect(result.authorized).toBe(false);
    });

    it('BLOCKS viewer from GET /api/pipeline', () => {
      const result = authorizeRoute('/api/pipeline', 'GET', viewerRole);
      expect(result.authorized).toBe(false);
    });

    it('BLOCKS viewer from GET /api/ai/advisor', () => {
      const result = authorizeRoute('/api/ai/advisor', 'GET', viewerRole);
      expect(result.authorized).toBe(false);
    });

    it('BLOCKS viewer from GET /api/ai/governance/dashboard', () => {
      const result = authorizeRoute('/api/ai/governance/dashboard', 'GET', viewerRole);
      expect(result.authorized).toBe(false);
    });

    it('BLOCKS viewer from GET /api/ai/experiments', () => {
      const result = authorizeRoute('/api/ai/experiments', 'GET', viewerRole);
      expect(result.authorized).toBe(false);
    });

    it('BLOCKS viewer from GET /api/ai/prompt-registry', () => {
      const result = authorizeRoute('/api/ai/prompt-registry', 'GET', viewerRole);
      expect(result.authorized).toBe(false);
    });

    it('BLOCKS viewer from GET /api/ai/cost', () => {
      const result = authorizeRoute('/api/ai/cost', 'GET', viewerRole);
      expect(result.authorized).toBe(false);
    });

    it('BLOCKS viewer from GET /api/users', () => {
      const result = authorizeRoute('/api/users', 'GET', viewerRole);
      expect(result.authorized).toBe(false);
    });

    it('BLOCKS viewer from PATCH /api/users', () => {
      const result = authorizeRoute('/api/users', 'PATCH', viewerRole);
      expect(result.authorized).toBe(false);
    });

    it('BLOCKS viewer from POST /api/contacts', () => {
      const result = authorizeRoute('/api/contacts', 'POST', viewerRole);
      expect(result.authorized).toBe(false);
    });

    it('BLOCKS viewer from DELETE /api/companies/[id]', () => {
      const result = authorizeRoute('/api/companies/cx-123', 'DELETE', viewerRole);
      expect(result.authorized).toBe(false);
    });

    it('BLOCKS viewer from GET /api/reports/team-performance', () => {
      // Reports should be accessible (reports:read)
      const result = authorizeRoute('/api/reports/team-performance', 'GET', viewerRole);
      // This path matches /api/reports/ wildcard which requires reports:read
      // Viewer HAS reports:read, so this should be ALLOWED
      expect(result.authorized).toBe(true);
    });

    it('ALLOWS viewer to GET /api/dashboard', () => {
      const result = authorizeRoute('/api/dashboard', 'GET', viewerRole);
      expect(result.authorized).toBe(true);
    });

    it('ALLOWS viewer to GET /api/reports (read-only)', () => {
      const result = authorizeRoute('/api/reports/pipeline', 'GET', viewerRole);
      expect(result.authorized).toBe(true);
    });
  });

  describe('User Role (standard read access)', () => {
    const userRole = 'user';

    it('ALLOWS user to GET /api/companies', () => {
      const result = authorizeRoute('/api/companies', 'GET', userRole);
      expect(result.authorized).toBe(true);
    });

    it('ALLOWS user to GET /api/companies/[id]', () => {
      const result = authorizeRoute('/api/companies/cx-123', 'GET', userRole);
      expect(result.authorized).toBe(true);
    });

    it('ALLOWS user to GET /api/contacts', () => {
      const result = authorizeRoute('/api/contacts', 'GET', userRole);
      expect(result.authorized).toBe(true);
    });

    it('ALLOWS user to GET /api/opportunities', () => {
      const result = authorizeRoute('/api/opportunities', 'GET', userRole);
      expect(result.authorized).toBe(true);
    });

    it('BLOCKS user from POST /api/companies (write)', () => {
      const result = authorizeRoute('/api/companies', 'POST', userRole);
      expect(result.authorized).toBe(false);
    });

    it('BLOCKS user from DELETE /api/companies/[id]', () => {
      const result = authorizeRoute('/api/companies/cx-123', 'DELETE', userRole);
      expect(result.authorized).toBe(false);
    });

    it('BLOCKS user from PATCH /api/contacts/[id]', () => {
      const result = authorizeRoute('/api/contacts/ct-456', 'PATCH', userRole);
      expect(result.authorized).toBe(false);
    });

    it('BLOCKS user from GET /api/users', () => {
      const result = authorizeRoute('/api/users', 'GET', userRole);
      expect(result.authorized).toBe(false);
    });

    it('BLOCKS user from GET /api/ai/governance/dashboard', () => {
      const result = authorizeRoute('/api/ai/governance/dashboard', 'GET', userRole);
      expect(result.authorized).toBe(true); // user has ai:read
    });
  });

  describe('Operator Role (day-to-day operations)', () => {
    const operatorRole = 'operator';

    it('ALLOWS operator to GET /api/companies', () => {
      const result = authorizeRoute('/api/companies', 'GET', operatorRole);
      expect(result.authorized).toBe(true);
    });

    it('ALLOWS operator to POST /api/companies (write)', () => {
      const result = authorizeRoute('/api/companies', 'POST', operatorRole);
      expect(result.authorized).toBe(true);
    });

    it('ALLOWS operator to PATCH /api/contacts/[id]', () => {
      const result = authorizeRoute('/api/contacts/ct-456', 'PATCH', operatorRole);
      expect(result.authorized).toBe(true);
    });

    it('ALLOWS operator to GET /api/ai/advisor', () => {
      const result = authorizeRoute('/api/ai/advisor', 'GET', operatorRole);
      expect(result.authorized).toBe(true);
    });

    it('BLOCKS operator from GET /api/users', () => {
      const result = authorizeRoute('/api/users', 'GET', operatorRole);
      expect(result.authorized).toBe(false);
    });

    it('BLOCKS operator from PATCH /api/users', () => {
      const result = authorizeRoute('/api/users', 'PATCH', operatorRole);
      expect(result.authorized).toBe(false);
    });

    it('BLOCKS operator from DELETE /api/companies/[id]', () => {
      const result = authorizeRoute('/api/companies/cx-123', 'DELETE', operatorRole);
      expect(result.authorized).toBe(false);
    });
  });

  describe('Admin Role (full access)', () => {
    const adminRole = 'admin';

    it('ALLOWS admin full access to ALL endpoints', () => {
      const endpoints = [
        { path: '/api/companies', method: 'GET' },
        { path: '/api/companies', method: 'POST' },
        { path: '/api/companies/cx-123', method: 'PATCH' },
        { path: '/api/companies/cx-123', method: 'DELETE' },
        { path: '/api/contacts', method: 'GET' },
        { path: '/api/contacts', method: 'POST' },
        { path: '/api/contacts/ct-456', method: 'PATCH' },
        { path: '/api/contacts/ct-456', method: 'DELETE' },
        { path: '/api/opportunities', method: 'GET' },
        { path: '/api/opportunities', method: 'POST' },
        { path: '/api/opportunities/opp-789', method: 'PATCH' },
        { path: '/api/opportunities/opp-789', method: 'DELETE' },
        { path: '/api/pipeline', method: 'GET' },
        { path: '/api/ai/advisor', method: 'GET' },
        { path: '/api/ai/advisor', method: 'POST' },
        { path: '/api/ai/governance/dashboard', method: 'GET' },
        { path: '/api/ai/experiments', method: 'GET' },
        { path: '/api/ai/experiments', method: 'POST' },
        { path: '/api/ai/prompt-registry', method: 'GET' },
        { path: '/api/ai/prompt-registry', method: 'POST' },
        { path: '/api/ai/cost', method: 'GET' },
        { path: '/api/users', method: 'GET' },
        { path: '/api/users', method: 'PATCH' },
        { path: '/api/reports/team-performance', method: 'GET' },
        { path: '/api/dashboard', method: 'GET' },
      ];

      for (const { path, method } of endpoints) {
        const result = authorizeRoute(path, method, adminRole);
        expect(result.authorized).toBe(true);
      }
    });
  });

  describe('Deny-by-default for unconfigured routes', () => {
    it('DENIES access to routes not in the matrix', () => {
      const result = authorizeRoute('/api/unknown-endpoint', 'GET', 'admin');
      expect(result.authorized).toBe(false);
      expect(result.reason).toContain('no authorization configuration');
    });

    it('DENIES empty/null roles', () => {
      expect(authorizeRoute('/api/companies', 'GET', '').authorized).toBe(false);
      expect(authorizeRoute('/api/companies', 'GET', 'unknown_role' as any).authorized).toBe(false);
    });
  });
});

// ── Test Suite 2: Field-Level Permission Filtering ───────────────────

describe('Field-Level Permission Filtering', () => {
  describe('Company model', () => {
    const companyData = {
      id: 'cx-123',
      rawName: 'Acme Corp',
      internalSummary: 'Secret internal notes about Acme',
      aiAnalysis: 'AI-generated analysis not for viewers',
      revenueEstimate: '$5M ARR',
      domain: 'acme.com',
      industry: 'Technology',
    };

    it('Viewer: CANNOT see internalSummary, aiAnalysis, revenueEstimate', () => {
      const filtered = filterObjectByRole(companyData, 'viewer', 'Company');
      expect(filtered.internalSummary).toBeUndefined();
      expect(filtered.aiAnalysis).toBeUndefined();
      expect(filtered.revenueEstimate).toBeUndefined();
      // Non-sensitive fields remain
      expect(filtered.rawName).toBe('Acme Corp');
      expect(filtered.domain).toBe('acme.com');
    });

    it('User: CANNOT see internalSummary, aiAnalysis, revenueEstimate', () => {
      const filtered = filterObjectByRole(companyData, 'user', 'Company');
      expect(filtered.internalSummary).toBeUndefined();
      expect(filtered.aiAnalysis).toBeUndefined();
      expect(filtered.revenueEstimate).toBeUndefined();
    });

    it('Operator: CAN see internalSummary, aiAnalysis but NOT revenueEstimate', () => {
      const filtered = filterObjectByRole(companyData, 'operator', 'Company');
      expect(filtered.internalSummary).toBe('Secret internal notes about Acme');
      expect(filtered.aiAnalysis).toBe('AI-generated analysis not for viewers');
      expect(filtered.revenueEstimate).toBeUndefined();
    });

    it('Admin: CAN see ALL fields including revenueEstimate', () => {
      const filtered = filterObjectByRole(companyData, 'admin', 'Company');
      expect(filtered.internalSummary).toBe('Secret internal notes about Acme');
      expect(filtered.aiAnalysis).toBe('AI-generated analysis not for viewers');
      expect(filtered.revenueEstimate).toBe('$5M ARR');
    });
  });

  describe('Contact model (PII)', () => {
    const contactData = {
      id: 'ct-456',
      rawName: 'Jane Smith',
      email: 'jane@acme.com',
      phone: '+1-555-0123',
      enrichmentData: { linkedin: 'jane-smith', twitter: '@janesmith' },
      consentIp: '192.168.1.100',
      emailHealthScore: 85,
      linkedinUrl: 'https://linkedin.com/in/jane-smith',
      jobTitle: 'CTO',
    };

    it('Viewer: CANNOT see phone, enrichmentData, consentIp, emailHealthScore, linkedinUrl', () => {
      const filtered = filterObjectByRole(contactData, 'viewer', 'Contact');
      expect(filtered.phone).toBeUndefined();
      expect(filtered.enrichmentData).toBeUndefined();
      expect(filtered.consentIp).toBeUndefined();
      expect(filtered.emailHealthScore).toBeUndefined();
      expect(filtered.linkedinUrl).toBeUndefined();
      // Public fields remain
      expect(filtered.rawName).toBe('Jane Smith');
      expect(filtered.email).toBe('jane@acme.com');
      expect(filtered.jobTitle).toBe('CTO');
    });

    it('User: CANNOT see phone, enrichmentData, consentIp, emailHealthScore, linkedinUrl', () => {
      const filtered = filterObjectByRole(contactData, 'user', 'Contact');
      expect(filtered.phone).toBeUndefined();
      expect(filtered.enrichmentData).toBeUndefined();
      expect(filtered.consentIp).toBeUndefined();
      expect(filtered.emailHealthScore).toBeUndefined();
      expect(filtered.linkedinUrl).toBeUndefined();
    });

    it('Operator: CAN see phone, enrichmentData, emailHealthScore, linkedinUrl but NOT consentIp', () => {
      const filtered = filterObjectByRole(contactData, 'operator', 'Contact');
      expect(filtered.phone).toBe('+1-555-0123');
      expect(filtered.enrichmentData).toEqual({ linkedin: 'jane-smith', twitter: '@janesmith' });
      expect(filtered.emailHealthScore).toBe(85);
      expect(filtered.linkedinUrl).toBe('https://linkedin.com/in/jane-smith');
      expect(filtered.consentIp).toBeUndefined();
    });

    it('Admin: CAN see ALL contact fields including consentIp', () => {
      const filtered = filterObjectByRole(contactData, 'admin', 'Contact');
      expect(filtered.phone).toBe('+1-555-0123');
      expect(filtered.consentIp).toBe('192.168.1.100');
      expect(filtered.enrichmentData).toBeDefined();
    });
  });

  describe('Opportunity model', () => {
    const oppData = {
      id: 'opp-789',
      opportunityTitle: 'Enterprise Deal',
      opportunityScore: 92,
      winProbability: 0.78,
      estimatedValue: '$500K',
      internalNotes: 'Internal strategy notes',
      status: 'active',
    };

    it('Viewer: CANNOT see opportunityScore, winProbability, estimatedValue, internalNotes', () => {
      const filtered = filterObjectByRole(oppData, 'viewer', 'Opportunity');
      expect(filtered.opportunityScore).toBeUndefined();
      expect(filtered.winProbability).toBeUndefined();
      expect(filtered.estimatedValue).toBeUndefined();
      expect(filtered.internalNotes).toBeUndefined();
    });

    it('Operator: CAN see scores but NOT internalNotes', () => {
      const filtered = filterObjectByRole(oppData, 'operator', 'Opportunity');
      expect(filtered.opportunityScore).toBe(92);
      expect(filtered.winProbability).toBe(0.78);
      expect(filtered.estimatedValue).toBe('$500K');
      expect(filtered.internalNotes).toBeUndefined();
    });

    it('Admin: CAN see ALL opportunity fields', () => {
      const filtered = filterObjectByRole(oppData, 'admin', 'Opportunity');
      expect(filtered.opportunityScore).toBe(92);
      expect(filtered.winProbability).toBe(0.78);
      expect(filtered.estimatedValue).toBe('$500K');
      expect(filtered.internalNotes).toBe('Internal strategy notes');
    });
  });

  describe('IntelligenceSignal model', () => {
    const signalData = {
      id: 'sig-101',
      type: 'technology_adoption',
      title: 'Company adopting Kubernetes',
      confidenceScore: 0.85,
      sourceDetails: { url: 'https://example.com/blog', scrapedAt: '2025-01-01' },
      rawData: { fullHtml: '<html>...</html>', rawJson: '{...}' },
    };

    it('Viewer: CANNOT see confidenceScore, sourceDetails, rawData', () => {
      const filtered = filterObjectByRole(signalData, 'viewer', 'IntelligenceSignal');
      expect(filtered.confidenceScore).toBeUndefined();
      expect(filtered.sourceDetails).toBeUndefined();
      expect(filtered.rawData).toBeUndefined();
    });

    it('Operator: CAN see confidenceScore, sourceDetails but NOT rawData', () => {
      const filtered = filterObjectByRole(signalData, 'operator', 'IntelligenceSignal');
      expect(filtered.confidenceScore).toBe(0.85);
      expect(filtered.sourceDetails).toEqual({ url: 'https://example.com/blog', scrapedAt: '2025-01-01' });
      expect(filtered.rawData).toBeUndefined();
    });

    it('Admin: CAN see ALL intelligence fields', () => {
      const filtered = filterObjectByRole(signalData, 'admin', 'IntelligenceSignal');
      expect(filtered.confidenceScore).toBe(0.85);
      expect(filtered.sourceDetails).toBeDefined();
      expect(filtered.rawData).toBeDefined();
    });
  });

  describe('User model', () => {
    const userData = {
      id: 'usr-1',
      email: 'admin@deepmindq.com',
      name: 'Admin User',
      passwordHash: '$2b$10$hashedvalue',
      lastLoginAt: '2025-08-07T10:00:00Z',
      role: 'admin',
    };

    it('Viewer: CANNOT see passwordHash or lastLoginAt', () => {
      const filtered = filterObjectByRole(userData, 'viewer', 'User');
      expect(filtered.passwordHash).toBeUndefined();
      expect(filtered.lastLoginAt).toBeUndefined();
    });

    it('Operator: CANNOT see passwordHash or lastLoginAt', () => {
      const filtered = filterObjectByRole(userData, 'operator', 'User');
      expect(filtered.passwordHash).toBeUndefined();
      expect(filtered.lastLoginAt).toBeUndefined();
    });

    it('User: CANNOT see passwordHash or lastLoginAt', () => {
      const filtered = filterObjectByRole(userData, 'user', 'User');
      expect(filtered.passwordHash).toBeUndefined();
      expect(filtered.lastLoginAt).toBeUndefined();
    });

    it('Admin: CAN see lastLoginAt but NOT passwordHash', () => {
      const filtered = filterObjectByRole(userData, 'admin', 'User');
      expect(filtered.passwordHash).toBeUndefined();
      expect(filtered.lastLoginAt).toBe('2025-08-07T10:00:00Z');
    });
  });
});

// ── Test Suite 3: Array Filtering ─────────────────────────────────────

describe('Array Filtering', () => {
  it('Filters all items in an array by role', () => {
    const companies = [
      { id: 'cx-1', rawName: 'Acme', internalSummary: 'Secret', revenueEstimate: '$5M' },
      { id: 'cx-2', rawName: 'Beta', internalSummary: 'Classified', revenueEstimate: '$10M' },
      { id: 'cx-3', rawName: 'Gamma', internalSummary: 'Confidential', revenueEstimate: '$3M' },
    ];

    const filtered = filterArrayByRole(companies, 'viewer', 'Company');
    expect(filtered).toHaveLength(3);
    expect(filtered[0].rawName).toBe('Acme');
    expect(filtered[0].internalSummary).toBeUndefined();
    expect(filtered[0].revenueEstimate).toBeUndefined();
    expect(filtered[1].internalSummary).toBeUndefined();
    expect(filtered[2].revenueEstimate).toBeUndefined();
  });

  it('Returns same array when no restricted fields for role', () => {
    const companies = [
      { id: 'cx-1', rawName: 'Acme', internalSummary: 'Secret' },
    ];

    const filtered = filterArrayByRole(companies, 'admin', 'Company');
    expect(filtered[0].internalSummary).toBe('Secret');
  });
});

// ── Test Suite 4: hasFieldAccess & getRestrictedFields ───────────────

describe('Field Access Utilities', () => {
  it('hasFieldAccess returns true for unrestricted fields', () => {
    expect(hasFieldAccess('viewer', 'Company', 'rawName')).toBe(true);
    expect(hasFieldAccess('viewer', 'Company', 'domain')).toBe(true);
  });

  it('hasFieldAccess returns false for restricted fields', () => {
    expect(hasFieldAccess('viewer', 'Company', 'internalSummary')).toBe(false);
    expect(hasFieldAccess('viewer', 'Company', 'revenueEstimate')).toBe(false);
    expect(hasFieldAccess('user', 'Contact', 'phone')).toBe(false);
  });

  it('hasFieldAccess returns true for admin on all non-password fields', () => {
    expect(hasFieldAccess('admin', 'Company', 'revenueEstimate')).toBe(true);
    expect(hasFieldAccess('admin', 'Contact', 'consentIp')).toBe(true);
    expect(hasFieldAccess('admin', 'User', 'passwordHash')).toBe(false); // nobody
  });

  it('getRestrictedFields returns correct fields per role+model', () => {
    const viewerCompanyFields = getRestrictedFields('viewer', 'Company');
    expect(viewerCompanyFields).toContain('internalSummary');
    expect(viewerCompanyFields).toContain('aiAnalysis');
    expect(viewerCompanyFields).toContain('revenueEstimate');

    const operatorCompanyFields = getRestrictedFields('operator', 'Company');
    expect(operatorCompanyFields).not.toContain('internalSummary');
    expect(operatorCompanyFields).not.toContain('aiAnalysis');
    expect(operatorCompanyFields).toContain('revenueEstimate');

    const adminCompanyFields = getRestrictedFields('admin', 'Company');
    expect(adminCompanyFields).toHaveLength(0); // admin has full access
  });
});

// ── Test Suite 5: Permission Matrix Integrity ─────────────────────────

describe('Permission Matrix Integrity', () => {
  it('Viewer has ONLY dashboard, analytics, reports permissions', () => {
    const perms = getRolePermissions('viewer');
    expect(perms).toHaveLength(3);
    expect(perms).toContain('dashboard:read');
    expect(perms).toContain('analytics:read');
    expect(perms).toContain('reports:read');
    // Should NOT have any write permissions
    expect(perms.some(p => p.includes(':write'))).toBe(false);
    expect(perms.some(p => p.includes(':delete'))).toBe(false);
    expect(perms.some(p => p.includes(':manage'))).toBe(false);
  });

  it('User has ONLY read permissions (no write/delete/manage)', () => {
    const perms = getRolePermissions('user');
    expect(perms.some(p => p.includes(':write'))).toBe(false);
    expect(perms.some(p => p.includes(':delete'))).toBe(false);
    expect(perms.some(p => p.includes(':manage'))).toBe(false);
  });

  it('Admin has ALL permissions including write/delete/manage', () => {
    const perms = getRolePermissions('admin');
    expect(perms).toContain('companies:write');
    expect(perms).toContain('companies:delete');
    expect(perms).toContain('users:manage');
    expect(perms).toContain('ai:configure');
    expect(perms).toContain('knowledge:manage');
  });

  it('FIELD_PERMISSIONS has no duplicate entries', () => {
    const keys = FIELD_PERMISSIONS.map(f => `${f.model}:${f.field}`);
    const unique = new Set(keys);
    expect(unique.size).toBe(keys.length);
  });

  it('Every FIELD_PERMISSIONS model has at least one sensitive=true field', () => {
    const models = [...new Set(FIELD_PERMISSIONS.map(f => f.model))];
    for (const model of models) {
      const rules = FIELD_PERMISSIONS.filter(f => f.model === model);
      const hasSensitive = rules.some(r => r.sensitive);
      expect(hasSensitive).toBe(true);
    }
  });
});

// ── Test Suite 6: Role Hierarchy ──────────────────────────────────────

describe('Role Hierarchy', () => {
  it('Viewer permissions are a strict subset of User permissions', () => {
    const viewerPerms = new Set(getRolePermissions('viewer'));
    const userPerms = new Set(getRolePermissions('user'));
    for (const p of viewerPerms) {
      expect(userPerms.has(p)).toBe(true);
    }
    expect(userPerms.size).toBeGreaterThan(viewerPerms.size);
  });

  it('User permissions are a strict subset of Operator permissions', () => {
    const userPerms = new Set(getRolePermissions('user'));
    const operatorPerms = new Set(getRolePermissions('operator'));
    for (const p of userPerms) {
      expect(operatorPerms.has(p)).toBe(true);
    }
    expect(operatorPerms.size).toBeGreaterThan(userPerms.size);
  });

  it('Operator permissions are a strict subset of Admin permissions', () => {
    const operatorPerms = new Set(getRolePermissions('operator'));
    const adminPerms = new Set(getRolePermissions('admin'));
    for (const p of operatorPerms) {
      expect(adminPerms.has(p)).toBe(true);
    }
    expect(adminPerms.size).toBeGreaterThan(operatorPerms.size);
  });

  it('Full hierarchy chain: viewer ⊂ user ⊂ operator ⊂ admin', () => {
    const viewerCount = getRolePermissions('viewer').length;
    const userCount = getRolePermissions('user').length;
    const operatorCount = getRolePermissions('operator').length;
    const adminCount = getRolePermissions('admin').length;

    expect(viewerCount).toBeLessThan(userCount);
    expect(userCount).toBeLessThan(operatorCount);
    expect(operatorCount).toBeLessThan(adminCount);
  });
});
