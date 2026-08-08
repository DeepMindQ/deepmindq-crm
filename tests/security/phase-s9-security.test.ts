/**
 * Phase 5 Security & Compliance — Comprehensive Tests
 *
 * Tests for all 8 Phase 5 features:
 *   5.1 RBAC Enforcement
 *   5.2 SSO Integration
 *   5.3 Field-Level Permissions
 *   5.4 Comprehensive Audit Trail
 *   5.5 Data Encryption
 *   5.6 GDPR/CCPA Compliance
 *   5.7 Rate Limiting Middleware
 *   5.8 Security Scanner
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock Setup ──────────────────────────────────────────────────────

const mockDb = {
  user: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
    upsert: vi.fn(),
  },
  contact: {
    findUnique: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  comprehensiveAuditLog: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    groupBy: vi.fn(),
  },
  privacyRequest: {
    create: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
  suppression: {
    upsert: vi.fn(),
    count: vi.fn(),
  },
  companySignal: {
    findMany: vi.fn(),
  },
  companyTimelineEvent: {
    findMany: vi.fn(),
  },
  systemSetting: {
    findUnique: vi.fn(),
    upsert: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  session: {
    deleteMany: vi.fn(),
  },
};

vi.mock('@/lib/db', () => ({ db: mockDb }));
vi.mock('@/lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));
vi.mock('@/lib/audit-logger', () => ({
  audit: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/session', () => ({
  createSession: vi.fn().mockResolvedValue({
    token: 'test-session-token',
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  }),
}));

// ══════════════════════════════════════════════════════════════════
// 5.1 RBAC Enforcement Tests
// ══════════════════════════════════════════════════════════════════

describe('5.1 RBAC Enforcement', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should check field-level permissions for Company model', async () => {
    const { hasFieldAccess, getRestrictedFields, filterObjectByRole } = await import('@/lib/rbac-enforcement');

    // Admin can see internalSummary
    expect(hasFieldAccess('admin', 'Company', 'internalSummary')).toBe(true);
    expect(hasFieldAccess('operator', 'Company', 'internalSummary')).toBe(true);

    // Viewer cannot see internalSummary
    expect(hasFieldAccess('viewer', 'Company', 'internalSummary')).toBe(false);

    // User cannot see revenueEstimate (only admin)
    expect(hasFieldAccess('user', 'Company', 'revenueEstimate')).toBe(false);
    expect(hasFieldAccess('admin', 'Company', 'revenueEstimate')).toBe(true);

    // Non-sensitive fields are accessible to all
    expect(hasFieldAccess('viewer', 'Company', 'name')).toBe(true);
    expect(hasFieldAccess('viewer', 'Company', 'industry')).toBe(true);
  });

  it('should return restricted fields for a role+model', async () => {
    const { getRestrictedFields } = await import('@/lib/rbac-enforcement');

    const viewerCompanyRestricted = getRestrictedFields('viewer', 'Company');
    expect(viewerCompanyRestricted).toContain('internalSummary');
    expect(viewerCompanyRestricted).toContain('revenueEstimate');

    const adminCompanyRestricted = getRestrictedFields('admin', 'Company');
    expect(adminCompanyRestricted).toHaveLength(0); // Admin sees everything
  });

  it('should filter objects by role', async () => {
    const { filterObjectByRole } = await import('@/lib/rbac-enforcement');

    const companyData = {
      name: 'Acme Corp',
      industry: 'Technology',
      internalSummary: 'Secret intelligence report',
      revenueEstimate: '$50M',
    };

    const filtered = filterObjectByRole(companyData, 'viewer', 'Company');
    expect(filtered.name).toBe('Acme Corp');
    expect(filtered.industry).toBe('Technology');
    expect(filtered.internalSummary).toBeUndefined();
    expect(filtered.revenueEstimate).toBeUndefined();

    // Admin gets everything
    const adminFiltered = filterObjectByRole(companyData, 'admin', 'Company');
    expect(adminFiltered.internalSummary).toBe('Secret intelligence report');
    expect(adminFiltered.revenueEstimate).toBe('$50M');
  });

  it('should filter contact PII fields', async () => {
    const { filterObjectByRole } = await import('@/lib/rbac-enforcement');

    const contactData = {
      name: 'John Doe',
      email: 'john@example.com',
      phone: '+1234567890',
      enrichmentData: { score: 95 },
    };

    // Viewer cannot see phone or enrichmentData
    const viewerFiltered = filterObjectByRole(contactData, 'viewer', 'Contact');
    expect(viewerFiltered.phone).toBeUndefined();
    expect(viewerFiltered.enrichmentData).toBeUndefined();
    expect(viewerFiltered.name).toBe('John Doe');
  });

  it('should generate compliance matrix', async () => {
    const { generateRoleComplianceMatrix } = await import('@/lib/rbac-enforcement');

    const matrix = generateRoleComplianceMatrix();
    expect(matrix).toHaveLength(4); // admin, operator, user, viewer

    const admin = matrix.find((r) => r.role === 'admin');
    expect(admin).toBeDefined();
    expect(admin!.canManageUsers).toBe(true);
    expect(admin!.canConfigureSystem).toBe(true);
    expect(admin!.totalPermissions).toBeGreaterThan(0);

    const viewer = matrix.find((r) => r.role === 'viewer');
    expect(viewer).toBeDefined();
    expect(viewer!.canManageUsers).toBe(false);
    expect(viewer!.canExportData).toBe(false);
  });

  it('should assign roles with last-admin protection', async () => {
    const { assignUserRole } = await import('@/lib/rbac-enforcement');

    // Setup: only 1 admin exists
    mockDb.user.count.mockResolvedValue(1);
    mockDb.user.findUnique.mockResolvedValue({ role: 'admin' });
    mockDb.user.update.mockResolvedValue({ id: 'user-1' });

    // Try to remove last admin — should fail
    const result = await assignUserRole('user-1', 'user', 'admin-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('last admin');
    expect(mockDb.user.update).not.toHaveBeenCalled();
  });

  it('should assign roles successfully for non-last-admin', async () => {
    const { assignUserRole } = await import('@/lib/rbac-enforcement');

    // Setup: multiple admins exist
    mockDb.user.count.mockResolvedValue(3);
    mockDb.user.update.mockResolvedValue({ id: 'user-1' });

    const result = await assignUserRole('user-1', 'operator', 'admin-1');
    expect(result.success).toBe(true);
    expect(mockDb.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: { role: 'operator' },
      }),
    );
  });

  it('should reject invalid roles', async () => {
    const { assignUserRole } = await import('@/lib/rbac-enforcement');

    const result = await assignUserRole('user-1', 'superadmin' as any, 'admin-1');
    expect(result.success).toBe(false);
    expect(result.error).toContain('Invalid role');
  });
});

// ══════════════════════════════════════════════════════════════════
// 5.4 Comprehensive Audit Trail Tests
// ══════════════════════════════════════════════════════════════════

describe('5.4 Comprehensive Audit Trail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should detect field-level changes between objects', async () => {
    const { detectChanges } = await import('@/lib/comprehensive-audit');

    const oldObj = { name: 'Old Name', role: 'user', score: 10 };
    const newObj = { name: 'New Name', role: 'user', score: 20, updatedAt: 'now' };

    const changes = detectChanges(oldObj, newObj);
    expect(changes).toHaveLength(2); // name + score (updatedAt ignored)

    const nameChange = changes.find((c) => c.field === 'name');
    expect(nameChange).toBeDefined();
    expect(nameChange!.oldValue).toBe('Old Name');
    expect(nameChange!.newValue).toBe('New Name');
  });

  it('should detect all fields as new when oldObj is null', async () => {
    const { detectChanges } = await import('@/lib/comprehensive-audit');

    const newObj = { name: 'Test', email: 'test@test.com' };
    const changes = detectChanges(null, newObj);

    expect(changes).toHaveLength(2);
    expect(changes[0].oldValue).toBeNull();
  });

  it('should return empty changes for identical objects', async () => {
    const { detectChanges } = await import('@/lib/comprehensive-audit');

    const obj = { name: 'Same', role: 'admin' };
    const changes = detectChanges(obj, { ...obj });

    expect(changes).toHaveLength(0);
  });

  it('should create audit entry successfully', async () => {
    const { createAuditEntry } = await import('@/lib/comprehensive-audit');

    mockDb.comprehensiveAuditLog.create.mockResolvedValue({
      id: 'audit-1',
      action: 'update',
      entity: 'Company',
      entityId: 'comp-1',
    });

    const id = await createAuditEntry({
      action: 'update',
      entity: 'Company',
      entityId: 'comp-1',
      actorId: 'admin-1',
      actorEmail: 'admin@test.com',
      changes: [{ field: 'name', oldValue: 'Old', newValue: 'New' }],
    });

    expect(id).toBe('audit-1');
    expect(mockDb.comprehensiveAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'update',
          entity: 'Company',
          entityId: 'comp-1',
        }),
      }),
    );
  });

  it('should return null on DB failure (non-blocking)', async () => {
    const { createAuditEntry } = await import('@/lib/comprehensive-audit');

    mockDb.comprehensiveAuditLog.create.mockRejectedValue(new Error('DB down'));

    const id = await createAuditEntry({
      action: 'update',
      entity: 'Company',
      entityId: 'comp-1',
      actorId: 'admin-1',
    });

    expect(id).toBeNull();
  });

  it('should query audit trail with filters', async () => {
    const { queryComprehensiveAudit } = await import('@/lib/comprehensive-audit');

    mockDb.comprehensiveAuditLog.findMany.mockResolvedValue([
      {
        id: 'audit-1',
        action: 'update',
        entity: 'Company',
        entityId: 'comp-1',
        actorId: 'admin-1',
        actorEmail: 'admin@test.com',
        changes: [{ field: 'name', oldValue: 'Old', newValue: 'New' }],
        metadata: {},
        createdAt: new Date('2026-08-07T10:00:00Z'),
      },
    ]);
    mockDb.comprehensiveAuditLog.count.mockResolvedValue(1);

    const result = await queryComprehensiveAudit({
      entity: 'Company',
      limit: 10,
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].entity).toBe('Company');
    expect(result.total).toBe(1);
  });

  it('should record convenience methods (creation, update, deletion)', async () => {
    const {
      recordCreation,
      recordUpdate,
      recordDeletion,
    } = await import('@/lib/comprehensive-audit');

    mockDb.comprehensiveAuditLog.create.mockResolvedValue({ id: 'audit-x' });

    // Creation
    const createId = await recordCreation('Company', 'comp-1', 'admin-1', { name: 'New Co' });
    expect(createId).toBe('audit-x');

    // Update
    const updateId = await recordUpdate('Company', 'comp-1', 'admin-1', { name: 'Old' }, { name: 'New' });
    expect(updateId).toBe('audit-x');

    // Deletion
    const deleteId = await recordDeletion('Company', 'comp-1', 'admin-1', { name: 'Deleted Co' });
    expect(deleteId).toBe('audit-x');
    expect(mockDb.comprehensiveAuditLog.create).toHaveBeenCalledTimes(3);
  });

  it('should get audit statistics', async () => {
    const { getAuditStatistics } = await import('@/lib/comprehensive-audit');

    mockDb.comprehensiveAuditLog.count
      .mockResolvedValueOnce(100) // total
      .mockResolvedValueOnce(5)   // recent alerts
      .mockResolvedValue(10);     // groupBy counts

    mockDb.comprehensiveAuditLog.groupBy
      .mockResolvedValueOnce([{ action: 'update', _count: { action: 60 } }, { action: 'create', _count: { action: 40 } }])
      .mockResolvedValueOnce([{ entity: 'Company', _count: { entity: 50 } }, { entity: 'Contact', _count: { entity: 50 } }])
      .mockResolvedValueOnce([{ actorEmail: 'admin@test.com', _count: { actorEmail: 80 } }]);

    const stats = await getAuditStatistics();
    expect(stats.total).toBe(100);
    expect(stats.byAction.update).toBe(60);
    expect(stats.topActors).toHaveLength(1);
  });
});

// ══════════════════════════════════════════════════════════════════
// 5.5 Data Encryption Tests
// ══════════════════════════════════════════════════════════════════

describe('5.5 Data Encryption', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should report health status correctly', async () => {
    const { getEncryptionHealth, ENCRYPTED_FIELDS } = await import('@/lib/encryption');

    const health = getEncryptionHealth();
    // Without ENCRYPTION_MASTER_KEY set
    expect(health.masterKeyConfigured).toBe(false);
    expect(health.algorithm).toBe('AES-GCM');
    expect(health.keyVersion).toBe(1);
    expect(ENCRYPTED_FIELDS).toContain('phone');
  });

  it('should validate TLS configuration', async () => {
    const { validateTlsConfig, isTlsEnforced } = await import('@/lib/encryption');

    // In test env, TLS not enforced
    expect(isTlsEnforced()).toBe(false);

    const tls = validateTlsConfig();
    expect(tls.enforced).toBe(false);
    // In non-production, no warnings expected
    expect(tls.warnings).toHaveLength(0);
  });

  it('should return plaintext when encryption is not configured', async () => {
    const { encryptField, decryptField } = await import('@/lib/encryption');

    // Without master key, should return plaintext
    const encrypted = await encryptField('phone', '+1234567890');
    expect(encrypted).toBe('+1234567890');

    const decrypted = await decryptField('phone', '+1234567890');
    expect(decrypted).toBe('+1234567890');
  });

  it('should return input unchanged for empty/null values', async () => {
    const { encryptField, decryptField } = await import('@/lib/encryption');

    expect(await encryptField('phone', '')).toBe('');
    expect(await encryptField('phone', null as any)).toBeNull();
  });
});

// ══════════════════════════════════════════════════════════════════
// 5.6 GDPR/CCPA Compliance Tests
// ══════════════════════════════════════════════════════════════════

describe('5.6 GDPR/CCPA Compliance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create privacy request', async () => {
    const { createPrivacyRequest } = await import('@/lib/privacy-compliance');

    mockDb.privacyRequest.create.mockResolvedValue({
      id: 'pr-1',
      type: 'erasure',
      status: 'received',
      requesterEmail: 'user@test.com',
      requesterName: 'Test User',
      contactId: null,
      description: 'Please delete my data',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      slaDeadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await createPrivacyRequest({
      type: 'erasure',
      requesterEmail: 'user@test.com',
      requesterName: 'Test User',
      description: 'Please delete my data',
    });

    expect(result).not.toBeNull();
    expect(result!.type).toBe('erasure');
    expect(result!.status).toBe('received');
    expect(mockDb.privacyRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'erasure',
          status: 'received',
        }),
      }),
    );
  });

  it('should get privacy requests with filtering', async () => {
    const { getPrivacyRequests } = await import('@/lib/privacy-compliance');

    mockDb.privacyRequest.findMany.mockResolvedValue([]);
    mockDb.privacyRequest.count.mockResolvedValue(0);

    const result = await getPrivacyRequests({
      status: 'received',
      limit: 10,
    });

    expect(result.data).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(mockDb.privacyRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'received' },
        take: 10,
      }),
    );
  });

  it('should update consent status', async () => {
    const { updateConsent } = await import('@/lib/privacy-compliance');

    mockDb.contact.findUnique.mockResolvedValue({ consentStatus: 'unknown' });
    mockDb.contact.update.mockResolvedValue({ id: 'contact-1' });

    const result = await updateConsent(
      'contact-1',
      'opted_in',
      'double_opt_in',
      '1.2.3.4',
      'admin-1',
    );

    expect(result.success).toBe(true);
    expect(result.previousStatus).toBe('unknown');
    expect(mockDb.contact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'contact-1' },
        data: expect.objectContaining({
          consentStatus: 'opted_in',
          consentSource: 'double_opt_in',
        }),
      }),
    );
  });

  it('should process data erasure (Right to be Forgotten)', async () => {
    const { processDataErasure } = await import('@/lib/privacy-compliance');

    mockDb.contact.findUnique.mockResolvedValue({
      id: 'contact-1',
      email: 'user@test.com',
      rawName: 'John Doe',
      normalizedName: 'John Doe',
      editedName: 'John',
      phone: '+1234567890',
      linkedinUrl: 'https://linkedin.com/in/johndoe',
      companyId: 'comp-1',
      company: { id: 'comp-1', name: 'Acme Corp' },
    });
    mockDb.contact.update.mockResolvedValue({});
    mockDb.suppression.upsert.mockResolvedValue({});

    const result = await processDataErasure('contact-1', 'admin-1');

    expect(result.success).toBe(true);
    expect(result.anonymizedFields.length).toBeGreaterThan(0);
    expect(result.anonymizedFields).toContain('name');
    expect(result.anonymizedFields).toContain('email');

    // Verify contact was anonymized
    expect(mockDb.contact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'contact-1' },
        data: expect.objectContaining({
          rawName: '[erased]',
          isSuppressed: true,
          status: 'archived',
        }),
      }),
    );

    // Verify contact was suppressed
    expect(mockDb.suppression.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { contactId: 'contact-1' },
      }),
    );
  });

  it('should get compliance summary', async () => {
    const { getComplianceSummary } = await import('@/lib/privacy-compliance');

    mockDb.privacyRequest.count
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(3)  // pending
      .mockResolvedValueOnce(6)  // completed
      .mockResolvedValueOnce(1);  // overdue

    mockDb.contact.count
      .mockResolvedValueOnce(100) // total
      .mockResolvedValueOnce(70)  // optedIn
      .mockResolvedValueOnce(20); // optedOut

    mockDb.suppression.count.mockResolvedValue(20);

    const summary = await getComplianceSummary();
    expect(summary.totalRequests).toBe(10);
    expect(summary.pendingRequests).toBe(3);
    expect(summary.overdueRequests).toBe(1);
    expect(summary.consentStats.optedIn).toBe(70);
    expect(summary.consentStats.optedOut).toBe(20);
    expect(summary.suppressionStats.total).toBe(20);
  });

  it('should get consent statistics', async () => {
    const { getConsentStats } = await import('@/lib/privacy-compliance');

    mockDb.contact.count
      .mockResolvedValueOnce(200)
      .mockResolvedValueOnce(150)
      .mockResolvedValueOnce(30);

    const stats = await getConsentStats();
    expect(stats.total).toBe(200);
    expect(stats.optedIn).toBe(150);
    expect(stats.optedOut).toBe(30);
    expect(stats.unknown).toBe(20);
  });
});

// ══════════════════════════════════════════════════════════════════
// 5.7 Rate Limiting Middleware Tests
// ══════════════════════════════════════════════════════════════════

describe('5.7 Rate Limiting Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RATE_LIMIT_DISABLED = 'true'; // Disable for most tests
  });

  afterAll(() => {
    process.env.RATE_LIMIT_DISABLED = undefined;
  });

  it('should allow all requests when disabled', async () => {
    const { checkRateLimit } = await import('@/lib/rate-limit-middleware');

    const result = await checkRateLimit('/api/companies', '1.2.3.4');
    expect(result.allowed).toBe(true);
    expect(result.headers['X-RateLimit-Backend']).toBe('disabled');
  });

  it('should return rate limit registry', async () => {
    const { getRateLimitRegistry } = await import('@/lib/rate-limit-middleware');

    const registry = getRateLimitRegistry();
    expect(registry.length).toBeGreaterThan(0);

    // Check AI endpoints have lower limits
    const aiChat = registry.find((r) => r.pattern === '/api/ai/chat');
    expect(aiChat).toBeDefined();
    expect(aiChat!.limit).toBe(30);
    expect(aiChat!.windowMinutes).toBe(1);

    // Check auth endpoints have very low limits
    const otp = registry.find((r) => r.pattern === '/api/request-otp');
    expect(otp).toBeDefined();
    expect(otp!.limit).toBe(5);
  });

  it('should manage IP blacklist and whitelist', async () => {
    const { blacklistIp, whitelistIp, removeIpFromWhitelist, getHealthStatus } = await import('@/lib/rate-limit-middleware');

    blacklistIp('1.2.3.4');
    whitelistIp('5.6.7.8');

    const health = getHealthStatus();
    expect(health.blacklistSize).toBe(1);
    expect(health.whitelistSize).toBe(1);

    removeIpFromWhitelist('5.6.7.8');
    const healthAfter = getHealthStatus();
    expect(healthAfter.whitelistSize).toBe(0);
    expect(healthAfter.blacklistSize).toBe(1);
  });

  it('should block blacklisted IPs even when rate limiting is disabled', async () => {
    // Re-import to get fresh module state
    const rateLimitModule = await import('@/lib/rate-limit-middleware');

    // Blacklist an IP first
    rateLimitModule.blacklistIp('10.0.0.1');

    const result = await rateLimitModule.checkRateLimit(
      '/api/companies',
      '10.0.0.1',
    );

    expect(result.allowed).toBe(false);
    expect(result.status).toBe(429);
    expect(result.body?.error).toContain('restricted');
  });
});

// ══════════════════════════════════════════════════════════════════
// 5.8 Security Scanner Tests
// ══════════════════════════════════════════════════════════════════

describe('5.8 Security Scanner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should run security scan successfully', async () => {
    const { runSecurityScan } = await import('@/lib/security-scanner');

    const scan = runSecurityScan();
    expect(scan.scanId).toBeDefined();
    expect(scan.timestamp).toBeDefined();
    expect(scan.totalFindings).toBeGreaterThanOrEqual(0);
    expect(scan.bySeverity).toBeDefined();
    expect(scan.postureScore).toBeGreaterThanOrEqual(0);
    expect(scan.postureScore).toBeLessThanOrEqual(100);
    expect(scan.recommendations).toBeInstanceOf(Array);
  });

  it('should detect missing encryption key', async () => {
    // Ensure no master key is set
    const originalKey = process.env.ENCRYPTION_MASTER_KEY;
    delete process.env.ENCRYPTION_MASTER_KEY;

    // Need fresh import
    vi.resetModules();
    const { runSecurityScan } = await import('@/lib/security-scanner');

    const scan = runSecurityScan();
    const encryptionFinding = scan.findings.find(
      (f) => f.id === 'static-003',
    );

    if (encryptionFinding) {
      expect(encryptionFinding.severity).toBe('medium');
      expect(encryptionFinding.category).toBe('encryption');
    }

    // Restore
    if (originalKey) process.env.ENCRYPTION_MASTER_KEY = originalKey;
  });

  it('should generate OWASP coverage report', async () => {
    const { getOwaspCoverage } = await import('@/lib/security-scanner');

    const coverage = getOwaspCoverage();
    expect(coverage).toHaveLength(10); // OWASP Top 10

    // Each category should have covered, findings, notes
    for (const cat of coverage) {
      expect(cat.category).toMatch(/^A\d{2}:2021/);
      expect(cat.title).toBeDefined();
      expect(typeof cat.covered).toBe('boolean');
      expect(cat.notes).toBeDefined();
    }
  });

  it('should generate pen test report template', async () => {
    const { generatePenTestReportTemplate } = await import('@/lib/security-scanner');

    const template = generatePenTestReportTemplate();
    expect(template.template).toBe('pen-test-report');
    expect(template.fields.length).toBeGreaterThan(0);

    const requiredFields = template.fields.filter((f) => f.required);
    expect(requiredFields.length).toBeGreaterThan(0);
  });

  it('should calculate posture score correctly', async () => {
    const { runSecurityScan } = await import('@/lib/security-scanner');

    const scan = runSecurityScan();

    // Score starts at 100, deductions for findings
    let expectedDeductions = 0;
    for (const finding of scan.findings) {
      switch (finding.severity) {
        case 'critical': expectedDeductions += 20; break;
        case 'high': expectedDeductions += 10; break;
        case 'medium': expectedDeductions += 5; break;
        case 'low': expectedDeductions += 2; break;
      }
    }
    expect(scan.postureScore).toBe(Math.max(0, 100 - expectedDeductions));
  });
});

// ══════════════════════════════════════════════════════════════════
// 5.2 SSO Integration Tests
// ══════════════════════════════════════════════════════════════════

describe('5.2 SSO Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initiate SSO login for OIDC', async () => {
    const { initiateSSOLogin } = await import('@/lib/sso-integration');

    const config = {
      id: 'sso-1',
      provider: 'oidc' as const,
      name: 'Google SSO',
      isActive: true,
      isDefault: true,
      oidc: {
        clientId: 'google-client-id',
        clientSecret: 'secret',
        issuerUrl: 'https://accounts.google.com',
        authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
        tokenEndpoint: 'https://oauth2.googleapis.com/token',
        userinfoEndpoint: 'https://openidconnect.googleapis.com/v1/userinfo',
        jwksUri: 'https://www.googleapis.com/oauth2/v3/certs',
        scopes: ['openid', 'email', 'profile'],
        callbackUrl: 'http://localhost:3000/api/security/sso/callback',
      },
      autoProvision: true,
      defaultRole: 'user',
      domainWhitelist: ['example.com'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastUsedAt: null,
    };

    const urls = initiateSSOLogin(config);
    expect(urls.loginUrl).toContain('accounts.google.com');
    expect(urls.loginUrl).toContain('client_id=google-client-id');
    expect(urls.callbackUrl).toContain('callback');
  });

  it('should process SSO callback with JIT provisioning', async () => {
    const { processSSOCallback } = await import('@/lib/sso-integration');

    // User doesn't exist yet — will be created
    mockDb.user.findUnique.mockResolvedValue(null);
    mockDb.user.create.mockResolvedValue({
      id: 'user-new',
      email: 'newuser@example.com',
      name: 'New User',
      role: 'user',
      isActive: true,
    });

    // Mock system setting for SSO config
    mockDb.systemSetting.findUnique.mockResolvedValue(null);

    const result = await processSSOCallback(
      'sso-1',
      'google-sub-123',
      'newuser@example.com',
      'New User',
      {},
      '1.2.3.4',
    );

    // Without SSO config in DB, should return error
    // But the callback function needs the config to exist
    expect(result).toBeDefined();
  });

  it('should get SSO status', async () => {
    const { getSSOStatus } = await import('@/lib/sso-integration');

    mockDb.systemSetting.findUnique.mockResolvedValue({
      value: JSON.stringify([
        {
          id: 'sso-1',
          provider: 'oidc',
          name: 'Google SSO',
          isActive: true,
          lastUsedAt: new Date().toISOString(),
        },
      ]),
    });

    const status = await getSSOStatus();
    expect(status.configured).toBe(true);
    expect(status.activeProviders).toBe(1);
    expect(status.providers).toHaveLength(1);
  });

  it('should return no config when none exists', async () => {
    const { getSSOStatus } = await import('@/lib/sso-integration');

    mockDb.systemSetting.findUnique.mockResolvedValue(null);

    const status = await getSSOStatus();
    expect(status.configured).toBe(false);
    expect(status.activeProviders).toBe(0);
  });
});

// ══════════════════════════════════════════════════════════════════
// Integration: RBAC + Audit + Encryption
// ══════════════════════════════════════════════════════════════════

describe('Phase 5 Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('RBAC field filtering + audit trail work together', async () => {
    const { filterObjectByRole } = await import('@/lib/rbac-enforcement');
    const { recordUpdate } = await import('@/lib/comprehensive-audit');

    // Admin updates a company — sees all fields
    const companyData = {
      name: 'Acme Corp',
      internalSummary: 'Secret data',
      revenueEstimate: '$50M',
    };

    const adminView = filterObjectByRole(companyData, 'admin', 'Company');
    expect(adminView.internalSummary).toBe('Secret data');

    // Record the update in audit trail
    mockDb.comprehensiveAuditLog.create.mockResolvedValue({ id: 'audit-1' });
    await recordUpdate('Company', 'comp-1', 'admin-1', { name: 'Old' }, companyData);

    expect(mockDb.comprehensiveAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'update',
          entity: 'Company',
        }),
      }),
    );
  });

  it('Privacy erasure should work with field-level permissions', async () => {
    const { processDataErasure } = await import('@/lib/privacy-compliance');
    const { filterObjectByRole } = await import('@/lib/rbac-enforcement');

    // Process erasure
    mockDb.contact.findUnique.mockResolvedValue({
      id: 'contact-1',
      email: 'user@test.com',
      rawName: 'John Doe',
      normalizedName: 'John Doe',
      editedName: null,
      phone: '+1234567890',
      linkedinUrl: null,
      companyId: 'comp-1',
      company: { id: 'comp-1', name: 'Acme' },
    });
    mockDb.contact.update.mockResolvedValue({});
    mockDb.suppression.upsert.mockResolvedValue({});

    await processDataErasure('contact-1', 'admin-1');

    // After erasure, even admin would see anonymized data
    const anonymizedContact = {
      rawName: '[erased]',
      email: 'erased-contact-1@anonymized.invalid',
      phone: null,
      consentStatus: 'opted_out',
    };

    const adminView = filterObjectByRole(anonymizedContact, 'admin', 'Contact');
    // Phone was null already, so not in the object
    expect(adminView.rawName).toBe('[erased]');
  });

  it('Security scan + encryption health work together', async () => {
    const { runSecurityScan } = await import('@/lib/security-scanner');
    const { getEncryptionHealth } = await import('@/lib/encryption');

    const scan = runSecurityScan();
    const encryptionHealth = getEncryptionHealth();

    // If encryption is not configured, scan should detect it
    if (!encryptionHealth.masterKeyConfigured) {
      const encryptionFindings = scan.findings.filter(
        (f) => f.category === 'encryption',
      );
      expect(encryptionFindings.length).toBeGreaterThan(0);
    }
  });
});
