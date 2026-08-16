// ═══════════════════════════════════════════════════════════════════════════
// Env Config — Unit Tests
//
// Tests all getters on the `env` object from @/lib/env-config.ts.
// Each getter reads from process.env with sensible defaults.
// ═══════════════════════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const originalEnv = process.env;

function setEnv(key: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}

function resetEnv() {
  process.env = { ...originalEnv };
}

describe('env-config', () => {
  let env: typeof import('@/lib/env-config').env;

  beforeEach(async () => {
    vi.resetModules();
    resetEnv();
    const mod = await import('@/lib/env-config');
    env = mod.env;
  });

  afterEach(() => {
    resetEnv();
  });

  // ── Application ────────────────────────────────────────────────
  describe('nodeEnv', () => {
    it('defaults to "development" when NODE_ENV not set', () => {
      delete process.env.NODE_ENV;
      expect(env.nodeEnv).toBe('development');
    });

    it('returns NODE_ENV when set', () => {
      process.env.NODE_ENV = 'production';
      expect(env.nodeEnv).toBe('production');
    });
  });

  describe('isProduction', () => {
    it('returns true when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      expect(env.isProduction).toBe(true);
    });

    it('returns false when NODE_ENV is development', () => {
      process.env.NODE_ENV = 'development';
      expect(env.isProduction).toBe(false);
    });
  });

  describe('isDevelopment', () => {
    it('returns true when NODE_ENV is development', () => {
      process.env.NODE_ENV = 'development';
      expect(env.isDevelopment).toBe(true);
    });

    it('returns false when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      expect(env.isDevelopment).toBe(false);
    });
  });

  describe('port', () => {
    it('defaults to 3000', () => {
      expect(env.port).toBe(3000);
    });

    it('parses PORT env var', () => {
      process.env.PORT = '8080';
      expect(env.port).toBe(8080);
    });

    it('handles non-numeric PORT by NaN', () => {
      process.env.PORT = 'abc';
      expect(env.port).toBeNaN();
    });
  });

  describe('logLevel', () => {
    it('defaults to "debug" in development', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.LOG_LEVEL;
      expect(env.logLevel).toBe('debug');
    });

    it('defaults to "info" in production', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.LOG_LEVEL;
      expect(env.logLevel).toBe('info');
    });

    it('returns LOG_LEVEL when set', () => {
      process.env.LOG_LEVEL = 'warn';
      expect(env.logLevel).toBe('warn');
    });
  });

  // ── Database ───────────────────────────────────────────────────
  describe('databaseUrl', () => {
    it('returns DATABASE_URL when set', () => {
      process.env.DATABASE_URL = 'postgres://user:pass@host:5432/db';
      expect(env.databaseUrl).toBe('postgres://user:pass@host:5432/db');
    });

    it('throws when DATABASE_URL is not set', () => {
      delete process.env.DATABASE_URL;
      expect(() => env.databaseUrl).toThrow('DATABASE_URL is required');
    });
  });

  describe('databasePoolSize', () => {
    it('defaults to 10', () => {
      delete process.env.DATABASE_POOL_SIZE;
      expect(env.databasePoolSize).toBe(10);
    });

    it('parses valid DATABASE_POOL_SIZE', () => {
      process.env.DATABASE_POOL_SIZE = '25';
      expect(env.databasePoolSize).toBe(25);
    });

    it('returns 10 for zero (invalid)', () => {
      process.env.DATABASE_POOL_SIZE = '0';
      expect(env.databasePoolSize).toBe(10);
    });

    it('returns 10 for negative', () => {
      process.env.DATABASE_POOL_SIZE = '-5';
      expect(env.databasePoolSize).toBe(10);
    });

    it('returns 10 for NaN', () => {
      process.env.DATABASE_POOL_SIZE = 'abc';
      expect(env.databasePoolSize).toBe(10);
    });
  });

  describe('useDbPersistence', () => {
    it('returns false by default', () => {
      expect(env.useDbPersistence).toBe(false);
    });

    it('returns true when USE_DB_PERSISTENCE=true', () => {
      process.env.USE_DB_PERSISTENCE = 'true';
      expect(env.useDbPersistence).toBe(true);
    });
  });

  describe('persistenceMode', () => {
    it('defaults to "memory"', () => {
      expect(env.persistenceMode).toBe('memory');
    });

    it('returns PERSISTENCE_MODE when set', () => {
      process.env.PERSISTENCE_MODE = 'database';
      expect(env.persistenceMode).toBe('database');
    });
  });

  // ── Redis ───────────────────────────────────────────────────────
  describe('redisUrl', () => {
    it('returns undefined by default', () => {
      delete process.env.REDIS_URL;
      expect(env.redisUrl).toBeUndefined();
    });

    it('returns REDIS_URL when set', () => {
      process.env.REDIS_URL = 'redis://localhost:6379';
      expect(env.redisUrl).toBe('redis://localhost:6379');
    });
  });

  // ── Auth / Security ─────────────────────────────────────────────
  describe('authSecret', () => {
    it('defaults to dev secret', () => {
      delete process.env.AUTH_SECRET;
      delete process.env.NEXTAUTH_SECRET;
      expect(env.authSecret).toBe('dev-secret-change-me');
    });

    it('prefers AUTH_SECRET over NEXTAUTH_SECRET', () => {
      process.env.AUTH_SECRET = 'auth-sec';
      process.env.NEXTAUTH_SECRET = 'nextauth-sec';
      expect(env.authSecret).toBe('auth-sec');
    });

    it('falls back to NEXTAUTH_SECRET', () => {
      delete process.env.AUTH_SECRET;
      process.env.NEXTAUTH_SECRET = 'nextauth-sec';
      expect(env.authSecret).toBe('nextauth-sec');
    });
  });

  describe('sessionMaxAgeSeconds', () => {
    it('defaults to 86400 (24h)', () => {
      expect(env.sessionMaxAgeSeconds).toBe(86400);
    });

    it('parses SESSION_MAX_AGE', () => {
      process.env.SESSION_MAX_AGE = '3600';
      expect(env.sessionMaxAgeSeconds).toBe(3600);
    });
  });

  // ── Sentry ──────────────────────────────────────────────────────
  describe('sentryDsn', () => {
    it('returns undefined by default', () => {
      expect(env.sentryDsn).toBeUndefined();
    });

    it('returns SENTRY_DSN when set', () => {
      process.env.SENTRY_DSN = 'https://key@sentry.io/1';
      expect(env.sentryDsn).toBe('https://key@sentry.io/1');
    });
  });

  // ── Rate Limiting ───────────────────────────────────────────────
  describe('rateLimitEnabled', () => {
    it('returns true by default', () => {
      expect(env.rateLimitEnabled).toBe(true);
    });

    it('returns false when RATE_LIMIT_DISABLED=true', () => {
      process.env.RATE_LIMIT_DISABLED = 'true';
      expect(env.rateLimitEnabled).toBe(false);
    });
  });

  describe('rateLimitWindowMs', () => {
    it('defaults to 60000', () => {
      expect(env.rateLimitWindowMs).toBe(60000);
    });
  });

  describe('rateLimitMax', () => {
    it('defaults to 100', () => {
      expect(env.rateLimitMax).toBe(100);
    });

    it('parses RATE_LIMIT_MAX', () => {
      process.env.RATE_LIMIT_MAX = '50';
      expect(env.rateLimitMax).toBe(50);
    });
  });

  // ── Deployment ───────────────────────────────────────────────────
  describe('deployEnvironment', () => {
    it('defaults to nodeEnv', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.DEPLOY_ENVIRONMENT;
      expect(env.deployEnvironment).toBe('production');
    });

    it('returns DEPLOY_ENVIRONMENT when set', () => {
      process.env.DEPLOY_ENVIRONMENT = 'staging';
      expect(env.deployEnvironment).toBe('staging');
    });
  });

  describe('isCanary', () => {
    it('returns false by default', () => {
      expect(env.isCanary).toBe(false);
    });

    it('returns true when CANARY=true', () => {
      process.env.CANARY = 'true';
      expect(env.isCanary).toBe(true);
    });
  });

  describe('appVersion', () => {
    it('defaults to 0.2.0', () => {
      delete process.env.NEXT_PUBLIC_APP_VERSION;
      delete process.env.npm_package_version;
      expect(env.appVersion).toBe('0.2.0');
    });

    it('prefers NEXT_PUBLIC_APP_VERSION', () => {
      process.env.NEXT_PUBLIC_APP_VERSION = '1.0.0';
      expect(env.appVersion).toBe('1.0.0');
    });
  });

  // ── AI Providers ─────────────────────────────────────────────────
  describe('AI provider keys', () => {
    it('openaiApiKey returns undefined by default', () => {
      expect(env.openaiApiKey).toBeUndefined();
    });

    it('openaiApiKey returns value when set', () => {
      process.env.OPENAI_API_KEY = 'sk-test';
      expect(env.openaiApiKey).toBe('sk-test');
    });

    it('anthropicApiKey returns value when set', () => {
      process.env.ANTHROPIC_API_KEY = 'ak-test';
      expect(env.anthropicApiKey).toBe('ak-test');
    });

    it('geminiApiKey returns value when set', () => {
      process.env.GEMINI_API_KEY = 'gk-test';
      expect(env.geminiApiKey).toBe('gk-test');
    });
  });
});
