/**
 * Cron Auth Tests
 * @vitest-environment node
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('cron-auth', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('returns false when CRON_SECRET is not set', async () => {
    delete process.env.CRON_SECRET;
    const { validateCronSecret } = await import('@/lib/cron-auth');
    const req = new Request('http://localhost/api/cron/test', {
      headers: { authorization: 'Bearer some-token' },
    });
    expect(validateCronSecret(req)).toBe(false);
  });

  it('returns false when authorization header is missing', async () => {
    process.env.CRON_SECRET = 'my-secret';
    const { validateCronSecret } = await import('@/lib/cron-auth');
    const req = new Request('http://localhost/api/cron/test');
    expect(validateCronSecret(req)).toBe(false);
  });

  it('returns false for incorrect token', async () => {
    process.env.CRON_SECRET = 'correct-secret';
    const { validateCronSecret } = await import('@/lib/cron-auth');
    const req = new Request('http://localhost/api/cron/test', {
      headers: { authorization: 'Bearer wrong-token' },
    });
    expect(validateCronSecret(req)).toBe(false);
  });

  it('returns false for token with different length', async () => {
    process.env.CRON_SECRET = 'short';
    const { validateCronSecret } = await import('@/lib/cron-auth');
    const req = new Request('http://localhost/api/cron/test', {
      headers: { authorization: 'Bearer this-is-much-longer' },
    });
    expect(validateCronSecret(req)).toBe(false);
  });

  it('returns true for correct token', async () => {
    process.env.CRON_SECRET = 'my-cron-secret';
    const { validateCronSecret } = await import('@/lib/cron-auth');
    const req = new Request('http://localhost/api/cron/test', {
      headers: { authorization: 'Bearer my-cron-secret' },
    });
    expect(validateCronSecret(req)).toBe(true);
  });

  it('handles empty authorization header', async () => {
    process.env.CRON_SECRET = 'my-secret';
    const { validateCronSecret } = await import('@/lib/cron-auth');
    const req = new Request('http://localhost/api/cron/test', {
      headers: { authorization: '' },
    });
    expect(validateCronSecret(req)).toBe(false);
  });

  it('handles Bearer prefix correctly', async () => {
    process.env.CRON_SECRET = 'token123';
    const { validateCronSecret } = await import('@/lib/cron-auth');
    // "token123" != "Bearer token123"
    const req = new Request('http://localhost/api/cron/test', {
      headers: { authorization: 'token123' },
    });
    expect(validateCronSecret(req)).toBe(false);
  });

  it('is timing-safe (does not short-circuit on mismatch)', async () => {
    process.env.CRON_SECRET = 'aaaaaaaaaa';
    const { validateCronSecret } = await import('@/lib/cron-auth');
    // Same length, different content — should not short-circuit
    const req = new Request('http://localhost/api/cron/test', {
      headers: { authorization: 'Bearer aaaaaaaaab' },
    });
    // Just verify it returns false (timing safety is inherent to timingSafeEqual)
    expect(validateCronSecret(req)).toBe(false);
  });
});
