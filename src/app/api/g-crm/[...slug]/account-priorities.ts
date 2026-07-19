import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import {
  computeAccountPriority,
  computeAllAccountPriorities,
  getPrioritizedCompanies,
  getICPProfile,
} from '@/lib/account-prioritization/engine';

/**
 * GET /api/g-crm/account-priorities
 *
 * Phase 5: Get prioritized company list with tier distribution.
 * Query params: tier, limit, offset, search, sortBy, sortOrder
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const tier = searchParams.get('tier') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const search = searchParams.get('search') || undefined;
    const sortBy = (searchParams.get('sortBy') || 'priorityScore') as 'priorityScore' | 'intelligenceScore' | 'engagementScore' | 'name';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    const result = await getPrioritizedCompanies({
      tier,
      limit,
      offset,
      search,
      sortBy,
      sortOrder,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[account-priorities] GET error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch account priorities' },
      { status: 500 },
    );
  }
}

/**
 * POST /api/g-crm/account-priorities
 *
 * Phase 5: Trigger priority computation.
 * Body: { companyId?: string, all?: boolean }
 * - companyId: compute for a single company
 * - all: true = batch compute for all companies
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { companyId, all } = body;

    if (all) {
      const result = await computeAllAccountPriorities();
      return NextResponse.json({
        message: `Computed priorities for ${result.computed} companies`,
        ...result,
      });
    }

    if (companyId) {
      const result = await computeAccountPriority(companyId);
      return NextResponse.json({
        message: 'Priority computed',
        ...result,
      });
    }

    return NextResponse.json(
      { error: 'Provide either companyId or all: true' },
      { status: 400 },
    );
  } catch (error) {
    console.error('[account-priorities] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to compute priorities' },
      { status: 500 },
    );
  }
}