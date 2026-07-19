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
  // 1. Load all signals NOT already archived (no point re-checking archived)
  const signals = await db.companySignal.findMany({
    where: { status: { not: 'archived' } },
    select: { id: true, signalDate: true, confidence: true, impact: true, status: true },
  });

  const now = new Date();
  const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;
  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;
  const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

  const breakdown: Record<string, number> = {};
  let transitioned = 0;

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

  // Execute batch updates
  for (const [status, ids] of Object.entries(byNewStatus)) {
    if (ids.length > 0) {
      await db.companySignal.updateMany({
        where: { id: { in: ids } },
        data: { status },
      });
    }
  }

  return { transitioned, breakdown };
}