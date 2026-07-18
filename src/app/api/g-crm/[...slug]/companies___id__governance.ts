import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/apiHelpers';

/**
 * GET /api/g-crm/companies/:id/governance
 *
 * Company-specific governance history and quality indicators.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: companyId } = await params;

    const company = await db.company.findUnique({ where: { id: companyId } });
    if (!company) return apiError('Company not found', 404);

    const [total, passed, recent] = await Promise.all([
      db.aIGenerationAudit.count({ where: { companyId } }),
      db.aIGenerationAudit.count({ where: { companyId, governancePassed: true } }),
      db.aIGenerationAudit.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          generationType: true,
          researchConfidence: true,
          freshnessScore: true,
          governancePassed: true,
          governanceChecks: true,
          outputSummary: true,
          createdAt: true,
        },
      }),
    ]);

    // Per-type breakdown for this company
    const byType = await db.aIGenerationAudit.groupBy({
      by: ['generationType'],
      where: { companyId },
      _count: { id: true },
      _avg: { researchConfidence: true, freshnessScore: true },
    });

    return apiSuccess({
      companyId,
      companyName: company.rawName,
      summary: {
        totalGenerations: total,
        passedGenerations: passed,
        passRate: total > 0 ? Math.round((passed / total) * 100) : 100,
      },
      byType: byType.map(t => ({
        type: t.generationType,
        count: t._count.id,
        avgConfidence: t._avg.researchConfidence != null ? Math.round(t._avg.researchConfidence * 100) : null,
        avgFreshness: t._avg.freshnessScore != null ? Math.round(t._avg.freshnessScore) : null,
      })),
      recentGenerations: recent,
    });
  } catch (err) {
    console.error('[companies/:id/governance]', err);
    return apiError('Failed to load company governance', 500);
  }
}