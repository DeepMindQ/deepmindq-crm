// Runtime environment variable validation using Zod
import { z } from 'zod'
import { logger } from '@/lib/logger';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  NEXTAUTH_URL: z.string().url().optional().default('http://localhost:3000'),
  NEXTAUTH_SECRET: z.string().min(1, 'NEXTAUTH_SECRET is required'),
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
})

export type EnvConfig = z.infer<typeof envSchema>

let _env: EnvConfig | null = null

export function getEnv(): EnvConfig {
  if (_env) return _env

  const result = envSchema.safeParse(process.env)

  if (!result.success) {
    const missing = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`Missing required env vars: ${missing}`)
    }
    logger.error(`[ENV] Missing env vars (dev mode): ${missing}`)
  }

  _env = result.data as EnvConfig
  return _env
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
  ]
  const configured = aiKeys.filter(([, v]) => v && v.length > 0).map(([name]) => name)
  return { providers: configured, count: configured.length }
}

/**
 * Returns a health report of all env configuration.
 * Useful for /api/health and startup diagnostics.
 */
export function getEnvHealthReport(): {
  database: boolean;
  auth: { secret: boolean; minLength: boolean };
  ai: { providers: string[]; count: number; tavily: boolean };
  smtp: boolean;
  status: 'healthy' | 'degraded' | 'critical';
  warnings: string[];
} {
  const warnings: string[] = []
  const env = process.env

  // Database
  const database = !!env.DATABASE_URL

  // Auth
  const secret = !!env.NEXTAUTH_SECRET
  const minLength = !!(env.NEXTAUTH_SECRET && env.NEXTAUTH_SECRET.length >= 32)
  if (!secret) warnings.push('NEXTAUTH_SECRET is not set — auth will fail')
  if (secret && !minLength) warnings.push('NEXTAUTH_SECRET is less than 32 characters')

  // AI
  const ai = getAIProviderStatus()
  if (ai.count === 0) warnings.push('No AI providers configured — AI features will use template fallback')
  const tavily = !!env.TAVILY_API_KEY

  // SMTP
  const smtp = !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS)

  // Overall status
  let status: 'healthy' | 'degraded' | 'critical' = 'healthy'
  if (!database || !secret) status = 'critical'
  else if (ai.count === 0 || !minLength) status = 'degraded'

  return { database, auth: { secret, minLength }, ai: { ...ai, tavily }, smtp, status, warnings }
}

// Validate env on import (warn only in dev, throw in prod)
export function validateEnv() {
  const env = getEnv()
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET.length < 32) {
      throw new Error('NEXTAUTH_SECRET must be set and at least 32 characters in production')
    }
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL must be set in production')
    }
  }

  // Log AI provider status at startup
  const ai = getAIProviderStatus()
  logger.info(`[ENV] AI providers configured: ${ai.count} (${ai.providers.join(', ') || 'none'})`)

  return env
}