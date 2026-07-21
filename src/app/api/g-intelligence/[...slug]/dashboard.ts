// GET /api/g-intelligence/dashboard
import { NextRequest, NextResponse } from 'next/server';
import { getDashboardHealthStats } from '@/lib/intelligence-health';
import { db } from '@/lib/db';

export async function GET(_req: NextRequest) {

export async function GET(req: NextRequest) {
  const [healthStats, conflictCounts, recentConflicts, validationStats] = await Promise.all([
    getDashboardHealthStats(),
    db.intelligenceConflict.groupBy({
      by: ['status'],
      _count: { id: true },
    }),
    db.intelligenceConflict.findMany({
      where: { status: 'open' },
      include: {
        company: { select: { rawName: true, normalizedName: true } },
      },
      orderBy: { detectedAt: 'desc' },
      take: 10,
    }),
    db.companyIntelligenceHealth.count(),
  ]);

  const totalConflicts = conflictCounts.reduce((sum, g) => sum + g._count.id, 0);
  const openConflicts = conflictCounts
    .filter(g => g.status === 'open')
    .reduce((sum, g) => sum + g._count.id, 0);

  // Validation rate: companies with health records / total companies
  const totalCompaniesInDb = await db.company.count();
  const validationRate = totalCompaniesInDb > 0
    ? Math.round((validationStats / totalCompaniesInDb) * 100) / 100
    : 0;

  return NextResponse.json({
    summary: {
      totalCompanies: healthStats.totalCompanies,
      avgHealthScore: healthStats.avgHealthScore,
      companiesByHealthTier: healthStats.companiesByHealthTier,
      totalConflicts,
      openConflicts,
      validationRate,
    },
    lowestHealthCompanies: healthStats.lowestHealthCompanies,
    recentConflicts: recentConflicts.map(c => ({
      id: c.id,
      companyId: c.companyId,
      id: c.id,
      companyId: c.companyId,
      companyName: c.company.rawName || c.company.normalizedName || 'Unknown',
      conflictType: c.conflictType,
      severity: c.severity,
      detectedAt: c.detectedAt.toISOString(),
    })),
  });
}