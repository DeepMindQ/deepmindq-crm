/**
 * API Helpers Tests
 * @vitest-environment node
 */
import { describe, it, expect, vi } from 'vitest';
import {
  createApiError,
  isApiError,
  apiErrorCode,
  apiError,
  type ApiErrorResponse,
} from '@/lib/apiHelpers';

describe('apiHelpers', () => {
  describe('createApiError', () => {
    it('creates error with message and default status 500', () => {
      const err = createApiError('Something went wrong');
      expect(err.success).toBe(false);
      expect(err.error).toBe('Something went wrong');
      expect(err.status).toBe(500);
      expect(err.timestamp).toBeDefined();
      // Valid ISO date
      expect(new Date(err.timestamp!).getTime()).not.toBeNaN();
    });

    it('accepts custom status code', () => {
      const err = createApiError('Not found', 404);
      expect(err.status).toBe(404);
    });

    it('accepts details', () => {
      const err = createApiError('Validation failed', 400);
      expect(err.details).toBeUndefined();
    });
  });

  describe('isApiError', () => {
    it('returns true for valid ApiErrorResponse', () => {
      const err: ApiErrorResponse = {
        success: false,
        error: 'test',
        status: 500,
      };
      expect(isApiError(err)).toBe(true);
    });

    it('returns false for null', () => {
      expect(isApiError(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isApiError(undefined)).toBe(false);
    });

    it('returns false for string', () => {
      expect(isApiError('error')).toBe(false);
    });

    it('returns false for number', () => {
      expect(isApiError(42)).toBe(false);
    });

    it('returns false for object with success=true', () => {
      expect(isApiError({ success: true })).toBe(false);
    });

    it('returns false for object without success property', () => {
      expect(isApiError({ error: 'test' })).toBe(false);
    });

    it('returns false for empty object', () => {
      expect(isApiError({})).toBe(false);
    });

    it('returns true for minimal error object', () => {
      expect(isApiError({ success: false })).toBe(true);
    });
  });

  describe('apiErrorCode', () => {
    it('returns Response with correct structure', () => {
      const res = apiErrorCode('VALIDATION_ERROR', 'Invalid input', 400);
      expect(res.status).toBe(400);
      expect(res.headers.get('Content-Type')).toBe('application/json');
    });

    it('returns JSON body with code field', async () => {
      const res = apiErrorCode('RATE_LIMITED', 'Too many requests', 429);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.code).toBe('RATE_LIMITED');
      expect(body.error).toBe('Too many requests');
      expect(body.timestamp).toBeDefined();
    });
  });

  describe('apiError', () => {
    it('returns Response with status', () => {
      const res = apiError('Internal error', 500);
      expect(res.status).toBe(500);
      expect(res.headers.get('Content-Type')).toBe('application/json');
    });

    it('returns JSON body without code field', async () => {
      const res = apiError('Not found', 404);
      const body = await res.json();
      expect(body.success).toBe(false);
      expect(body.error).toBe('Not found');
      expect(body.code).toBeUndefined();
      expect(body.timestamp).toBeDefined();
    });
  });
});
