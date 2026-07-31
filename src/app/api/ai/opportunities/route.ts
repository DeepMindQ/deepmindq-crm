import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { apiSuccess, apiError } from '@/lib/apiHelpers';

/* ═══════════════════════════════════════════════════════════════
   Ticket 9 — Opportunity Radar Screen API

   Contract (per ARCHITECTURE.md):
   GET /api/ai/opportunities?status=pending_review&priority=high&page=1
   Response: {
     opportunities: OpportunityRecommendation[],
     stats: { total, byPriority, byStatus }
   }
   ═══════════════════════════════════════════════════════════════ */

const VALID_STATUSES = ['pending_review', 'accepted', 'rejected', 'monitored'];
const VALID_PRIORITIES = ['high', 'medium', 'low'];
const PAGE_SIZE = 20;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    /* ── Parse query params ── */
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10) || 1);

    /* ── Build Prisma where clause ── */
    const where: Record<string, unknown> = {};

    if (status && VALID_STATUSES.includes(status)) {
      where.status = status;
    }
    if (priority && VALID_PRIORITIES.includes(priority)) {
      where.priority = priority;
    }

    /* ── Fetch opportunities with company + signal + capability match ── */
    const [opportunities, total, allForStats] = await Promise.all([
      // Paginated opportunities
      db.opportunityRecommendation.findMany({
        where,
        include: {
          company: {
            select: { id: true, normalizedName: true, industry: true, sizeRange: true },
          },
          signal: {
            select: { id: true, signalType: true, title: true, severity: true },
          },
          capabilityMatch: {
            select: {
              id: true,
              matchScore: true,
              reason: true,
              salesAngle: true,
              capability: {
                select: { id: true, title: true, category: true },
              },
            },
          },
        },
        orderBy: [
          { priority: 'desc' },     // high first
          { opportunityScore: 'desc' },
          { createdAt: 'desc' },
        ],
        skip: (page - 1) * PAGE_SIZE,
        take: PAGE_SIZE,
      }),

      // Total count for current filters
      db.opportunityRecommendation.count({ where }),

      // All records for stats computation (byPriority, byStatus)
      db.opportunityRecommendation.findMany({
        select: { priority: true, status: true },
      }),
    ]);

    /* ── Build stats: { total, byPriority, byStatus } ── */
    const byPriority = { high: 0, medium: 0, low: 0 };
    const byStatus: Record<string, number> = {};
    for (const rec of allForStats) {
      if (rec.priority in byPriority) {
        (byPriority as Record<string, number>)[rec.priority]++;
      }
      byStatus[rec.status] = (byStatus[rec.status] || 0) + 1;
    }

    const stats = {
      total: allForStats.length,
      byPriority,
      byStatus,
    };

    return apiSuccess({
      opportunities,
      stats,
      pagination: {
        page,
        pageSize: PAGE_SIZE,
        total,
        totalPages: Math.ceil(total / PAGE_SIZE),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch opportunities';
    return apiError(message, 500);
  }
}
