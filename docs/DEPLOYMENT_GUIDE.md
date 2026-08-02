# DeepMindQ — Deployment Guide

> **Audience:** Senior engineer deploying a fresh customer instance. No prior context assumed.
> **Last updated:** WI-14 (Productization)

---

## 1. Deployment Model Overview

DeepMindQ uses **dedicated per-customer enterprise deployments**. Each customer receives completely isolated infrastructure — there is **no multi-tenancy, no shared databases, no shared storage**.

### Isolation Guarantees

| Resource | Per Customer | Shared? |
|----------|-------------|---------|
| PostgreSQL database | Own instance/schema | No |
| S3 storage (attachments) | Own bucket | No |
| Environment secrets | Own `.env` | No |
| Domain | Own domain | No |
| Docker container | Own container | No |
| AI API keys | Own keys | No |

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        Customer A Instance                             │
│                                                                         │
│  www.customer-a.com                                                      │
│       │                                                                 │
│       ▼                                                                 │
│  ┌──────────┐     ┌──────────────┐     ┌──────────┐                     │
│  │  Caddy /  │────▶│  DeepMindQ   │────▶│  Postgres │                     │
│  │  Reverse  │     │  App (port   │     │     A     │                     │
│  │  Proxy    │     │   3000)      │     │           │                     │
│  └──────────┘     └──────┬───────┘     └──────────┘                     │
│                          │                                             │
│                    ┌─────┴──────┐                                      │
│                    ▼            ▼                                      │
│               ┌─────────┐  ┌────────┐                                  │
│               │  S3-A   │  │ AI APIs│                                  │
│               │ (files) │  │ (keys) │                                  │
│               └─────────┘  └────────┘                                  │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────┐
│                        Customer B Instance                             │
│                                                                         │
│  www.customer-b.com                                                      │
│       │                                                                 │
│       ▼                                                                 │
│  ┌──────────┐     ┌──────────────┐     ┌──────────┐                     │
│  │  Caddy /  │────▶│  DeepMindQ   │────▶│  Postgres │                     │
│  │  Reverse  │     │  App (port   │     │     B     │                     │
│  │  Proxy    │     │   3000)      │     │           │                     │
│  └──────────┘     └──────┬───────┘     └──────────┘                     │
│                          │                                             │
│                    ┌─────┴──────┐                                      │
│                    ▼            ▼                                      │
│               ┌─────────┐  ┌────────┐                                  │
│               │  S3-B   │  │ AI APIs│                                  │
│               │ (files) │  │ (keys) │                                  │
│               └─────────┘  └────────┘                                  │
└─────────────────────────────────────────────────────────────────────────┘

Zero shared infrastructure between Customer A and Customer B.
```

---

## 2. Prerequisites

| Requirement | Minimum | Notes |
|-------------|---------|-------|
| Docker | 20.10+ | With Docker Compose v2 (`docker compose` — note: **not** `docker-compose`) |
| Domain | Any registrar | DNS A/CNAME record pointing to your host |
| Email provider | Resend (recommended) | Required for OTP login codes. Free tier available. |
| AI API key | At least one | NVIDIA (free), Groq (free), Gemini (free), or Fireworks (free) |
| Ports | 3000, 5432 open | App and PostgreSQL. Customisable via `APP_PORT` / `DB_PORT`. |
| TLS termination | Caddy (recommended) | Handles auto-HTTPS. Or use a load balancer / cloud proxy. |

---

## 3. Docker Deployment (Primary Method)

### Step 1 — Clone the repository

```bash
git clone https://github.com/your-org/deepmindq.git /opt/deepmindq
cd /opt/deepmindq
git checkout v0.2.0        # Pin to a tagged release
```

### Step 2 — Copy environment template

```bash
cp .env.example .env
```

### Step 3 — Generate all required secrets

```bash
# Auth secret (min 32 chars)
openssl rand -base64 32

# Tracking secret (min 16 chars)
openssl rand -hex 32

# Cron secret
openssl rand -hex 32

# Setup token (one-time DB initialisation)
openssl rand -hex 32

# Resend webhook secret (get from Resend Dashboard → Webhooks → Signing Key)
# No generation needed — copy from Resend.

# Database password
openssl rand -base64 24
```

### Step 4 — Configure environment variables

Edit `.env` with values from Step 3. See [Section 4](#4-environment-setup) for the full variable reference.

Minimal working `.env`:

```env
# ── Database ──
POSTGRES_USER=deepmindq
POSTGRES_PASSWORD=<generated-password>
POSTGRES_DB=deepmindq
DB_PORT=5432

# ── App ──
APP_PORT=3000
NEXTAUTH_URL=https://app.customer-a.com
NEXT_PUBLIC_APP_URL=https://app.customer-a.com

# ── Secrets ──
NEXTAUTH_SECRET=<generated-secret>
TRACKING_SECRET=<generated-secret>
CRON_SECRET=<generated-secret>
SETUP_TOKEN=<generated-token>

# ── Auth ──
AUTHORIZED_EMAIL=admin@customer-a.com

# ── Email (required for OTP login) ──
EMAIL_PROVIDER=resend
EMAIL_API_KEY=re_xxxxxxxxxxxxx
EMAIL_FROM=noreply@customer-a.com

# ── AI (at least one) ──
NVIDIA_API_KEY=nvapi-xxxxxxxxxxxx
```

### Step 5 — Build and start

```bash
docker compose up -d --build
```

### Step 6 — Wait for health checks

```bash
# Watch startup logs
docker compose logs -f app

# Wait until you see: "Ready on http://0.0.0.0:3000"
# Then verify:
docker compose ps
```

Expected output — all services `healthy` / `running`:

```
NAME                STATUS          PORTS
deepmindq-app-1     Up (healthy)    0.0.0.0:3000->3000/tcp
deepmindq-postgres-1  Up (healthy)  0.0.0.0:5432->5432/tcp
```

### Step 7 — Initialize database

```bash
SETUP_TOKEN=<your-setup-token>
curl -X POST http://localhost:3000/api/setup-db \
  -H "X-Setup-Token: ${SETUP_TOKEN}" \
  -H "Content-Type: application/json"
```

Expected response:

```json
{
  "success": true,
  "message": "Migrations applied.",
  "method": "migrate deploy",
  "output": "..."
}
```

### Step 8 — Verify deployment

```bash
# Basic health
curl -s http://localhost:3000/api/health | jq .

# Readiness (DB connectivity)
curl -s http://localhost:3000/api/ready | jq .

# Version
curl -s http://localhost:3000/api/version | jq .
```

### Step 9 — Login and verify

1. Open `https://app.customer-a.com` in a browser
2. Enter the `AUTHORIZED_EMAIL` address
3. Check email for OTP code
4. Enter OTP to log in
5. Verify the dashboard loads

---

## 4. Environment Setup

### Complete Variable Reference

| Variable | Purpose | Required In | Example Value | Generation Command |
|----------|---------|-------------|---------------|-------------------|
| `POSTGRES_USER` | PostgreSQL username | Docker | `deepmindq` | — |
| `POSTGRES_PASSWORD` | PostgreSQL password | Docker | `a3f8...k2m1` | `openssl rand -base64 24` |
| `POSTGRES_DB` | PostgreSQL database name | Docker | `deepmindq` | — |
| `DB_PORT` | PostgreSQL host port | Docker | `5432` | — |
| `APP_PORT` | Application host port | Docker | `3000` | — |
| `DATABASE_URL` | Prisma connection string | Production, Docker (auto) | `postgresql://user:pass@postgres:5432/deepmindq?schema=public` | — |
| `DIRECT_DATABASE_URL` | Prisma migration connection (no pooler) | Production (external DB) | `postgresql://user:pass@host:5432/deepmindq?sslmode=require` | — |
| `NEXTAUTH_SECRET` | JWT/session signing secret | All | `k8Fm...3xQ=` | `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Canonical app URL (server-side) | All | `https://app.customer-a.com` | — |
| `NEXT_PUBLIC_APP_URL` | Public base URL (client-side) | Production | `https://app.customer-a.com` | — |
| `AUTHORIZED_EMAIL` | Single email allowed to log in | Production | `admin@customer-a.com` | — |
| `TRACKING_SECRET` | HMAC secret for email tracking tokens | Production | `a1b2c3...` | `openssl rand -hex 32` |
| `SETUP_TOKEN` | One-time token for `/api/setup-db` | Production | `f7e3...` | `openssl rand -hex 32` |
| `CRON_SECRET` | Bearer token for cron job auth | Production | `d4c2...` | `openssl rand -hex 32` |
| `NVIDIA_API_KEY` | NVIDIA NIM AI (Llama 3.1 8B, free tier) | Optional | `nvapi-xxxx` | Get from [build.nvidia.com](https://build.nvidia.com/) |
| `FIREWORKS_API_KEY` | Fireworks AI backup (Llama 3.3 70B, free tier) | Optional | `fw_xxxx` | Get from [fireworks.ai](https://fireworks.ai/api) |
| `GROQ_API_KEY` | Groq fallback (Llama 3.3 70B, free tier) | Optional | `gsk_xxxx` | Get from [console.groq.com](https://console.groq.com/keys) |
| `GEMINI_API_KEY` | Google Gemini fallback (free tier) | Optional | `AIza...` | Get from [aistudio.google.com](https://aistudio.google.com/apikey) |
| `OPENAI_API_KEY` | OpenAI (optional) | Optional | `sk-...` | Get from [platform.openai.com](https://platform.openai.com/) |
| `TAVILY_API_KEY` | Web search (1000 free searches/month) | Optional | `tvly-xxxx` | Get from [app.tavily.com](https://app.tavily.com/) |
| `EMAIL_PROVIDER` | Email service provider name | Production (for login) | `resend` | — |
| `EMAIL_API_KEY` | Resend API key | Production (for login) | `re_xxxxx` | Get from [resend.com](https://resend.com/api-keys) |
| `EMAIL_FROM` | Sender email address | Production (for login) | `noreply@customer-a.com` | — |
| `SMTP_HOST` | Custom SMTP host (alternative to Resend) | Optional | `smtp.gmail.com` | — |
| `SMTP_PORT` | Custom SMTP port | Optional | `587` | — |
| `SMTP_USER` | Custom SMTP username | Optional | `user@gmail.com` | — |
| `SMTP_PASS` | Custom SMTP password | Optional | `app-password` | — |
| `RESEND_WEBHOOK_SECRET` | HMAC signing key for Resend webhooks | Optional | `whsec_xxx` | From Resend Dashboard → Webhooks |
| `S3_BUCKET` | S3 bucket for file attachments | Optional | `customer-a-uploads` | — |
| `S3_REGION` | S3 region | Optional | `us-east-1` | — |
| `S3_ACCESS_KEY` | S3 access key | Optional | `AKIA...` | — |
| `S3_SECRET_KEY` | S3 secret key | Optional | `xxxx` | — |
| `SENTRY_DSN` | Sentry server-side DSN | Optional | `https://xxx@sentry.io/123` | Get from [sentry.io](https://sentry.io/) |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry client-side DSN | Optional | `https://xxx@sentry.io/123` | Get from [sentry.io](https://sentry.io/) |

### Startup Validation

At startup, `src/lib/validate-env.ts` validates environment variables using Zod:

- **Production:** App **exits immediately** if required vars are missing (`DATABASE_URL`, `NEXTAUTH_SECRET` ≥ 32 chars, `TRACKING_SECRET`, `AUTHORIZED_EMAIL`)
- **Development:** Warnings are logged but app continues running

---

## 5. Database Initialization

### Via `/api/setup-db` (Recommended for Docker + PaaS)

The `/api/setup-db` endpoint applies all pending Prisma migrations to a fresh database.

**Security:** Double-gated — requires both `SETUP_TOKEN` env var and matching `X-Setup-Token` header.

```bash
# Set your token first
export SETUP_TOKEN="$(grep SETUP_TOKEN .env | cut -d= -f2)"

# Run setup
curl -X POST http://localhost:3000/api/setup-db \
  -H "X-Setup-Token: ${SETUP_TOKEN}"
```

**What it does:**
1. Checks for migration files in `prisma/migrations/`
2. If migrations exist → runs `prisma migrate deploy`
3. If no migrations → runs `prisma db push` (schema sync)
4. Returns success/failure with the method used

**Verify:**

```bash
curl -s http://localhost:3000/api/health | jq '.db'
# Expected: true
curl -s http://localhost:3000/api/ready | jq '.'
# Expected: {"status":"ready","db":true}
```

> **Note:** The Docker `Dockerfile` already runs `prisma migrate deploy` during the build stage. The `/api/setup-db` endpoint is a safety net for scenarios where the build-time DB wasn't reachable (e.g., external managed databases on first deploy).

---

## 6. Prisma Migration Strategy

| Context | Command | When to Use |
|---------|---------|-------------|
| Development | `npx prisma migrate dev` | Local dev — creates and applies migrations interactively |
| Production (Docker build) | `npx prisma migrate deploy` | Runs inside Dockerfile build stage. Applies pending migrations without prompting. |
| Production (runtime) | `POST /api/setup-db` | Post-deploy safety net for external databases |
| Prototyping only | `npx prisma db push` | Syncs schema without migration files. **Never use in production.** |

### How Migrations Work in Docker

```
Dockerfile Stage 2 (builder):
  ┌─────────────────────────────┐
  │ npx prisma generate         │  ← Generates Prisma Client
  │ npx prisma migrate deploy    │  ← Applies pending migrations
  │ npx next build               │  ← Builds Next.js app
  └─────────────────────────────┘
        │
        ▼
Dockerfile Stage 3 (runner):
  ┌─────────────────────────────┐
  │ Copies built app + Prisma   │
  │ Runs: node server.js        │
  └─────────────────────────────┘
```

**Important:** The Docker build needs `DATABASE_URL` to reach the database at build time. For Docker Compose deployments, the database container is started first (via `depends_on: condition: service_healthy`), but the build happens before that. This is why `/api/setup-db` exists as a runtime fallback.

---

## 7. Backup Procedure

### Automated Daily Backup (Docker Compose)

The `backup` service in `docker-compose.yml` runs as a one-shot container. Schedule it via host cron:

```bash
# Add to host crontab (run daily at 2 AM)
(crontab -l 2>/dev/null; echo "0 2 * * * cd /opt/deepmindq && docker compose run --rm backup >> /var/log/deepmindq-backup.log 2>&1") | crontab -
```

### Manual Backup

```bash
docker compose run --rm backup
```

### Backup Details

| Property | Value |
|----------|-------|
| Format | Gzipped SQL dump (`pg_dump --compress=9`) |
| Location | Docker volume `backup_data` mounted at `/backups` |
| Filename pattern | `deepmindq-YYYYMMDD-HHMMSS.sql.gz` |
| Retention | Last 30 backups (auto-rotated) |
| Access from host | `docker compose exec backup ls -lh /backups/` |

### Standalone Backup Script

For non-Docker setups or custom scheduling:

```bash
# Run with default 30-day retention
./scripts/backup.sh

# Run with custom retention
./scripts/backup.sh 7   # Keep last 7 backups only
```

---

## 8. Restore Procedure

The restore script is at `scripts/restore.sh`. When running inside Docker, set environment variables to point to the Docker database.

### List Available Backups

```bash
DB_NAME=deepmindq DB_USER=deepmindq POSTGRES_HOST=postgres POSTGRES_PORT=5432 \
  ./scripts/restore.sh --list
```

Or from within the backup container:

```bash
docker compose run --rm backup ls -lht /backups/
```

### Restore Latest Backup

```bash
# Step 1: Pause the application to prevent write conflicts
docker compose pause app

# Step 2: Restore
DB_NAME=deepmindq DB_USER=deepmindq POSTGRES_HOST=localhost POSTGRES_PORT=5432 \
  ./scripts/restore.sh --latest
# Type 'yes' to confirm

# Step 3: Unpause and restart
docker compose unpause app
docker compose restart app

# Step 4: Verify
curl -s http://localhost:3000/api/health | jq '.db'
```

### Restore a Specific Backup

```bash
docker compose pause app

BACKUP_FILE=/backups/deepmindq-20250115-020000.sql.gz
docker compose exec postgres psql -U deepmindq -d deepmindq -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='deepmindq' AND pid <> pg_backend_pid();"
docker compose exec -T postgres gunzip -c "${BACKUP_FILE}" | docker compose exec -T postgres psql -U deepmindq -d deepmindq --quiet --single-transaction

docker compose unpause app
docker compose restart app
```

### Restore Options Summary

| Command | Description |
|---------|-------------|
| `./scripts/restore.sh --list` | List available backups with timestamps |
| `./scripts/restore.sh --latest` | Restore the most recent backup (interactive confirmation) |
| `./scripts/restore.sh <file>` | Restore a specific backup file |

> ⚠️ **Warning:** Restore **replaces ALL data** in the target database. This operation is irreversible. Always verify backups before restoring.

---

## 9. Upgrade Procedure

### Standard Upgrade

```bash
cd /opt/deepmindq

# Step 1: Pull latest code (pin to a release tag)
git fetch --tags
git checkout v0.3.0        # Or the target version

# Step 2: Run any new database migrations
docker compose run --rm app npx prisma migrate deploy

# Step 3: Rebuild and restart
docker compose up -d --build

# Step 4: Verify health
curl -s http://localhost:3000/api/health | jq '.'
curl -s http://localhost:3000/api/ready | jq '.'
curl -s http://localhost:3000/api/version | jq '.'

# Step 5: Check logs for errors
docker compose logs --tail=50 app
```

### Rollback

```bash
# Step 1: Checkout previous version
git checkout v0.2.0

# Step 2: Rebuild
docker compose up -d --build

# Step 3: Verify
curl -s http://localhost:3000/api/version | jq '.'
```

> **Note:** Prisma migrations are forward-only. If a rollback requires schema changes, restore from backup (see [Section 8](#8-restore-procedure)).

---

## 10. Monitoring and Verification

### Health Endpoints

| Endpoint | Purpose | Auth | Failure Response |
|----------|---------|------|-----------------|
| `GET /api/health` | Liveness probe — DB connectivity, uptime, configured AI providers | None | Always 200 (degraded if DB down) |
| `GET /api/ready` | Readiness probe — DB must be reachable | None | **503** if DB is down |
| `GET /api/version` | Version, environment, git SHA | None | Always 200 |

### Health Check Response Example

```json
{
  "status": "ok",
  "uptime": 86400,
  "timestamp": "2025-01-15T12:00:00.000Z",
  "providers": {
    "nvidia": true,
    "fireworks": false,
    "groq": true,
    "gemini": false,
    "tavily": true
  },
  "db": true
}
```

### Docker Health Checks

Already configured in `docker-compose.yml` and `Dockerfile`:

| Service | Check | Interval | Timeout | Retries | Start Period |
|---------|-------|----------|---------|---------|-------------|
| `postgres` | `pg_isready -U <user>` | 10s | 5s | 5 | — |
| `app` | `wget -qO- http://localhost:3000/api/health` | 30s | 5s | 3 | 20s |

### Sentry Error Tracking (Optional)

Set `SENTRY_DSN` and `NEXT_PUBLIC_SENTRY_DSN` in your `.env` to enable Sentry integration. The app automatically initializes Sentry on startup via `src/instrumentation.ts` and flushes events on graceful shutdown (SIGTERM/SIGINT).

---

## 11. Common Deployment Issues

### Port Already in Use

**Symptom:** `docker compose up` fails with "port is already allocated".

```bash
# Check what's using the port
ss -tlnp | grep :3000
ss -tlnp | grep :5432

# Fix: Change ports in .env
APP_PORT=3001
DB_PORT=5433
```

### Database Connection Refused

**Symptom:** App logs show `ECONNREFUSED` or `/api/ready` returns 503.

```bash
# Check postgres is healthy
docker compose ps postgres

# Check app can reach postgres
docker compose exec app wget -qO- postgres:5432 2>&1 | head -5

# Verify DATABASE_URL format
docker compose exec app printenv DATABASE_URL
# Should be: postgresql://user:pass@postgres:5432/deepmindq?schema=public
```

### Missing Required Environment Variables

**Symptom:** App exits immediately on startup with "Missing required env vars".

The app validates environment at startup via `src/lib/validate-env.ts`. In production, it **exits with code 1** if any of these are missing:

- `DATABASE_URL`
- `NEXTAUTH_SECRET` (must be ≥ 32 characters)
- `TRACKING_SECRET` (must be ≥ 16 characters)
- `AUTHORIZED_EMAIL`

```bash
# Check validation errors
docker compose logs app 2>&1 | head -20

# Common fix: add missing vars to .env
```

### AI Keys Not Working

**Symptom:** AI features return template fallback content, or API calls fail.

| Issue | Cause | Fix |
|-------|-------|-----|
| Rate limit errors | Free tier RPM exceeded | Add a backup provider key (NVIDIA + Groq + Gemini) |
| Region blocked | Groq/Gemini block certain IP ranges (notably India) | Use NVIDIA or Fireworks as primary instead |
| Invalid key | Key copied incorrectly | Regenerate from provider dashboard |
| No providers configured | All AI keys empty | At minimum, set `NVIDIA_API_KEY` (free tier available) |

```bash
# Check which providers are configured
curl -s http://localhost:3000/api/health | jq '.providers'

# Expected: at least one provider shows `true`
```

### Email/OTP Not Delivered

**Symptom:** Login OTP email never arrives.

```bash
# Check email config
docker compose exec app printenv EMAIL_PROVIDER EMAIL_API_KEY EMAIL_FROM

# Common issues:
# 1. EMAIL_FROM domain not verified in Resend dashboard
# 2. EMAIL_API_KEY is empty or invalid
# 3. For testing without domain: use EMAIL_FROM=onboarding@resend.dev
#    (only sends to your Resend account email)
```

### Startup Validation Failure in Production

**Symptom:** Container starts and immediately exits.

```bash
# Check exit reason
docker compose logs app

# Look for:
# [startup] Environment validation failed: Error: ...
#
# The app calls process.exit(1) in production if validation fails.
# Fix the missing/invalid env var and restart.
docker compose restart app
```
