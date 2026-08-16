// ═══════════════════════════════════════════════════════════════════════════
// Environment Validation — Unit Tests
//
// Tests getEnv, getAIProviderStatus, getEnvHealthReport, validateEnv
// from @/lib/validate-env.ts.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mocks (hoisted) ─────────────────────────────────────────────────────

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
};

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}));

// ── Module under test ────────────────────────────────────────────────────

const { getEnv, getAIProviderStatus, getEnvHealthReport, validateEnv } =
  await import('@/lib/validate-env');

// ── Helpers ─────────────────────────────────────────────────────────────

/** Snapshot and restore process.env */
const originalEnv = { ...process.env };

function setEnv(overrides: Record<string, string | undefined>) {
  // Clear all env vars we care about first, then set overrides
  const keysToRemove = [
    'DATABASE_URL',
    'NEXTAUTH_URL',
    'SESSION_TOKEN_HMAC_SECRET',
    'NEXTAUTH_SECRET',
    'OPENAI_API_KEY',
    'GEMINI_API_KEY',
    'GROQ_API_KEY',
    'FIREWORKS_API_KEY',
    'NVIDIA_API_KEY',
    'TAVILY_API_KEY',
    'SMTP_HOST',
    'SMTP_USER',
    'SMTP_PASS',
    'SMTP_PORT',
    'REDIS_URL',
    'AUTHORIZED_EMAIL',
    'TRACKING_SECRET',
    'EMAIL_API_KEY',
    'EMAIL_FROM',
    'API_KEY_ENCRYPTION_KEY',
    'SLACK_WEBHOOK_URL',
    'TEAMS_WEBHOOK_URL',
    'ONCALL_EMAIL',
    'PAGERDUTY_KEY',
    'NODE_ENV',
    'CRON_SECRET',
    'RESEND_WEBHOOK_SECRET',
    'SETUP_TOKEN',
    'DIRECT_DATABASE_URL',
  ];
  for (const key of keysToRemove) {
    delete process.env[key];
  }
  Object.assign(process.env, overrides);
}

// We need to reset the internal _env cache between tests.
// The module caches the parsed env, so we re-import or clear it.
// Since getEnv caches on first call, we use vi.resetModules() + dynamic import.
// But for simplicity, we test with a single well-configured env.

beforeEach(() => {
  vi.clearAllMocks();
});

// ── getAIProviderStatus ──────────────────────────────────────────────────

describe('getAIProviderStatus', () => {
  beforeEach(() => {
    setEnv({ NODE_ENV: 'test' });
  });

  it('returns empty providers when no AI keys set', () => {
    const result = getAIProviderStatus();
    expect(result.providers).toEqual([]);
    expect(result.count).toBe(0);
  });

  it('detects a single configured provider', () => {
    process.env.GROQ_API_KEY = 'gsk_test';
    const result = getAIProviderStatus();
    expect(result.providers).toContain('GROQ');
    expect(result.count).toBe(1);
  });

  it('detects multiple configured providers', () => {
    process.env.GROQ_API_KEY = 'gsk_test';
    process.env.GEMINI_API_KEY = 'gemini_test';
    process.env.OPENAI_API_KEY = 'sk_test';
    const result = getAIProviderStatus();
    expect(result.count).toBe(3);
    expect(result.providers).toEqual(['GROQ', 'GEMINI', 'OPENAI']);
  });

  it('ignores empty-string AI keys', () => {
    process.env.GROQ_API_KEY = '';
    const result = getAIProviderStatus();
    expect(result.count).toBe(0);
  });

  it('detects all five provider keys', () => {
    process.env.GROQ_API_KEY = 'g';
    process.env.GEMINI_API_KEY = 'g';
    process.env.FIREWORKS_API_KEY = 'f';
    process.env.NVIDIA_API_KEY = 'n';
    process.env.OPENAI_API_KEY = 'o';
    const result = getAIProviderStatus();
    expect(result.count).toBe(5);
  });
});

// ── getEnvHealthReport ───────────────────────────────────────────────────

describe('getEnvHealthReport', () => {
  beforeEach(() => {
    setEnv({ NODE_ENV: 'test' });
  });

  it('returns critical status when DATABASE_URL is missing', () => {
    const report = getEnvHealthReport();
    expect(report.status).toBe('critical');
    expect(report.database).toBe(false);
    expect(report.warnings).toContain(
      'SESSION_TOKEN_HMAC_SECRET (or NEXTAUTH_SECRET) is not set — auth will fail',
    );
  });

  it('returns critical when TRACKING_SECRET is missing', () => {
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    process.env.SESSION_TOKEN_HMAC_SECRET = 'a'.repeat(32);
    process.env.AUTHORIZED_EMAIL = 'admin@test.com';
    const report = getEnvHealthReport();
    expect(report.status).toBe('critical');
    expect(report.secrets.trackingSecret).toBe(false);
    expect(report.warnings).toContain(
      'TRACKING_SECRET is not set — email tracking will be insecure',
    );
  });

  it('returns critical when AUTHORIZED_EMAIL is missing', () => {
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    process.env.SESSION_TOKEN_HMAC_SECRET = 'a'.repeat(32);
    process.env.TRACKING_SECRET = 'a'.repeat(16);
    const report = getEnvHealthReport();
    expect(report.status).toBe('critical');
    expect(report.secrets.authorizedEmail).toBe(false);
  });

  it('returns degraded when AI providers are missing', () => {
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    process.env.SESSION_TOKEN_HMAC_SECRET = 'a'.repeat(32);
    process.env.TRACKING_SECRET = 'a'.repeat(16);
    process.env.AUTHORIZED_EMAIL = 'admin@test.com';
    const report = getEnvHealthReport();
    expect(report.status).toBe('degraded');
    expect(report.warnings).toContain(
      'No AI providers configured — AI features will use template fallback',
    );
  });

  it('returns degraded when session secret is too short', () => {
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    process.env.NEXTAUTH_SECRET = 'short';
    process.env.TRACKING_SECRET = 'a'.repeat(16);
    process.env.AUTHORIZED_EMAIL = 'admin@test.com';
    process.env.GROQ_API_KEY = 'g';
    const report = getEnvHealthReport();
    expect(report.status).toBe('degraded');
    expect(report.auth.secret).toBe(true);
    expect(report.auth.minLength).toBe(false);
  });

  it('returns healthy when all required vars are set', () => {
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    process.env.SESSION_TOKEN_HMAC_SECRET = 'a'.repeat(32);
    process.env.TRACKING_SECRET = 'a'.repeat(16);
    process.env.AUTHORIZED_EMAIL = 'admin@test.com';
    process.env.GROQ_API_KEY = 'g';
    const report = getEnvHealthReport();
    expect(report.status).toBe('healthy');
    expect(report.warnings).toHaveLength(0);
  });

  it('reports SMTP status correctly when all SMTP vars set', () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'user';
    process.env.SMTP_PASS = 'pass';
    const report = getEnvHealthReport();
    expect(report.smtp).toBe(true);
  });

  it('reports SMTP false when any SMTP var is missing', () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    // SMTP_USER and SMTP_PASS missing
    const report = getEnvHealthReport();
    expect(report.smtp).toBe(false);
  });

  it('reports TAVILY_API_KEY as tavily field', () => {
    process.env.TAVILY_API_KEY = 'tvly_test';
    const report = getEnvHealthReport();
    expect(report.ai.tavily).toBe(true);
  });

  it('prefers SESSION_TOKEN_HMAC_SECRET over NEXTAUTH_SECRET', () => {
    process.env.SESSION_TOKEN_HMAC_SECRET = 'a'.repeat(32);
    process.env.NEXTAUTH_SECRET = 'b'.repeat(32);
    const report = getEnvHealthReport();
    expect(report.auth.secret).toBe(true);
    expect(report.auth.minLength).toBe(true);
  });
});

// ── validateEnv ──────────────────────────────────────────────────────────

describe('validateEnv', () => {
  beforeEach(() => {
    setEnv({ NODE_ENV: 'development' });
    vi.clearAllMocks();
  });

  it('does not throw in development when required vars are missing', () => {
    expect(() => validateEnv()).not.toThrow();
  });

  it('logs AI provider status on call', () => {
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    process.env.GROQ_API_KEY = 'g';
    validateEnv();
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('[ENV] AI providers configured: 1 (GROQ)'),
    );
  });

  it('warns about missing API_KEY_ENCRYPTION_KEY in development', () => {
    validateEnv();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining('API_KEY_ENCRYPTION_KEY not set'),
    );
  });

  it('does not warn about API_KEY_ENCRYPTION_KEY when set in development', () => {
    process.env.API_KEY_ENCRYPTION_KEY = 'a'.repeat(32);
    validateEnv();
    const warnCalls = mockLogger.warn.mock.calls.map((c: string[]) => c[0]);
    const encryptionWarnings = warnCalls.filter((c: string) =>
      c.includes('API_KEY_ENCRYPTION_KEY'),
    );
    expect(encryptionWarnings).toHaveLength(0);
  });

  it('throws in production when DATABASE_URL is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.SESSION_TOKEN_HMAC_SECRET = 'a'.repeat(32);
    expect(() => validateEnv()).toThrow('DATABASE_URL must be set in production');
  });

  it('throws in production when TRACKING_SECRET is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    process.env.SESSION_TOKEN_HMAC_SECRET = 'a'.repeat(32);
    process.env.AUTHORIZED_EMAIL = 'admin@test.com';
    process.env.API_KEY_ENCRYPTION_KEY = 'a'.repeat(32);
    expect(() => validateEnv()).toThrow('TRACKING_SECRET must be set in production');
  });

  it('throws in production when AUTHORIZED_EMAIL is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    process.env.SESSION_TOKEN_HMAC_SECRET = 'a'.repeat(32);
    process.env.TRACKING_SECRET = 'a'.repeat(16);
    process.env.API_KEY_ENCRYPTION_KEY = 'a'.repeat(32);
    expect(() => validateEnv()).toThrow('AUTHORIZED_EMAIL must be set in production');
  });

  it('throws in production when API_KEY_ENCRYPTION_KEY is missing', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    process.env.SESSION_TOKEN_HMAC_SECRET = 'a'.repeat(32);
    process.env.TRACKING_SECRET = 'a'.repeat(16);
    process.env.AUTHORIZED_EMAIL = 'admin@test.com';
    expect(() => validateEnv()).toThrow('API_KEY_ENCRYPTION_KEY must be set in production');
  });

  it('throws in production when session secret is too short', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    process.env.SESSION_TOKEN_HMAC_SECRET = 'short';
    process.env.TRACKING_SECRET = 'a'.repeat(16);
    process.env.AUTHORIZED_EMAIL = 'admin@test.com';
    process.env.API_KEY_ENCRYPTION_KEY = 'a'.repeat(32);
    expect(() => validateEnv()).toThrow('SESSION_TOKEN_HMAC_SECRET');
  });

  it('succeeds in production when all required vars are present', () => {
    process.env.NODE_ENV = 'production';
    process.env.DATABASE_URL = 'postgresql://localhost/test';
    process.env.SESSION_TOKEN_HMAC_SECRET = 'a'.repeat(32);
    process.env.TRACKING_SECRET = 'a'.repeat(16);
    process.env.AUTHORIZED_EMAIL = 'admin@test.com';
    process.env.API_KEY_ENCRYPTION_KEY = 'a'.repeat(32);
    process.env.GROQ_API_KEY = 'g';
    expect(() => validateEnv()).not.toThrow();
  });
});

// ── Restore env after all tests ──────────────────────────────────────────

afterEach(() => {
  // Restore original env
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnv)) {
      delete process.env[key];
    }
  }
  Object.assign(process.env, originalEnv);
});
