import { NextRequest } from 'next/server';
import { apiError, apiSuccess } from '@/lib/apiHelpers';
import { computeAccountPriority } from '@/lib/account-prioritization';
import { db } from '@/lib/db';

/* ═══════════════════════════════════════════════════════════════
   GET /api/strategy/companies/[id]/priority
   Get the current persisted priority score & breakdown for a company.
   ═══════════════════════════════════════════════════════════════ */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: companyId } = await params;

    const company = await db.company.findUnique({
      where: { id: companyId },
      select: {
        id: true,
        rawName: true,
        domain: true,
        industry: true,
        sizeRange: true,
        country: true,
        accountPriorityScore: true,
        priorityTier: true,
        priorityComputedAt: true,
        intelligenceScore: true,
        engagementScore: true,
        status: true,
        lifecycleStage: true,
      },
    });

    if (!company) {
      return apiError('Company not found', 404);
    }

    return apiSuccess({
      companyId: company.id,
      companyName: company.rawName,
      domain: company.domain,
      industry: company.industry,
      sizeRange: company.sizeRange,
      country: company.country,
      accountPriorityScore: company.accountPriorityScore,
      priorityTier: company.priorityTier,
      priorityComputedAt: company.priorityComputedAt,
      intelligenceScore: company.intelligenceScore,
      engagementScore: company.engagementScore,
      status: company.status,
      lifecycleStage: company.lifecycleStage,
      hasComputedPriority: company.accountPriorityScore !== null,
    });
  } catch (error) {
    console.error('[company-priority] GET error:', error);
    return apiError('Failed to fetch company priority');
  }
}

/* ═══════════════════════════════════════════════════════════════
   POST /api/strategy/companies/[id]/priority
   (Re)compute the priority score for a single company.
   Returns full breakdown.
   ═══════════════════════════════════════════════════════════════ */

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: companyId } = await params;

    const result = await computeAccountPriority(companyId);

    if (!result) {
      return apiError('Company not found', 404);
    }

    return apiSuccess({
      message: `Priority score computed: ${result.accountPriorityScore} (${result.priorityTier})`,
      ...result,
    });
  } catch (error) {
    console.error('[company-priority] POST error:', error);
    return apiError('Failed to compute company priority');
  }
}