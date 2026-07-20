import { NextRequest } from 'next/server';
import { apiError, apiSuccess, validateBody } from '@/lib/apiHelpers';
import { computeAccountPriorityBatch, getAccountRankings, computeAccountPriority, PriorityTier } from '@/lib/account-prioritization';
import { scoreEvents } from '@/lib/events';
import { db } from '@/lib/db';
import { z } from 'zod';

/* ═══════════════════════════════════════════════════════════════
   In-memory job tracking for async batch compute (GAP-25)
   ═══════════════════════════════════════════════════════════════ */

interface BatchJob {
  id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  total: number;
  startedAt: Date;
  completedAt?: Date;
  error?: string;
}

const batchJobs = new Map<string, BatchJob>();

function generateJobId(): string {
  return `job_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/* ═══════════════════════════════════════════════════════════════
   GET /api/strategy/account-rankings
   Fetch already-computed account priority rankings from DB.
   Does NOT recompute scores.

   Query params:
     tier            — filter by priority tier (HOT|ACTIVE|NURTURE|LOW)
     limit           — page size (default 50, max 200)
     offset          — pagination offset
     search          — search by company name or domain
     assignedTo      — filter by assigned user
     includeBreakdown — if 'true', compute full breakdown per company (expensive)
     jobId           — if provided, return job status instead of rankings
   ═══════════════════════════════════════════════════════════════ */

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // ── Job status check (GAP-25) ──
    const jobId = searchParams.get('jobId');
    if (jobId) {
      const job = batchJobs.get(jobId);
      if (!job) return apiError('Job not found', 404);
      return apiSuccess({
        jobId: job.id,
        status: job.status,
        progress: job.progress,
        total: job.total,
        startedAt: job.startedAt.toISOString(),
        completedAt: job.completedAt?.toISOString(),
        error: job.error,
      });
    }

    const tier = searchParams.get('tier') as PriorityTier | null;
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200);
    const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);
    const search = searchParams.get('search') || undefined;
    const assignedTo = searchParams.get('assignedTo') || undefined;
    const includeBreakdown = searchParams.get('includeBreakdown') === 'true';

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

    // ── GAP-4: Fetch _count for returned companies ──
    // getAccountRankings fetches _count in Prisma but drops it during mapping,
    // so we re-fetch counts here to include them in the API response.
    const companyIds = result.rankings.map(r => r.companyId);
    const emptyCount = { contacts: 0, signals: 0, opportunityRecommendations: 0, pursuits: 0 };
    let countMap = new Map<string, typeof emptyCount>();
    if (companyIds.length > 0) {
      try {
        const countRows = await db.company.findMany({
          where: { id: { in: companyIds } },
          select: {
            id: true,
            _count: {
              select: {
                contacts: true,
                signals: true,
                opportunityRecommendations: true,
                pursuits: true,
              },
            },
          },
        });
        for (const row of countRows) {
          countMap.set(row.id, row._count as unknown as typeof emptyCount);
        }
      } catch (err) {
        console.warn('[account-rankings] Failed to fetch _count (non-critical):', err);
      }
    }

    // ── GAP-24: includeBreakdown — compute full breakdown per company ──
    if (includeBreakdown && result.rankings.length > 0) {
      const enrichedCompanies = await Promise.all(
        result.rankings.map(async (r) => {
          try {
            const breakdown = await computeAccountPriority(r.companyId);
            if (breakdown) {
              return {
                ...r,
                _count: countMap.get(r.companyId) || emptyCount,
                staticFit: breakdown.staticFit,
                dynamicIntelligence: breakdown.dynamicIntelligence,
                timingUrgency: breakdown.timingUrgency,
                whyNowReasons: breakdown.whyNowReasons,
                topSignals: breakdown.topSignals,
                recommendedFocus: breakdown.recommendedFocus,
              };
            }
          } catch (err) {
            console.error(`[account-rankings] Breakdown error for ${r.companyId}:`, err);
          }
          return { ...r, _count: countMap.get(r.companyId) || emptyCount };
        })
      );
      // GAP-4: Return with frontend-expected keys: companies + tierDistribution
      return apiSuccess({
        companies: enrichedCompanies,
        total: result.total,
        tierDistribution: result.tierBreakdown,
      });
    }

    // GAP-4: Return with frontend-expected keys: companies + tierDistribution
    return apiSuccess({
      companies: result.rankings.map(r => ({
        ...r,
        _count: countMap.get(r.companyId) || emptyCount,
      })),
      total: result.total,
      tierDistribution: result.tierBreakdown,
    });
  } catch (error) {
    console.error('[account-rankings] GET error:', error);
    return apiError('Failed to fetch account rankings');
  }
}

/* ═══════════════════════════════════════════════════════════════
   POST /api/strategy/account-rankings
   Trigger batch recomputation of account priority scores.
   Now async (GAP-25) — returns 202 with jobId immediately.

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

    // Create job entry (GAP-25)
    const jobId = generateJobId();
    const job: BatchJob = {
      id: jobId,
      status: 'pending',
      progress: 0,
      total: 0,
      startedAt: new Date(),
    };
    batchJobs.set(jobId, job);

    // Run computation asynchronously — don't await
    runBatchCompute(jobId, options).catch((err) => {
      console.error(`[account-rankings] Background job ${jobId} failed:`, err);
    });

    // Return 202 Accepted immediately
    return apiSuccess(
      { jobId, message: 'Batch computation started', status: 'pending' },
      202,
    );
  } catch (error) {
    console.error('[account-rankings] POST error:', error);
    return apiError('Failed to start account rankings computation');
  }
}

/* ═══════════════════════════════════════════════════════════════
   Background batch compute with progress tracking (GAP-25)
   ═══════════════════════════════════════════════════════════════ */

async function runBatchCompute(
  jobId: string,
  options: { status?: string; industry?: string; limit?: number },
) {
  const job = batchJobs.get(jobId)!;
  job.status = 'running';

  try {
    const result = await computeAccountPriorityBatch(options);

    job.total = result.totalComputed;
    job.progress = result.totalComputed;
    job.status = 'completed';
    job.completedAt = new Date();

    // Emit batchCompleted event (GAP-26)
    scoreEvents.emit('batchCompleted', {
      totalProcessed: result.totalComputed,
      jobId,
      tierBreakdown: result.tierBreakdown,
    });

    // Emit individual scoreUpdated events for each result (GAP-26)
    for (const r of result.results) {
      scoreEvents.emit('scoreUpdated', {
        companyId: r.companyId,
        score: r.accountPriorityScore,
        tier: r.priorityTier,
        breakdown: {
          staticFit: r.staticFit,
          dynamicIntelligence: r.dynamicIntelligence,
          timingUrgency: r.timingUrgency,
        },
      });
    }
  } catch (err: any) {
    job.status = 'failed';
    job.error = err.message || 'Unknown error';
    job.completedAt = new Date();

    scoreEvents.emit('batchCompleted', {
      totalProcessed: job.progress,
      jobId,
      error: job.error,
    });
  }
}

/* ═══════════════════════════════════════════════════════════════
   DELETE /api/strategy/account-rankings
   Reset priority scores (GAP-23)

   Query params:
     companyId — reset a single company

   Body (optional):
     companyIds: string[] — reset multiple companies

   If neither is provided, reset ALL companies.
   Reset means: accountPriorityScore = null, priorityTier = null,
                priorityComputedAt = null
   ═══════════════════════════════════════════════════════════════ */

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');

    const resetData = {
      accountPriorityScore: null,
      priorityTier: null,
      priorityComputedAt: null,
    };

    let resetCount = 0;

    if (companyId) {
      // Reset single company
      const company = await db.company.findUnique({ where: { id: companyId }, select: { id: true } });
      if (!company) return apiError('Company not found', 404);

      await db.company.update({ where: { id: companyId }, data: resetData });
      resetCount = 1;

      scoreEvents.emit('scoresReset', { resetCount, companyIds: [companyId] });
    } else {
      // Check for batch body
      let companyIds: string[] | undefined;
      try {
        const body = await request.json();
        if (Array.isArray(body?.companyIds)) {
          companyIds = body.companyIds;
        }
      } catch {
        // No body — reset all
      }

      if (companyIds && companyIds.length > 0) {
        // Reset multiple specific companies
        const result = await db.company.updateMany({
          where: { id: { in: companyIds } },
          data: resetData,
        });
        resetCount = result.count;

        scoreEvents.emit('scoresReset', { resetCount, companyIds });
      } else {
        // Reset ALL companies
        const result = await db.company.updateMany({
          where: { accountPriorityScore: { not: null } },
          data: resetData,
        });
        resetCount = result.count;

        scoreEvents.emit('scoresReset', { resetCount });
      }
    }

    return apiSuccess({ success: true, resetCount });
  } catch (error) {
    console.error('[account-rankings] DELETE error:', error);
    return apiError('Failed to reset priority scores');
  }
}