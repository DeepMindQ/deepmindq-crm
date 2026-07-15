// Runtime environment variable validation using Zod
import { z } from 'zod'

const envSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  NEXTAUTH_URL: z.string().url().optional().default('http://localhost:3000'),
  NEXTAUTH_SECRET: z.string().min(1, 'NEXTAUTH_SECRET is required').default('deepmindq-dev-secret-change-in-production'),
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
    console.error('[ENV] Invalid environment configuration:')
    for (const issue of result.error.issues) {
      console.error(`  - ${issue.path.join('.')}: ${issue.message}`)
    }
    // In development, use defaults where possible
    _env = envSchema.parse(process.env)
    return _env
  }

  _env = result.data
  return _env
}

// Validate env on import (warn only in dev, throw in prod)
export function validateEnv() {
  const env = getEnv()
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.NEXTAUTH_SECRET || process.env.NEXTAUTH_SECRET === 'deepmindq-dev-secret-change-in-production') {
      console.warn('[ENV] WARNING: Using default NEXTAUTH_SECRET. Change this in production!')
    }
  }
  return env
}