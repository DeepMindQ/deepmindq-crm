# Environment Configuration

> DeepMindQ dedicated deployment environment variable reference.

## 1. Overview

DeepMindQ uses environment variables for all configuration. Each customer deployment gets its own `.env` file with its own secrets — there is no shared configuration between customers. The system validates variables at startup via `src/lib/validate-env.ts` (called from `src/instrumentation.ts`) and degrades gracefully when AI keys are missing.

All AI provider keys are **optional**. When a key is absent, that provider tier is simply unavailable — the system falls through to the next provider or ultimately to a template fallback. No crash, no missing-variable error.

## 2. Complete Variable Reference

### Database

| Variable | Purpose | Required | Context | Default | Generation Command |
|---|---|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string (app queries). On Vercel/Neon, use the pgbouncer URL with `?pgbouncer=true&sslmode=require`. | **Yes** | All environments | — | `postgresql://user:pass@localhost:5432/deepmindq` |
| `DIRECT_DATABASE_URL` | Direct PostgreSQL connection for Prisma migrations (no connection pooling). Required on Vercel/Neon; not needed for local dev. | Vercel only | Production (Neon) | — | Same as DATABASE_URL but without `?pgbouncer=true` |

### Authentication

| Variable | Purpose | Required | Context | Default | Generation Command |
|---|---|---|---|---|---|
| `NEXTAUTH_SECRET` | HMAC secret for NextAuth session token signing and encryption. Must be ≥32 characters in production. | **Yes (prod)** | Production | — | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Canonical URL of the application. Used for OAuth callbacks and redirect URLs. | No | All | `http://localhost:3000` | — |
| `AUTHORIZED_EMAIL` | Single email address permitted to log in/register. Acts as the admin account for the deployment. | **Yes (prod)** | Production | — | — |

### AI Providers (All Optional — Graceful Degradation)

Priority order: NVIDIA → Fireworks → Groq → Gemini (configured in `ai-config.ts`).

| Variable | Purpose | Required | Context | Default | Generation Command |
|---|---|---|---|---|---|
| `NVIDIA_API_KEY` | **Primary** AI provider — Llama 3.1 8B Instruct via NVIDIA NIM. Free ~40 RPM. | No | All | — | Get from [build.nvidia.com](https://build.nvidia.com/) → API Keys |
| `FIREWORKS_API_KEY` | **Backup** AI provider — Llama 3.3 70B via Fireworks. Free tier. | No | All | — | Get from [fireworks.ai](https://fireworks.ai/api) → API Keys |
| `GROQ_API_KEY` | **Fallback** AI provider — Llama 3.3 70B via Groq. Free tier (may block India IPs). | No | All | — | Get from [console.groq.com/keys](https://console.groq.com/keys) |
| `GEMINI_API_KEY` | **Fallback** AI provider — Gemini 2.0 Flash. Free tier (may block India IPs). | No | All | — | Get from [aistudio.google.com/apikey](https://aistudio.google.com/apikey) |
| `TAVILY_API_KEY` | Web search provider for grounding engine. Free 1000 searches/month. | No | All | — | Get from [app.tavily.com](https://app.tavily.com/) → API Keys |
| `OPENAI_API_KEY` | Additional/future AI provider. Validated in schema but not referenced in the primary tier chain. | No | All | — | Get from [platform.openai.com](https://platform.openai.com/) |

### Email

| Variable | Purpose | Required | Context | Default | Generation Command |
|---|---|---|---|---|---|
| `EMAIL_PROVIDER` | Email service provider identifier. | No | All | `resend` | — |
| `EMAIL_API_KEY` | Resend API key for sending transactional emails (OTP codes, notifications, sequence emails). Without this, OTP login will fail. | No* | All | — | Get from [resend.com/api-keys](https://resend.com/api-keys) (format: `re_xxxxx`)
| `EMAIL_FROM` | Sender email address. Must be on a domain verified in the Resend dashboard. For initial testing use `onboarding@resend.dev` (Resend sandbox — sends only to your account email). | No* | All | — | — |
| `SMTP_HOST` | SMTP server hostname (alternative to Resend). | No | All | — | — |
| `SMTP_PORT` | SMTP server port. | No | All | `587` | — |
| `SMTP_USER` | SMTP authentication username. | No | All | — | — |
| `SMTP_PASS` | SMTP authentication password. | No | All | — | — |

\* `EMAIL_API_KEY` and `EMAIL_FROM` are functionally required if OTP login is needed.

### Secrets & Tokens

| Variable | Purpose | Required | Context | Default | Generation Command |
|---|---|---|---|---|---|
| `TRACKING_SECRET` | HMAC secret for email tracking (open/click) token signing. Must be ≥16 characters in production. | **Yes (prod)** | Production | — | `openssl rand -hex 32` |
| `CRON_SECRET` | Bearer token authenticating Vercel Cron job invocations to `/api/cron/*`. | No | Production | — | `openssl rand -hex 32` |
| `RESEND_WEBHOOK_SECRET` | HMAC signing secret for verifying inbound Resend webhooks (bounce, delivery events). | No | Production | — | Get from Resend Dashboard → Webhooks → Signing Key |
| `SETUP_TOKEN` | One-time bearer token for `/api/setup-db` initial database seeding. Should be rotated after use. | No | Initial setup | — | `openssl rand -hex 32` |

### Public URLs (Client-Exposed)

| Variable | Purpose | Required | Context | Default | Generation Command |
|---|---|---|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Public base URL used in email links, tracking pixels, and client-side redirects. Example: `https://app.customerdomain.com`. | No | Production | — | — |

### Error Tracking (Optional)

| Variable | Purpose | Required | Context | Default | Generation Command |
|---|---|---|---|---|---|
| `SENTRY_DSN` | Sentry server-side DSN for error tracking. | No | Production | — | Get from [sentry.io](https://sentry.io/) → Project Settings → Client Keys |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry client-side DSN (browser errors). | No | Production | — | Same source as above |

### File Attachments (Optional)

| Variable | Purpose | Required | Context | Default | Generation Command |
|---|---|---|---|---|---|
| `S3_BUCKET` | S3 bucket name for file attachment storage. | No | All | — | — |
| `S3_REGION` | S3 region. | No | All | — | — |
| `S3_ACCESS_KEY` | S3 access key. | No | All | — | — |
| `S3_SECRET_KEY` | S3 secret key. | No | All | — | — |

### Docker Compose Only

These are used by `docker-compose.yml` to construct the `DATABASE_URL` internally. They are **not** read by the application directly.

| Variable | Purpose | Required | Context | Default | Generation Command |
|---|---|---|---|---|---|
| `POSTGRES_USER` | PostgreSQL superuser name for the Docker container. | **Yes** | Docker | — | — |
| `POSTGRES_PASSWORD` | PostgreSQL superuser password for the Docker container. | **Yes** | Docker | — | — |
| `POSTGRES_DB` | Database name. | No | Docker | `deepmindq` | — |
| `DB_PORT` | Host port mapped to PostgreSQL container port 5432. | No | Docker | `5432` | — |
| `APP_PORT` | Host port mapped to app container port 3000. | No | Docker | `3000` | — |
| `PORT` | Internal port the Next.js app listens on. | No | Docker | `3000` | — |

## 3. Startup Validation

The file `src/lib/validate-env.ts` runs at server startup, loaded by `src/instrumentation.ts` (Next.js instrumentation hook).

### How It Works

1. **Zod schema** (`envSchema`) defines type-safe parsing rules for all variables.
2. `getEnv()` calls `envSchema.safeParse(process.env)` and caches the result.
3. `validateEnv()` is the entry point, called from `instrumentation.ts`.

### Behavior by Environment

| Environment | Validation Failure | Effect |
|---|---|---|
| **Production** | Missing `DATABASE_URL`, `NEXTAUTH_SECRET` (or <32 chars), `TRACKING_SECRET`, or `AUTHORIZED_EMAIL` | Throws `Error` → caught in `instrumentation.ts` → `process.exit(1)` |
| **Development** | Same missing variables | Logs `logger.error(...)` but continues running |

### Required vs Optional (per validate-env.ts)

**Zod-level required** (`.min(1)` — fails parsing in both envs):
- `DATABASE_URL`
- `NEXTAUTH_SECRET`

**Zod-level optional** (`.optional()` — never fails parsing):
- All AI keys (`NVIDIA_API_KEY`, `FIREWORKS_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY`, `TAVILY_API_KEY`)
- All SMTP variables
- All S3 variables
- `EMAIL_API_KEY`, `EMAIL_FROM`, `CRON_SECRET`, `RESEND_WEBHOOK_SECRET`, `SETUP_TOKEN`, `DIRECT_DATABASE_URL`, `AUTHORIZED_EMAIL`, `TRACKING_SECRET`

**Production-only additional checks** in `validateEnv()` (not in Zod schema):
- `NEXTAUTH_SECRET` must be ≥32 characters
- `TRACKING_SECRET` must be present and ≥16 characters
- `DATABASE_URL` must be present
- `AUTHORIZED_EMAIL` must be present

### Health Report

`getEnvHealthReport()` returns a structured diagnostic object used by monitoring endpoints:

- **`healthy`** — DB, auth secret, tracking secret, authorized email all present; AI providers configured
- **`degraded`** — Core vars present but no AI providers or short auth secret
- **`critical`** — Missing DB, auth secret, tracking secret, or authorized email

## 4. AI Key Graceful Degradation

When AI keys are missing, the engine system degrades gracefully — **no crashes**. The behavior is:

1. **Missing key** = that provider tier is unavailable.
2. The model router (`ai-config.ts`) walks the priority chain: **NVIDIA → Fireworks → Groq → Gemini**.
3. If all providers are exhausted (no keys configured), the system falls back to **template-based responses** — pre-written content without LLM generation.
4. At startup, `validateEnv()` logs: `[ENV] AI providers configured: N (provider1, provider2, ...)` or `[ENV] AI providers configured: 0 (none)`.

The `/api/health` endpoint reports which providers are configured (boolean flags, no secret values exposed) so operators can verify at a glance.

## 5. Per-Customer Isolation

Each DeepMindQ deployment is fully isolated:

- Each customer has their **own `.env` file** with their own secrets.
- No environment variables are shared between customer deployments.
- `AUTHORIZED_EMAIL` restricts login to a single admin per deployment.
- `DATABASE_URL` points to a customer-specific PostgreSQL instance (or schema).
- AI keys are customer-specific — one customer's rate limits do not affect another.
- Docker Compose deployments use `${VAR:?message}` syntax for required vars, ensuring the container refuses to start if secrets are missing.

## 6. Secret Generation Commands

Copy-pasteable commands for generating secrets during deployment setup:

```bash
# NextAuth session secret (min 32 chars, base64-encoded)
openssl rand -base64 32

# Tracking secret (min 16 chars, hex-encoded)
openssl rand -hex 32

# Cron job authentication token (hex-encoded)
openssl rand -hex 32

# Setup token for one-time /api/setup-db (hex-encoded)
openssl rand -hex 32
```

### DATABASE_URL Format

```bash
# Local development
DATABASE_URL=postgresql://user:pass@localhost:5432/deepmindq

# Production (Neon on Vercel) — app queries (connection pooled)
DATABASE_URL=postgresql://neondb_owner:xxx@ep-xxx.aws.neon.tech/neondb?pgbouncer=true&sslmode=require

# Production (Neon on Vercel) — migrations (direct TCP)
DIRECT_DATABASE_URL=postgresql://neondb_owner:xxx@ep-xxx.aws.neon.tech/neondb?sslmode=require
```

### Docker Compose Setup

For Docker deployments, only `POSTGRES_USER` and `POSTGRES_PASSWORD` are needed — the `DATABASE_URL` is constructed automatically by `docker-compose.yml`:

```bash
# In .env for docker compose
POSTGRES_USER=deepmindq
POSTGRES_PASSWORD=<generate with: openssl rand -base64 32>
NEXTAUTH_SECRET=<generate with: openssl rand -base64 32>
AUTHORIZED_EMAIL=admin@customer-domain.com
TRACKING_SECRET=<generate with: openssl rand -hex 32>
```
