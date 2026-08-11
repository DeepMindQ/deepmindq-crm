# RB-010: Disaster Recovery Runbook

**RTO Target**: < 4 hours (detection to full restoration)
**RPO Target**: < 1 hour (maximum data loss)
**Last Updated**: 2026-08-10
**Owner**: Platform Engineering
**Review Cadence**: Monthly (first Monday, aligned with DR test schedule)

---

## Overview

This runbook covers the complete disaster recovery procedure for DeepMindQ, deployed on Vercel with Neon PostgreSQL. It covers detection, assessment, failover, data restoration, validation, and post-mortem procedures.

**Architecture Summary:**
| Component | Platform | Region | Redundancy |
|-----------|----------|--------|------------|
| Application | Vercel (serverless) | bom1 | Automatic multi-region edge |
| Database | Neon PostgreSQL | aws-east-1 | Built-in replication |
| File Storage | AWS S3 | us-east-1 | Cross-region replication |
| AI Providers | NVIDIA/Fireworks/Groq/Gemini | Multi-provider | Automatic fallback chain |

---

## 1. Detection

### 1.1 Automated Monitoring

| Check | Source | Alert Threshold | Escalation |
|-------|--------|-----------------|------------|
| Health endpoint | `/api/health` | HTTP != 200 for 2 min | PagerDuty |
| Cron heartbeat | 5 cron jobs in `vercel.json` | No heartbeat in 10 min | Slack + PagerDuty |
| Error rate | Sentry DSN | >5% in 5-min window | PagerDuty |
| DB connections | Neon console | Connection pool >80% | Slack warning |
| Deploy failures | GitHub Actions | Any deploy job failure | Slack |

**Sentry config files:** `sentry.client.config.ts`, `sentry.edge.config.ts`
**Health endpoint source:** `src/app/api/health/route.ts`

### 1.2 Manual Detection

- Customer reports via `#incidents` Slack channel
- Status page alerts (Status.io / Vercel status)
- PagerDuty escalation to on-call engineer
- Vercel deployment logs: `https://vercel.com/<org>/deepmindq/deployments`

---

## 2. Assessment

### 2.1 Severity Classification Decision Tree

```
START
 ├── Is the health endpoint responding?
 │    ├── YES → Is error rate >5%?
 │    │    ├── YES → SEV-2: Degraded Service
 │    │    └── NO  → SEV-4: No Impact (monitoring artifact)
 │    └── NO → Is database reachable?
 │         ├── YES → Is Vercel responding?
 │         │    ├── YES → SEV-3: Partial Outage (route-specific)
 │         │    └── NO  → SEV-1: Total Application Outage
 │         └── NO → SEV-1: Database Outage (CRITICAL)
 └── Is data corruption suspected?
      ├── YES → SEV-0: Data Integrity Incident (escalate immediately)
      └── NO  → Continue normal assessment
```

### 2.2 Severity Levels

| Level | Name | Response Time | Example |
|-------|------|---------------|---------|
| SEV-0 | Data Integrity | Immediate | Database corruption, unauthorized data access |
| SEV-1 | Critical Outage | < 15 min | Total service or database down |
| SEV-2 | Degraded Service | < 1 hour | High error rate, slow responses |
| SEV-3 | Partial Outage | < 4 hours | Specific routes or features failing |
| SEV-4 | No Impact | Next business day | Monitoring noise, non-customer-facing |

---

## 3. Failover Procedures

### 3.1 Application Failover (Vercel)

Vercel provides automatic edge failover. Manual intervention is rarely needed but if required:

```bash
# Check current deployment status
curl -s -H "Authorization: Bearer $VERCEL_TOKEN" \
  "https://api.vercel.com/v6/deployments?projectId=$VERCEL_PROJECT_ID&limit=3"

# Trigger a redeployment from last known good commit
vercel --prod --token $VERCEL_TOKEN

# Or use blue/green workflow for zero-downtime failover
# See: .github/workflows/blue-green-deploy.yml
# Manual trigger:
gh workflow run blue-green-deploy.yml \
  -f environment=production \
  -f rollback_only=true
```

### 3.2 Database Failover (Neon)

Neon handles read replica failover automatically. For manual intervention:

```bash
# 1. Check Neon project status
#    Via console: https://console.neon.tech/app/projects

# 2. For write failover, promote a read replica:
#    Via Neon console → Project → Branches → Promote read replica

# 3. Update connection strings if endpoint changes:
#    Vercel Dashboard → Settings → Environment Variables
#    Update DATABASE_URL and DIRECT_DATABASE_URL
```

### 3.3 AI Provider Failover

The AI router in `src/app/api/ai/` automatically cascades through providers:
**NVIDIA → Fireworks → Groq → Gemini → Template Fallback**

If all providers are down, the system degrades gracefully to template-based responses. No manual intervention required for AI provider outages. See also [RB-003: LLM Provider Outage](./RB-003-llm-provider-outage.md).

---

## 4. Data Restoration

### 4.1 Neon Point-in-Time Recovery (PITR) — Primary Method

Neon supports PITR to any second within the retention window (7 days on standard plan).

```bash
# Via Neon Console:
# 1. Go to https://console.neon.tech/app/projects/<project-id>
# 2. Select the branch
# 3. Click "Restore from point in time"
# 4. Select the target timestamp
# 5. Create as new branch or overwrite

# Via API:
curl -X POST "https://console.neon.tech/api/v2/projects/<project-id>/branches" \
  -H "Authorization: Bearer $NEON_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "recovery-<timestamp>",
    "source": {
      "type": "point_in_time",
      "timestamp": "2026-08-10T14:30:00Z",
      "branch_id": "<original-branch-id>"
    }
  }'
```

### 4.2 S3 Backup Restoration — Secondary Method

If PITR is unavailable (retention exceeded, regional outage), use S3 backups:

```bash
# 1. Find the most recent backup
aws s3 ls s3://$S3_BUCKET/backups/ --recursive | sort -r | head -5

# 2. Download backup
aws s3 cp s3://$S3_BUCKET/backups/YYYYMMDD/deepmindq_full_TIMESTAMP.sql.gz.enc /tmp/restore.sql.gz.enc

# 3. Decrypt
openssl enc -aes-256-cbc -d -pbkdf2 -iter 100000 \
  -in /tmp/restore.sql.gz.enc \
  -out /tmp/restore.sql.gz \
  -pass pass:$BACKUP_ENCRYPTION_KEY

# 4. Verify checksum
sha256sum -c /tmp/restore.sql.gz.sha256

# 5. Restore to database
gunzip -c /tmp/restore.sql.gz | psql $DATABASE_URL

# Or use the automated script:
./scripts/backup.sh --restore <YYYYMMDD-TIMESTAMP-full>
```

### 4.3 Backup Metadata

Backups are tracked in the `BackupRecord` Prisma model:
- **Fields:** `type`, `status`, `storagePath`, `fileSizeBytes`, `checksum`, `durationMs`, `snapshotTime`, `expiresAt`, `verifiedAt`, `restoredAt`, `createdBy`
- **Model definition:** `prisma/schema.prisma` (migration: `20260810100000_phase6_8_compliance_admin_dr`)

### 4.4 Pre-Migration Backups

The production deploy pipeline (`.github/workflows/deploy-production.yml`, stage 3) automatically creates a pre-migration backup before running any database migrations. These are stored locally in the CI runner and available for immediate rollback.

---

## 5. Validation

After any failover or restoration, run through this checklist:

### 5.1 Smoke Test Checklist

```bash
# 1. Health endpoint
curl https://app.deepmindq.com/api/health
# Expected: {"status": "ok", "version": "...", "database": "connected"}

# 2. Authentication flow
# - Attempt login via /api/auth/login
# - Verify session token issuance

# 3. Core API endpoints
curl https://app.deepmindq.com/api/companies -H "Authorization: Bearer <token>"
curl https://app.deepmindq.com/api/intelligence/health

# 4. Database connectivity
npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM \"User\";"

# 5. Cron job heartbeat
# Check that /api/cron/data-retention runs successfully (scheduled 05:00 UTC)

# 6. AI pipeline
# Trigger a test intelligence query and verify response
```

### 5.2 Automated Validation

Run the full smoke test suite:
```bash
npx vitest run --config vitest.smoke.config.ts
```

Run the DR validation workflow:
```bash
gh workflow run disaster-recovery.yml
```

---

## 6. Communication

### 6.1 Stakeholder Notification Template

```
🚨 **[SEV-X] DeepMindQ Incident — [Brief Description]**

**Status:** [Investigating / Identified / Monitoring / Resolved]
**Started:** [YYYY-MM-DD HH:MM UTC]
**Impact:** [Description of affected functionality]
**Current State:** [What is happening right now]
**Next Update:** [Time]

**Timeline:**
- HH:MM UTC — Incident detected via [alert source]
- HH:MM UTC — [Action taken]
- HH:MM UTC — [Current status]

**Running:** [RB-XXX runbook]
**Incident Commander:** [@on-call]
```

### 6.2 Communication Channels

| Channel | Purpose | Cadence |
|---------|---------|---------|
| `#incidents` (Slack) | Real-time updates | Every 15 min during active incident |
| `#status-updates` (Slack) | Customer-facing status | Every 30 min |
| PagerDuty | On-call escalation | As triggered |
| Status page | Public status | Updated with each milestone |
| Email to stakeholders | Executive summary | At resolution |

### 6.3 External Communication

For SEV-0/SEV-1 incidents affecting customer data:
1. Notify customer success team within 15 minutes
2. Draft customer communication within 30 minutes
3. Send customer notification within 1 hour (legal compliance requirement)

---

## 7. Post-Mortem

### 7.1 Timeline

| Milestone | Deadline | Owner |
|-----------|----------|-------|
| Initial post-mortem draft | Within 24 hours | Incident Commander |
| Post-mortem review meeting | Within 48 hours | Platform Engineering |
| Action items created | Within 48 hours | All participants |
| Action items assigned | Within 72 hours | Engineering Manager |
| Action items completed | Within sprint or 2 weeks | Assigned engineers |

### 7.2 Post-Mortem Template

```markdown
# Post-Mortem: [Incident Title]

**Date:** [YYYY-MM-DD]
**Duration:** [Start time] — [End time] ([total duration])
**Severity:** [SEV-X]
**Impact:** [What was affected, how many users, data loss]
**Detected By:** [Monitoring/alert/manual]

## Summary
[2-3 sentence executive summary]

## Root Cause
[Technical root cause analysis]

## Timeline
| Time (UTC) | Event |
|------------|-------|
| HH:MM | [Event] |

## What Went Well
- [Positive observations]

## What Could Be Improved
- [Areas for improvement]

## Action Items
| # | Action | Owner | Priority | Due Date |
|---|--------|-------|----------|----------|
| 1 | [Action] | [@person] | P1 | [Date] |

## Lessons Learned
[Key takeaways for the team]
```

---

## Appendix A: Emergency Contacts

| Role | Name | Contact | Backup |
|------|------|---------|--------|
| On-Call Engineer | [Rotating] | PagerDuty escalation | See on-call schedule |
| Platform Engineering Lead | [Name] | Slack: @platform-lead | Email: platform@company.com |
| Database Admin | [Name] | Slack: @db-admin | Neon support |
| Vercel Support | Vercel Enterprise | support@vercel.com | Account manager |
| Neon Support | Neon Enterprise | support@neon.tech | console.neon.tech |
| Security Team | [Name] | Slack: @security | #security-incidents |

## Appendix B: Key URLs & Credentials

| Resource | URL / Command |
|----------|---------------|
| Vercel Dashboard | `https://vercel.com/<org>/deepmindq` |
| Neon Console | `https://console.neon.tech/app/projects` |
| GitHub Actions | `https://github.com/<org>/deepmindq/actions` |
| Sentry Errors | `https://sentry.io/orgs/<org>/projects/deepmindq/` |
| S3 Backups | `aws s3 ls s3://$S3_BUCKET/backups/ --recursive` |
| Backup Script | `./scripts/backup.sh` |
| DR Test Workflow | `gh workflow run disaster-recovery.yml` |
| Blue/Green Deploy | `gh workflow run blue-green-deploy.yml -f environment=production` |

## Appendix C: Related Runbooks

- [RB-001: High Error Rate](./RB-001-high-error-rate.md)
- [RB-002: Database Connection Exhaustion](./RB-002-database-connection-exhaustion.md)
- [RB-003: LLM Provider Outage](./RB-003-llm-provider-outage.md)
- [RB-005: Security Incident Response](./RB-005-security-incident-response.md)
- [RB-006: Deployment Rollback](./RB-006-deployment-rollback.md)
- [RB-007: Data Corruption Recovery](./RB-007-data-corruption-recovery.md)
