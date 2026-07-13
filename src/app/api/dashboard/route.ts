import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

/* ═══════════════════════════════════════════════════
   Demo data — shown when no real DB data exists
   ═══════════════════════════════════════════════════ */
const DEMO_DATA = {
  contactsByStatus: {
    imported: 142,
    cleaned: 98,
    drafted: 34,
    queued: 12,
    sent: 56,
    replied: 8,
    bounced: 5,
  },
  totalCompanies: 67,
  recentBatches: [
    { id: 'demo-1', fileName: 'tech_leads_q3_2026.xlsx', totalRows: 250, acceptedRows: 218, status: 'completed', createdAt: new Date(Date.now() - 86400000).toISOString() },
    { id: 'demo-2', fileName: 'fintech_decision_makers.csv', totalRows: 180, acceptedRows: 156, status: 'completed', createdAt: new Date(Date.now() - 172800000).toISOString() },
    { id: 'demo-3', fileName: 'healthcare_cios_list.xlsx', totalRows: 95, acceptedRows: 82, status: 'completed', createdAt: new Date(Date.now() - 604800000).toISOString() },
  ],
  draftsPendingReview: 7,
  queuePending: 12,
  repliesThisWeek: 3,
  bouncesCount: 5,
  suppressionsCount: 2,
  emailHealthDistribution: {
    valid: 210,
    risky: 38,
    invalid: 12,
    unknown: 95,
  },
};

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

    const totalLeads = Object.values(statusCounts).reduce((a, b) => a + b, 0);

    // If no real data exists, return demo data so the app looks alive
    if (totalLeads === 0 && totalCompanies === 0) {
      return NextResponse.json({ ...DEMO_DATA, _demo: true });
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
    return NextResponse.json({ ...DEMO_DATA, _demo: true });
  }
}