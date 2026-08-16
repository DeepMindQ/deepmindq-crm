/**
 * @vitest-environment node
 * Tests for src/lib/apiHelpers.ts
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createApiError, isApiError, apiErrorCode, apiError } from '@/lib/apiHelpers';
import type { ApiErrorResponse } from '@/lib/apiHelpers';

describe('apiHelpers', () => {
  describe('createApiError', () => {
    it('returns an object with success: false', () => {
      const result = createApiError('Something went wrong');
      expect(result.success).toBe(false);
    });

    it('includes the error message', () => {
      const result = createApiError('Not found');
      expect(result.error).toBe('Not found');
    });

    it('defaults status to 500', () => {
      const result = createApiError('fail');
      expect(result.status).toBe(500);
    });

    it('uses provided status', () => {
      const result = createApiError('unauthorized', 401);
      expect(result.status).toBe(401);
    });

    it('includes a timestamp string', () => {
      const result = createApiError('test');
      expect(result.timestamp).toBeDefined();
      expect(typeof result.timestamp).toBe('string');
      // Should be parseable as ISO date
      expect(new Date(result.timestamp!).getTime()).not.toBeNaN();
    });

    it('does not include details by default', () => {
      const result = createApiError('test');
      expect(result.details).toBeUndefined();
    });

    it('matches ApiErrorResponse type', () => {
      const result: ApiErrorResponse = createApiError('test', 400);
      expect(result.success).toBe(false);
      expect(result.error).toBe('test');
      expect(result.status).toBe(400);
    });
  });

  describe('isApiError', () => {
    it('returns true for valid ApiErrorResponse', () => {
      const err = { success: false, error: 'Bad request' };
      expect(isApiError(err)).toBe(true);
    });

    it('returns false for null', () => {
      expect(isApiError(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect(isApiError(undefined)).toBe(false);
    });

    it('returns false for a string', () => {
      expect(isApiError('error')).toBe(false);
    });

    it('returns false for an object with success: true', () => {
      expect(isApiError({ success: true, error: 'ok' })).toBe(false);
    });

    it('returns false for an object without success field', () => {
      expect(isApiError({ error: 'fail' })).toBe(false);
    });

    it('returns false for an empty object', () => {
      expect(isApiError({})).toBe(false);
    });

    it('returns false for a number', () => {
      expect(isApiError(42)).toBe(false);
    });

    it('returns false for an array', () => {
      expect(isApiError([{ success: false }])).toBe(false);
    });

    it('returns true for a full ApiErrorResponse with all fields', () => {
      const full = {
        success: false,
        error: 'Validation failed',
        details: { field: 'email' },
        status: 422,
        timestamp: '2024-01-01T00:00:00.000Z',
      };
      expect(isApiError(full)).toBe(true);
    });
  });

  describe('apiErrorCode', () => {
    it('returns a Response with correct status', () => {
      const res = apiErrorCode('VALIDATION_ERROR', 'Invalid input', 400);
      expect(res).toBeInstanceOf(Response);
      expect(res.status).toBe(400);
    });

    it('returns JSON content type', () => {
      const res = apiErrorCode('ERR', 'fail', 500);
      expect(res.headers.get('Content-Type')).toBe('application/json');
    });

    it('includes code in the body', async () => {
      const res = apiErrorCode('CUSTOM_CODE', 'message', 422);
      const body = await res.json();
      expect(body.code).toBe('CUSTOM_CODE');
    });

    it('includes error message in the body', async () => {
      const res = apiErrorCode('ERR', 'Something bad', 500);
      const body = await res.json();
      expect(body.error).toBe('Something bad');
    });

    it('includes success: false in body', async () => {
      const res = apiErrorCode('ERR', 'm', 400);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it('includes a timestamp in body', async () => {
      const res = apiErrorCode('ERR', 'm', 500);
      const body = await res.json();
      expect(typeof body.timestamp).toBe('string');
    });
  });

  describe('apiError', () => {
    it('returns a Response with correct status', () => {
      const res = apiError('Not found', 404);
      expect(res).toBeInstanceOf(Response);
      expect(res.status).toBe(404);
    });

    it('returns JSON content type', () => {
      const res = apiError('fail', 500);
      expect(res.headers.get('Content-Type')).toBe('application/json');
    });

    it('includes error message in body', async () => {
      const res = apiError('Server error', 500);
      const body = await res.json();
      expect(body.error).toBe('Server error');
    });

    it('includes success: false in body', async () => {
      const res = apiError('fail', 403);
      const body = await res.json();
      expect(body.success).toBe(false);
    });

    it('does not include code field (unlike apiErrorCode)', async () => {
      const res = apiError('fail', 500);
      const body = await res.json();
      expect(body.code).toBeUndefined();
    });

    it('includes a timestamp in body', async () => {
      const res = apiError('m', 500);
      const body = await res.json();
      expect(typeof body.timestamp).toBe('string');
    });
  });
});
