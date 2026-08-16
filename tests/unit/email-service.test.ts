/**
 * @vitest-environment node
 *
 * Tests for src/lib/email-provider.ts
 * (The requested email-service.ts does not exist; email-provider.ts is the actual module.)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendEmail } from '@/lib/email-provider';

// ── email-provider.ts is a stub that always returns false ────────

describe('sendEmail (email-provider stub)', () => {
  it('exports a sendEmail function', () => {
    expect(typeof sendEmail).toBe('function');
  });

  it('returns false for any input (stub implementation)', async () => {
    const result = await sendEmail('test@example.com', 'Subject', '<p>Body</p>');
    expect(result).toBe(false);
  });

  it('ignores its arguments (stub)', async () => {
    const result = await sendEmail('', '', '');
    expect(result).toBe(false);
  });

  it('is async and returns a Promise<boolean>', async () => {
    const result = await sendEmail('a@b.com', 'Hi', 'Hello');
    expect(result).toBe(false);
  });
});
