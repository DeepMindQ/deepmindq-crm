import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  utilityGuard,
  utilityCatchError,
  utilitySuccess,
  RateLimitedError,
} from '@/lib/intelligence-api/guard';

export async function GET(request: NextRequest) {
  const startedAt = Date.now();

  let ctx: ReturnType<typeof utilityGuard>;
  try {
    ctx = utilityGuard(request, 'dashboard');
  } catch (err) {
    if (err instanceof RateLimitedError) {
      return new Response(JSON.stringify(err.errorBody), {
        status: 429,
        headers: err.headers,
      });
    }
    throw err;
  }

  try {
    const [
      contactsByStatus,
      totalCompanies,
      recentBatches,
      draftsPendingReview,
      queuePending,
      repliesThisWeek,
      bouncesCount,
      suppressionsCount,
      emailHealthDistribution,
    ] = await Promise.all([
      db.contact.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      db.company.count(),
      db.importBatch.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      db.draft.count({ where: { status: 'pending_review' } }),
      db.sendQueue.count({
        where: { status: { in: ['pending', 'scheduled'] } },
      }),
      db.reply.count({
        where: {
          receivedAt: {
            gte: new Date(new Date().setDate(new Date().getDate() - 7)),
          },
        },
      }),
      db.bounce.count(),
      db.suppression.count(),
      db.contact.groupBy({
        by: ['emailHealth'],
        _count: { emailHealth: true },
      }),
    ]);

    // Format contacts by status into a record
    const statusCounts: Record<string, number> = {};
    for (const group of contactsByStatus) {
      statusCounts[group.status as string] = group._count.status;
    }

    // Format email health distribution
    const healthCounts: Record<string, number> = {};
    for (const group of emailHealthDistribution) {
      healthCounts[group.emailHealth as string] = group._count.emailHealth;
    }

    return utilitySuccess(ctx, {
      contactsByStatus: statusCounts,
      totalCompanies,
      recentBatches,
      draftsPendingReview,
      queuePending,
      repliesThisWeek,
      bouncesCount,
      suppressionsCount,
      emailHealthDistribution: healthCounts,
    }, 'dashboard', Date.now() - startedAt);
  } catch (err) {
    return utilityCatchError(ctx, err, 500, 'ENGINE_ERROR', 'Dashboard fetch failed', Date.now() - startedAt);
  }
}
