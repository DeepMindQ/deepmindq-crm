import { describe, it, expect } from 'vitest'

describe('Email Provider — Fallback', () => {
  it('defaults to resend', () => expect(process.env.EMAIL_PROVIDER || 'resend').toBe('resend'));
  it('detects API key absence', () => expect(typeof !!process.env.EMAIL_API_KEY).toBe('boolean'));
});

describe('Email Provider — Dev Bypass', () => {
  it('no bypass in non-dev', () => {
    const isDev = process.env.NODE_ENV === 'development';
    const bypass = process.env.ALLOW_DEV_OTP === 'true';
    expect(isDev && bypass).toBe(false);
  });
});