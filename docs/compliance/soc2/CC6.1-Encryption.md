# CC6.1: Encryption

**SOC 2 Criterion:** CC6.1 — The entity uses encryption to protect information during transmission and at rest.

**Last Updated:** 2026-08-10
**Owner:** Security Engineering
**Review Cadence**: Quarterly

---

## Encryption at Rest

### Database Encryption

Neon PostgreSQL provides transparent encryption at rest for all stored data using AES-256. This is a platform-managed feature — no application-level configuration required. Data at rest in the Neon database is encrypted by default for all plans.

**Prisma model:** `prisma/schema.prisma` — the schema defines the data model but does not handle encryption itself (that is a Neon platform responsibility).

### Field-Level Encryption

Certain sensitive fields receive additional application-layer encryption beyond the Neon platform default:

| Field / Data | Encryption Method | Key Source | Implementation |
|-------------|-------------------|------------|----------------|
| AI provider API keys | AES-256-GCM | `API_KEY_ENCRYPTION_KEY` | `src/lib/crypto/encryption.ts` |
| Session tokens | HMAC-SHA256 signing | `SESSION_TOKEN_HMAC_SECRET` | `src/lib/auth/session.ts` |
| Email tracking tokens | HMAC-SHA256 | `TRACKING_SECRET` | `src/lib/email/tracking.ts` |
| Cron auth tokens | Bearer comparison | `CRON_SECRET` | Vercel cron middleware |
| Setup token | Direct comparison | `SETUP_TOKEN` | `src/app/api/setup-db/route.ts` |

**Key generation:** All keys are generated via `openssl rand -base64 32` (minimum 256-bit entropy). Keys are stored as GitHub secrets for CI/CD and Vercel environment variables for production.

### File Storage Encryption

Files stored in AWS S3 are encrypted using:
- **Server-side encryption:** `aws:kms` (AES-256) — applied via the `--server-side-encryption aws:kms` flag in `scripts/backup.sh`
- **Storage class:** `STANDARD_IA` for backups (infrequent access, cost-optimized)

---

## Encryption in Transit

### TLS Configuration

All data in transit is protected using TLS:

| Component | TLS Version | HSTS | Certificate |
|-----------|-------------|------|-------------|
| Vercel application | TLS 1.3 (auto) | Yes (`includeSubDomains`, `max-age=31536000`) | Managed by Vercel |
| Neon database connection | TLS 1.2+ (via `sslmode=require`) | N/A (TCP) | Managed by Neon |
| S3 uploads/downloads | TLS 1.2 (aws-cli default) | N/A | AWS managed |
| Resend API calls | TLS 1.2+ | N/A | Managed by Resend |
| AI provider APIs | TLS 1.2+ | N/A | Provider-managed |

### HSTS Configuration

The `Caddyfile` in the project root includes HSTS headers for any self-hosted deployment. Vercel-managed deployments automatically enforce HSTS via their edge network.

### Database Connection Security

The `DATABASE_URL` in `.env.example` includes `sslmode=require` and `pgbouncer=true` for production connections:
```
DATABASE_URL=postgresql://neondb_owner:xxx@ep-xxx.aws.neon.tech/neondb?pgbouncer=true&sslmode=require
DIRECT_DATABASE_URL=postgresql://neondb_owner:xxx@ep-xxx.aws.neon.tech/neondb?sslmode=require
```

---

## Key Management Procedures

### Master Key Management

- **Master encryption key** (`ENCRYPTION_MASTER_KEY`): Used as the root key derivation source for `BACKUP_ENCRYPTION_KEY` in `scripts/backup.sh`.
- **API key encryption key** (`API_KEY_ENCRYPTION_KEY`): Dedicated key for field-level encryption of AI provider keys stored in the database. Separate from master key to allow independent rotation.
- **Key storage:** All encryption keys are stored as GitHub Actions secrets and Vercel environment variables. Keys are never committed to source code, logs, or audit trails.

### Key Rotation Procedure

1. **Generate new key:** `openssl rand -base64 32`
2. **Update production:** Add new key as Vercel env var (the app reads the latest key on each cold start)
3. **Re-encrypt data:** Run the re-encryption script for field-level encrypted data:
   ```bash
   # Decrypt all API keys with old key, re-encrypt with new key
   npx tsx scripts/rotate-encryption-key.ts --old-key=$OLD --new-key=$NEW
   ```
4. **Update CI/CD:** Update GitHub secrets for `API_KEY_ENCRYPTION_KEY`
5. **Verify:** Run integration tests to confirm decryption with new key works
6. **Retire old key:** Remove old key from Vercel env vars and GitHub secrets after 7-day grace period

### Certificate Management

- **Application certificates:** Managed automatically by Vercel (Let's Encrypt)
- **Database certificates:** Managed automatically by Neon
- **No self-signed certificates** in any production path

## Encryption Evidence

| Evidence | Location | Last Verified |
|----------|----------|---------------|
| TLS configuration | Vercel dashboard → Settings → Domains | 2026-08-10 |
| DB SSL mode | `.env.example` (`sslmode=require`) | 2026-08-10 |
| API key encryption | `src/lib/crypto/encryption.ts` | 2026-08-10 |
| Session HMAC | `src/lib/auth/session.ts` | 2026-08-10 |
| S3 encryption | `scripts/backup.sh` (`--server-side-encryption aws:kms`) | 2026-08-10 |
