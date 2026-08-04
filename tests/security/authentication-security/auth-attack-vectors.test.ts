import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '@/lib/password'

describe('Auth Security — Injection Resistance', () => {
  const maliciousPasswords = [
    "' OR 1=1 --",
    "admin'; DROP TABLE users; --",
    "1' UNION SELECT * FROM passwords --",
  ];

  it('handles SQL injection in password', async () => {
    for (const pw of maliciousPasswords) {
      const hash = await hashPassword(pw);
      expect(hash).toBeTruthy();
      expect(await verifyPassword(pw, hash)).toBe(true);
    }
  });

  it('handles extremely long passwords', async () => {
    const longPw = 'a'.repeat(10000);
    const hash = await hashPassword(longPw);
    expect(await verifyPassword(longPw, hash)).toBe(true);
  });

  it('handles Unicode passwords', async () => {
    const unicodePw = 'パスワード123!Ñ@#';
    const hash = await hashPassword(unicodePw);
    expect(await verifyPassword(unicodePw, hash)).toBe(true);
  });
});

describe('Auth Security — Hash Corruption', () => {
  it('rejects malformed hash (no separator)', async () => {
    expect(await verifyPassword('test', 'invalidhash')).toBe(false);
  });
  it('rejects empty hash', async () => {
    expect(await verifyPassword('test', '')).toBe(false);
  });
  it('rejects wrong separator', async () => {
    expect(await verifyPassword('test', 'salt:hash')).toBe(false);
  });
  it('rejects truncated salt', async () => {
    expect(await verifyPassword('test', 'ab' + '$' + 'c'.repeat(64))).toBe(false);
  });
  it('rejects truncated hash', async () => {
    expect(await verifyPassword('test', 'a'.repeat(32) + '$ab')).toBe(false);
  });
  it('rejects non-hex characters', async () => {
    expect(await verifyPassword('test', 'GGGG$' + 'H'.repeat(64))).toBe(false);
  });
});

describe('Auth Security — Email Validation', () => {
  it('rejects invalid email formats', () => {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    expect(re.test('notanemail')).toBe(false);
    expect(re.test('@no-user.com')).toBe(false);
    expect(re.test('spaces in@email.com')).toBe(false);
    expect(re.test('user@example.com')).toBe(true);
  });
});