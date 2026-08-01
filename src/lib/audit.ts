import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

/* ═══════════════════════════════════════════════════
   Audit Logging Utility
   Provides a simple interface to log actions to AuditLog.
   ═══════════════════════════════════════════════════ */

export async function logAction(
  action: string,
  entity: string,
  entityId: string,
  details?: Record<string, unknown>,
  userId?: string
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action,
        entity,
        entityId,
        userId: userId || undefined,
        details: details ? JSON.stringify(details) : undefined,
      },
    });
  } catch (err) {
    logger.error('[Audit] Failed to log action:', { error: err });
  }
}