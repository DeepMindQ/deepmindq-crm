import { db } from '@/lib/db';
import { NextRequest } from 'next/server';
import { apiSuccess, apiError } from '@/lib/apiHelpers';
import { inferSignalMeaning, batchInferMeaning } from '@/lib/research-engine/signal-meaning';

/* ═══════════════════════════════════════════════════════════════
   GET /api/g-crm/companies/[id]/signal-meaning

   Track C-6: Infer and return buying-stage meaning for a company's signals.
   Also returns an overall "company buying signal" summary.

   Query params:
     category — filter by meaningCategory
     limit    — max signals (default 50)
   ═══════════════════════════════════════════════════════════════ */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: companyId } = await params;
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') || undefined;
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));

    const signals = await db.companySignal.findMany({
      where: { companyId },
      orderBy: [
        { impact: 'desc' },
        { createdAt: 'desc' },
      ],
      take: limit,
    });

    if (signals.length === 0) {
      return apiSuccess({
        signals: [],
        summary: { total: 0, topCategory: null, categoryBreakdown: {} },
      });
    }

    // Infer meaning for each signal
    const enriched = signals.map(s => {
      const meaning = inferSignalMeaning({
        signalType: s.signalType,
        severity: s.severity,
        impact: s.impact,
        opportunityType: s.opportunityType,
        title: s.title,
        description: s.description,
      });
      return {
        id: s.id,
        signalType: s.signalType,
        title: s.title,
        severity: s.severity,
        impact: s.impact,
        status: s.status,
        meaningCategory: meaning.meaningCategory,
        meaningConfidence: meaning.confidence,
        buyingStageImplication: meaning.buyingStageImplication,
        recommendedAction: meaning.recommendedAction,
        createdAt: s.createdAt,
      };
    });

    // Filter by category if requested
    const filtered = category
      ? enriched.filter(s => s.meaningCategory === category)
      : enriched;

    // Category breakdown
    const categoryBreakdown: Record<string, number> = {};
    for (const s of enriched) {
      categoryBreakdown[s.meaningCategory] = (categoryBreakdown[s.meaningCategory] || 0) + 1;
    }

    // Top category = most frequent non-unknown category
    const topCategory = Object.entries(categoryBreakdown)
      .filter(([cat]) => cat !== 'unknown')
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;

    return apiSuccess({
      signals: filtered,
      summary: {
        total: enriched.length,
        topCategory,
        categoryBreakdown,
      },
    });
  } catch (error) {
    console.error('[signal-meaning] GET error:', error);
    return apiError('Failed to infer signal meaning');
  }
}

/* ═══════════════════════════════════════════════════════════════
   POST /api/g-crm/companies/[id]/signal-meaning

   Track C-6: Persist inferred meaning to CompanySignal.meaningCategory.
   Updates signals that currently have null/unknown meaningCategory.

   Body (optional):
     all  — boolean, if true re-infers all signals (not just null/unknown)
   ═══════════════════════════════════════════════════════════════ */

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: companyId } = await params;
    const body = await request.json().catch(() => ({}));
    const reInferAll = body.all === true;

    const signals = await db.companySignal.findMany({
      where: companyId
        ? { companyId }
        : undefined,
      select: {
        id: true,
        signalType: true,
        severity: true,
        impact: true,
        opportunityType: true,
        title: true,
        description: true,
        meaningCategory: true,
      },
    });

    if (signals.length === 0) {
      return apiSuccess({ updated: 0, results: [] });
    }

    // Filter: only update signals that need inference
    const toProcess = reInferAll
      ? signals
      : signals.filter(s => !s.meaningCategory || s.meaningCategory === 'unknown');

    if (toProcess.length === 0) {
      return apiSuccess({ updated: 0, results: [], message: 'All signals already have meaning categories' });
    }

    const batchResult = batchInferMeaning(toProcess as Parameters<typeof batchInferMeaning>[0]);

    // Persist to DB
    if (batchResult.results.length > 0) {
      await Promise.all(
        batchResult.results.map(r =>
          db.companySignal.update({
            where: { id: r.signalId },
            data: { meaningCategory: r.newCategory },
          }),
        ),
      );
    }

    return apiSuccess({
      message: `Inferred meaning for ${batchResult.updated} signals`,
      ...batchResult,
    });
  } catch (error) {
    console.error('[signal-meaning] POST error:', error);
    return apiError('Failed to persist signal meaning');
  }
}