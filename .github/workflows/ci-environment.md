# DeepMindQ — CI Environment Configuration

## Overview

This document describes all environment variables required by DeepMindQ's CI pipeline.
A new engineer should be able to clone the repository and understand exactly what CI requires.

## Environment Variable Matrix

### Required for All CI Jobs

| Variable | Purpose | Required By | CI Value | Local Dev |
|----------|---------|-------------|----------|------------|
| `NODE_VERSION` | Node.js version for setup | GitHub Actions workflow | `22` | System Node.js |
| `CI` | Indicates CI environment | Vitest (test framework) | `true` | Not set |
| `NODE_OPTIONS` | V8 memory limits | Node.js runtime | `--max-old-space-size=2048` (unit), `3072` (integration/E2E), `4096` (playwright/perf) | Not set |

### Database Variables

| Variable | Purpose | Required By | CI Value | Local Dev |
|----------|---------|-------------|----------|------------|
| `DATABASE_URL` | PostgreSQL connection string | Prisma ORM, `validate-env.ts` | `postgresql://ci_test:ci_test_pass@localhost:5432/ci_test` | Your local PostgreSQL URL |
| `DIRECT_DATABASE_URL` | Direct DB connection (bypass pool) | Prisma migrations | `postgresql://ci_test:ci_test_pass@localhost:5432/ci_test` | Same as DATABASE_URL |

### Authentication Variables

| Variable | Purpose | Required By | CI Value | Local Dev |
|----------|---------|-------------|----------|------------|
| `NEXTAUTH_SECRET` | NextAuth.js session encryption | `validate-env.ts` (production) | `${{ secrets.NEXTAUTH_SECRET \|\| 'ci-test-secret-for-build-only-long-enough-32chars!!' }}` | Generate with `openssl rand -base64 32` |
| `API_KEY_ENCRYPTION_KEY` | Encrypts stored API keys | `validate-env.ts` (production) | `${{ secrets.API_KEY_ENCRYPTION_KEY \|\| 'ci-test-encryption-key-min-32-bytes-ok!' }}` | Generate with `openssl rand -base64 32` |
| `AUTHORIZED_EMAIL` | Whitelisted email for OTP login | `validate-env.ts` (production), login flow | `${{ secrets.AUTHORIZED_EMAIL \|\| 'ci-test@deepmindq.com' }}` | Your email address |
| `TRACKING_SECRET` | HMAC secret for email tracking | `validate-env.ts` (production), email-tracking | `${{ secrets.TRACKING_SECRET \|\| 'ci-test-tracking-secret-min16!!' }}` | Generate with `openssl rand -hex 16` |
| `SESSION_TOKEN_HMAC_SECRET` | HMAC for session token hashing | Session management (optional) | Not set in CI (tests mock sessions) | Generate with `openssl rand -hex 32` |

### AI Provider Variables (Optional — tests mock AI calls)

| Variable | Purpose | Required By | CI Value | Local Dev |
|----------|---------|-------------|----------|------------|
| `OPENAI_API_KEY` | OpenAI GPT models | AI engine, model router | Not set (mocked in tests) | Your OpenAI API key |
| `GEMINI_API_KEY` | Google Gemini models | AI engine, model router | Not set (mocked in tests) | Your Gemini API key |
| `GROQ_API_KEY` | Groq fast inference | AI engine, model router | Not set (mocked in tests) | Your Groq API key |
| `FIREWORKS_API_KEY` | Fireworks AI | AI engine, model router | Not set (mocked in tests) | Your Fireworks key |
| `NVIDIA_API_KEY` | NVIDIA NIM models | AI engine, model router | Not set (mocked in tests) | Your NVIDIA key |
| `TAVILY_API_KEY` | Tavily search API | AI retrieval, web search | Not set (mocked in tests) | Your Tavily key |

### SMTP Variables (Optional — email tests mock SMTP)

| Variable | Purpose | Required By | CI Value | Local Dev |
|----------|---------|-------------|----------|------------|
| `SMTP_HOST` | SMTP server hostname | Email provider | Not set | `smtp.gmail.com` |
| `SMTP_PORT` | SMTP server port | Email provider | Not set (default: 587) | `587` |
| `SMTP_USER` | SMTP username | Email provider | Not set | Your Gmail address |
| `SMTP_PASS` | SMTP password | Email provider | Not set | App password |

### Storage Variables (Optional — tests mock S3)

| Variable | Purpose | Required By | CI Value | Local Dev |
|----------|---------|-------------|----------|------------|
| `S3_BUCKET` | S3 bucket name | File storage | Not set | Your bucket name |
| `S3_REGION` | S3 region | File storage | Not set | `us-east-1` |
| `S3_ACCESS_KEY` | S3 access key | File storage | Not set | Your AWS access key |
| `S3_SECRET_KEY` | S3 secret key | File storage | Not set | Your AWS secret key |

### Other Variables (Optional)

| Variable | Purpose | Required By | CI Value | Local Dev |
|----------|---------|-------------|----------|------------|
| `EMAIL_API_KEY` | Email service API key | Email provider | Not set | Your Resend/key |
| `EMAIL_FROM` | Sender email address | Email sending | Not set | `noreply@yourdomain.com` |
| `CRON_SECRET` | Cron job authentication | Cron endpoints | Not set | Generate random secret |
| `RESEND_WEBHOOK_SECRET` | Resend webhook verification | Email webhooks | Not set | Your webhook secret |
| `SETUP_TOKEN` | Initial setup token | Setup flow | Not set | Generate random token |
| `NEXTAUTH_URL` | NextAuth base URL | Auth callbacks | Default: `http://localhost:3000` | Your dev URL |

---

## Production Validation Rules

The `validate-env.ts` module enforces these rules in **production only**:

| Variable | Rule | Error if Missing |
|----------|------|-----------------|
| `DATABASE_URL` | Required | `DATABASE_URL is required` |
| `API_KEY_ENCRYPTION_KEY` | Required | Must be >= 32 chars |
| `NEXTAUTH_SECRET` | Required | Must be >= 32 chars |
| `TRACKING_SECRET` | Required | Must be >= 16 chars |
| `AUTHORIZED_EMAIL` | Required | Must be non-empty |

CI sets dummy values for all production-required variables to prevent build/start crashes.

---

## CI Job Environment Configuration

### Jobs with PostgreSQL Service (real database)

| Job | Env Vars Set |
|-----|-------------|
| API Tests | `DATABASE_URL`, `DIRECT_DATABASE_URL` |
| Database Tests | `DATABASE_URL`, `DIRECT_DATABASE_URL` |

### Jobs with Build/Start (production validation)

| Job | Env Vars Set |
|-----|-------------|
| Playwright E2E | `DATABASE_URL`, `NEXTAUTH_SECRET`, `API_KEY_ENCRYPTION_KEY`, `TRACKING_SECRET`, `AUTHORIZED_EMAIL` |
| Build Verification | `DATABASE_URL`, `NEXTAUTH_SECRET`, `API_KEY_ENCRYPTION_KEY`, `TRACKING_SECRET`, `AUTHORIZED_EMAIL` |

### Jobs with DATABASE_URL (Prisma import safety)

| Job | Env Vars Set |
|-----|-------------|
| Unit Tests | `DATABASE_URL` (prevents Prisma validation crash even though db is mocked) |

---

## Adding a New Environment Variable

1. Add Zod validation to `src/lib/validate-env.ts`
2. If required in production: add to the production validation section
3. Add to CI workflow jobs that need it (with fallback CI value)
4. Update this document
5. Add to `.env.example` if applicable
