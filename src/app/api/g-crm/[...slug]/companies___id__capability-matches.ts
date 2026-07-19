import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/apiHelpers';

/* ═══════════════════════════════════════════════════════════════
   GET /api/g-crm/companies/[id]/capability-matches

   Track C-3: View all SignalCapabilityMatch records for a company,
   enriched with signal title/type and capability title/category.

   Query params:
     minScore    — filter by minimum matchScore (0-1, default 0)
     signalType  — filter by signal type
     limit       — max results (default 50, max 200)
   ═══════════════════════════════════════════════════════════════ */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: companyId } = await params;

    // Verify company exists
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { id: true, rawName: true },
    });
    if (!company) {
      return apiError('Company not found', 404);
    }

    const { searchParams } = new URL(request.url);
    const minScore = parseFloat(searchParams.get('minScore') || '0') || 0;
    const signalType = searchParams.get('signalType') || undefined;
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));

    const where: Record<string, unknown> = {
      companyId,
    };
    if (minScore > 0) {
      (where as Record<string, unknown>).matchScore = { gte: minScore };
    }

    const matches = await db.signalCapabilityMatch.findMany({
      where,
      include: {
        signal: {
          select: {
            id: true,
            signalType: true,
            title: true,
            severity: true,
            impact: true,
            status: true,
            meaningCategory: true,
          },
        },
        capability: {
          select: {
            id: true,
            title: true,
            category: true,
            technology: true,
            industry: true,
          },
        },
      },
      orderBy: { matchScore: 'desc' },
      take: limit,
    });

    // Optionally filter by signalType on the joined signal
    const filtered = signalType
      ? matches.filter(m => m.signal.signalType === signalType)
      : matches;

    const enriched = filtered.map(m => ({
      id: m.id,
      companyId: m.companyId,
      signalId: m.signalId,
      capabilityId: m.capabilityId,
      matchScore: m.matchScore,
      matchScorePercent: Math.round(m.matchScore * 100),
      reason: m.reason,
      businessProblem: m.businessProblem,
      expectedOutcome: m.expectedOutcome,
      salesAngle: m.salesAngle,
      createdAt: m.createdAt,
      // Enriched
      signal: m.signal,
      capability: m.capability,
    }));

    // Summary stats
    const summary = {
      total: enriched.length,
      avgMatchScore: enriched.length > 0
        ? Math.round((enriched.reduce((sum, m) => sum + m.matchScore, 0) / enriched.length) * 100) / 100
        : 0,
      highMatchCount: enriched.filter(m => m.matchScore >= 0.7).length,
      signalTypes: [...new Set(enriched.map(m => m.signal.signalType))],
    };

    return apiSuccess({ matches: enriched, summary });
  } catch (error) {
    console.error('[capability-matches] GET error:', error);
    return apiError('Failed to fetch capability matches');
  }
}