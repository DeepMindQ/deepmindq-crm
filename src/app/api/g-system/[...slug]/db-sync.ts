import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { invalidateCache } from '@/lib/data-intelligence/config-store';

/**
 * POST /api/g-system/db-sync
 *
 * Ensures all Phase 1 & 2 tables exist in the remote PostgreSQL database
 * and seeds default configuration data. Safe to call multiple times.
 *
 * This is the single "make it work" endpoint that handles:
 * 1. Creating missing tables via raw SQL (Job, JobLog)
 * 2. Seeding ColumnMappingRules, FieldValidationRules, NormalizationMappings, ScoringWeights
 * 3. Verifying table integrity
 */
export async function POST() {
  const results: Record<string, string | number | boolean> = {};

  try {
    // ── Step 1: Ensure Job table exists ──
    try {
      await db.job.count();
      results.jobTable = 'exists';
    } catch (err: any) {
      // Table doesn't exist — create it via raw SQL
      console.log('[db-sync] Job table missing, creating...');
      try {
        await db.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "Job" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "type" TEXT NOT NULL,
            "status" TEXT NOT NULL DEFAULT 'pending',
            "priority" INTEGER NOT NULL DEFAULT 5,
            "companyId" TEXT,
            "contactId" TEXT,
            "batchId" TEXT,
            "progress" INTEGER NOT NULL DEFAULT 0,
            "currentStep" TEXT,
            "stepDetail" TEXT,
            "payload" TEXT,
            "result" TEXT,
            "error" TEXT,
            "errorCode" TEXT,
            "attemptCount" INTEGER NOT NULL DEFAULT 0,
            "maxAttempts" INTEGER NOT NULL DEFAULT 3,
            "nextRetryAt" TIMESTAMP(3),
            "queuedAt" TIMESTAMP(3),
            "startedAt" TIMESTAMP(3),
            "completedAt" TIMESTAMP(3),
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL
          );
          CREATE INDEX IF NOT EXISTS "Job_type_idx" ON "Job"("type");
          CREATE INDEX IF NOT EXISTS "Job_status_idx" ON "Job"("status");
          CREATE INDEX IF NOT EXISTS "Job_companyId_idx" ON "Job"("companyId");
          CREATE INDEX IF NOT EXISTS "Job_contactId_idx" ON "Job"("contactId");
          CREATE INDEX IF NOT EXISTS "Job_priority_idx" ON "Job"("priority");
          CREATE INDEX IF NOT EXISTS "Job_status_type_idx" ON "Job"("status", "type");
          CREATE INDEX IF NOT EXISTS "Job_nextRetryAt_idx" ON "Job"("nextRetryAt");
          CREATE INDEX IF NOT EXISTS "Job_createdAt_idx" ON "Job"("createdAt");
        `);
        results.jobTable = 'created';
      } catch (sqlErr: any) {
        results.jobTable = `create_failed: ${sqlErr.message}`;
      }
    }

    // ── Step 2: Ensure JobLog table exists ──
    try {
      await db.jobLog.count();
      results.jobLogTable = 'exists';
    } catch (err: any) {
      console.log('[db-sync] JobLog table missing, creating...');
      try {
        await db.$executeRawUnsafe(`
          CREATE TABLE IF NOT EXISTS "JobLog" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "jobId" TEXT NOT NULL,
            "level" TEXT NOT NULL DEFAULT 'info',
            "step" TEXT,
            "message" TEXT NOT NULL,
            "metadata" TEXT,
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "JobLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE
          );
          CREATE INDEX IF NOT EXISTS "JobLog_jobId_idx" ON "JobLog"("jobId");
          CREATE INDEX IF NOT EXISTS "JobLog_jobId_level_idx" ON "JobLog"("jobId", "level");
          CREATE INDEX IF NOT EXISTS "JobLog_createdAt_idx" ON "JobLog"("createdAt");
        `);
        results.jobLogTable = 'created';
      } catch (sqlErr: any) {
        results.jobLogTable = `create_failed: ${sqlErr.message}`;
      }
    }

    // ── Step 3: Seed Data Intelligence config ──
    try {
      const existingRules = await db.columnMappingRule.count();
      if (existingRules > 0) {
        results.configSeed = `skipped (${existingRules} rules already exist)`;
      } else {
        // Trigger auto-seed by calling the seed endpoint logic
        const { invalidateCache: ic } = await import('@/lib/data-intelligence/config-store');
        ic(); // Clear cache
        // Force a config load which triggers auto-seed
        const { getColumnMappingRules } = await import('@/lib/data-intelligence/config-store');
        await getColumnMappingRules(); // This triggers loadAllConfigs → autoSeed
        const newCount = await db.columnMappingRule.count();
        results.configSeed = `seeded ${newCount} column rules`;
      }
    } catch (err: any) {
      results.configSeed = `failed: ${err.message}`;
    }

    // ── Step 4: Verify all Phase 1 tables ──
    const tableChecks: Record<string, boolean> = {};
    for (const table of ['DataUpload', 'UploadRow', 'ColumnMappingRule', 'FieldValidationRule', 'NormalizationMapping', 'ScoringWeight']) {
      try {
        await db.$queryRawUnsafe(`SELECT 1 FROM "${table}" LIMIT 1`);
        tableChecks[table] = true;
      } catch {
        tableChecks[table] = false;
      }
    }
    // Also check Phase 2 tables
    try {
      await db.$queryRawUnsafe(`SELECT 1 FROM "Job" LIMIT 1`);
      tableChecks['Job'] = true;
    } catch { tableChecks['Job'] = false; }
    try {
      await db.$queryRawUnsafe(`SELECT 1 FROM "JobLog" LIMIT 1`);
      tableChecks['JobLog'] = true;
    } catch { tableChecks['JobLog'] = false; }

    results.tableIntegrity = tableChecks;

    // ── Step 5: Count existing data ──
    try {
      results.columnRules = await db.columnMappingRule.count();
      results.validationRules = await db.fieldValidationRule.count();
      results.normalizationMappings = await db.normalizationMapping.count();
      results.scoringWeights = await db.scoringWeight.count();
      results.totalJobs = await db.job.count();
      results.totalDataUploads = await db.dataUpload.count();
      results.totalCompanies = await db.company.count();
      results.totalContacts = await db.contact.count();
    } catch (err: any) {
      results.countsError = err.message;
    }

    return NextResponse.json({ success: true, ...results });
  } catch (error: any) {
    console.error('[db-sync]', error);
    return NextResponse.json({ success: false, error: error.message, ...results }, { status: 500 });
  }
}