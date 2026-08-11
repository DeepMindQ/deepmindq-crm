# A1: Data Retention

**SOC 2 Criterion:** A1.1 — The entity retains information for the period of time required by the entity's data retention policy.

**Last Updated:** 2026-08-10
**Owner:** Data Governance
**Review Cadence**: Quarterly

---

## Data Retention Policy

DeepMindQ retains data according to the following policy. Retention periods are enforced by the automated cron job at `/api/cron/data-retention` (scheduled daily at `0 5 * * * UTC` in `vercel.json`).

### Retention Schedule

| Entity / Data Type | Retention Period | Action After Retention | Prisma Model |
|--------------------|-----------------|----------------------|--------------|
| User accounts (active) | Indefinite (while active) | Archive after 90 days inactivity | `User` |
| User accounts (inactive) | 90 days from last login | Soft-delete → hard-delete after 30 days | `User.deletedAt` |
| Session tokens | 24 hours | Automatic expiry | In-memory / DB session |
| Companies | Indefinite (tied to user) | Delete with user account | `Company` |
| Contacts | Indefinite (tied to user) | Delete with user account | `Contact` |
| Intelligence briefings | 90 days | Archive to cold storage | `IntelligenceBriefing` |
| Intelligence signals | 30 days | Delete | `Signal` |
| Evidence records | 30 days | Delete | `Evidence` |
| Recommendation records | 90 days | Archive | `Recommendation` |
| Audit logs | 365 days | Archive → delete after 730 days | `AuditLog` |
| API access logs | 90 days | Delete | Application logs |
| Email tracking data | 30 days | Anonymize → delete | `EmailTracking` |
| Error reports (Sentry) | 90 days | Auto-expiry (Sentry plan) | Sentry-hosted |
| Cron job execution logs | 7 days | Delete | Vercel function logs |
| Database backups | 90 days | Delete from S3 | `BackupRecord` |
| Pre-migration backups | 30 days | Delete | CI runner temp storage |

### Legal Hold Procedures

When a legal hold is issued:

1. **Notification:** Legal team notifies Platform Engineering via `#legal-holds` Slack channel.
2. **Hold record:** Create a hold entry in the database with affected entities, hold reason, and custodian.
3. **Cron override:** The `/api/cron/data-retention` job checks for active holds before deleting any data. Entities under hold are skipped.
4. **Audit trail:** Hold creation, modification, and release are logged to `AuditLog`.
5. **Release:** Legal team explicitly releases the hold. Retention policy resumes from the hold release date (not the original date).

Implementation: The data retention cron checks a `DataHold` table before executing deletions. This table is part of the `20260810100000_phase6_8_compliance_admin_dr` migration in `prisma/migrations/`.

---

## Data Disposal Procedures

### Soft Delete

Most entities use soft-delete (`deletedAt` timestamp field) as the first stage:
- Soft-deleted entities are excluded from all queries via Prisma middleware
- Soft-deleted entities are not accessible via any API route
- Soft-deleted entities are retained for the configured grace period

### Hard Delete

After the grace period, hard deletion removes the record permanently:
```sql
-- Executed by the data retention cron
DELETE FROM "Company" WHERE "userId" = $1 AND "deletedAt" < NOW() - INTERVAL '30 days';
DELETE FROM "Contact" WHERE "userId" = $1 AND "deletedAt" < NOW() - INTERVAL '30 days';
DELETE FROM "User" WHERE "deletedAt" < NOW() - INTERVAL '30 days';
```

### Backup Cleanup

S3 backups older than 90 days are automatically cleaned:
```bash
# From scripts/backup.sh (also run by cron)
aws s3 rm s3://$S3_BUCKET/backups/ --recursive --exclude "*" --include "*.sql.gz*" \
  | xargs -I{} aws s3 ls {} --output json | jq 'select(.LastModified < "90 days ago")'
```

Or more simply:
```bash
aws s3api list-objects-v2 --bucket $S3_BUCKET --prefix backups/ \
  --query "Contents[?LastModified<'$(date -d '90 days ago' -u +%Y-%m-%dT%H:%M:%S.000Z)'].Key" \
  | xargs -r -n1 aws s3 rm s3://$S3_BUCKET/
```

---

## Backup Retention

| Backup Type | Retention | Storage | Encryption | Frequency |
|-------------|-----------|---------|------------|-----------|
| Full database backup | 90 days | S3 (Standard-IA) | AES-256-CBC + S3 KMS | Daily (via cron) |
| Pre-migration backup | 30 days | S3 (Standard-IA) | AES-256-CBC + S3 KMS | On deploy |
| WAL/incremental | 90 days | S3 (Standard-IA) | AES-256-CBC + S3 KMS | Daily |
| DR test verification | 7 days | GitHub Actions artifact | N/A | Monthly |

**Backup metadata** is stored in the `BackupRecord` Prisma model, which tracks `type`, `status`, `storagePath`, `fileSizeBytes`, `checksum`, `durationMs`, `snapshotTime`, `expiresAt`, `verifiedAt`, `restoredAt`, and `createdBy`.

---

## Evidence

| Evidence | Location | Audit Frequency |
|----------|----------|----------------|
| Retention policy enforcement | `/api/cron/data-retention` execution logs | Daily |
| Data hold records | Database `DataHold` table | On-demand |
| Backup cleanup | S3 lifecycle policy + cron logs | Monthly |
| Audit log retention | Database `AuditLog` table | Daily sweep |
| User account retention | Database `User.deletedAt` field | Daily sweep |
