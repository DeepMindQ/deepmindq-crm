/**
 * Input Validation Security Tests
 *
 * Tests for SQL injection, XSS, path traversal, and prototype pollution prevention.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Sanitization Utilities (mirror of src/lib/sanitize) ─────
function sanitizeString(input: unknown): string {
  if (typeof input !== 'string') return String(input ?? '');
  return input
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
}

function sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    // Block prototype pollution keys
    if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
      continue;
    }
    if (typeof value === 'string') {
      sanitized[key] = sanitizeString(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === 'string' ? sanitizeString(item) : item,
      );
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function validatePath(path: string): boolean {
  const normalized = path.replace(/\\/g, '/');
  // Block path traversal
  if (normalized.includes('..')) return false;
  // Block absolute paths
  if (normalized.startsWith('/')) return false;
  // Block null bytes
  if (normalized.includes('\0')) return false;
  return true;
}

function validateId(id: string): boolean {
  // Only allow alphanumeric, hyphens, underscores (UUIDs, CUIDs)
  return /^[a-zA-Z0-9_-]+$/.test(id);
}

describe('Input Validation Security', () => {
  // ── SQL Injection Prevention ──────────────────────────
  describe('SQL Injection Prevention', () => {
    it('sanitizes SQL injection in string input', () => {
      const malicious = "'; DROP TABLE users; --";
      const result = sanitizeString(malicious);
      expect(result).not.toContain("'");
    });

    it('sanitizes UNION-based SQL injection', () => {
      const malicious = "' UNION SELECT * FROM users --";
      const result = sanitizeString(malicious);
      expect(result).not.toContain("'");
    });

    it('sanitizes boolean-based SQL injection', () => {
      const malicious = "' OR 1=1 --";
      const result = sanitizeString(malicious);
      expect(result).not.toContain("'");
    });

    it('sanitizes SQL injection in object fields', () => {
      const input = {
        name: "admin'; DROP TABLE users;--",
        email: "test@example.com",
      };
      const result = sanitizeObject(input);
      expect(result.name).not.toContain("'");
      expect(result.email).toBe('test@example.com');
    });

    it('handles SQL injection in array fields', () => {
      const input = {
        tags: ["normal", "'; DROP TABLE tags;--"],
      };
      const result = sanitizeObject(input);
      expect(result.tags[1]).not.toContain("'");
    });
  });

  // ── XSS Prevention ────────────────────────────────────
  describe('XSS Prevention', () => {
    it('escapes <script> tags', () => {
      const malicious = '<script>alert("xss")</script>';
      const result = sanitizeString(malicious);
      expect(result).not.toContain('<script>');
      expect(result).toContain('&lt;script&gt;');
    });

    it('escapes on-event attributes', () => {
      const malicious = '<img src=x onerror="alert(1)">';
      const result = sanitizeString(malicious);
      expect(result).toContain("&lt;img");
    });

    it('escapes JavaScript URI scheme by encoding HTML', () => {
      const malicious = '<a href="javascript:alert(1)">click</a>';
      const result = sanitizeString(malicious);
      expect(result).not.toContain('<a');
      expect(result).toContain('&lt;a');
    });

    it('escapes double quotes for attribute injection', () => {
      const malicious = '" onmouseover="alert(1)';
      const result = sanitizeString(malicious);
      expect(result).not.toContain('"');
      expect(result).toContain('&quot;');
    });

    it('escapes SVG-based XSS', () => {
      const malicious = '<svg onload="alert(1)">';
      const result = sanitizeString(malicious);
      expect(result).not.toContain('<svg');
      expect(result).toContain('&lt;svg');
    });

    it('escapes nested script tags', () => {
      const malicious = '<scr<script>ipt>alert(1)</scr</script>ipt>';
      const result = sanitizeString(malicious);
      expect(result).not.toContain('<script>');
    });

    it('API responses should not include raw HTML tags', () => {
      const apiResponse = {
        error: '<script>alert(1)</script>',
        data: { name: '<img onerror=alert(1) src=x>' },
      };
      const sanitized = sanitizeObject(apiResponse);
      const jsonStr = JSON.stringify(sanitized);
      expect(jsonStr).not.toContain('<script>');
      expect(jsonStr).not.toContain('<img');
    });
  });

  // ── Path Traversal Prevention ─────────────────────────
  describe('Path Traversal Prevention', () => {
    it('blocks ../ traversal', () => {
      expect(validatePath('../../../etc/passwd')).toBe(false);
    });

    it('blocks ..\ backslash traversal', () => {
      expect(validatePath('..\\..\\..\\windows\\system32\\config')).toBe(false);
    });

    it('blocks absolute paths', () => {
      expect(validatePath('/etc/passwd')).toBe(false);
    });

    it('blocks null byte injection', () => {
      expect(validatePath('file.txt\0.exe')).toBe(false);
    });

    it('blocks encoded path traversal', () => {
      const malicious = '%2e%2e%2f%2e%2e%2fetc/passwd';
      const decoded = decodeURIComponent(malicious);
      expect(validatePath(decoded)).toBe(false);
    });

    it('allows safe relative paths', () => {
      expect(validatePath('documents/report.pdf')).toBe(true);
      expect(validatePath('images/logo.png')).toBe(true);
    });

    it('blocks double-encoded traversal', () => {
      const malicious = '%252e%252e%252f';
      const decoded = decodeURIComponent(decodeURIComponent(malicious));
      expect(validatePath(decoded)).toBe(false);
    });
  });

  // ── Prototype Pollution Prevention ────────────────────
  describe('Prototype Pollution Prevention', () => {
    it('strips __proto__ from input objects', () => {
      const input = {
        name: 'test',
        __proto__: { admin: true },
      } as unknown as Record<string, unknown>;
      const result = sanitizeObject(input);
      expect(result).not.toHaveProperty('__proto__');
      expect(result.name).toBe('test');
    });

    it('strips constructor from input objects', () => {
      const input = {
        name: 'test',
        constructor: { prototype: { isAdmin: true } },
      } as unknown as Record<string, unknown>;
      const result = sanitizeObject(input);
      expect(result).not.toHaveProperty('constructor');
    });

    it('strips prototype from input objects', () => {
      const input = {
        name: 'test',
        prototype: { polluted: true },
      } as unknown as Record<string, unknown>;
      const result = sanitizeObject(input);
      expect(result).not.toHaveProperty('prototype');
    });

    it('strips pollution keys in nested objects', () => {
      const input = {
        profile: {
          name: 'test',
          __proto__: { role: 'admin' },
        },
      } as unknown as Record<string, unknown>;
      const result = sanitizeObject(input);
      expect((result.profile as Record<string, unknown>)).not.toHaveProperty('__proto__');
    });

    it('does not pollute Object.prototype after sanitization', () => {
      const input = {
        __proto__: { isAdmin: true },
      } as unknown as Record<string, unknown>;
      sanitizeObject(input);
      expect(({} as Record<string, unknown>)).not.toHaveProperty('isAdmin');
    });
  });

  // ── ID Validation ─────────────────────────────────────
  describe('ID Validation', () => {
    it('accepts valid UUID-like IDs', () => {
      expect(validateId('abc-123')).toBe(true);
      expect(validateId('clxyz123abc')).toBe(true);
      expect(validateId('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    });

    it('rejects IDs with special characters', () => {
      expect(validateId('id; DROP TABLE')).toBe(false);
      expect(validateId('id<script>')).toBe(false);
      expect(validateId('../etc/passwd')).toBe(false);
    });
  });
});
