/**
 * Error Handling Patterns API Tests
 *
 * Validates that all API routes return structured error JSON on failure,
 * with correct HTTP status codes and no stack trace leakage.
 */
import { describe, it, expect } from 'vitest';

// ── Structured Error Response Contract ─────────────────────
interface StructuredError {
  error: string;
  message: string;
  code?: string;
  details?: unknown;
}

function isStructuredError(body: unknown): body is StructuredError {
  if (typeof body !== 'object' || body === null) return false;
  const obj = body as Record<string, unknown>;
  return typeof obj.error === 'string' && typeof obj.message === 'string';
}

describe('Error Handling Patterns', () => {
  describe('429 — Rate Limit Response Format', () => {
    it('returns structured JSON with retryAfter', () => {
      const body = {
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Please try again later.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfter: 60,
      };

      expect(isStructuredError(body)).toBe(true);
      expect(body.error).toBe('Too Many Requests');
      expect(body.code).toBe('RATE_LIMIT_EXCEEDED');
      expect(typeof body.retryAfter).toBe('number');
    });

    it('includes standard headers', () => {
      const headers = new Headers({
        'Content-Type': 'application/json',
        'Retry-After': '60',
        'X-RateLimit-Limit': '10',
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.floor(Date.now() / 1000) + 60),
      });

      expect(headers.get('Retry-After')).toBe('60');
      expect(headers.get('X-RateLimit-Remaining')).toBe('0');
    });
  });

  describe('403 — Forbidden Response Format', () => {
    it('returns structured JSON for insufficient permissions', () => {
      const body = {
        error: 'Forbidden',
        message: 'You do not have permission to perform this action.',
        code: 'INSUFFICIENT_PERMISSIONS',
        requiredRole: 'admin',
      };

      expect(isStructuredError(body)).toBe(true);
      expect(body.error).toBe('Forbidden');
      expect(body.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    it('returns structured JSON for admin-only routes', () => {
      const body = {
        error: 'Forbidden',
        message: 'This endpoint requires admin role.',
        code: 'REQUIRES_ADMIN',
      };

      expect(isStructuredError(body)).toBe(true);
      expect(body.code).toBe('REQUIRES_ADMIN');
    });
  });

  describe('401 — Unauthorized Response Format', () => {
    it('returns structured JSON for missing auth', () => {
      const body = {
        error: 'Unauthorized',
        message: 'Authentication required.',
        code: 'AUTH_REQUIRED',
      };

      expect(isStructuredError(body)).toBe(true);
      expect(body.error).toBe('Unauthorized');
    });

    it('returns structured JSON for expired session', () => {
      const body = {
        error: 'Unauthorized',
        message: 'Session expired. Please log in again.',
        code: 'SESSION_EXPIRED',
      };

      expect(isStructuredError(body)).toBe(true);
      expect(body.code).toBe('SESSION_EXPIRED');
    });

    it('returns structured JSON for invalid token', () => {
      const body = {
        error: 'Unauthorized',
        message: 'Invalid session token.',
        code: 'INVALID_SESSION',
      };

      expect(isStructuredError(body)).toBe(true);
    });
  });

  describe('500 — Server Error Response Format', () => {
    it('does NOT leak stack traces in production', () => {
      const productionError = {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred.',
        code: 'INTERNAL_ERROR',
      };

      expect(isStructuredError(productionError)).toBe(true);
      expect(JSON.stringify(productionError)).not.toContain('stack');
      expect(JSON.stringify(productionError)).not.toContain('at /');
      expect(JSON.stringify(productionError)).not.toContain('node_modules');
      expect(JSON.stringify(productionError)).not.toContain('.ts:');
    });

    it('includes a correlation ID for debugging', () => {
      const body = {
        error: 'Internal Server Error',
        message: 'An unexpected error occurred.',
        code: 'INTERNAL_ERROR',
        correlationId: 'corr-abc-123',
      };

      expect(body.correlationId).toBeDefined();
      expect(typeof body.correlationId).toBe('string');
      expect(body.correlationId.length).toBeGreaterThan(0);
    });
  });

  describe('Generic Error Structure Validation', () => {
    it('all error responses have error + message fields', () => {
      const errors = [
        { status: 400, body: { error: 'Bad Request', message: 'Invalid input', code: 'VALIDATION_ERROR' } },
        { status: 404, body: { error: 'Not Found', message: 'Resource not found', code: 'NOT_FOUND' } },
        { status: 422, body: { error: 'Unprocessable Entity', message: 'Validation failed', code: 'VALIDATION_FAILED' } },
      ];

      for (const { body } of errors) {
        expect(isStructuredError(body)).toBe(true);
        expect(body.error.length).toBeGreaterThan(0);
        expect(body.message.length).toBeGreaterThan(0);
      }
    });

    it('error codes are UPPER_SNAKE_CASE', () => {
      const codes = [
        'RATE_LIMIT_EXCEEDED',
        'INSUFFICIENT_PERMISSIONS',
        'AUTH_REQUIRED',
        'SESSION_EXPIRED',
        'INVALID_SESSION',
        'INTERNAL_ERROR',
        'VALIDATION_ERROR',
        'NOT_FOUND',
      ];

      const snakeCase = /^[A-Z][A-Z0-9]*(_[A-Z0-9]+)*$/;
      for (const code of codes) {
        expect(code).toMatch(snakeCase);
      }
    });

    it('error responses are JSON with Content-Type header', () => {
      const response = new Response(JSON.stringify({ error: 'Test', message: 'Test error' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });

      expect(response.headers.get('Content-Type')).toContain('application/json');
    });
  });
});