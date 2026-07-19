import { NextRequest } from 'next/server';
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers';
import { computeAccountPriorityBatch, getAccountRankings, PriorityTier } from '@/lib/account-prioritization';
import { z } from 'zod';

/* ═══════════════════════════════════════════════════════════════
   GET /api/strategy/account-rankings
   Fetch already-computed account priority rankings from DB.
   Does NOT recompute scores.

   Query params:
     tier      — filter by priority tier (HOT|ACTIVE|NURTURE|LOW)
     limit     — page size (default 50, max 200)
     offset    — pagination offset
     search    — search by company name or domain
     assignedTo — filter by assigned user
   ═══════════════════════════════════════════════════════════════ */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const tier = searchParams.get('tier') as PriorityTier | null;
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);
    const search = searchParams.get('search') || undefined;
    const assignedTo = searchParams.get('assignedTo') || undefined;

    // Validate tier if provided
    if (tier && !['HOT', 'ACTIVE', 'NURTURE', 'LOW'].includes(tier)) {
      return apiError('Invalid tier. Must be HOT, ACTIVE, NURTURE, or LOW', 400);
    }

    const result = await getAccountRankings({
      tier: tier || undefined,
      limit,
      offset,
      search,
      assignedTo,
    });

    return apiSuccess(result);
  } catch (error) {
    console.error('[account-rankings] GET error:', error);
    return apiError('Failed to fetch account rankings');
  }
}

/* ═══════════════════════════════════════════════════════════════
   POST /api/strategy/account-rankings
   Trigger batch recomputation of account priority scores.

   Body (optional):
     status   — filter by company status
     industry — filter by industry (partial match)
     limit    — max companies to compute (default 500)
   ═══════════════════════════════════════════════════════════════ */

const batchComputeSchema = z.object({
  status: z.string().optional(),
  industry: z.string().optional(),
  limit: z.number().int().min(1).max(1000).optional(),
});

export async function POST(request: NextRequest) {
  try {
    let options: { status?: string; industry?: string; limit?: number } = {};
    try {
      const body = await request.json();
      const parsed = validateBody(batchComputeSchema, body);
      if (parsed instanceof Response) return parsed;
      options = {
        status: parsed.status,
        industry: parsed.industry,
        limit: parsed.limit,
      };
    } catch {
      // Empty body is fine — compute all
    }

    const result = await computeAccountPriorityBatch(options);

    return apiSuccess({
      message: `Computed priority scores for ${result.totalComputed} companies`,
      ...result,
    });
  } catch (error) {
    console.error('[account-rankings] POST error:', error);
    return apiError('Failed to compute account rankings');
  }
}