# CC8.1: Change Management

**SOC 2 Criterion:** CC8.1 — The entity authorizes, designs, develops, configures, documents, tests, approves, and implements changes to the system.

**Last Updated:** 2026-08-10
**Owner:** Platform Engineering
**Review Cadence**: Quarterly

---

## CI/CD Pipeline Evidence

DeepMindQ changes follow a strict pipeline with multiple automated gates and mandatory human approval before reaching production.

### Pipeline Flow

```
Developer Push → CI Pipeline (11 blocking jobs) → PR Review → Merge to main
    → Production Pipeline (9 stages) → Human Approval → Deploy → Smoke → Health → Done
```

**Pipeline definitions:**
- CI: `.github/workflows/ci.yml`
- Production deploy: `.github/workflows/deploy-production.yml`
- Staging deploy: `.github/workflows/deploy-staging.yml`
- Blue/green deploy: `.github/workflows/blue-green-deploy.yml`

### Change Categories and Approval Requirements

| Change Type | CI Gates | Human Review | Production Approval | Evidence |
|-------------|----------|-------------|-------------------|----------|
| Application code | Full CI (11 jobs) | 1 reviewer | GitHub environment protection | PR + Actions log |
| Database migration | Full CI + backup gate | 2 reviewers | GitHub environment protection | Migration SQL + backup record |
| Environment variables | N/A | Admin only | Admin dashboard | Vercel audit log |
| Infrastructure (Terraform) | `infra-validation` job | 1 reviewer | Terraform plan review | `.github/workflows/ci.yml` (infra-validation) |
| Secrets/credentials | N/A | 2 reviewers + security lead | Admin dashboard | Secret rotation log |

---

## Code Review Requirements

### Mandatory Review Rules

1. **No self-merge:** All PRs require at least 1 approved review from a different team member.
2. **Security-sensitive changes:** PRs touching `src/lib/auth/`, `src/middleware.ts`, `src/app/api/auth/`, or environment variable files require 2 reviewers including a security-labeled reviewer.
3. **Database changes:** PRs touching `prisma/schema.prisma` or `prisma/migrations/` require 2 reviewers and must include the generated migration SQL.
4. **AI pipeline changes:** PRs touching `src/app/api/ai/` require review from a team member with AI governance expertise.

### Review Quality Standards

Reviewers must verify:
- [ ] No hardcoded secrets or credentials (enforced by `eslint-rules/no-hardcoded-env-paths.js`)
- [ ] Proper error handling and logging
- [ ] No ungoverned AI calls (enforced by `eslint-rules/no-ungoverned-llm.js`)
- [ ] Test coverage for new functionality
- [ ] No breaking API changes without deprecation notice

---

## Deployment Approval Workflow

### Staging (Automatic)
1. Push to `develop` branch triggers `deploy-staging.yml`
2. CI runs on the commit
3. Deploys to Vercel staging environment automatically
4. No human approval required for staging

### Production (Gated)
1. Push to `main` branch triggers `deploy-production.yml`
2. **Stage 1 — CI Gate:** Workflow waits for CI to pass
3. **Stage 1 — Human Approval:** GitHub `production` environment protection requires at least 1 reviewer to approve
4. **Stages 2-9:** Build → Backup → Migrate → Deploy → Smoke → Health → Rollback (if needed)
5. **Automatic rollback:** If health check or smoke tests fail, deployment is automatically rolled back to the previous version

### Blue/Green Deployments (Optional)
For critical changes requiring extra safety:
```bash
gh workflow run blue-green-deploy.yml \
  -f environment=production \
  -f verify_duration=30
```
See `.github/workflows/blue-green-deploy.yml` for the full blue/green strategy.

---

## Rollback Procedures

### Automatic Rollback (Production Pipeline)

The production deploy pipeline (`deploy-production.yml`, stages 7-9) includes automatic rollback:

1. **Capture rollback point:** Stage 5 captures the current production deployment ID before deploying
2. **Health check failure:** If `/api/health` returns non-200 after 3 retries (30s apart), automatic rollback triggers
3. **Smoke test failure:** If smoke tests fail, automatic rollback triggers
4. **Rollback execution:** Vercel CLI `vercel rollback <deployment-id>` reverts to previous deployment

### Manual Rollback

```bash
# Via GitHub Actions (blue/green rollback)
gh workflow run blue-green-deploy.yml \
  -f environment=production \
  -f rollback_only=true

# Via Vercel CLI
vercel rollback <deployment-id> --token $VERCEL_TOKEN

# Via Vercel API
curl -X POST \
  "https://api.vercel.com/v13/deployments/<blue-id>/promote" \
  -H "Authorization: Bearer $VERCEL_TOKEN"
```

### Database Rollback

1. **Neon PITR:** Restore database to point-in-time before the migration
2. **Pre-migration backup:** The deploy pipeline creates a backup before migration (`backup-production` job)
3. **Manual restore:** `./scripts/backup.sh --restore <backup_id>` (see RB-010 Disaster Recovery)

### Rollback Runbook

Full rollback procedures are documented in [RB-006: Deployment Rollback](../../runbooks/RB-006-deployment-rollback.md).

---

## Change Documentation Evidence

All changes are automatically documented through:
- **Git history:** Full commit log with conventional commit messages
- **GitHub PRs:** Review comments, approvals, and linked issues
- **GitHub Actions:** Build logs, test results, and deployment artifacts
- **Vercel deploy logs:** Deployment metadata, build output, and function logs
- **Audit logs:** Database `AuditLog` table records all admin actions
- **Backup records:** `BackupRecord` model tracks all backup operations
