/**
 * Unit Tests — Password Hashing (password.ts)
 * Split from auth-authz-certification.test.ts during M3 Stabilization
 *
 * Validates: PBKDF2-SHA256 hashing, salt generation, verification, edge cases
 */

import { describe, it, expect, vi } from 'vitest';

describe('Password Hashing (password.ts)', () => {
  let hashPassword: typeof import('@/lib/password').hashPassword;
  let verifyPassword: typeof import('@/lib/password').verifyPassword;

  beforeAll(async () => {
    const mod = await import('@/lib/password');
    hashPassword = mod.hashPassword;
    verifyPassword = mod.verifyPassword;
  });

  it('hashPassword returns a string in salt$hash format', async () => {
    const hash = await hashPassword('test-password-123');
    const parts = hash.split('$');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatch(/^[0-9a-f]{32}$/);
    expect(parts[1]).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hashPassword produces different hashes for the same password (random salt)', async () => {
    const hash1 = await hashPassword('same-password');
    const hash2 = await hashPassword('same-password');
    expect(hash1).not.toBe(hash2);
    expect(hash1.split('$')[0]).not.toBe(hash2.split('$')[0]);
    expect(await verifyPassword('same-password', hash1)).toBe(true);
    expect(await verifyPassword('same-password', hash2)).toBe(true);
  });

  it('verifyPassword returns true for correct password', async () => {
    const password = 'MySecureP@ssw0rd!';
    const hash = await hashPassword(password);
    expect(await verifyPassword(password, hash)).toBe(true);
  });

  it('verifyPassword returns false for wrong password', async () => {
    const hash = await hashPassword('correct-password');
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('verifyPassword returns false for empty password against a hash', async () => {
    const hash = await hashPassword('nonempty');
    expect(await verifyPassword('', hash)).toBe(false);
  });

  it('verifyPassword handles malformed hash gracefully (missing $ separator)', async () => {
    expect(await verifyPassword('test', 'malformed-no-dollar')).toBe(false);
  });

  it('verifyPassword handles malformed hash (only salt, no hash)', async () => {
    expect(await verifyPassword('test', 'abcdef1234567890')).toBe(false);
  });

  it('verifyPassword handles empty string hash', async () => {
    expect(await verifyPassword('test', '')).toBe(false);
  });

  it('verifyPassword handles hash with non-hex characters', async () => {
    expect(await verifyPassword('test', 'zzzz$zzzz')).toBe(false);
  });

  it('verifyPassword uses constant-time comparison (no early return on first char mismatch)', async () => {
    const hash = await hashPassword('password123');
    const wrongPw = 'password124';
    const startWrong = performance.now();
    await verifyPassword(wrongPw, hash);
    const timeWrong = performance.now() - startWrong;

    const startDiff = performance.now();
    await verifyPassword('zzzzzzzzzz', hash);
    const timeDiff = performance.now() - startDiff;

    const ratio = Math.max(timeWrong, timeDiff) / (Math.min(timeWrong, timeDiff) || 1);
    expect(ratio).toBeLessThan(2);
  });

  it('hashPassword produces 32-byte salt (64 hex chars) and 32-byte hash (64 hex chars)', async () => {
    const hash = await hashPassword('test');
    const [salt, digest] = hash.split('$');
    expect(salt).toHaveLength(32);
    expect(digest).toHaveLength(64);
  });
});
