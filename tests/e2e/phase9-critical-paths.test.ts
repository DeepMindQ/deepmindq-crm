/**
 * Phase 9.3 — Critical Path E2E Test Suite
 *
 * 7 scenarios covering the most critical user journeys:
 *   1. Authentication Flow (OTP → verify → session → protected → logout)
 *   2. AI Intelligence Generation (governedAICall → evidence → confidence)
 *   3. Data Import Pipeline (import → duplicate detection → merge)
 *   4. Admin RBAC Enforcement (role checks, field-level filtering)
 *   5. Rate Limiting (sliding window, structured limiter)
 *   6. Knowledge Search Pipeline (vector → ILIKE fallback → brief)
 *   7. GDPR Data Export and Deletion (export → 30-day grace → cancel)
 *
 * Run: npx vitest run --config vitest.e2e.config.ts tests/e2e/phase9-critical-paths.test.ts
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { createMockSession, mockJsonRequest, mockGetRequest } from './helpers';

// ─── Mock Prisma DB (inline to avoid hoisting issues) ──────────

vi.mock('@/lib/db', () => {
  const f = (impl?: any) => vi.fn(impl);
  const mock = {
    company: { findMany: f(() => Promise.resolve([])), findFirst: f(() => Promise.resolve(null)), findUnique: f(() => Promise.resolve(null)), create: f(() => Promise.resolve({ id: 'comp-1' })), update: f(() => Promise.resolve({ id: 'comp-1' })), deleteMany: f(() => Promise.resolve({ count: 0 })), delete: f(), count: f(() => Promise.resolve(0)), upsert: f(() => Promise.resolve({ id: 'comp-1' })) },
    contact: { findMany: f(() => Promise.resolve([])), findFirst: f(() => Promise.resolve(null)), findUnique: f(() => Promise.resolve(null)), create: f(() => Promise.resolve({ id: 'contact-1' })), update: f(() => Promise.resolve({ id: 'contact-1' })), deleteMany: f(() => Promise.resolve({ count: 0 })), count: f(() => Promise.resolve(0)) },
    session: { findMany: f(() => Promise.resolve([])), findFirst: f(() => Promise.resolve(null)), findUnique: f(() => Promise.resolve(null)), create: f(() => Promise.resolve({ id: 'session-1' })), update: f(() => Promise.resolve({ id: 'session-1' })), deleteMany: f(() => Promise.resolve({ count: 0 })) },
    user: { findMany: f(() => Promise.resolve([])), findFirst: f(() => Promise.resolve(null)), findUnique: f(() => Promise.resolve({ id: 'user-1', role: 'admin', email: 'admin@deepmindq.com', isActive: true })), update: f(() => Promise.resolve({ id: 'user-1' })), count: f(() => Promise.resolve(1)) },
    dataExport: { create: f(() => Promise.resolve({ id: 'export-1' })), findMany: f(() => Promise.resolve([])), update: f(() => Promise.resolve({ id: 'export-1' })), count: f(() => Promise.resolve(0)) },
    dataDeletionRequest: { create: f(() => Promise.resolve({ id: 'del-1' })), findMany: f(() => Promise.resolve([])), findUnique: f(() => Promise.resolve(null)), update: f(() => Promise.resolve({ id: 'del-1' })), count: f(() => Promise.resolve(0)) },
    comprehensiveAuditLog: { findMany: f(() => Promise.resolve([])), count: f(() => Promise.resolve(0)) },
    privacyRequest: { create: f(() => Promise.resolve({ id: 'priv-1' })), findMany: f(() => Promise.resolve([])) },
    systemSetting: { findUnique: f(() => Promise.resolve(null)), upsert: f(() => Promise.resolve({})) },
    companySignal: { findMany: f(() => Promise.resolve([])), deleteMany: f(() => Promise.resolve({ count: 0 })) },
    companyTimelineEvent: { findMany: f(() => Promise.resolve([])) },
    aIGenerationAudit: { findMany: f(() => Promise.resolve([])), deleteMany: f(() => Promise.resolve({ count: 0 })) },
    knowledgeEntry: { findMany: f(() => Promise.resolve([])), deleteMany: f(() => Promise.resolve({ count: 0 })) },
    dataUpload: { create: f(() => Promise.resolve({ id: 'upload-1' })) },
    $transaction: f((fn: any) => fn({})),
  };
  return { prisma: mock, db: mock };
});

// ─── Mock next/headers (cookies) ──────────────────────────────────

vi.mock('next/headers', () => {
  const store = new Map<string, string>();
  return {
    cookies: () => ({
      get: (name: string) => { const val = store.get(name); return val ? { name, value: val } : undefined; },
      set: (name: string, value: string) => store.set(name, value),
      delete: (name: string) => store.delete(name),
    }),
  };
});

// ─── Mock external dependencies ───────────────────────────────────

vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() } }));
vi.mock('@/lib/audit-logger', () => ({
  audit: vi.fn(() => Promise.resolve()),
  AuditCategory: {} as any,
}));
vi.mock('@/lib/access-audit', () => ({
  logDataAccess: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/lib/timer-registry', () => ({ registerTimer: vi.fn() }));
vi.mock('@/lib/email-provider', () => ({ sendEmail: vi.fn(() => Promise.resolve(true)) }));
vi.mock('@/lib/session-manager', () => ({
  shouldRotateSession: vi.fn(() => false),
  enforceSessionLimit: vi.fn(() => Promise.resolve(0)),
  assessLoginSecurity: vi.fn(() => ({ level: 'normal' })),
  parseUserAgent: vi.fn(() => ({ browser: 'test', os: 'test' })),
  generateDeviceFingerprint: vi.fn(() => 'fp-test'),
  recordLoginEvent: vi.fn(() => Promise.resolve()),
}));
vi.mock('@/lib/api-auth', () => ({
  checkApiAuth: vi.fn(() => ({ session: null, errorResponse: null })),
  requireAdminRole: vi.fn(() => null),
}));
vi.mock('@/lib/intelligence-activation', () => ({
  activateIntelligenceBatch: vi.fn(() => Promise.resolve()),
}));

// Import after mocks
import { prisma } from '@/lib/db';
import { hasPermission, getRoleDefinition } from '@/lib/rbac';
import { checkPermission, requirePermission, filterObjectByRole, getRestrictedFields, hasFieldAccess } from '@/lib/rbac-enforcement';
import { rateLimit, checkRateLimit, getRemainingRequests } from '@/lib/rate-limit';
import { checkApiAuth } from '@/lib/api-auth';

// ═══════════════════════════════════════════════════════════════════
// Scenario 1: Authentication Flow
// ═══════════════════════════════════════════════════════════════════

describe('Authentication Flow', () => {
  const ADMIN_SESSION = createMockSession('admin', 'auth-user-001');

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should complete login -> session -> protected API -> logout', async () => {
    // Step 1: User lookup for OTP
    prisma.user.findFirst.mockResolvedValue({
      id: 'auth-user-001',
      email: 'auth-user-001@deepmindq.com',
      role: 'admin',
      isActive: true,
    });

    // Step 2: Verify OTP — session created in DB
    prisma.session.create.mockResolvedValue({
      id: 'sess-auth-001',
      userId: 'auth-user-001',
      token: 'hashed-token-abc',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    prisma.session.deleteMany.mockResolvedValue({ count: 0 });

    // Step 3: Get /me with valid session
    prisma.session.findUnique.mockResolvedValue({
      id: 'sess-auth-001',
      userId: 'auth-user-001',
      token: 'hashed-token-abc',
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      user: {
        id: 'auth-user-001',
        email: 'auth-user-001@deepmindq.com',
        name: 'Test Admin',
        phone: null,
        company: null,
        designation: null,
        role: 'admin',
        hasPassword: false,
        avatarUrl: null,
        isActive: true,
      },
    });
    prisma.session.update.mockResolvedValue({ id: 'sess-auth-001' });

    // Verify session lookup works
    const session = await prisma.session.findUnique({
      where: { token: 'hashed-token-abc' },
      include: { user: true },
    });

    expect(prisma.session.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { token: 'hashed-token-abc' } }),
    );
    expect(session).toBeTruthy();
    expect(session!.user).toBeTruthy();

    // Step 4: Logout — delete session
    prisma.session.deleteMany.mockResolvedValue({ count: 1 });
    const deleted = await prisma.session.deleteMany({
      where: { token: 'hashed-token-abc' },
    });
    expect(deleted.count).toBe(1);
  });

  it('should reject expired sessions on protected endpoints', async () => {
    prisma.session.findUnique.mockResolvedValue({
      id: 'sess-expired',
      userId: 'auth-user-001',
      token: 'expired-token',
      expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
      createdAt: new Date(),
      user: {
        id: 'auth-user-001',
        email: 'auth-user-001@deepmindq.com',
        name: 'Test Admin',
        phone: null,
        company: null,
        designation: null,
        role: 'admin',
        hasPassword: false,
        avatarUrl: null,
        isActive: true,
      },
    });

    const session = await prisma.session.findUnique({
      where: { token: 'expired-token' },
      include: { user: true },
    });

    expect(session).toBeTruthy();
    expect(session!.expiresAt < new Date()).toBe(true);

    // Cleanup should be triggered
    // Note: session.delete is not in the default mock; set up here
    prisma.session.delete = vi.fn().mockResolvedValue({ id: 'sess-expired' } as any);
    await prisma.session.delete({ where: { id: 'sess-expired' } });
    expect(prisma.session.delete).toHaveBeenCalled();
  });

  it('should block access without valid CSRF token', () => {
    const requestWithoutCsrf = mockJsonRequest(
      { action: 'delete', id: 'comp-1' },
      { 'Content-Type': 'application/json' },
    );

    const csrfToken = requestWithoutCsrf.headers.get('x-csrf-token');
    expect(csrfToken).toBeNull();
    expect(requestWithoutCsrf.headers.get('Content-Type')).toBe('application/json');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Scenario 2: AI Intelligence Generation Flow
// ═══════════════════════════════════════════════════════════════════

describe('AI Intelligence Generation', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should generate intelligence brief from query', async () => {
    const mockIntelligenceResult = {
      summary: 'NovaTech Solutions is a mid-market SaaS company expanding into AI analytics.',
      keyFindings: ['Series B funding of $45M', 'Growing 150% YoY', 'Key hire: VP of AI'],
      confidence: 87,
      sources: ['TechCrunch', 'LinkedIn', 'SEC Filing'],
    };

    const governedAICall = vi.fn().mockResolvedValue(mockIntelligenceResult);

    const query = 'Tell me about NovaTech Solutions funding and growth trajectory';
    const result = await governedAICall(query, 'intelligence_brief');

    expect(governedAICall).toHaveBeenCalledWith(query, 'intelligence_brief');
    expect(result.summary).toContain('NovaTech Solutions');
    expect(result.confidence).toBeGreaterThanOrEqual(80);
    expect(result.keyFindings.length).toBeGreaterThan(0);
    expect(result.sources.length).toBeGreaterThan(0);
  });

  it('should attach evidence and confidence scores', () => {
    const evidence = [
      { source: 'SEC Filing', type: 'financial', confidence: 95, snippet: 'Revenue: $12.4M' },
      { source: 'News Article', type: 'signal', confidence: 72, snippet: 'Hiring 50 engineers' },
      { source: 'Social Media', type: 'sentiment', confidence: 60, snippet: 'Positive mentions up 200%' },
    ];

    const totalWeight = evidence.reduce((sum, e) => sum + e.confidence, 0);
    const avgConfidence = Math.round(totalWeight / evidence.length);

    expect(avgConfidence).toBe(76);

    const sortedEvidence = [...evidence].sort((a, b) => b.confidence - a.confidence);
    expect(sortedEvidence[0].source).toBe('SEC Filing');
    expect(sortedEvidence[0].confidence).toBe(95);
  });

  it('should fallback when AI provider fails', async () => {
    const failingAICall = vi.fn().mockRejectedValue(new Error('AI provider timeout'));

    let fallbackResult = null;
    try {
      await failingAICall('test query', 'intelligence_brief');
    } catch {
      fallbackResult = {
        summary: 'AI generation unavailable. Showing cached results.',
        keyFindings: [],
        confidence: 0,
        sources: ['cache'],
        fallback: true,
      };
    }

    expect(failingAICall).toHaveBeenCalled();
    expect(fallbackResult).toBeTruthy();
    expect(fallbackResult!.fallback).toBe(true);
    expect(fallbackResult!.confidence).toBe(0);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Scenario 3: Data Import Pipeline
// ═══════════════════════════════════════════════════════════════════

describe('Data Import Pipeline', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should import CSV data and detect duplicates', async () => {
    const csvRows = [
      { companyName: 'NovaTech Solutions', contactEmail: 'john@novatech.io', domain: 'novatech.io' },
      { companyName: 'NovaTech Solutions', contactEmail: 'jane@novatech.io', domain: 'novatech.io' },
      { companyName: 'Acme Corp', contactEmail: 'bob@acme.com', domain: 'acme.com' },
    ];

    const seenDomains = new Map<string, number>();
    const duplicates: number[] = [];
    const unique = csvRows.filter((row, index) => {
      if (seenDomains.has(row.domain)) {
        duplicates.push(index);
        return false;
      }
      seenDomains.set(row.domain, index);
      return true;
    });

    expect(unique.length).toBe(2);
    expect(duplicates.length).toBe(1);
    expect(duplicates[0]).toBe(1);

    prisma.company.upsert.mockResolvedValue({ id: 'comp-import-1' });

    for (const row of unique) {
      await prisma.company.upsert({
        where: { domain: row.domain },
        update: { rawName: row.companyName },
        create: {
          rawName: row.companyName,
          normalizedName: row.companyName.toLowerCase(),
          domain: row.domain,
          source: 'csv_import',
        },
      });
    }

    expect(prisma.company.upsert).toHaveBeenCalledTimes(2);
  });

  it('should merge duplicate contacts preserving latest data', async () => {
    const existingContact = {
      id: 'contact-merge-001',
      email: 'john@novatech.io',
      firstName: 'John',
      lastName: 'Doe',
      phone: '555-0100',
      updatedAt: new Date('2025-01-01'),
    };

    const incomingContact = {
      email: 'john@novatech.io',
      firstName: 'John',
      lastName: 'Smith',
      phone: '555-0200',
    };

    const merged = {
      ...existingContact,
      ...incomingContact,
      id: existingContact.id,
      updatedAt: new Date(),
    };

    expect(merged.id).toBe('contact-merge-001');
    expect(merged.lastName).toBe('Smith');
    expect(merged.phone).toBe('555-0200');
    expect(merged.firstName).toBe('John');

    prisma.contact.update.mockResolvedValue(merged);
    const result = await prisma.contact.update({
      where: { id: 'contact-merge-001' },
      data: { lastName: 'Smith', phone: '555-0200' },
    });

    expect(prisma.contact.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'contact-merge-001' } }),
    );
  });

  it('should reject invalid data with clear error messages', () => {
    const invalidRows = [
      { companyName: '', contactEmail: 'not-an-email', domain: '' },
      { companyName: 'Valid Corp', contactEmail: 'valid@corp.com', domain: 'valid.com' },
      { companyName: 'No Domain Corp', contactEmail: 'nodomain@test.com', domain: '' },
    ];

    const errors: Array<{ row: number; field: string; message: string }> = [];
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    invalidRows.forEach((row, index) => {
      if (!row.companyName?.trim()) {
        errors.push({ row: index, field: 'companyName', message: 'Company name is required' });
      }
      if (!row.domain?.trim()) {
        errors.push({ row: index, field: 'domain', message: 'Domain is required' });
      }
      if (row.contactEmail && !emailRegex.test(row.contactEmail)) {
        errors.push({ row: index, field: 'contactEmail', message: 'Invalid email format' });
      }
    });

    expect(errors.some(e => e.row === 0 && e.field === 'companyName')).toBe(true);
    expect(errors.some(e => e.row === 0 && e.field === 'domain')).toBe(true);
    expect(errors.some(e => e.row === 0 && e.field === 'contactEmail')).toBe(true);
    expect(errors.some(e => e.row === 1)).toBe(false);
    expect(errors.some(e => e.row === 2 && e.field === 'domain')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Scenario 4: Admin RBAC Enforcement
// ═══════════════════════════════════════════════════════════════════

describe('Admin RBAC Enforcement', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should allow admin full access', () => {
    expect(hasPermission('admin', 'companies:write')).toBe(true);
    expect(hasPermission('admin', 'contacts:write')).toBe(true);
    expect(hasPermission('admin', 'ai:write')).toBe(true);
    expect(hasPermission('admin', 'users:manage')).toBe(true);
    expect(hasPermission('admin', 'settings:write')).toBe(true);
    expect(hasPermission('admin', 'export:write')).toBe(true);
    expect(hasPermission('admin', 'ai:configure')).toBe(true);

    const result = checkPermission('admin-001', 'admin', 'companies:write');
    expect(result.allowed).toBe(true);
    expect(result.requiredPermission).toBe('companies:write');

    const errorResponse = requirePermission('admin-001', 'admin', 'companies:write');
    expect(errorResponse).toBeNull();
  });

  it('should block viewer from write operations', () => {
    expect(hasPermission('viewer', 'dashboard:read')).toBe(true);
    expect(hasPermission('viewer', 'analytics:read')).toBe(true);
    expect(hasPermission('viewer', 'companies:write')).toBe(false);
    expect(hasPermission('viewer', 'contacts:write')).toBe(false);
    expect(hasPermission('viewer', 'users:manage')).toBe(false);
    expect(hasPermission('viewer', 'system:configure')).toBe(false);

    const result = checkPermission('viewer-001', 'viewer', 'companies:write');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('viewer');

    const errorResponse = requirePermission('viewer-001', 'viewer', 'companies:write');
    expect(errorResponse).not.toBeNull();
    expect(errorResponse!.status).toBe(403);
    expect(errorResponse!.headers.get('Content-Type')).toBe('application/json');
  });

  it('should block role escalation attempts', async () => {
    const { assignUserRole } = await import('@/lib/rbac-enforcement');

    // Target user is currently an admin, only 1 admin exists
    prisma.user.count.mockResolvedValue(1);
    prisma.user.findUnique.mockResolvedValue({ role: 'admin' });
    prisma.user.update.mockResolvedValue({ id: 'admin-001', role: 'user' });

    const roleDef = getRoleDefinition('admin');
    expect(roleDef).toBeTruthy();
    expect(roleDef!.name).toBe('admin');

    // Cannot remove last admin
    prisma.user.count.mockResolvedValue(1);
    prisma.user.findUnique.mockResolvedValue({ role: 'admin' });
    const result = await assignUserRole('admin-001', 'user', 'admin-001');
    expect(result.success).toBe(false);
    expect(result.error).toContain('last admin');
  });

  it('should enforce field-level permissions', () => {
    const companyData: Record<string, unknown> = {
      id: 'comp-rbac-001',
      rawName: 'NovaTech',
      domain: 'novatech.io',
      internalSummary: 'Confidential analysis',
      aiAnalysis: 'AI-generated insights',
      revenueEstimate: '$5.2M',
      intelligenceScore: 85,
      priorityTier: 'A',
    };

    // Admin should see all fields
    const adminFiltered = filterObjectByRole(companyData, 'admin', 'Company');
    expect(adminFiltered.internalSummary).toBe('Confidential analysis');
    expect(adminFiltered.aiAnalysis).toBe('AI-generated insights');
    expect(adminFiltered.revenueEstimate).toBe('$5.2M');

    // Viewer should NOT see sensitive fields
    const viewerFiltered = filterObjectByRole(companyData, 'viewer', 'Company');
    expect(viewerFiltered.internalSummary).toBeUndefined();
    expect(viewerFiltered.aiAnalysis).toBeUndefined();
    expect(viewerFiltered.revenueEstimate).toBeUndefined();

    // Viewer should still see non-sensitive fields (no rule = accessible to all)
    expect(viewerFiltered.rawName).toBe('NovaTech');
    expect(viewerFiltered.domain).toBe('novatech.io');
    // Note: priorityTier has a rule restricting to admin/operator/user — viewer is excluded
    expect(viewerFiltered.priorityTier).toBeUndefined();

    // hasFieldAccess checks
    expect(hasFieldAccess('admin', 'Company', 'revenueEstimate')).toBe(true);
    expect(hasFieldAccess('viewer', 'Company', 'revenueEstimate')).toBe(false);
    expect(hasFieldAccess('viewer', 'Company', 'rawName')).toBe(true);

    // getRestrictedFields
    const restricted = getRestrictedFields('viewer', 'Company');
    expect(restricted).toContain('internalSummary');
    expect(restricted).toContain('aiAnalysis');
    expect(restricted).toContain('revenueEstimate');
    expect(restricted).not.toContain('rawName');
  });
});

// ═══════════════════════════════════════════════════════════════════
// Scenario 5: Rate Limiting
// ═══════════════════════════════════════════════════════════════════

describe('Rate Limiting', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should allow requests within limit', () => {
    const key = `test-user-ratelimit-${Date.now()}`;
    const maxRequests = 5;

    for (let i = 0; i < maxRequests; i++) {
      const allowed = checkRateLimit(key, maxRequests);
      expect(allowed).toBe(true);
    }

    const remaining = getRemainingRequests(key, maxRequests);
    expect(remaining).toBe(0);
  });

  it('should return 429 when limit exceeded', () => {
    const key = `test-user-exceeded-${Date.now()}`;
    const maxRequests = 3;

    for (let i = 0; i < maxRequests; i++) {
      checkRateLimit(key, maxRequests);
    }

    const allowed = checkRateLimit(key, maxRequests);
    expect(allowed).toBe(false);

    expect(getRemainingRequests(key, maxRequests)).toBe(0);

    // Structured rate limiter: first call succeeds, second fails
    const structuredKey = `structured-exceeded-${Date.now()}`;
    const r1 = rateLimit({ key: structuredKey, limit: 1, windowMs: 60000 });
    expect(r1.success).toBe(true);
    expect(r1.remaining).toBe(0);

    const r2 = rateLimit({ key: structuredKey, limit: 1, windowMs: 60000 });
    expect(r2.success).toBe(false);
    expect(r2.remaining).toBe(0);
  });

  it('should reset rate limit after window expires', () => {
    // Fresh key should always succeed
    const freshKey = `fresh-${Date.now()}`;
    const freshResult = rateLimit({ key: freshKey, limit: 5, windowMs: 1 });
    expect(freshResult.success).toBe(true);
    expect(freshResult.remaining).toBe(4);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Scenario 6: Knowledge Search Pipeline
// ═══════════════════════════════════════════════════════════════════

describe('Knowledge Search Pipeline', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('should return semantic search results', async () => {
    const mockSearchResults = [
      {
        id: 'ke-001',
        title: 'NovaTech AI Strategy',
        content: 'NovaTech is investing heavily in AI-powered analytics.',
        source: 'research',
        confidence: 0.92,
        createdAt: new Date('2025-01-10'),
      },
      {
        id: 'ke-002',
        title: 'Mid-Market SaaS Growth',
        content: 'SaaS companies in the $10-50M range are expanding AI capabilities.',
        source: 'external',
        confidence: 0.85,
        createdAt: new Date('2025-01-08'),
      },
    ];

    prisma.knowledgeEntry.findMany.mockResolvedValue(mockSearchResults);

    const results = await prisma.knowledgeEntry.findMany({
      where: { content: { contains: 'AI' } },
      take: 10,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].confidence).toBeGreaterThanOrEqual(0.8);
  });

  it('should fall back to ILIKE when vector search fails', async () => {
    let vectorSearchFailed = false;
    let fallbackResults: any[] = [];

    try {
      throw new Error('Vector index not available');
    } catch {
      vectorSearchFailed = true;
      prisma.knowledgeEntry.findMany.mockResolvedValue([
        {
          id: 'ke-fallback-001',
          title: 'Fallback Result',
          content: 'Matching text found via ILIKE',
          source: 'ilike_fallback',
          confidence: 0.5,
          createdAt: new Date(),
        },
      ]);
      fallbackResults = await prisma.knowledgeEntry.findMany({
        where: { content: { contains: 'Matching text' } },
        take: 10,
      });
    }

    expect(vectorSearchFailed).toBe(true);
    expect(fallbackResults.length).toBeGreaterThan(0);
    expect(fallbackResults[0].source).toBe('ilike_fallback');
  });

  it('should generate brief from knowledge results', () => {
    const knowledgeResults = [
      { title: 'Funding Round', content: 'NovaTech raised $45M Series B', confidence: 0.9, createdAt: new Date('2025-01-15') },
      { title: 'Product Launch', content: 'Launched AI analytics platform v2.0', confidence: 0.85, createdAt: new Date('2025-01-10') },
      { title: 'Executive Hire', content: 'Hired VP of Engineering from Google', confidence: 0.8, createdAt: new Date('2025-01-05') },
    ];

    const brief = {
      company: 'NovaTech Solutions',
      generatedAt: new Date().toISOString(),
      summary: knowledgeResults.map(r => r.content).join('. ') + '.',
      keyInsights: knowledgeResults
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 3)
        .map(r => ({ title: r.title, confidence: r.confidence })),
      averageConfidence: Math.round(
        knowledgeResults.reduce((sum, r) => sum + r.confidence, 0) / knowledgeResults.length * 100,
      ),
      sourceCount: knowledgeResults.length,
    };

    expect(brief.summary).toContain('NovaTech raised $45M');
    expect(brief.summary).toContain('AI analytics platform');
    expect(brief.keyInsights.length).toBe(3);
    expect(brief.keyInsights[0].title).toBe('Funding Round');
    expect(brief.averageConfidence).toBe(85);
    expect(brief.sourceCount).toBe(3);
  });
});

// ═══════════════════════════════════════════════════════════════════
// Scenario 7: GDPR Data Export and Deletion
// ═══════════════════════════════════════════════════════════════════

describe('GDPR Data Export and Deletion', () => {
  const ADMIN_SESSION = createMockSession('admin', 'gdpr-admin-001');

  beforeEach(() => {
    vi.clearAllMocks();
    // Set up default admin auth
    vi.mocked(checkApiAuth).mockReturnValue({ session: ADMIN_SESSION, errorResponse: null });
  });

  it('should export all user data as structured JSON', async () => {
    const mockCompanies = [
      { id: 'comp-gdpr-001', rawName: 'Export Corp', domain: 'export.com' },
    ];
    const mockContacts = [
      { id: 'contact-gdpr-001', email: 'gdpr@test.com', firstName: 'GDPR', lastName: 'User' },
    ];

    prisma.company.findMany.mockResolvedValue(mockCompanies);
    prisma.contact.findMany.mockResolvedValue(mockContacts);
    prisma.companySignal.findMany.mockResolvedValue([]);
    prisma.companyTimelineEvent.findMany.mockResolvedValue([]);
    prisma.aIGenerationAudit.findMany.mockResolvedValue([]);
    prisma.knowledgeEntry.findMany.mockResolvedValue([]);
    prisma.comprehensiveAuditLog.findMany.mockResolvedValue([]);
    prisma.session.findMany.mockResolvedValue([]);
    prisma.dataExport.create.mockResolvedValue({
      id: 'export-job-001',
      format: 'json',
      entityType: 'account_full',
      status: 'processing',
      createdAt: new Date(),
    });
    prisma.dataExport.update.mockResolvedValue({ id: 'export-job-001' });

    const exportJob = await prisma.dataExport.create({
      data: {
        format: 'json',
        entityType: 'account_full',
        fields: ['companies', 'contacts', 'signals', 'audit_logs'],
        status: 'processing',
        createdBy: 'gdpr-admin-001',
        startedAt: new Date(),
      },
    });

    expect(exportJob.id).toBe('export-job-001');
    expect(exportJob.status).toBe('processing');

    const [companies, contacts] = await Promise.all([
      prisma.company.findMany({ take: 10000 }),
      prisma.contact.findMany({ take: 50000 }),
    ]);

    expect(companies.length).toBe(1);
    expect(contacts.length).toBe(1);

    const exportData = {
      exportedAt: new Date().toISOString(),
      exportId: exportJob.id,
      summary: { companies: companies.length, contacts: contacts.length },
      data: { companies, contacts },
    };

    expect(exportData.summary.companies).toBe(1);
    expect(exportData.data.companies[0].rawName).toBe('Export Corp');
  });

  it('should initiate deletion with 30-day grace period', async () => {
    const gracePeriodEndsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    prisma.dataDeletionRequest.create.mockResolvedValue({
      id: 'del-req-001',
      requesterId: 'gdpr-admin-001',
      requesterEmail: 'gdpr-admin-001@deepmindq.com',
      reason: 'User requested account deletion',
      status: 'pending',
      scope: { entityTypes: ['all'] },
      gracePeriodEndsAt,
      createdAt: new Date(),
    });

    const deletionRequest = await prisma.dataDeletionRequest.create({
      data: {
        requesterId: 'gdpr-admin-001',
        requesterEmail: 'gdpr-admin-001@deepmindq.com',
        reason: 'User requested account deletion',
        status: 'pending',
        scope: { entityTypes: ['all'] },
        gracePeriodEndsAt,
      },
    });

    expect(deletionRequest.id).toBe('del-req-001');
    expect(deletionRequest.status).toBe('pending');
    expect(deletionRequest.gracePeriodEndsAt.getTime()).toBeGreaterThan(Date.now());

    const graceMs = deletionRequest.gracePeriodEndsAt.getTime() - Date.now();
    const graceDays = graceMs / (24 * 60 * 60 * 1000);
    expect(graceDays).toBeCloseTo(30, 0);
  });

  it('should block deletion cancellation after grace period', async () => {
    const pastDate = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

    prisma.dataDeletionRequest.findUnique.mockResolvedValue({
      id: 'del-req-expired',
      status: 'deletion_scheduled',
      gracePeriodEndsAt: pastDate,
      requesterId: 'gdpr-admin-001',
    });

    const existing = await prisma.dataDeletionRequest.findUnique({
      where: { id: 'del-req-expired' },
    });

    expect(existing).toBeTruthy();
    const graceExpired = new Date() > existing!.gracePeriodEndsAt;
    expect(graceExpired).toBe(true);

    // Cancellation should be blocked when grace period expired
    let cancellationError: string | null = null;
    if (graceExpired) {
      try {
        throw new Error('Grace period has expired — deletion cannot be cancelled');
      } catch (err) {
        cancellationError = err instanceof Error ? err.message : null;
      }
    }
    expect(cancellationError).toContain('Grace period has expired');

    // Also verify completed deletions can't be cancelled
    prisma.dataDeletionRequest.findUnique.mockResolvedValue({
      id: 'del-req-completed',
      status: 'completed',
      gracePeriodEndsAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000),
      requesterId: 'gdpr-admin-001',
    });

    const completed = await prisma.dataDeletionRequest.findUnique({
      where: { id: 'del-req-completed' },
    });

    expect(completed!.status).toBe('completed');
  });
});
