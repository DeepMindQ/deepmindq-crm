// Runtime environment variable validation using Zod
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  NEXTAUTH_URL: z.string().url().optional().default('http://localhost:3000'),
  NEXTAUTH_SECRET: z.string().min(1, 'NEXTAUTH_SECRET is required'),
  // AI API keys (optional - app works with template fallback)
  OPENAI_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  GROQ_API_KEY: z.string().optional(),
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
    console.error(`[ENV] Missing env vars (dev mode): ${missing}`)
  }

  _env = result.data as EnvConfig
  return _env
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
  return env
}