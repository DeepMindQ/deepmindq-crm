# Prisma Client Regeneration

**Phase**: 9.5  
**Status**: Required action for local development

## Problem

28 TypeScript errors exist across 7 files, all caused by stale Prisma client types. After adding 6 new models (`DataAccessAudit`, `DataDeletionRequest`, `EnvironmentConfig`, `RetentionPolicy`, `ScoringConfigHistory`, `BackupRecord`) in Phases 6–8, the locally generated Prisma client at `node_modules/.prisma/client` does not include them.

## Why This Happens

`npx prisma generate` reads `schema.prisma` and generates TypeScript types in `node_modules/.prisma/client`. Without a running Postgres connection, the generate command can still run successfully — it only parses the schema file. However, if generate has not been executed since the schema changed, the TypeScript types will be stale.

## Affected Files

| File | Errors | Missing Types |
|------|--------|---------------|
| `src/app/api/account/data-deletion/route.ts` | 8 | `dataDeletionRequest` |
| `src/app/api/admin/environments/route.ts` | 4 | `environmentConfig` |
| `src/lib/access-audit.ts` | 3 | `dataAccessAudit` |
| `src/lib/retention-policy-engine.ts` | 7 | `retentionPolicy` (×5), `backupRecord` (×1) |
| `src/app/api/admin/scoring/route.ts` | 3 | `scoringConfigHistory` |
| `src/app/api/admin/retention/route.ts` | 1 | `retentionPolicy` |
| `src/lib/scoring-config.ts` | 1 | `scoringConfigHistory` |

## Fix

```bash
npx prisma generate
```

This command:
1. Parses `prisma/schema.prisma`
2. Generates TypeScript types into `node_modules/.prisma/client/`
3. Resolves all 28 "Property does not exist" errors

No database connection is required for `prisma generate`.

## CI Resolution

The CI pipeline (`.github/workflows/ci.yml`) runs `npx prisma generate` as part of the test job, before TypeScript compilation. This means:

- **CI builds will succeed** — `prisma generate` runs before `tsc`
- **Local development needs manual `prisma generate`** — run it after pulling schema changes

## Prevention

After any `schema.prisma` change, run:

```bash
npx prisma generate
```

This should be added to the onboarding checklist in `docs/ONBOARDING.md` if not already present.

## Error Pattern

All 28 errors follow this pattern:

```
Property 'dataDeletionRequest' does not exist on type 'typeof import("/.../node_modules/.prisma/client")'.
error TS2339
```

This is the definitive signal that `prisma generate` needs to be run.