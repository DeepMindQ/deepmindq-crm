/**
 * Phase 4 — Items 2.1-2.7: Connector Retry Hardening Tests
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Connector Retry Utilities (Phase 4.2.x)', () => {
  describe('classifyError', () => {
    it('should classify network errors as retryable_network', async () => {
      const { classifyError } = await import('@/lib/intelligence-sources/retry-utilities');
      const error = new Error('connect ECONNRESET');
      (error as any).code = 'ECONNRESET';
      expect(classifyError(error)).toBe('retryable_network');
    });

    it('should classify timeout errors as retryable_network', async () => {
      const { classifyError } = await import('@/lib/intelligence-sources/retry-utilities');
      expect(classifyError(new Error('Request timed out'))).toBe('retryable_network');
    });

    it('should classify 429 as retryable_rate_limit', async () => {
      const { classifyError } = await import('@/lib/intelligence-sources/retry-utilities');
      const error = new Error('Too Many Requests');
      (error as any).status = 429;
      expect(classifyError(error)).toBe('retryable_rate_limit');
    });

    it('should classify 500 as retryable_server', async () => {
      const { classifyError } = await import('@/lib/intelligence-sources/retry-utilities');
      const error = new Error('Internal Server Error');
      (error as any).status = 500;
      expect(classifyError(error)).toBe('retryable_server');
    });

    it('should classify 404 as non_retryable', async () => {
      const { classifyError } = await import('@/lib/intelligence-sources/retry-utilities');
      const error = new Error('Not Found');
      (error as any).status = 404;
      expect(classifyError(error)).toBe('non_retryable');
    });

    it('should classify unknown errors as unknown', async () => {
      const { classifyError } = await import('@/lib/intelligence-sources/retry-utilities');
      expect(classifyError('string error')).toBe('unknown');
    });
  });

  describe('isRetryable', () => {
    it('should return true for retryable errors', async () => {
      const { isRetryable } = await import('@/lib/intelligence-sources/retry-utilities');
      const error = new Error('timeout');
      expect(isRetryable(error)).toBe(true);
    });

    it('should return false for non-retryable errors', async () => {
      const { isRetryable } = await import('@/lib/intelligence-sources/retry-utilities');
      const error = new Error('Not Found');
      (error as any).status = 404;
      expect(isRetryable(error)).toBe(false);
    });
  });

  describe('withRetry', () => {
    it('should return result on first attempt if successful', async () => {
      const { withRetry } = await import('@/lib/intelligence-sources/retry-utilities');
      const fn = vi.fn().mockResolvedValue('success');
      const result = await withRetry(fn, 'test context');
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable errors and succeed', async () => {
      const { withRetry } = await import('@/lib/intelligence-sources/retry-utilities');

      const error = new Error('ECONNRESET timeout');
      (error as any).code = 'ECONNRESET';

      const fn = vi.fn()
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('recovered');

      // Use real timers with a short delay to avoid fake timer unhandled rejection issues
      const result = await withRetry(
        () => fn(),
        'test context',
        { maxRetries: 1, baseDelayMs: 1, maxDelayMs: 10, jitter: false }
      );
      expect(result).toBe('recovered');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should throw after exhausting retries', async () => {
      const { withRetry } = await import('@/lib/intelligence-sources/retry-utilities');
      const fn = vi.fn().mockRejectedValue(new Error('persistent failure'));

      await expect(withRetry(
        () => fn(),
        'test context',
        { maxRetries: 1, baseDelayMs: 1, maxDelayMs: 10, jitter: false }
      )).rejects.toThrow('failed after 2 attempts');
      expect(fn).toHaveBeenCalledTimes(2);
    });

    it('should not retry non-retryable errors', async () => {
      const { withRetry } = await import('@/lib/intelligence-sources/retry-utilities');
      const error = new Error('Not Found');
      (error as any).status = 404;
      const fn = vi.fn().mockRejectedValue(error);

      await expect(withRetry(fn, 'test context', { maxRetries: 2, baseDelayMs: 50, maxDelayMs: 100, jitter: false }))
        .rejects.toThrow('failed after 1 attempts');
      expect(fn).toHaveBeenCalledTimes(1);
    });
  });

  describe('buildConnectorErrorDetail', () => {
    it('should include classification and timestamp', async () => {
      const { buildConnectorErrorDetail } = await import('@/lib/intelligence-sources/retry-utilities');
      const error = new Error('timeout');
      (error as any).code = 'ETIMEDOUT';
      const detail = buildConnectorErrorDetail(error, 'TestConnector', 3);
      expect(detail).toContain('TestConnector');
      expect(detail).toContain('retryable_network');
      expect(detail).toContain('Attempts: 3');
    });
  });
});
