# Troubleshooting

> Operational runbook for diagnosing and resolving DeepMindQ issues without diving into source code.

## 1. Monitoring Endpoints

### GET /api/health — Liveness Probe

Lightweight health check. Always returns HTTP 200 if the Node.js process is running — designed for container orchestrators and load balancers.

**Response (200):**
```json
{
  "status": "ok",
  "uptime": 86400.5,
  "timestamp": "2025-01-15T10:30:00.000Z",
  "providers": {
    "nvidia": true,
    "fireworks": false,
    "groq": true,
    "gemini": false,
    "tavily": false
  },
  "db": true
}
```

- `uptime` — Seconds since process start.
- `providers` — Boolean flags showing which AI providers have keys configured (secret values never exposed).
- `db` — Result of `SELECT 1` with a 3-second timeout. `false` means the database is unreachable, but the endpoint still returns 200.

**Use in health checks:**
```bash
# Quick liveness check
curl -sf http://localhost:3000/api/health | jq .db
# true = DB connected, false = DB down (but app is alive)
```

---

### GET /api/ready — Readiness Probe

Returns 200 only when the database is reachable. Returns 503 when the database is down.

**Response (200):**
```json
{ "status": "ready", "db": true }
```

**Response (503):**
```json
{ "status": "not_ready", "db": false }
```

**Use in health checks:**
```bash
# Readiness check (exit non-zero on 503)
curl -sf http://localhost:3000/api/ready || echo "NOT READY"
```

Use this as your **Kubernetes readiness probe** or **Docker Compose healthcheck** (it is already configured as the Docker healthcheck in `docker-compose.yml`).

---

### GET /api/version — Version Info

Returns the application version and runtime environment.

**Response (200):**
```json
{
  "version": "0.2.0",
  "environment": "production"
}
```

- `version` — Reads from `npm_package_version` (currently `0.2.0` in `package.json`).
- `environment` — Value of `NODE_ENV`.

**Note:** This endpoint does not include git SHA or build timestamp. For deployment verification, compare the `version` field against your release tags.

---

### Endpoint Summary

| Endpoint | Auth Required | Always 200? | Purpose |
|---|---|---|---|
| `/api/health` | No | Yes | Container liveness — process is alive |
| `/api/ready` | No | No (503 if DB down) | Database readiness — can serve requests |
| `/api/version` | No | Yes | Release identification |

## 2. Startup Failures

| Symptom | Cause | Resolution |
|---|---|---|
| Process exits immediately with code 1 | Missing required env var caught by `validateEnv()` in production | Check container/startup logs for `[startup] Environment validation failed:`. The error message lists the specific missing variable. Set it in `.env` or Docker environment. |
| Process exits with `NEXTAUTH_SECRET must be set and at least 32 characters in production` | `NEXTAUTH_SECRET` missing or too short | Generate: `openssl rand -base64 32` and set in env. |
| Process exits with `DATABASE_URL must be set in production` | `DATABASE_URL` not provided | For Docker: set `POSTGRES_USER` and `POSTGRES_PASSWORD` (DATABASE_URL is auto-constructed). For Vercel: set in Environment Variables dashboard. |
| Process exits with `TRACKING_SECRET must be set in production` | `TRACKING_SECRET` missing | Generate: `openssl rand -hex 32` and set in env. |
| Process exits with `AUTHORIZED_EMAIL must be set in production` | `AUTHORIZED_EMAIL` not set | Set to the admin email for this deployment. |
| Prisma Client initialization error | Invalid `DATABASE_URL` format or unreachable database | Verify PostgreSQL is running. Check connection string format: `postgresql://user:pass@host:5432/dbname`. For Neon, ensure `?sslmode=require` is present. |
| `prisma generate` fails | Schema syntax error in `schema.prisma` | Run `npx prisma generate` locally and fix any reported errors. Common issue: referencing a model that was renamed or deleted. |

## 3. Database Issues

| Symptom | Cause | Resolution |
|---|---|---|
| Connection refused on port 5432 | PostgreSQL not running or not reachable | Docker: `docker compose up -d postgres` and wait for healthcheck. Check `docker compose ps postgres` — should show `healthy`. Verify `DB_PORT` if non-default. |
| `pgbouncer` error in Neon deployment | Using `DIRECT_DATABASE_URL` for app queries (or vice versa) | `DATABASE_URL` = pgbouncer URL (with `?pgbouncer=true`). `DIRECT_DATABASE_URL` = direct URL (without pgbouncer). Do not swap them. |
| Migration pending / schema mismatch | New code deployed without running migrations | Docker: `docker compose run app npx prisma migrate deploy`. Vercel: migrations run automatically in `vercel-build` script (`prisma generate && next build`). For manual: `npx prisma migrate deploy`. |
| Migration conflict (checksum mismatch) | Out-of-order migrations or manual schema edits | `npx prisma migrate resolve --applied <migration_name>` to mark it applied, then `npx prisma migrate deploy`. |
| Slow queries on large tables | Missing database indexes | Check `schema.prisma` for `@@index` directives. Add composite indexes for common query patterns (e.g., company lookups by domain, signal queries by companyId). |
| `SELECT 1` timeout in health check | Database under heavy load or network latency | The health endpoint has a 3-second timeout. If consistently timing out, check database CPU/memory and connection pool limits. |

## 4. Authentication Issues

| Symptom | Cause | Resolution |
|---|---|---|
| OTP not delivered / not received | `EMAIL_API_KEY` missing or invalid | Verify `EMAIL_API_KEY` is set (format: `re_xxxxx`). Check Resend dashboard for delivery logs. For initial testing, ensure `EMAIL_FROM=onboarding@resend.dev` (sandbox mode only sends to your account email). |
| OTP not delivered — domain issue | `EMAIL_FROM` domain not verified in Resend | Verify the sending domain in Resend Dashboard → Domains. Until verified, use `onboarding@resend.dev`. |
| Login loops (keeps redirecting to login) | `AUTHORIZED_EMAIL` does not match the email used to log in | Verify `AUTHORIZED_EMAIL` in env matches exactly (case-sensitive) the email you are using. |
| CSRF token invalid error | Cookie/expiry mismatch or missing CSRF token | Clear browser cookies for the domain. Re-login. If persistent, check that `NEXTAUTH_SECRET` hasn't changed between server restarts (causes session cookie invalidation). |
| Session expires immediately | `NEXTAUTH_SECRET` changed or too short | Ensure `NEXTAUTH_SECRET` is stable across deploys and ≥32 characters. Changing it invalidates all existing sessions. |
| `NEXTAUTH_URL` mismatch | OAuth/callback URL doesn't match actual app URL | Set `NEXTAUTH_URL` to the exact public URL (e.g., `https://app.customer.com`). Do not include trailing slash. |

## 5. AI Engine Failures

| Symptom | Cause | Resolution |
|---|---|---|
| "All providers exhausted" error | No valid AI API keys configured | Set at least one of: `NVIDIA_API_KEY`, `FIREWORKS_API_KEY`, `GROQ_API_KEY`, `GEMINI_API_KEY`. Verify via `/api/health` → `providers` object. |
| Specific provider returns 401/403 | Invalid or revoked API key | Regenerate the key from the provider's dashboard. Check for IP restrictions (Groq and Gemini may block certain regions). |
| Rate limit errors (429) | Too many requests for the provider's free tier | Wait for rate limit window to reset. Add additional provider keys for higher throughput (the router will failover). |
| Responses are template fallbacks (no AI content) | All AI keys missing or all providers rate-limited | Check `/api/health` providers. This is expected graceful degradation — not an error. Set at least one key to get AI-generated content. |
| Hallucinated or low-quality responses | Low evidence quality or missing grounding | Verify `TAVILY_API_KEY` is set for web search grounding. Check that the grounding engine has evidence to work with. |
| Slow AI responses | Primary provider (NVIDIA) latency; failover to slower backup | This is the tier chain working as designed. If NVIDIA is slow, the system tries Fireworks, then Groq, then Gemini. |

## 6. Docker Issues

| Symptom | Cause | Resolution |
|---|---|---|
| Container won't start — "required" error | Missing env var with `${VAR:?message}` syntax in `docker-compose.yml` | Required Docker vars: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `NEXTAUTH_SECRET` (min 32 chars), `AUTHORIZED_EMAIL`, `TRACKING_SECRET`. Check `docker compose config` to validate. |
| Container starts but health check fails | App not responding on port 3000 within 20s start period | `docker compose logs -f app` to see startup errors. Common: invalid env vars causing `validateEnv()` to throw. Verify `PORT=3000` is set. |
| `docker compose up` fails — build error | TypeScript compilation error or Prisma generate failure | Run `npm run build` locally first to catch errors. Check that `prisma generate` succeeds: `npx prisma generate`. |
| PostgreSQL container unhealthy | Database not initializing (permission issue, volume corruption) | `docker compose down -v` to remove volumes, then `docker compose up -d`. **Warning:** this deletes all data. For data preservation, check `docker compose logs postgres` for the specific error. |
| Database connection from app fails | App container starts before PostgreSQL is healthy | This should be handled by `depends_on: condition: service_healthy` in docker-compose.yml. If still failing, check that the postgres healthcheck is passing: `docker compose ps`. |
| Backup container fails | `POSTGRES_USER` or `POSTGRES_PASSWORD` not passed to backup service | Ensure these vars are in `.env`. The backup service reads them directly (not via `:?` syntax, so it silently gets empty values). |

## 7. Deployment Issues

| Symptom | Cause | Resolution |
|---|---|---|
| 502 Bad Gateway | Application not running or crashed | `docker compose up -d` to restart. Check `docker compose ps` — if app shows `exited`, check `docker compose logs app`. |
| Database migration pending after deploy | New code with schema changes, old database state | `docker compose run app npx prisma migrate deploy`. On Vercel, the `vercel-build` script runs `prisma generate` but **not** `prisma migrate deploy` — you must run migrations manually or via a deploy script. |
| New environment variables not picked up | Container started with old env vars | `docker compose down && docker compose up -d` to recreate containers with current `.env`. Vercel: redeploy after updating env vars in dashboard. |
| Sentry not capturing errors | `SENTRY_DSN` not set or invalid | Set `SENTRY_DSN` (server-side) and `NEXT_PUBLIC_SENTRY_DSN` (client-side) in environment. Verify DSN URL format: `https://key@sentry.io/projectId`. |
| Vercel deployment fails at build | Prisma generate or Next.js build error | Check Vercel build logs. Common: `prisma generate` fails due to schema issues. Run `npx prisma generate && npx next build` locally to reproduce. |
| Port conflict | Another service using port 3000 or 5432 | Change `APP_PORT` and/or `DB_PORT` in `.env`: `APP_PORT=3001 DB_PORT=5433 docker compose up -d`. |

## Quick Diagnostic Commands

```bash
# Check if app is alive
curl -sf http://localhost:3000/api/health | jq .

# Check if database is connected
curl -sf http://localhost:3000/api/ready && echo "READY" || echo "NOT READY"

# Check which AI providers are configured
curl -sf http://localhost:3000/api/health | jq .providers

# Check app version
curl -sf http://localhost:3000/api/version | jq .

# Docker: view app logs
docker compose logs -f app

# Docker: check all service status
docker compose ps

# Docker: validate compose config with env vars
docker compose config

# Run database migrations
docker compose run app npx prisma migrate deploy

# Reset database (destructive!)
docker compose run app npx prisma migrate reset

# Validate env vars locally
node -e "require('dotenv').config(); require('./src/lib/validate-env').validateEnv()"
```
