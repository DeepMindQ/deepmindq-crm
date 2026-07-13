import { db } from '@/lib/db';

/* ═══════════════════════════════════════════════════
   Audit Logging Utility
   Provides a simple interface to log actions to AuditLog.
   ═══════════════════════════════════════════════════ */

export async function logAction(
  action: string,
  entity: string,
  entityId: string,
  details?: Record<string, unknown>
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action,
        entity,
        entityId,
        details: details ? JSON.stringify(details) : undefined,
      },
    });
  } catch (err) {
    console.error('[Audit] Failed to log action:', err);
  }
}