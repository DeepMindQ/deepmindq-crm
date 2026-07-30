/**
 * Ticket 2 — Unit Tests: parseIncludeParams, shouldInclude, shouldIncludeAny
 *
 * Tests the middleware include-parsing utilities in isolation.
 * These functions are the single source of truth for ?include= handling.
 */

import { describe, it, expect } from 'vitest';
import { parseIncludeParams, shouldInclude, shouldIncludeAny } from '@/lib/intelligence-api/middleware';
import type { IntelligenceInclude } from '@/lib/intelligence-api/types';
import { NextRequest } from 'next/server';

// ── Helper ──────────────────────────────────────────────────────────────────

function makeRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'));
}

// ═══════════════════════════════════════════════════════════════════════════
//  parseIncludeParams
// ═══════════════════════════════════════════════════════════════════════════

describe('parseIncludeParams', () => {
  it('returns empty set and null raw when no include param', () => {
    const req = makeRequest('/api/intelligence/company/test-id');
    const { includes, raw } = parseIncludeParams(req);
    expect(includes.size).toBe(0);
    expect(raw).toBeNull();
  });

  it('parses single valid include key', () => {
    const req = makeRequest('/api/intelligence/company/test-id?include=signals');
    const { includes, raw } = parseIncludeParams(req);
    expect(includes.has('signals')).toBe(true);
    expect(includes.size).toBe(1);
    expect(raw).toBe('signals');
  });

  it('parses multiple comma-separated valid include keys', () => {
    const req = makeRequest('/api/intelligence/company/test-id?include=signals,scores,contacts');
    const { includes, raw } = parseIncludeParams(req);
    expect(includes.has('signals')).toBe(true);
    expect(includes.has('scores')).toBe(true);
    expect(includes.has('contacts')).toBe(true);
    expect(includes.size).toBe(3);
    expect(raw).toBe('signals,scores,contacts');
  });

  it('trims whitespace around include values', () => {
    const req = makeRequest('/api/intelligence/company/test-id?include=  signals , scores , contacts  ');
    const { includes, raw } = parseIncludeParams(req);
    expect(includes.has('signals')).toBe(true);
    expect(includes.has('scores')).toBe(true);
    expect(includes.has('contacts')).toBe(true);
    expect(includes.size).toBe(3);
    // raw preserves the original string (URL may normalize trailing spaces)
    expect(raw).not.toBeNull();
    expect(raw!).toContain('signals');
    expect(raw!).toContain('scores');
    expect(raw!).toContain('contacts');
  });

  it('lowercases include values', () => {
    const req = makeRequest('/api/intelligence/company/test-id?include=SignalS,SCORES');
    const { includes, raw } = parseIncludeParams(req);
    expect(includes.has('signals')).toBe(true);
    expect(includes.has('scores')).toBe(true);
    expect(includes.size).toBe(2);
  });

  it('silently drops invalid include keys', () => {
    const req = makeRequest('/api/intelligence/company/test-id?include=notarealkey');
    const { includes, raw } = parseIncludeParams(req);
    expect(includes.size).toBe(0);
    expect(raw).toBe('notarealkey');
  });

  it('handles mix of valid and invalid keys', () => {
    const req = makeRequest('/api/intelligence/company/test-id?include=signals,fakeKey,scores');
    const { includes, raw } = parseIncludeParams(req);
    expect(includes.has('signals')).toBe(true);
    expect(includes.has('scores')).toBe(true);
    expect(includes.has('fakeKey')).toBe(false);
    expect(includes.size).toBe(2);
    expect(raw).toBe('signals,fakeKey,scores');
  });

  it('handles empty string include param', () => {
    const req = makeRequest('/api/intelligence/company/test-id?include=');
    const { includes, raw } = parseIncludeParams(req);
    // Empty value in URLSearchParams → get('include') returns null
    // (URLSearchParams treats empty values as absent)
    expect(includes.size).toBe(0);
    expect(raw).toBeNull();
  });

  it('returns raw string for metadata', () => {
    const req = makeRequest('/api/intelligence/company/test-id?include=signals,timeline');
    const { raw } = parseIncludeParams(req);
    expect(raw).toBe('signals,timeline');
  });

  it('prevents SQL injection patterns in include param', () => {
    const req = makeRequest('/api/intelligence/company/test-id?include=signals;DROP TABLE companies;--');
    const { includes, raw } = parseIncludeParams(req);
    // The SQL injection string is not a valid include key, so it gets dropped
    expect(includes.size).toBe(0);
    // The raw string is preserved for metadata/logging purposes but never executed
    expect(raw).toContain('DROP TABLE');
    // Crucially, no SQL-like keys are in the includes set
    expect(includes.has('signals;DROP TABLE companies;--')).toBe(false);
  });

  it('prevents path traversal patterns in include param', () => {
    const req = makeRequest('/api/intelligence/company/test-id?include=../../../etc/passwd');
    const { includes, raw } = parseIncludeParams(req);
    expect(includes.size).toBe(0);
    // The path traversal string is not a valid include key
    expect(includes.has('../../../etc/passwd')).toBe(false);
  });

  it('prevents NoSQL injection patterns', () => {
    const req = makeRequest('/api/intelligence/company/test-id?include={"$gt":""}');
    const { includes, raw } = parseIncludeParams(req);
    expect(includes.size).toBe(0);
    // The NoSQL injection string is not a valid include key
    expect(includes.has('{"$gt":""}')).toBe(false);
  });

  it('prevents XSS/script injection patterns', () => {
    const req = makeRequest('/api/intelligence/company/test-id?include=<script>alert(1)</script>');
    const { includes, raw } = parseIncludeParams(req);
    expect(includes.size).toBe(0);
    // The XSS string is not a valid include key
    expect(includes.has('<script>alert(1)</script>')).toBe(false);
  });

  it('handles special characters gracefully', () => {
    const req = makeRequest('/api/intelligence/company/test-id?include=signals@#$%^&*()');
    const { includes, raw } = parseIncludeParams(req);
    // 'signals@#$%^&*()' is not a valid include key (only 'signals' is)
    // But the whole thing is treated as one key, not split further
    expect(includes.has('signals@#$%^&*()')).toBe(false);
    expect(includes.size).toBe(0);
  });

  it('handles duplicate include keys (deduplicates)', () => {
    const req = makeRequest('/api/intelligence/company/test-id?include=signals,signals,scores,signals');
    const { includes, raw } = parseIncludeParams(req);
    // Set deduplicates automatically
    expect(includes.has('signals')).toBe(true);
    expect(includes.has('scores')).toBe(true);
    expect(includes.size).toBe(2);
  });

  it('rejects very long include strings', () => {
    // Generate a very long include string with valid keys repeated
    const longStr = Array(1000).fill('signals').join(',');
    const req = makeRequest(`/api/intelligence/company/test-id?include=${longStr}`);
    const { includes, raw } = parseIncludeParams(req);
    // Should not crash; deduplicates to a single entry
    expect(includes.size).toBe(1);
    expect(includes.has('signals')).toBe(true);
    // raw preserves the very long string
    expect(raw).not.toBeNull();
    expect(raw!.length).toBeGreaterThan(1000);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  shouldInclude
// ═══════════════════════════════════════════════════════════════════════════

describe('shouldInclude', () => {
  it('returns true when include is present', () => {
    const includes = new Set<IntelligenceInclude>(['signals', 'scores']);
    expect(shouldInclude(includes, 'signals')).toBe(true);
    expect(shouldInclude(includes, 'scores')).toBe(true);
  });

  it('returns false when include is absent', () => {
    const includes = new Set<IntelligenceInclude>(['signals']);
    expect(shouldInclude(includes, 'contacts')).toBe(false);
    expect(shouldInclude(includes, 'timeline')).toBe(false);
  });

  it('is case-sensitive (includes are lowercase)', () => {
    const includes = new Set<IntelligenceInclude>(['signals']);
    // 'Signals' (capital S) should not match 'signals'
    expect(shouldInclude(includes, 'Signals' as IntelligenceInclude)).toBe(false);
    expect(shouldInclude(includes, 'SIGNALS' as IntelligenceInclude)).toBe(false);
    expect(shouldInclude(includes, 'signals')).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  shouldIncludeAny
// ═══════════════════════════════════════════════════════════════════════════

describe('shouldIncludeAny', () => {
  it('returns true when any include matches', () => {
    const includes = new Set<IntelligenceInclude>(['signals', 'scores']);
    expect(shouldIncludeAny(includes, 'contacts', 'signals', 'timeline')).toBe(true);
  });

  it('returns false when no includes match', () => {
    const includes = new Set<IntelligenceInclude>(['signals']);
    expect(shouldIncludeAny(includes, 'contacts', 'timeline', 'actions')).toBe(false);
  });

  it('returns true when all includes match', () => {
    const includes = new Set<IntelligenceInclude>(['signals', 'scores', 'contacts']);
    expect(shouldIncludeAny(includes, 'signals', 'scores', 'contacts')).toBe(true);
  });
});
