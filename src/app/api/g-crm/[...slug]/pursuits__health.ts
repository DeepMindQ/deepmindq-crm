import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/apiHelpers';

/* ═══════════════════════════════════════════════════════════════
   GET /api/g-crm/pursuits/health

   Track C-4: Pursuit freshness and stale detection.
   Returns health assessment for all active pursuits.

   A pursuit is "stale" if:
     - status is "active" AND
     - lastActivityAt is NULL or older than 14 days AND
     - nextActionAt is NULL or in the past

   Returns:
     - activePursuits: count
     - stalePursuits: count + details
     - atRiskPursuits: count (stale within 7-14 days)
     - healthyPursuits: count
   ═══════════════════════════════════════════════════════════════ */

const STALE_THRESHOLD_DAYS = 14;
const AT_RISK_THRESHOLD_DAYS = 7;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId') || undefined;
    const owner = searchParams.get('owner') || undefined;

    const now = new Date();
    const staleBefore = new Date(now.getTime() - STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);
    const atRiskBefore = new Date(now.getTime() - AT_RISK_THRESHOLD_DAYS * 24 * 60 * 60 * 1000);

    const where: Record<string, unknown> = { status: 'active' };
    if (companyId) where.companyId = companyId;
    if (owner) where.owner = owner;

    const pursuits = await db.pursuit.findMany({
      where,
      include: {
        opportunity: {
          select: {
            opportunityTitle: true,
            businessTrigger: true,
            recommendedCapability: true,
            opportunityScore: true,
          },
        },
        company: {
          select: { id: true, rawName: true, industry: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const healthy: typeof pursuits = [];
    const atRisk: typeof pursuits = [];
    const stale: typeof pursuits = [];

    for (const p of pursuits) {
      const lastActivity = p.lastActivityAt || p.updatedAt;
      const nextAction = p.nextActionAt;
      const daysSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24);
      const nextActionPassed = nextAction && nextAction < now;

      if (daysSinceActivity >= STALE_THRESHOLD_DAYS || (!p.lastActivityAt && daysSinceActivity >= STALE_THRESHOLD_DAYS)) {
        stale.push(p);
      } else if (daysSinceActivity >= AT_RISK_THRESHOLD_DAYS || nextActionPassed) {
        atRisk.push(p);
      } else {
        healthy.push(p);
      }
    }

    const enrichPursuit = (p: typeof pursuits[0]) => ({
      id: p.id,
      companyId: p.companyId,
      companyName: p.company.rawName,
      companyIndustry: p.company.industry,
      opportunityTitle: p.opportunity.opportunityTitle,
      recommendedCapability: p.opportunity.recommendedCapability,
      opportunityScore: p.opportunity.opportunityScore,
      owner: p.owner,
      priority: p.priority,
      nextAction: p.nextAction,
      nextActionAt: p.nextActionAt,
      lastActivityAt: p.lastActivityAt,
      daysSinceActivity: Math.round(
        ((p.lastActivityAt || p.updatedAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24) * -1
      ),
      outcomeStage: p.outcomeStage,
    });

    return apiSuccess({
      summary: {
        total: pursuits.length,
        healthy: healthy.length,
        atRisk: atRisk.length,
        stale: stale.length,
      },
      stalePursuits: stale.map(enrichPursuit),
      atRiskPursuits: atRisk.map(enrichPursuit),
      healthyPursuits: healthy.map(enrichPursuit),
    });
  } catch (error) {
    console.error('[pursuits/health] GET error:', error);
    return apiError('Failed to assess pursuit health');
  }
}