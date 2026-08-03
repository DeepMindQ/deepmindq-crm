/**
 * WI-18.2 Persistence Integration Helper
 * =======================================
 *
 * Gate 1: No AI Module Direct Database Calls
 *   All persistence flows through this helper → adapter → DB.
 *   AI modules call persistWrite()/persistDelete() instead of Prisma directly.
 *
 * Gate 2: Shadow Mode
 *   When PERSISTENCE_SHADOW_MODE=true, Map operations continue normally
 *   AND DB writes happen in parallel (non-blocking, fire-and-forget).
 *
 * Gate 3: Write Failure Handling (VISIBILITY GUARANTEE)
 *   - DB failure → logged + queued for retry + health alert
 *   - Map operation ALWAYS succeeds regardless of DB state
 *   - No silent intelligence loss
 *
 *   FAILURE PIPELINE (every failure MUST produce visibility):
 *     DB write failure
 *       → adapter catches error
 *       → health monitor updated (consecutiveFailures++)
 *       → failure queue entry created (PersistenceOperationLog)
 *       → structured alert (WARNING at 3, CRITICAL at 10 consecutive)
 *       → retry with backoff (1s, 5s, 30s)
 *       → dead_letter if retries exhausted
 *       → ERROR-level log if queue enqueue itself fails
 *
 *   LAST-RESORT SAFETY:
 *     If adapter.write() itself throws (should never happen),
 *     persistWrite catches and logs at ERROR level.
 *     This ensures no failure can disappear silently.
 *
 * ARCHITECTURE:
 *   AI Module Function
 *     → Map.set() (existing, always succeeds)
 *     → persistWrite() (new, non-blocking)
 *       → adapter.write() (if enabled)
 *         → PostgreSQL (source of truth)
 *         → failure queue (on error)
 */

import { logger } from '@/lib/logger';
import type { IntelligencePersistenceStore } from '@prisma/client';
import { getPersistenceAdapter } from './intelligence-persistence-adapter';

/**
 * Persist a write operation to the database.
 *
 * CRITICAL: This function is NON-BLOCKING and FIRE-AND-FORGET.
 * The Map operation has already completed before this is called.
 * DB failure does NOT affect the Map state.
 *
 * @param store - The persistence store to write to
 * @param key - The Map key (used as DB record ID)
 * @param data - The full entity data to persist
 * @param companyId - Tenant context (Lock L3)
 */
export async function persistWrite(
  store: IntelligencePersistenceStore,
  key: string,
  data: Record<string, unknown>,
  companyId?: string | null
): Promise<void> {
  const adapter = getPersistenceAdapter();

  if (!adapter.isEnabled()) return;

  // Fire-and-forget: Don't await, don't block the caller
  adapter
    .write({
      store,
      operation: 'upsert',
      key,
      data,
      companyId: companyId ?? null,
      timestamp: Date.now(),
    })
    .then((result) => {
      if (!result.success) {
        // Adapter internally handles: health monitor + failure queue + audit log.
        // This log provides per-operation visibility for debugging.
        logger.warn(
          `[persistence] Background write failed: ${store}/${key} — ${result.failureReason}. ` +
          `Failure tracked by health monitor and retry queue.`
        );
      }
    })
    .catch((error) => {
      // LAST-RESORT VISIBILITY: adapter.write() should never throw
      // because it has its own try/catch. But if the adapter itself
      // fails catastrophically (e.g., health monitor throws), we MUST log.
      // This is the final safety net — no failure disappears silently.
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error(
        `[persistence] CRITICAL: persistWrite caught unexpected error for ${store}/${key}. ` +
        `This should never happen — adapter.write() is designed to never throw. ` +
        `Error: ${errMsg}. Map operation was unaffected.`
      );
    });
}

/**
 * Persist a delete operation to the database.
 *
 * CRITICAL: This function is NON-BLOCKING.
 * The Map.delete() has already completed before this is called.
 */
export async function persistDelete(
  store: IntelligencePersistenceStore,
  key: string,
  companyId?: string | null
): Promise<void> {
  const adapter = getPersistenceAdapter();

  if (!adapter.isEnabled()) return;

  adapter
    .delete(store, key)
    .then((result) => {
      if (!result.success) {
        logger.warn(
          `[persistence] Background delete failed: ${store}/${key} — ${result.failureReason}. ` +
          `Failure tracked by health monitor and retry queue.`
        );
      }
    })
    .catch((error) => {
      // LAST-RESORT VISIBILITY: adapter.delete() should never throw.
      const errMsg = error instanceof Error ? error.message : String(error);
      logger.error(
        `[persistence] CRITICAL: persistDelete caught unexpected error for ${store}/${key}. ` +
        `Error: ${errMsg}. Map delete was unaffected.`
      );
    });
}

/**
 * Check if DB persistence is currently enabled.
 * Useful for conditional logic in AI modules.
 */
export function isPersistenceEnabled(): boolean {
  return getPersistenceAdapter().isEnabled();
}

/**
 * Check if shadow mode is active.
 * In shadow mode, Map behavior is unchanged, DB writes happen in parallel.
 */
export function isShadowModeActive(): boolean {
  return getPersistenceAdapter().isShadowMode();
}

/**
 * Serialize a Float64Array to a Buffer for DB storage.
 * Used for retrieval index vectors.
 */
export function serializeVector(vector: Float64Array | null): Buffer | null {
  if (!vector) return null;
  return Buffer.from(vector.buffer, vector.byteOffset, vector.byteLength);
}

/**
 * Deserialize a Buffer back to Float64Array.
 * Used when loading vectors from DB.
 */
export function deserializeVector(buffer: Buffer | null): Float64Array | null {
  if (!buffer) return null;
  return new Float64Array(buffer.buffer, buffer.byteOffset, buffer.length / 8);
}
