// Runtime environment variable validation using Zod
import { z } from 'zod';
import { logger } from '@/lib/logger';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  NEXTAUTH_URL: z.string().url().optional().default('http://localhost:3000'),
  // Milestone 1 H-02: Renamed from NEXTAUTH_SECRET to SESSION_TOKEN_HMAC_SECRET
  // The custom session system doesn't use NextAuth, so the name was misleading.
  // Accept both for backwards compatibility, but SESSION_TOKEN_HMAC_SECRET takes precedence.
  SESSION_TOKEN_HMAC_SECRET: z
    .string()
    .min(32, 'SESSION_TOKEN_HMAC_SECRET must be at least 32 characters')
    .optional(),
  NEXTAUTH_SECRET: z.string().min(32).optional(),
  // AI API keys (optional — app works with template fallback)
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
  FIREWORKS_API_KEY: z.string().optional(),
  NVIDIA_API_KEY: z.string().optional(),
  TAVILY_API_KEY: z.string().optional(),
  // Optional services
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().optional().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ACCESS_KEY: z.string().optional(),
  S3_SECRET_KEY: z.string().optional(),
  // P4.5: Redis for distributed rate limiting
  REDIS_URL: z.string().url().optional().describe('Redis URL for distributed rate limiting'),
  // Required for core features
  AUTHORIZED_EMAIL: z.string().min(1, 'AUTHORIZED_EMAIL is required for login').optional(),
  TRACKING_SECRET: z.string().min(16, 'TRACKING_SECRET must be at least 16 characters').optional(),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  RESEND_WEBHOOK_SECRET: z.string().optional(),
  SETUP_TOKEN: z.string().optional(),
  DIRECT_DATABASE_URL: z.string().optional(),
  // WI-18.1 LOCK: Encryption key for API keys at rest
  API_KEY_ENCRYPTION_KEY: z
    .string()
    .min(32, 'API_KEY_ENCRYPTION_KEY must be at least 32 characters')
    .optional(),
  // P2.1 / P4.4: Alert & notification channel configuration
  SLACK_WEBHOOK_URL: z.string().url().optional(),
  TEAMS_WEBHOOK_URL: z.string().url().optional(),
  ONCALL_EMAIL: z.string().email().optional(),
  PAGERDUTY_KEY: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

let _env: EnvConfig | null = null;

export function getEnv(): EnvConfig {
  if (_env) return _env;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const missing = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ');
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required env vars: ${missing}`);
    }
    logger.error(`[ENV] Missing env vars (dev mode): ${missing}`);
  }

  _env = result.data as EnvConfig;
  return _env;
}

/**
 * Check how many AI providers are configured.
 * Returns provider names and count for operational awareness.
 */
export function getAIProviderStatus(): { providers: string[]; count: number } {
  const aiKeys: Array<[string, string | undefined]> = [
    ['GROQ', process.env.GROQ_API_KEY],
    ['GEMINI', process.env.GEMINI_API_KEY],
    ['FIREWORKS', process.env.FIREWORKS_API_KEY],
    ['NVIDIA', process.env.NVIDIA_API_KEY],
    ['OPENAI', process.env.OPENAI_API_KEY],
  ];
  const configured = aiKeys.filter(([, v]) => v && v.length > 0).map(([name]) => name);
  return { providers: configured, count: configured.length };
}

/**
 * Returns a health report of all env configuration.
 * Useful for /api/health and startup diagnostics.
 */
export function getEnvHealthReport(): {
  database: boolean;
  auth: { secret: boolean; minLength: boolean };
  secrets: { trackingSecret: boolean; authorizedEmail: boolean };
  ai: { providers: string[]; count: number; tavily: boolean };
  smtp: boolean;
  status: 'healthy' | 'degraded' | 'critical';
  warnings: string[];
} {
  const warnings: string[] = [];
  const env = process.env;

  // Database
  const database = !!env.DATABASE_URL;

  // Auth — Milestone 1 H-02: Accept SESSION_TOKEN_HMAC_SECRET or NEXTAUTH_SECRET (backwards compat)
  const sessionSecret = process.env.SESSION_TOKEN_HMAC_SECRET || process.env.NEXTAUTH_SECRET;
  const secret = !!sessionSecret;
  const minLength = !!(sessionSecret && sessionSecret.length >= 32);
  if (!secret)
    warnings.push('SESSION_TOKEN_HMAC_SECRET (or NEXTAUTH_SECRET) is not set — auth will fail');
  if (secret && !minLength)
    warnings.push('SESSION_TOKEN_HMAC_SECRET (or NEXTAUTH_SECRET) is less than 32 characters');

  // Critical secrets
  const trackingSecret = !!env.TRACKING_SECRET;
  const authorizedEmail = !!env.AUTHORIZED_EMAIL;
  if (!trackingSecret)
    warnings.push('TRACKING_SECRET is not set — email tracking will be insecure');
  if (!authorizedEmail) warnings.push('AUTHORIZED_EMAIL is not set — login will be restricted');

  // AI
  const ai = getAIProviderStatus();
  if (ai.count === 0)
    warnings.push('No AI providers configured — AI features will use template fallback');
  const tavily = !!env.TAVILY_API_KEY;

  // SMTP
  const smtp = !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);

  // Overall status
  let status: 'healthy' | 'degraded' | 'critical' = 'healthy';
  if (!database || !secret || !trackingSecret || !authorizedEmail) status = 'critical';
  else if (ai.count === 0 || !minLength) status = 'degraded';

  return {
    database,
    auth: { secret, minLength },
    secrets: { trackingSecret, authorizedEmail },
    ai: { ...ai, tavily },
    smtp,
    status,
    warnings,
  };
}

// Validate env on import (warn only in dev, throw in prod)
export function validateEnv() {
  const env = getEnv();
  if (process.env.NODE_ENV === 'production') {
    const sessionSecret = process.env.SESSION_TOKEN_HMAC_SECRET || process.env.NEXTAUTH_SECRET;
    if (!sessionSecret || sessionSecret.length < 32) {
      throw new Error(
        'SESSION_TOKEN_HMAC_SECRET (or NEXTAUTH_SECRET) must be set and at least 32 characters in production',
      );
    }
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL must be set in production');
    }
    if (!process.env.TRACKING_SECRET) {
      throw new Error('TRACKING_SECRET must be set in production (min 16 chars)');
    }
    if (!process.env.AUTHORIZED_EMAIL) {
      throw new Error('AUTHORIZED_EMAIL must be set in production');
    }
    if (process.env.TRACKING_SECRET && process.env.TRACKING_SECRET.length < 16) {
      throw new Error('TRACKING_SECRET must be at least 16 characters');
    }
    // WI-18.1 LOCK: API key encryption — fail production if missing
    if (!process.env.API_KEY_ENCRYPTION_KEY || process.env.API_KEY_ENCRYPTION_KEY.length < 32) {
      throw new Error(
        'API_KEY_ENCRYPTION_KEY must be set in production (min 32 chars). ' +
          'Without it, API keys are stored in PLAINTEXT. Generate: openssl rand -base64 32',
      );
    }
  } else {
    // Development: warn about missing security vars but don't block
    if (!process.env.API_KEY_ENCRYPTION_KEY) {
      logger.warn(
        '[ENV SECURITY] API_KEY_ENCRYPTION_KEY not set — API keys will be stored unencrypted. ' +
          'This is acceptable in development but MUST be set in production.',
      );
    }
  }

  // Log AI provider status at startup
  const ai = getAIProviderStatus();
  logger.info(`[ENV] AI providers configured: ${ai.count} (${ai.providers.join(', ') || 'none'})`);

  return env;
}
