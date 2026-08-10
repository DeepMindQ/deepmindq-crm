/**
 * DeepMindQ — Database Migration Strategy
 *
 * Utilities for safe database migrations including:
 * - Pre-migration validation
 * - Rollback helpers
 * - Data migration scripts
 * - Schema versioning
 */

import { PrismaClient } from '@prisma/client'
import { logger } from '@/lib/logger'

export interface MigrationStep {
  name: string
  description: string
  forward: (db: PrismaClient) => Promise<void>
  rollback: (db: PrismaClient) => Promise<void>
  estimatedDurationMs: number
  destructive: boolean
}

export interface MigrationResult {
  step: string
  success: boolean
  durationMs: number
  error?: string
  rowsAffected?: number
}

// ── Pre-migration Checks ──
export async function preMigrationCheck(db: PrismaClient): Promise<{ ok: boolean; issues: string[] }> {
  const issues: string[] = []

  // Check database connectivity
  try {
    await db.$queryRaw`SELECT 1`
  } catch {
    issues.push('Database connection failed')
  }

  // Check for active connections that might block migration
  const activeConns = await db.$queryRaw<Array<{ count: number }>>`
    SELECT count(*) as count FROM pg_stat_activity WHERE datname = current_database() AND pid != pg_backend_pid() AND state = 'active'
  `

  if (activeConns[0].count > 0) {
    issues.push(`${activeConns[0].count} active database connections. Consider draining before migration.`)
  }

  // Check available disk space (approximate via DB size as proxy)
  try {
    const diskSpace = await db.$queryRawUnsafe<Array<{ available_mb: number }>>(
      `SELECT pg_database_size(current_database()) / 1024 / 1024 as available_mb`
    )
    // Log DB size for awareness — not a blocking check
    logger.info(`[PreMigration] Current database size: ${diskSpace[0].available_mb} MB`)
  } catch {
    // Non-critical check
  }

  return { ok: issues.length === 0, issues }
}

// ── Migration Runner ──
export async function runMigration(
  db: PrismaClient,
  steps: MigrationStep[],
  options?: { dryRun?: boolean; stopOnError?: boolean }
): Promise<MigrationResult[]> {
  const results: MigrationResult[] = []

  for (const step of steps) {
    const start = Date.now()
    logger.info(`[Migration] Starting: ${step.name}`)

    if (options?.dryRun) {
      results.push({ step: step.name, success: true, durationMs: 0 })
      logger.info(`[Migration] DRY RUN: ${step.name} (skipped)`)
      continue
    }

    try {
      await step.forward(db)
      const duration = Date.now() - start
      results.push({ step: step.name, success: true, durationMs: duration })
      logger.info(`[Migration] Completed: ${step.name} (${duration}ms)`)
    } catch (error) {
      const duration = Date.now() - start
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      results.push({ step: step.name, success: false, durationMs: duration, error: errorMsg })
      logger.error(`[Migration] FAILED: ${step.name} (${errorMsg})`)

      if (options?.stopOnError !== false) {
        logger.info('[Migration] Stopping due to error. Run rollback to undo.')
        break
      }
    }
  }

  return results
}

// ── Rollback Runner ──
export async function rollbackMigration(
  db: PrismaClient,
  steps: MigrationStep[],
  upToStep: string
): Promise<MigrationResult[]> {
  const results: MigrationResult[] = []
  const targetIdx = steps.findIndex(s => s.name === upToStep)
  if (targetIdx === -1) return results

  // Rollback in reverse order
  for (let i = targetIdx; i >= 0; i--) {
    const step = steps[i]
    const start = Date.now()
    logger.info(`[Rollback] Reverting: ${step.name}`)

    try {
      await step.rollback(db)
      results.push({ step: step.name, success: true, durationMs: Date.now() - start })
      logger.info(`[Rollback] Reverted: ${step.name}`)
    } catch (error) {
      results.push({
        step: step.name,
        success: false,
        durationMs: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown',
      })
      logger.error(`[Rollback] FAILED: ${step.name}`)
      break
    }
  }

  return results
}

// ── Data Migration Helpers ──
export async function batchUpdate(
  db: PrismaClient,
  tableName: string,
  updateFn: (ids: string[]) => Promise<number>,
  batchSize = 1000
): Promise<number> {
  // Get all IDs
  const allIds: Array<{ id: string }> = await db.$queryRawUnsafe(`SELECT id FROM "${tableName}"`)
  let totalUpdated = 0

  for (let i = 0; i < allIds.length; i += batchSize) {
    const batch = allIds.slice(i, i + batchSize).map(r => r.id)
    const updated = await updateFn(batch)
    totalUpdated += updated
    logger.info(
      `[DataMigration] ${tableName}: batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(allIds.length / batchSize)} updated ${updated} rows`
    )
  }

  return totalUpdated
}

// ── Schema Version Tracking ──
export async function ensureMigrationTable(db: PrismaClient): Promise<void> {
  await db.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "_migration_history" (
      "id" TEXT NOT NULL PRIMARY KEY,
      "name" TEXT NOT NULL,
      "description" TEXT,
      "direction" TEXT NOT NULL CHECK ("direction" IN ('forward', 'rollback')),
      "duration_ms" INTEGER,
      "success" BOOLEAN NOT NULL,
      "error" TEXT,
      "applied_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
}

export async function recordMigration(
  db: PrismaClient,
  result: MigrationResult,
  direction: 'forward' | 'rollback',
  description?: string
): Promise<void> {
  await ensureMigrationTable(db)
  await db.$executeRawUnsafe(
    `INSERT INTO "_migration_history" (id, name, description, direction, duration_ms, success, error) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    `mig_${Date.now()}`,
    result.step,
    description || null,
    direction,
    result.durationMs,
    result.success,
    result.error || null,
  )
}

// ── Migration Summary ──
export function summarizeResults(results: MigrationResult[]): {
  total: number
  succeeded: number
  failed: number
  totalDurationMs: number
} {
  const succeeded = results.filter(r => r.success).length
  const failed = results.filter(r => !r.success).length
  const totalDurationMs = results.reduce((sum, r) => sum + r.durationMs, 0)
  return {
    total: results.length,
    succeeded,
    failed,
    totalDurationMs,
  }
}

// ── Applied Migrations Query ──
export async function getMigrationHistory(db: PrismaClient): Promise<
  Array<{
    id: string
    name: string
    description: string | null
    direction: string
    duration_ms: number | null
    success: boolean
    error: string | null
    applied_at: Date
  }>
> {
  await ensureMigrationTable(db)
  return db.$queryRawUnsafe(
    `SELECT * FROM "_migration_history" ORDER BY "applied_at" DESC`
  )
}

// ── Destructive Migration Guard ──
export function checkDestructiveSteps(steps: MigrationStep[]): MigrationStep[] {
  return steps.filter(s => s.destructive)
}

// ── Estimated Duration ──
export function estimateTotalDuration(steps: MigrationStep[]): number {
  return steps.reduce((sum, s) => sum + s.estimatedDurationMs, 0)
}
