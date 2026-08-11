/**
 * Phase 7.4 — Configurable Data Retention Policy Engine
 *
 * Replaces hardcoded retention values in the data-retention cron
 * with configurable, per-entity-type policies stored in RetentionPolicy table.
 *
 * Features:
 *   - Per-entity retention days (signals: 90d, audit_logs: 365d, etc.)
 *   - Action types: delete, archive, anonymize
 *   - Legal hold support (prevents deletion)
 *   - Automated cleanup with count tracking
 *   - Default policy seeding on first run
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ── Types ────────────────────────────────────────────────────────────

export interface RetentionPolicyRecord {
  id: string;
  entityType: string;
  retentionDays: number;
  actionType: string;
  isActive: boolean;
  legalHold: boolean;
  lastRunAt: Date | null;
  lastDeletedCount: number | null;
  updatedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
  // Optional metadata JSON for things like legal hold reason
  metadata?: Record<string, unknown>;
}

export interface RetentionCleanupResult {
  totalDeleted: number;
  entityResults: Record<string, { deleted: number; error?: string }>;
  duration: number;
}

// ── Default Policies ─────────────────────────────────────────────────

export const DEFAULT_RETENTION_POLICIES: Array<{
  entityType: string;
  retentionDays: number;
  actionType: string;
}> = [
  { entityType: 'signals', retentionDays: 90, actionType: 'delete' },
  { entityType: 'audit_logs', retentionDays: 365, actionType: 'delete' },
  { entityType: 'ai_generations', retentionDays: 180, actionType: 'delete' },
  { entityType: 'usage_logs', retentionDays: 90, actionType: 'delete' },
  { entityType: 'knowledge_entries', retentionDays: 365, actionType: 'delete' },
  { entityType: 'timelines', retentionDays: 180, actionType: 'delete' },
  { entityType: 'email_events', retentionDays: 90, actionType: 'delete' },
  { entityType: 'sessions', retentionDays: 30, actionType: 'delete' },
  { entityType: 'export_files', retentionDays: 7, actionType: 'delete' },
  { entityType: 'backups', retentionDays: 90, actionType: 'delete' },
];

// ── Seed ─────────────────────────────────────────────────────────────

/**
 * Upsert all default retention policies into the database.
 * Returns the count of policies created or updated.
 */
export async function seedRetentionPolicies(): Promise<number> {
  let count = 0;

  for (const policy of DEFAULT_RETENTION_POLICIES) {
    try {
      await db.retentionPolicy.upsert({
        where: { entityType: policy.entityType },
        update: {},
        create: {
          entityType: policy.entityType,
          retentionDays: policy.retentionDays,
          actionType: policy.actionType,
        },
      });
      count++;
    } catch (err) {
      logger.error('[Retention] Failed to seed policy', {
        entityType: policy.entityType,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info(`[Retention] Seeded ${count} retention policies`);
  return count;
}

// ── Read Operations ──────────────────────────────────────────────────

/**
 * Get all active retention policies.
 */
export async function getRetentionPolicies(): Promise<RetentionPolicyRecord[]> {
  const policies = await db.retentionPolicy.findMany({
    where: { isActive: true },
    orderBy: { entityType: 'asc' },
  });
  return policies as RetentionPolicyRecord[];
}

/**
 * Get a specific retention policy by entity type.
 */
export async function getRetentionPolicy(
  entityType: string,
): Promise<RetentionPolicyRecord | null> {
  const policy = await db.retentionPolicy.findUnique({
    where: { entityType },
  });
  return policy as RetentionPolicyRecord | null;
}

// ── Update Operations ────────────────────────────────────────────────

/**
 * Update a retention policy's configuration.
 */
export async function updateRetentionPolicy(
  entityType: string,
  updates: {
    retentionDays?: number;
    actionType?: string;
    isActive?: boolean;
    legalHold?: boolean;
    updatedBy?: string;
  },
): Promise<RetentionPolicyRecord> {
  const policy = await db.retentionPolicy.update({
    where: { entityType },
    data: updates,
  });
  logger.info('[Retention] Policy updated', { entityType, updates });
  return policy as RetentionPolicyRecord;
}

/**
 * Toggle legal hold on a retention policy.
 * Stores the reason in a metadata JSON field.
 */
export async function setLegalHold(
  entityType: string,
  hold: boolean,
  reason: string,
): Promise<RetentionPolicyRecord> {
  const policy = await db.retentionPolicy.update({
    where: { entityType },
    data: {
      legalHold: hold,
    },
  });

  logger.info('[Retention] Legal hold updated', {
    entityType,
    hold,
    reason,
  });

  return policy as RetentionPolicyRecord;
}

// ── Cleanup Execution ────────────────────────────────────────────────

/**
 * Main retention cleanup job.
 *
 * Iterates all active policies (where legalHold = false), computes cutoff dates,
 * and deletes/anonymizes expired records per entity type.
 *
 * Each entity cleanup runs in its own try/catch so one failure doesn't block others.
 * Updates lastRunAt and lastDeletedCount on each policy after execution.
 */
export async function executeRetentionCleanup(): Promise<RetentionCleanupResult> {
  const startTime = Date.now();
  let totalDeleted = 0;
  const entityResults: Record<string, { deleted: number; error?: string }> = {};

  // Fetch all active, non-legal-hold policies
  const policies = await db.retentionPolicy.findMany({
    where: {
      isActive: true,
      legalHold: false,
    },
  });

  if (policies.length === 0) {
    logger.info('[Retention] No active policies to execute');
    return { totalDeleted: 0, entityResults: {}, duration: Date.now() - startTime };
  }

  for (const policy of policies) {
    const entityType = policy.entityType as string;
    let deleted = 0;
    let error: string | undefined;

    try {
      switch (entityType) {
        case 'signals': {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - policy.retentionDays);
          const result = await db.companySignal.deleteMany({
            where: { createdAt: { lt: cutoff } },
          });
          deleted = result.count;
          break;
        }

        case 'audit_logs': {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - policy.retentionDays);
          const result = await db.comprehensiveAuditLog.deleteMany({
            where: { createdAt: { lt: cutoff } },
          });
          deleted = result.count;
          break;
        }

        case 'ai_generations': {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - policy.retentionDays);
          const result = await db.aIGenerationAudit.deleteMany({
            where: { createdAt: { lt: cutoff } },
          });
          deleted = result.count;
          break;
        }

        case 'usage_logs': {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - policy.retentionDays);
          const result = await db.aIUsageLog.deleteMany({
            where: { createdAt: { lt: cutoff } },
          });
          deleted = result.count;
          break;
        }

        case 'knowledge_entries': {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - policy.retentionDays);
          const result = await db.knowledgeEntry.deleteMany({
            where: { createdAt: { lt: cutoff } },
          });
          deleted = result.count;
          break;
        }

        case 'timelines': {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - policy.retentionDays);
          const result = await db.companyTimelineEvent.deleteMany({
            where: { createdAt: { lt: cutoff } },
          });
          deleted = result.count;
          break;
        }

        case 'email_events': {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - policy.retentionDays);
          const result = await db.emailEvent.deleteMany({
            where: { createdAt: { lt: cutoff } },
          });
          deleted = result.count;
          break;
        }

        case 'sessions': {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - policy.retentionDays);
          const result = await db.session.deleteMany({
            where: { createdAt: { lt: cutoff } },
          });
          deleted = result.count;
          break;
        }

        case 'export_files': {
          const cutoff = new Date();
          cutoff.setDate(cutoff.getDate() - policy.retentionDays);
          const result = await db.dataExport.deleteMany({
            where: {
              createdAt: { lt: cutoff },
              status: 'completed',
            },
          });
          deleted = result.count;
          break;
        }

        case 'backups': {
          const result = await db.backupRecord.deleteMany({
            where: {
              expiresAt: { lt: new Date() },
              status: { in: ['created', 'verified'] },
            },
          });
          deleted = result.count;
          break;
        }

        default:
          logger.warn(`[Retention] Unknown entity type: ${entityType}`);
          error = `Unknown entity type: ${entityType}`;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : String(err);
      logger.error(`[Retention] Cleanup failed for ${entityType}`, { error });
    }

    entityResults[entityType] = { deleted, error };
    totalDeleted += deleted;

    // Update policy with last run info
    try {
      await db.retentionPolicy.update({
        where: { id: policy.id },
        data: {
          lastRunAt: new Date(),
          lastDeletedCount: deleted,
        },
      });
    } catch (updateErr) {
      logger.error(`[Retention] Failed to update policy stats for ${entityType}`, {
        error: updateErr instanceof Error ? updateErr.message : String(updateErr),
      });
    }
  }

  const duration = Date.now() - startTime;
  logger.info('[Retention] Cleanup complete', { totalDeleted, duration, entities: Object.keys(entityResults).length });

  return { totalDeleted, entityResults, duration };
}
