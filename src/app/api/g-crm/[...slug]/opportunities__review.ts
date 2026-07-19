import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/apiHelpers';

/* ═══════════════════════════════════════════════════
   GET /api/g-crm/opportunities/review
   Review queue for pending opportunities.
   Query params: ?priority, ?limit
   ═══════════════════════════════════════════════════ */

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const priority = searchParams.get('priority');
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));

    const where: Record<string, unknown> = {
      status: 'pending_review',
    };
    if (priority) where.priority = priority;

    const opportunities = await db.opportunityRecommendation.findMany({
      where,
      include: {
        company: { select: { id: true, rawName: true, normalizedName: true, industry: true } },
        signal: { select: { id: true, title: true, signalType: true, impact: true, confidence: true } },
        capabilityMatch: { select: { id: true, matchScore: true, reason: true, capabilityId: true } },
        pursuits: {
          select: { id: true },
          take: 1,
        },
      },
      orderBy: [
        { opportunityScore: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    // Batch-load capability titles
    const matchEntries = opportunities.map(o => ({
      matchId: o.capabilityMatchId,
      capId: o.capabilityMatch.capabilityId,
    }));
    const capIds = [...new Set(matchEntries.map(e => e.capId))];
    const capTitles = new Map<string, string>();
    if (capIds.length > 0) {
      const assets = await db.capabilityAsset.findMany({
        where: { id: { in: capIds } },
        select: { id: true, title: true },
      });
      for (const a of assets) capTitles.set(a.id, a.title);
    }

    const enriched = opportunities.map(o => {
      let evidenceIds: string[] = [];
      try { evidenceIds = JSON.parse(o.evidenceIds); } catch { /* empty */ }

      return {
        ...o,
        companyName: o.company.rawName || o.company.normalizedName,
        companyIndustry: o.company.industry,
        capabilityTitle: capTitles.get(o.capabilityMatch.capabilityId) || 'Unknown',
        evidenceCount: evidenceIds.length,
        hasPursuit: o.pursuits.length > 0,
        recommendedStakeholders: safeJsonParse(o.recommendedStakeholders, []),
        evidenceIds,
        company: undefined,
        capabilityMatch: undefined,
        pursuits: undefined,
      };
    });

    return apiSuccess(enriched);
  } catch (err) {
    console.error('[opportunities/review GET]', err);
    return apiError('Failed to load review queue');
  }
}

/* ═══════════════════════════════════════════════════
   POST /api/g-crm/opportunities/review
   Batch review actions: accept, reject, monitor.
   Body: {
     action: "accept"|"reject"|"monitor",
     opportunityIds: string[],
     owner?: string,
     priority?: string,
     nextAction?: string,
     rejectionReason?: string,
     rejectionFeedback?: string,
     reviewedBy?: string
   }
   ═══════════════════════════════════════════════════ */

interface BatchResult {
  id: string;
  success: boolean;
  error?: string;
}

async function processAccept(
  opportunityId: string,
  owner?: string,
  priority?: string,
  nextAction?: string,
  reviewedBy?: string,
): Promise<BatchResult> {
  const opportunity = await db.opportunityRecommendation.findUnique({
    where: { id: opportunityId },
    select: { id: true, status: true, companyId: true, priority: true },
  });

  if (!opportunity) return { id: opportunityId, success: false, error: 'Opportunity not found' };
  if (opportunity.status !== 'pending_review') {
    return { id: opportunityId, success: false, error: `Status is "${opportunity.status}", expected "pending_review"` };
  }

  // Update opportunity status
  await db.opportunityRecommendation.update({
    where: { id: opportunityId },
    data: {
      status: 'accepted',
      reviewedBy: reviewedBy || null,
      reviewedAt: new Date(),
    },
  });

  // Create Pursuit record
  await db.pursuit.create({
    data: {
      opportunityId,
      companyId: opportunity.companyId,
      owner: owner || null,
      priority: priority || opportunity.priority,
      nextAction: nextAction || null,
      status: 'active',
    },
  });

  return { id: opportunityId, success: true };
}

async function processReject(
  opportunityId: string,
  rejectionReason?: string,
  rejectionFeedback?: string,
  reviewedBy?: string,
): Promise<BatchResult> {
  const opportunity = await db.opportunityRecommendation.findUnique({
    where: { id: opportunityId },
    select: { id: true, status: true },
  });

  if (!opportunity) return { id: opportunityId, success: false, error: 'Opportunity not found' };
  if (opportunity.status !== 'pending_review') {
    return { id: opportunityId, success: false, error: `Status is "${opportunity.status}", expected "pending_review"` };
  }

  await db.opportunityRecommendation.update({
    where: { id: opportunityId },
    data: {
      status: 'rejected',
      rejectionReason: rejectionReason || null,
      rejectionFeedback: rejectionFeedback || null,
      reviewedBy: reviewedBy || null,
      reviewedAt: new Date(),
    },
  });

  return { id: opportunityId, success: true };
}

async function processMonitor(
  opportunityId: string,
  reviewedBy?: string,
): Promise<BatchResult> {
  const opportunity = await db.opportunityRecommendation.findUnique({
    where: { id: opportunityId },
    select: { id: true, status: true },
  });

  if (!opportunity) return { id: opportunityId, success: false, error: 'Opportunity not found' };
  if (opportunity.status !== 'pending_review') {
    return { id: opportunityId, success: false, error: `Status is "${opportunity.status}", expected "pending_review"` };
  }

  await db.opportunityRecommendation.update({
    where: { id: opportunityId },
    data: {
      status: 'monitored',
      reviewedBy: reviewedBy || null,
      reviewedAt: new Date(),
    },
  });

  return { id: opportunityId, success: true };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      action,
      opportunityIds,
      owner,
      priority,
      nextAction,
      rejectionReason,
      rejectionFeedback,
      reviewedBy,
    } = body as {
      action: string;
      opportunityIds: string[];
      owner?: string;
      priority?: string;
      nextAction?: string;
      rejectionReason?: string;
      rejectionFeedback?: string;
      reviewedBy?: string;
    };

    if (!action || !opportunityIds || !Array.isArray(opportunityIds) || opportunityIds.length === 0) {
      return apiError('action and opportunityIds (non-empty array) are required', 400);
    }

    const validActions = ['accept', 'reject', 'monitor'];
    if (!validActions.includes(action)) {
      return apiError(`action must be one of: ${validActions.join(', ')}`, 400);
    }

    if (opportunityIds.length > 100) {
      return apiError('Maximum 100 opportunityIds per batch', 400);
    }

    const results: BatchResult[] = [];

    for (const id of opportunityIds) {
      try {
        let result: BatchResult;
        switch (action) {
          case 'accept':
            result = await processAccept(id, owner, priority, nextAction, reviewedBy);
            break;
          case 'reject':
            result = await processReject(id, rejectionReason, rejectionFeedback, reviewedBy);
            break;
          case 'monitor':
            result = await processMonitor(id, reviewedBy);
            break;
          default:
            result = { id, success: false, error: `Unknown action: ${action}` };
        }
        results.push(result);
      } catch (err) {
        results.push({
          id,
          success: false,
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    const processed = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;

    return apiSuccess({ processed, failed, results });
  } catch (err) {
    console.error('[opportunities/review POST]', err);
    return apiError(err instanceof Error ? err.message : 'Failed to process batch review');
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