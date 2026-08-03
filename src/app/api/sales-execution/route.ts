import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/apiHelpers';
import { createInsights } from '@/lib/ai-insight-service';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

/**
 * Wave 6 — Sales Execution Dashboard API
 * 
 * GET /api/sales-execution — sales execution metrics and pipeline overview
 * GET /api/sales-execution?activity=pursuits — pursuit activity feed
 */

export async function GET(request: NextRequest) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    const { searchParams } = new URL(request.url);
    const view = searchParams.get('activity');

    const now = Date.now();
    const day = 86400000;

    // ── All pursuits ──
    const allPursuits = await db.pursuit.findMany({
      take: 500,
      include: {
        opportunity: { include: { company: { select: { id: true, rawName: true, normalizedName: true } } } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const active = allPursuits.filter(p => p.status === 'active');
    const won = allPursuits.filter(p => p.outcomeStage === 'closed_won');
    const lost = allPursuits.filter(p => p.outcomeStage === 'closed_lost');

    // ── Activity view ──
    if (view === 'pursuits') {
      const recentActivity = allPursuits.slice(0, 20).map(p => ({
        pursuitId: p.id,
        opportunityTitle: p.opportunity?.opportunityTitle || 'Untitled',
        company: p.opportunity?.company?.normalizedName || p.opportunity?.company?.rawName || 'Unknown',
        status: p.status,
        stage: p.outcomeStage || 'discovery',
        owner: p.owner || 'Unassigned',
        lastActivityAt: p.lastActivityAt || p.updatedAt,
        nextAction: p.nextAction,
        nextActionAt: p.nextActionAt,
      }));

      return apiSuccess({ total: allPursuits.length, activity: recentActivity });
    }

    // ── Main dashboard metrics ──
    // Execution velocity
    const pursuitsCreatedThisWeek = allPursuits.filter(p =>
      p.createdAt && (now - p.createdAt.getTime()) < 7 * day
    ).length;

    const pursuitsAdvancedThisWeek = allPursuits.filter(p =>
      p.updatedAt && (now - p.updatedAt.getTime()) < 7 * day && p.status === 'active'
    ).length;

    const winsThisMonth = won.filter(p =>
      p.updatedAt && (now - p.updatedAt.getTime()) < 30 * day
    ).length;

    const lossesThisMonth = lost.filter(p =>
      p.updatedAt && (now - p.updatedAt.getTime()) < 30 * day
    ).length;

    // Owner performance
    const ownerStats: Record<string, { active: number; won: number; lost: number; avgDaysInStage: number }> = {};
    for (const p of allPursuits) {
      const owner = p.owner || 'Unassigned';
      if (!ownerStats[owner]) ownerStats[owner] = { active: 0, won: 0, lost: 0, avgDaysInStage: 0 };
      if (p.status === 'active') ownerStats[owner].active++;
      if (p.outcomeStage === 'closed_won') ownerStats[owner].won++;
      if (p.outcomeStage === 'closed_lost') ownerStats[owner].lost++;
    }

    // Stage distribution for active
    const stageDist: Record<string, number> = {};
    for (const p of active) {
      const s = p.outcomeStage || 'discovery';
      stageDist[s] = (stageDist[s] || 0) + 1;
    }

    // Deals needing action
    const needsAction = active.filter(p => {
      if (!p.nextAction || !p.nextActionAt) return true;
      return p.nextActionAt < new Date();
    });

    // Stale pursuits
    const stalePursuits = active.filter(p =>
      !p.lastActivityAt || (now - p.lastActivityAt.getTime()) > 14 * day
    );

    // Win rate
    const closedTotal = won.length + lost.length;
    const winRate = closedTotal > 0 ? Math.round((won.length / closedTotal) * 100) : 0;

    // Persist execution insight
    try {
      await createInsights([{
        type: 'FORECAST' as const,
        title: `Sales Execution: ${active.length} active, ${winsThisMonth} wins this month, ${winRate}% win rate`,
        description: `${pursuitsCreatedThisWeek} new pursuits this week. ${needsAction.length} need action. ${stalePursuits.length} stale.`,
        evidence: [
          { source: 'sales-execution', snippet: `Win rate: ${winRate}% (${won.length}W / ${closedTotal} total)`, reliability: 0.9 },
          { source: 'sales-execution', snippet: `${stalePursuits.length} pursuits inactive 14+ days`, reliability: 0.95 },
        ],
        confidenceScore: 85,
        impactScore: winRate >= 30 ? 70 : 40,
        urgencyScore: needsAction.length > 5 ? 75 : 30,
        reasoning: 'Sales execution metrics from pursuit tracking data',
        recommendedAction: needsAction.length > 3 ? `Review ${needsAction.length} pursuits needing immediate action` : 'Pipeline execution on track',
        sourceType: 'sales_execution',
        sourceRoute: '/api/sales-execution',
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      }]);
    } catch (e) {
      logger.warn('[sales-execution] Failed to persist insight:', { error: e });
    }

    return apiSuccess({
      // Summary
      totalPursuits: allPursuits.length,
      activePursuits: active.length,
      wonPursuits: won.length,
      lostPursuits: lost.length,
      winRate,

      // Velocity
      newThisWeek: pursuitsCreatedThisWeek,
      advancedThisWeek: pursuitsAdvancedThisWeek,
      winsThisMonth,
      lossesThisMonth,

      // Distribution
      stageDistribution: stageDist,
      ownerPerformance: ownerStats,

      // Action items
      needsAction: needsAction.length,
      stalePursuits: stalePursuits.length,

      // Top needs-action
      topNeedsAction: needsAction.slice(0, 5).map(p => ({
        pursuitId: p.id,
        title: p.opportunity?.opportunityTitle || 'Untitled',
        company: p.opportunity?.company?.normalizedName || p.opportunity?.company?.rawName || 'Unknown',
        owner: p.owner || 'Unassigned',
        stage: p.outcomeStage || 'discovery',
        nextAction: p.nextAction || 'None set',
        overdue: p.nextActionAt ? p.nextActionAt < new Date() : false,
      })),
    });
  } catch (error) {
    logger.error('[sales-execution] Error:', { error: error });
    return apiError('Failed to load sales execution data', 500);
  }
}
