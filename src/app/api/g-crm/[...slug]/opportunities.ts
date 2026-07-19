import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/apiHelpers';
import {
  generateOpportunityRecommendation,
  generateCompanyOpportunities,
} from '@/lib/research-engine/opportunity-recommendation-engine';

/* ═══════════════════════════════════════════════════
   GET /api/g-crm/opportunities
   List all opportunity recommendations with filters.
   Query params: ?status, ?priority, ?companyId, ?limit
   ═══════════════════════════════════════════════════ */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const companyId = searchParams.get('companyId');
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (companyId) where.companyId = companyId;

    const opportunities = await db.opportunityRecommendation.findMany({
      where,
      include: {
        company: { select: { id: true, rawName: true, normalizedName: true, industry: true } },
        signal: { select: { id: true, title: true, signalType: true, impact: true } },
        capabilityMatch: { select: { id: true, matchScore: true, reason: true } },
        pursuits: {
          select: { id: true, status: true, owner: true, outcomeStage: true },
          take: 1,
        },
      },
      orderBy: [
        { opportunityScore: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    // Enrich with capability title (SignalCapabilityMatch doesn't have direct Prisma relation to CapabilityAsset)
    const matchIds = [...new Set(opportunities.map(o => o.capabilityMatchId))];
    const capabilityTitles = new Map<string, string>();
    if (matchIds.length > 0) {
      const matches = await db.signalCapabilityMatch.findMany({
        where: { id: { in: matchIds } },
        select: { id: true, capabilityId: true },
      });
      const capIds = [...new Set(matches.map(m => m.capabilityId))];
      if (capIds.length > 0) {
        const assets = await db.capabilityAsset.findMany({
          where: { id: { in: capIds } },
          select: { id: true, title: true },
        });
        const capMap = new Map(assets.map(a => [a.id, a.title]));
        const matchToCap = new Map(matches.map(m => [m.id, m.capabilityId]));
        for (const mId of matchIds) {
          const capId = matchToCap.get(mId);
          if (capId) capabilityTitles.set(mId, capMap.get(capId) || 'Unknown');
        }
      }
    }

    const enriched = opportunities.map(o => ({
      ...o,
      recommendedStakeholders: safeJsonParse(o.recommendedStakeholders, []),
      evidenceIds: safeJsonParse(o.evidenceIds, []),
      capabilityTitle: capabilityTitles.get(o.capabilityMatchId) || null,
      pursuit: o.pursuits[0] || null,
      pursuits: undefined,
    }));

    return apiSuccess(enriched);
  } catch (err) {
    console.error('[opportunities GET]', err);
    return apiError('Failed to list opportunities');
  }
}

/* ═══════════════════════════════════════════════════
   POST /api/g-crm/opportunities
   Generate opportunity recommendations.
   Body: { companyId } or { companyId, signalId, capabilityMatchId }
   ═══════════════════════════════════════════════════ */

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { companyId, signalId, capabilityMatchId } = body;

    if (!companyId) {
      return apiError('companyId is required', 400);
    }

    // Single recommendation mode
    if (signalId && capabilityMatchId) {
      const result = await generateOpportunityRecommendation({
        companyId,
        signalId,
        capabilityMatchId,
      });
      return apiSuccess(result);
    }

    // Company-wide generation mode
    const result = await generateCompanyOpportunities(companyId);
    return apiSuccess(result);
  } catch (err) {
    console.error('[opportunities POST]', err);
    return apiError(err instanceof Error ? err.message : 'Failed to generate opportunities');
  }
}

/* ═══════════════════════════════════════════════════
   PATCH /api/g-crm/opportunities
   Update a single opportunity status.
   Body: { id, status, rejectionReason?, rejectionFeedback?, reviewedBy? }
   Only allows: pending_review → accepted/rejected/monitored
   If status === 'accepted', also create a Pursuit record automatically.
   ═══════════════════════════════════════════════════ */

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, status, rejectionReason, rejectionFeedback, reviewedBy } = body;

    if (!id || !status) {
      return apiError('id and status are required', 400);
    }

    const validTransitions: Record<string, string[]> = {
      pending_review: ['accepted', 'rejected', 'monitored'],
    };

    // Load current opportunity
    const opportunity = await db.opportunityRecommendation.findUnique({
      where: { id },
      select: { id: true, status: true, companyId: true, priority: true },
    });

    if (!opportunity) {
      return apiError('Opportunity not found', 404);
    }

    const allowed = validTransitions[opportunity.status];
    if (!allowed || !allowed.includes(status)) {
      return apiError(
        `Cannot transition from "${opportunity.status}" to "${status}"`,
        400,
      );
    }

    // Update the opportunity
    const updateData: Record<string, unknown> = {
      status,
      reviewedBy: reviewedBy || null,
      reviewedAt: new Date(),
    };

    if (status === 'rejected') {
      updateData.rejectionReason = rejectionReason || null;
      updateData.rejectionFeedback = rejectionFeedback || null;
    }

    await db.opportunityRecommendation.update({
      where: { id },
      data: updateData,
    });

    // If accepted, auto-create a Pursuit record
    let pursuit: Record<string, unknown> | null = null;
    if (status === 'accepted') {
      pursuit = await db.pursuit.create({
        data: {
          opportunityId: id,
          companyId: opportunity.companyId,
          priority: opportunity.priority,
          status: 'active',
        },
      });
    }

    return apiSuccess({
      id,
      status,
      reviewedBy: updateData.reviewedBy,
      reviewedAt: updateData.reviewedAt,
      rejectionReason: status === 'rejected' ? rejectionReason : undefined,
      rejectionFeedback: status === 'rejected' ? rejectionFeedback : undefined,
      pursuit,
    });
  } catch (err) {
    console.error('[opportunities PATCH]', err);
    return apiError(err instanceof Error ? err.message : 'Failed to update opportunity');
  }
}

// ── Helpers ──

function safeJsonParse(str: string, fallback: unknown): unknown {
  if (typeof str !== 'string') return fallback;
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}