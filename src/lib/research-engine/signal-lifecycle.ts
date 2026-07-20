/**
 * Signal Lifecycle Manager (Phase 4 B1)
 *
 * Transitions CompanySignal records through lifecycle states:
 *   detected → validated → active → aging → expired → archived
 *
 * Rules:
 *   - active: signalDate within 14 days AND (confidence >= 0.7 AND impact === 'high')
 *   - validated: signalDate within 14 days AND confidence >= 0.5
 *   - detected: signalDate within 14 days AND confidence < 0.5
 *   - aging: signalDate 14-90 days ago
 *   - expired: signalDate 90-365 days ago
 *   - archived: signalDate > 365 days ago
 *
 * This should be called by the background job processor.
 */
import { db } from '@/lib/db';

export async function transitionSignalLifecycles(): Promise<{
  transitioned: number;
  breakdown: Record<string, number>;
}> {
  const now = new Date();
  const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
  const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

  const breakdown: Record<string, number> = {};
  let transitioned = 0;

  // FIX-GAP-17: Cursor-based pagination (200 per batch) instead of loading all non-archived signals at once.
  // Prevents OOM risk at scale by only holding one page of signals in memory at a time.
  const BATCH_SIZE = 200;
  let cursor: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const signals = await db.companySignal.findMany({
      where: { status: { notIn: ['archived', 'expired'] } },
      select: { id: true, signalDate: true, confidence: true, impact: true, status: true },
      take: BATCH_SIZE,
      orderBy: { id: 'asc' },
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    if (signals.length === 0) break;
    hasMore = signals.length === BATCH_SIZE;

    // Batch updates grouped by new status
    const byNewStatus: Record<string, string[]> = {};

    for (const signal of signals) {
      const signalAge = signal.signalDate
        ? now.getTime() - new Date(signal.signalDate).getTime()
        : now.getTime(); // no signalDate = treat as old

      let newStatus: string;
      if (signalAge > ONE_YEAR_MS) {
        newStatus = 'archived';
      } else if (signalAge > NINETY_DAYS_MS) {
        newStatus = 'expired';
      } else if (signalAge > FOURTEEN_DAYS_MS) {
        newStatus = 'aging';
      } else if (signal.confidence >= 0.7 && signal.impact === 'high') {
        newStatus = 'active';
      } else if (signal.confidence >= 0.5) {
        newStatus = 'validated';
      } else {
        newStatus = 'detected';
      }

      if (newStatus !== signal.status) {
        if (!byNewStatus[newStatus]) byNewStatus[newStatus] = [];
        byNewStatus[newStatus].push(signal.id);
        breakdown[`${signal.status}→${newStatus}`] = (breakdown[`${signal.status}→${newStatus}`] || 0) + 1;
        transitioned++;
      }
    }

    // Execute batch updates for this page
    for (const [status, ids] of Object.entries(byNewStatus)) {
      if (ids.length > 0) {
        await db.companySignal.updateMany({
          where: { id: { in: ids } },
          data: { status },
        });
      }
    }

    // Advance cursor to the last signal's ID for next page
    cursor = signals[signals.length - 1].id;
  }

  return { transitioned, breakdown };
}