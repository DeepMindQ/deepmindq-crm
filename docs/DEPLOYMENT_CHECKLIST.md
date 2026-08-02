# DeepMindQ — Deployment Checklist

Use this checklist for every customer deployment. Check each item as you complete it.
For detailed instructions, see [`docs/DEPLOYMENT_GUIDE.md`](./DEPLOYMENT_GUIDE.md).

---

## Pre-Deployment

### Repository
- [ ] Clone repository at target tag
  ```bash
  git clone <repo> -b <tag> deepmindq && cd deepmindq
  ```

### Environment Variables
- [ ] Copy `.env.example` to `.env`
  ```bash
  cp .env.example .env
  ```

### Generate Secrets
- [ ] Generate `NEXTAUTH_SECRET`:
  ```bash
  openssl rand -base64 32
  ```
- [ ] Generate `TRACKING_SECRET`:
  ```bash
  openssl rand -hex 32
  ```
- [ ] Generate `CRON_SECRET`:
  ```bash
  openssl rand -hex 32
  ```
- [ ] Generate `SETUP_TOKEN`:
  ```bash
  openssl rand -hex 32
  ```

### Database Configuration
- [ ] Set `DATABASE_URL` (PostgreSQL connection string)
- [ ] Set `DIRECT_DATABASE_URL` (for migrations — may differ if using connection pooling)

### Authentication
- [ ] Set `AUTHORIZED_EMAIL` (customer admin email for initial login)

### Email Configuration
- [ ] Set `EMAIL_API_KEY` (Resend API key)
- [ ] Set `EMAIL_FROM` (verified sender domain email address)

### Public URL
- [ ] Set `NEXT_PUBLIC_APP_URL` (public URL of the deployment, e.g. `https://app.customer.com`)

### AI Provider
- [ ] Configure at least one AI API key:
  - `NVIDIA_API_KEY` (NVIDIA NIM)
  - `GROQ_API_KEY` (Groq)
  - `GEMINI_API_KEY` (Google Gemini)

### File Storage (if file attachments needed)
- [ ] Set `S3_BUCKET`
- [ ] Set `S3_REGION`
- [ ] Set `S3_ACCESS_KEY`
- [ ] Set `S3_SECRET_KEY`

---

## Deployment

### Start Services
- [ ] Build and start all services:
  ```bash
  docker compose up -d --build
  ```

### Verify Services
- [ ] Wait for PostgreSQL health check:
  ```bash
  docker compose ps
  # postgres should show "healthy" status
  ```
- [ ] Wait for app readiness:
  ```bash
  docker compose logs app | grep "ready"
  # Should show: "App is ready" or similar startup confirmation
  ```

---

## Database Initialization

### Run Setup
- [ ] Initialize the database schema:
  ```bash
  curl -X POST http://localhost:3000/api/setup-db \
    -H "X-Setup-Token: <SETUP_TOKEN>"
  ```

### Verify
- [ ] Confirm health endpoint responds:
  ```bash
  curl http://localhost:3000/api/health
  # Expected: {"status":"ok"}
  ```

---

## Post-Deployment Verification

### Health Endpoints
- [ ] Health check:
  ```bash
  curl -w "\nHTTP %{http_code}\n" http://localhost:3000/api/health
  # Expected: 200
  ```
- [ ] Readiness check:
  ```bash
  curl -w "\nHTTP %{http_code}\n" http://localhost:3000/api/ready
  # Expected: 200
  ```
- [ ] Version check:
  ```bash
  curl http://localhost:3000/api/version
  # Expected: version info JSON
  ```

### Full Login Flow
- [ ] Open the deployment URL in a browser
- [ ] Request an OTP email to the `AUTHORIZED_EMAIL` address
- [ ] Enter the OTP code
- [ ] Confirm the dashboard loads without errors
- [ ] Confirm the landing page renders correctly (before login)

---

## Backup Verification

- [ ] Verify backup service is running:
  ```bash
  docker compose logs backup
  # Should show scheduled backup activity
  ```
- [ ] Verify restore capability:
  ```bash
  ./scripts/restore.sh --list
  # Should list available backups (if any)
  ```

---

## Rollback Procedure

If deployment fails or causes issues:

1. Stop services:
   ```bash
   docker compose down
   ```

2. Checkout previous stable tag:
   ```bash
   git checkout <previous-tag>
   ```

3. Rebuild and restart:
   ```bash
   docker compose up -d --build
   ```

4. Verify health endpoints:
   ```bash
   curl http://localhost:3000/api/health
   curl http://localhost:3000/api/ready
   ```

5. Confirm login and dashboard work

---

## Notes

- Each deployment is **fully isolated** — dedicated database, storage, secrets, and domain
- No shared infrastructure between customers
- For detailed environment variable documentation, see [`docs/ENVIRONMENT_CONFIGURATION.md`](./ENVIRONMENT_CONFIGURATION.md)
- For troubleshooting, see [`docs/TROUBLESHOOTING.md`](./TROUBLESHOOTING.md)
