import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { apiSuccess } from '@/lib/apiHelpers';
import { getBatchFreshnessProfiles, getStaleCompanies } from '@/lib/research-engine/freshness-indicators';

/**
 * GET /api/g-crm/freshness-overview
 *
 * Portfolio-level freshness summary.
 * Query params:
 *   - view: "stale" (companies needing refresh, default) | "all" (all with research cards)
 *   - limit: number (default 20)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const view = searchParams.get('view') || 'stale';
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);

  try {
    let profiles;
    if (view === 'all') {
      const companies = await db.company.findMany({
        where: { researchCard: { isNot: null } },
        select: { id: true },
        take: limit,
        orderBy: { researchCard: { lastResearchedAt: 'asc' } },
      });
      profiles = await getBatchFreshnessProfiles(companies.map(c => c.id));
    } else {
      profiles = await getStaleCompanies(limit);
    }

    // Compute portfolio summary
    const total = profiles.length;
    const freshCount = profiles.filter(p => p.overallStatus === 'fresh').length;
    const agingCount = profiles.filter(p => p.overallStatus === 'aging').length;
    const staleCount = profiles.filter(p => p.overallStatus === 'stale').length;
    const expiredCount = profiles.filter(p => p.overallStatus === 'expired').length;
    const noneCount = profiles.filter(p => p.overallStatus === 'none').length;
    const avgScore = total > 0 ? Math.round(profiles.reduce((s, p) => s + p.overallScore, 0) / total) : 0;

    return apiSuccess({
      summary: { total, freshCount, agingCount, staleCount, expiredCount, noneCount, avgScore },
      companies: profiles,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to get freshness overview' }, { status: 500 });
  }
}