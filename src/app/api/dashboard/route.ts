import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

export async function GET() {
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
      // Contacts grouped by status
      db.contact.groupBy({
        by: ['status'],
        _count: { status: true },
      }),
      // Total companies
      db.company.count(),
      // Recent 5 batches
      db.importBatch.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
      // Drafts pending review
      db.draft.count({ where: { status: 'pending_review' } }),
      // Queue pending
      db.sendQueue.count({
        where: { status: { in: ['pending', 'scheduled'] } },
      }),
      // Replies this week
      db.reply.count({
        where: {
          receivedAt: {
            gte: new Date(new Date().setDate(new Date().getDate() - 7)),
          },
        },
      }),
      // Total bounces
      db.bounce.count(),
      // Total suppressions
      db.suppression.count(),
      // Email health distribution
      db.contact.groupBy({
        by: ['emailHealth'],
        _count: { emailHealth: true },
      }),
    ]);

    // Format contacts by status into a record
    const statusCounts: Record<string, number> = {};
    for (const group of contactsByStatus) {
      statusCounts[group.status] = group._count.status;
    }

    // Format email health distribution
    const healthCounts: Record<string, number> = {};
    for (const group of emailHealthDistribution) {
      healthCounts[group.emailHealth] = group._count.emailHealth;
    }

    return NextResponse.json({
      contactsByStatus: statusCounts,
      totalCompanies,
      recentBatches,
      draftsPendingReview,
      queuePending,
      repliesThisWeek,
      bouncesCount,
      suppressionsCount,
      emailHealthDistribution: healthCounts,
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    return NextResponse.json(
      { error: 'Failed to load dashboard data' },
      { status: 500 }
    );
  }
}