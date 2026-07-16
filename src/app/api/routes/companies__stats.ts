import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

/* ═══════════════════════════════════════════════════
   GET — Company statistics and analytics
   ═══════════════════════════════════════════════════ */
export async function GET() {
  try {
    // Run all aggregation queries in parallel
    const [
      total,
      byStatusRaw,
      byIndustryRaw,
      bySizeRaw,
      enrichedCount,
      withNotesCount,
      avgScoreRaw,
      topCompanies,
    ] = await Promise.all([
      // Total company count
      db.company.count(),

      // Count by status
      db.company.groupBy({
        by: ['status'],
        _count: { status: true },
      }),

      // Count by industry
      db.company.groupBy({
        by: ['industry'],
        _count: { industry: true },
      }),

      // Count by size range
      db.company.groupBy({
        by: ['sizeRange'],
        _count: { sizeRange: true },
      }),

      // Count enriched companies (those with a research card)
      db.companyResearchCard.count(),

      // Count companies with notes
      db.company.count({
        where: {
          notes: { some: {} },
        },
      }),

      // Average intelligence score
      db.company.aggregate({
        _avg: { intelligenceScore: true },
      }),

      // Top companies by intelligence score
      db.company.findMany({
        take: 10,
        orderBy: { intelligenceScore: 'desc' },
        select: {
          id: true,
          rawName: true,
          domain: true,
          industry: true,
          status: true,
          intelligenceScore: true,
          engagementScore: true,
          _count: {
            select: { contacts: true, notes: true, signals: true },
          },
        },
      }),
    ]);

    // Transform groupBy results into key-value maps
    const byStatus: Record<string, number> = {};
    for (const item of byStatusRaw as any[]) {
      byStatus[item.status] = item._count.status;
    }

    const byIndustry: Record<string, number> = {};
    for (const item of byIndustryRaw as any[]) {
      if (item.industry) {
        byIndustry[item.industry] = item._count.industry;
      }
    }

    const bySize: Record<string, number> = {};
    for (const item of bySizeRaw as any[]) {
      if (item.sizeRange) {
        bySize[item.sizeRange] = item._count.sizeRange;
      }
    }

    return NextResponse.json({
      total,
      byStatus,
      byIndustry,
      bySize,
      enriched: enrichedCount,
      withNotes: withNotesCount,
      avgIntelligenceScore: Math.round((avgScoreRaw as any)._avg.intelligenceScore || 0),
      topCompanies: topCompanies.map((c: any) => ({
        ...c,
        contactCount: c._count.contacts,
        noteCount: c._count.notes,
        signalCount: c._count.signals,
      })),
    });
  } catch (error) {
    console.error('Company stats error:', error);
    return NextResponse.json({ error: 'Failed to fetch company statistics' }, { status: 500 });
  }
}