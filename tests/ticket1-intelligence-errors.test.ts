/**
 * Ticket 1 — Integration Test: Intelligence API Structured Error Responses
 *
 * Tests that all Intelligence API endpoints return structured errors
 * matching the Ticket 1 exit-criteria format: { error: string, code: string, details?: object }
 *
 * Also tests:
 *   - Correlation ID propagation (x-correlation-id header)
 *   - Sensitive data scrubbing (no passwords/tokens/connections in errors)
 */

import { describe, it, expect } from 'vitest';
import { scrubError, SENSITIVE_PATTERNS } from '@/lib/intelligence-api/handler';
import { createErrorResponse, type IntelligenceErrorResponse } from '@/lib/intelligence-api/middleware';
import { IntelligenceErrors } from '@/lib/intelligence-api/types';

// ═══════════════════════════════════════════════════════════════════════════
//  Error response format: { error: string, code: string, details?: object }
// ═══════════════════════════════════════════════════════════════════════════

describe('Intelligence API Error Response Format', () => {
  /**
   * Helper: validate that an error response matches the Ticket 1 contract.
   * Contract: { error: string, code: string, details?: object }
   */
  function validateErrorContract(body: IntelligenceErrorResponse): void {
    // Must have top-level error string
    expect(typeof body.error).toBe('string');
    expect(body.error.length).toBeGreaterThan(0);

    // Must have top-level code string
    expect(typeof body.code).toBe('string');
    expect(body.code.length).toBeGreaterThan(0);

    // Must NOT have old envelope fields
    expect('success' in body).toBe(false);
    expect('data' in body).toBe(false);
    expect('meta' in body).toBe(false);

    // details is optional; if present, must be an object
    if (body.details !== undefined) {
      expect(typeof body.details).toBe('object');
      expect(Array.isArray(body.details)).toBe(false);
    }
  }

  it('company endpoint returns { error, code, details } format', () => {
    const errorBody = createErrorResponse('company', '', 'Company ID is required', IntelligenceErrors.MISSING_COMPANY_ID, 5);
    validateErrorContract(errorBody);
    expect(errorBody.code).toBe('MISSING_COMPANY_ID');
  });

  it('reasoning endpoint returns { error, code, details } format', () => {
    const errorBody = createErrorResponse('reasoning', '', 'Company not found', IntelligenceErrors.COMPANY_NOT_FOUND, 10);
    validateErrorContract(errorBody);
    expect(errorBody.error).toBe('Company not found');
    expect(errorBody.code).toBe('COMPANY_NOT_FOUND');
  });

  it('opportunity endpoint includes durationMs in details when provided', () => {
    const errorBody = createErrorResponse('opportunity', 'test-id', 'Engine timeout', IntelligenceErrors.ENGINE_TIMEOUT, 2500);
    validateErrorContract(errorBody);
    expect(errorBody.details).toBeDefined();
    expect((errorBody.details as Record<string, unknown>).companyId).toBe('test-id');
    expect((errorBody.details as Record<string, unknown>).durationMs).toBe(2500);
  });

  it('action endpoint has no details when only companyId is provided', () => {
    const errorBody = createErrorResponse('action', '', 'Internal error', IntelligenceErrors.INTELLIGENCE_UNAVAILABLE);
    validateErrorContract(errorBody);
    // details should be undefined when only companyId is set (single-key object collapses)
    expect(errorBody.details).toBeUndefined();
  });

  it('conversation endpoint returns { error, code, details } format', () => {
    const errorBody = createErrorResponse('conversation', 'test-id', 'Engine failed', IntelligenceErrors.ENGINE_TIMEOUT, 5000);
    validateErrorContract(errorBody);
    expect(errorBody.code).toBe('ENGINE_TIMEOUT');
  });

  it('mindmap endpoint returns { error, code, details } format', () => {
    const errorBody = createErrorResponse('mindmap', '', 'Company ID is required', IntelligenceErrors.MISSING_COMPANY_ID, 1);
    validateErrorContract(errorBody);
    expect(errorBody.code).toBe('MISSING_COMPANY_ID');
  });

  it('brief endpoint returns { error, code, details } format', () => {
    const errorBody = createErrorResponse('brief', 'brief-id', 'Brief unavailable', IntelligenceErrors.INTELLIGENCE_UNAVAILABLE, 150);
    validateErrorContract(errorBody);
  });

  it('grounding endpoint returns { error, code, details } format', () => {
    const errorBody = createErrorResponse('grounding', 'g-id', 'Grounding failed', IntelligenceErrors.GOVERNANCE_BLOCKED, 300);
    validateErrorContract(errorBody);
    expect(errorBody.code).toBe('GOVERNANCE_BLOCKED');
  });

  it('retrieval endpoint returns { error, code, details } format', () => {
    const errorBody = createErrorResponse('retrieval', 'r-id', 'Retrieval error', IntelligenceErrors.INTELLIGENCE_UNAVAILABLE, 200);
    validateErrorContract(errorBody);
  });

  it('knowledge endpoint returns { error, code, details } format', () => {
    const errorBody = createErrorResponse('knowledge', 'k-id', 'Knowledge unavailable', IntelligenceErrors.INTELLIGENCE_UNAVAILABLE, 100);
    validateErrorContract(errorBody);
  });

  it('error with includes populates details.requestedIncludes', () => {
    const errorBody = createErrorResponse(
      'company', 'c-id', 'Test', IntelligenceErrors.INVALID_INCLUDE, 10,
      new Set(['signals', 'scores'] as any),
    );
    validateErrorContract(errorBody);
    expect(errorBody.details).toBeDefined();
    expect((errorBody.details as Record<string, unknown>).requestedIncludes).toEqual(['signals', 'scores']);
  });

  it('error without includes has no requestedIncludes in details', () => {
    const errorBody = createErrorResponse('company', '', 'Test', 'MISSING_COMPANY_ID', 0, new Set());
    validateErrorContract(errorBody);
    expect(errorBody.details).toBeUndefined();
  });

  it('uses default code INTELLIGENCE_UNAVAILABLE when none provided', () => {
    const errorBody = createErrorResponse('company', '', 'Some error');
    expect(errorBody.code).toBe('INTELLIGENCE_UNAVAILABLE');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Sensitive data scrubbing
// ═══════════════════════════════════════════════════════════════════════════

describe('Sensitive data scrubbing', () => {
  it('scrubs password from error messages', () => {
    expect(scrubError('Error: password=supersecret123')).not.toContain('supersecret123');
    expect(scrubError('Error: password=supersecret123')).toContain('[REDACTED]');
  });

  it('scrubs API keys from error messages', () => {
    expect(scrubError('Failed with api_key=sk-12345')).not.toContain('sk-12345');
    expect(scrubError('Failed with api_key=sk-12345')).toContain('[REDACTED]');
  });

  it('scrubs PostgreSQL connection strings', () => {
    expect(scrubError('Connection to postgresql://user:pass@host:5432/db failed'))
      .not.toContain('postgresql://');
    expect(scrubError('Connection to postgresql://user:pass@host:5432/db failed'))
      .toContain('[REDACTED]');
  });

  it('scrubs Bearer tokens', () => {
    expect(scrubError('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload'))
      .not.toContain('eyJhbGciOiJIUzI1NiJ9');
    expect(scrubError('Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.payload'))
      .toContain('[REDACTED]');
  });

  it('scrubs database URLs', () => {
    expect(scrubError('database_url=postgres://admin:secret@db.example.com:5432/prod'))
      .not.toContain('postgres://');
  });

  it('scrubs secrets', () => {
    expect(scrubError('Error with secret=my-secret-value')).not.toContain('my-secret-value');
  });

  it('scrubs tokens', () => {
    expect(scrubError('token=github_pat_abc123xyz')).not.toContain('github_pat_abc123xyz');
  });

  it('truncates long error messages to 500 chars', () => {
    const longMsg = 'A'.repeat(600);
    const result = scrubError(longMsg);
    expect(result.length).toBeLessThanOrEqual(504); // 500 + '...'
    expect(result).toContain('...');
  });

  it('does not modify safe error messages', () => {
    const safeMsg = 'Company not found';
    expect(scrubError(safeMsg)).toBe(safeMsg);
  });

  it('all SENSITIVE_PATTERNS are regex patterns', () => {
    for (const pattern of SENSITIVE_PATTERNS) {
      expect(pattern).toBeInstanceOf(RegExp);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Correlation ID propagation
// ═══════════════════════════════════════════════════════════════════════════

describe('Correlation ID propagation', () => {
  it('generates correlation ID header', async () => {
    const { getCorrelationId, createResponseHeaders, CORRELATION_HEADER } = await import('@/lib/correlation-id');

    // Mock request with no correlation ID
    const mockRequest = new Request('http://localhost/api/intelligence/company/123', {
      headers: {},
    });
    const cid = getCorrelationId(mockRequest);
    expect(typeof cid).toBe('string');
    expect(cid.length).toBeGreaterThan(0);

    // Headers should contain the correlation ID
    const headers = createResponseHeaders(cid);
    expect(headers[CORRELATION_HEADER]).toBe(cid);
  });

  it('preserves existing correlation ID from request', async () => {
    const { getCorrelationId, CORRELATION_HEADER } = await import('@/lib/correlation-id');

    const existingId = 'trace-12345-abcde';
    const mockRequest = new Request('http://localhost/api/intelligence/company/123', {
      headers: { [CORRELATION_HEADER]: existingId },
    });
    const cid = getCorrelationId(mockRequest);
    expect(cid).toBe(existingId);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  Error code constants
// ═══════════════════════════════════════════════════════════════════════════

describe('Intelligence error codes', () => {
  it('all expected error codes are defined', async () => {
    const { IntelligenceErrors } = await import('@/lib/intelligence-api/types');

    expect(IntelligenceErrors.COMPANY_NOT_FOUND).toBe('COMPANY_NOT_FOUND');
    expect(IntelligenceErrors.MISSING_COMPANY_ID).toBe('MISSING_COMPANY_ID');
    expect(IntelligenceErrors.INTELLIGENCE_UNAVAILABLE).toBe('INTELLIGENCE_UNAVAILABLE');
    expect(IntelligenceErrors.ENGINE_TIMEOUT).toBe('ENGINE_TIMEOUT');
    expect(IntelligenceErrors.GOVERNANCE_BLOCKED).toBe('GOVERNANCE_BLOCKED');
    expect(IntelligenceErrors.INVALID_INCLUDE).toBe('INVALID_INCLUDE');
    expect(IntelligenceErrors.RATE_LIMITED).toBe('RATE_LIMITED');
  });
});
