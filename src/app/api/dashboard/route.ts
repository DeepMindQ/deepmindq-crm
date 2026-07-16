import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Auto-seed if DB is empty
    const contactCount = await db.contact.count();
    if (contactCount === 0) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000';
        await fetch(`${baseUrl}/api/seed`, { method: 'POST' });
      } catch (e) {
        console.error('Auto-seed failed:', e);
      }
    }

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
    for (const group of contactsByStatus as any[]) {
      statusCounts[group.status] = group._count.status;
    }

    // Format email health distribution
    const healthCounts: Record<string, number> = {};
    for (const group of emailHealthDistribution as any[]) {
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
    return NextResponse.json({
      contactsByStatus: {},
      totalCompanies: 0,
      recentBatches: [],
      draftsPendingReview: 0,
      queuePending: 0,
      repliesThisWeek: 0,
      bouncesCount: 0,
      suppressionsCount: 0,
      emailHealthDistribution: {},
    });
  }
}