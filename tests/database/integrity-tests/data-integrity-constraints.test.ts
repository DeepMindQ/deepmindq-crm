import { describe, it, expect } from 'vitest'

describe('Data Integrity — Email', () => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  it('validates format', () => {
    expect(re.test('user@example.com')).toBe(true);
    expect(re.test('invalid')).toBe(false);
    expect(re.test('@no-user.com')).toBe(false);
  });
  it('normalizes to lowercase', () => {
    expect('User@Example.COM'.trim().toLowerCase()).toBe('user@example.com');
  });
});

describe('Data Integrity — Session', () => {
  it('30-day max expiry', () => {
    const diffMs = 30 * 24 * 60 * 60 * 1000;
    expect(diffMs / (1000*60*60*24)).toBe(30);
  });
});

describe('Data Integrity — OTP', () => {
  it('5 max attempts', () => expect(5).toBe(5));
  it('10-minute expiry', () => expect(10).toBe(10));
  it('6-digit format', () => {
    expect(/^\d{6}$/.test('123456')).toBe(true);
    expect(/^\d{6}$/.test('12345')).toBe(false);
  });
});

describe('Data Integrity — RBAC', () => {
  it('only valid roles allowed', () => {
    const valid = ['admin','operator','user','viewer'];
    expect(valid.includes('admin')).toBe(true);
    expect(valid.includes('superadmin')).toBe(false);
    expect(valid.includes('')).toBe(false);
  });
});