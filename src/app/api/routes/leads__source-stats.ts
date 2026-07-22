import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   GET /api/leads/source-stats
   Returns performance stats by lead source
   ═══════════════════════════════════════════════════ */

export async function GET() {
  try {
    const contacts = await db.contact.findMany({
      where: { source: { not: null } },
      select: {
        source: true,
        status: true,
        id: true,
      },
    });

    // Group by source
    const sourceMap: Record<string, { count: number; drafted: number; sent: number; replied: number; bounced: number }> = {};

    for (const c of contacts) {
      const src = c.source || 'manual';
      if (!sourceMap[src]) {
        sourceMap[src] = { count: 0, drafted: 0, sent: 0, replied: 0, bounced: 0 };
      }
      sourceMap[src].count++;
      if (c.status === 'drafted') sourceMap[src].drafted++;
      if (c.status === 'queued' || c.status === 'sent') sourceMap[src].sent++;
      if (c.status === 'replied') sourceMap[src].replied++;
      if (c.status === 'bounced') sourceMap[src].bounced++;
    }

    const sources = Object.entries(sourceMap).map(([name, stats]) => ({
      name,
      count: stats.count,
      drafted: stats.drafted,
      sent: stats.sent,
      replied: stats.replied,
      bounced: stats.bounced,
      conversionRate: stats.sent > 0 ? Math.round((stats.replied / stats.sent) * 100) : 0,
    })).sort((a, b) => b.count - a.count);

    return NextResponse.json({ sources });
  } catch (error) {
    console.error('Source stats error:', error);
    return NextResponse.json({ error: 'Failed to get source stats' }, { status: 500 });
  }
}