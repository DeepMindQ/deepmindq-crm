/**
 * System Health Dashboard API (Wave 9 — Corrected, NO RBAC)
 *
 * GET /api/system-health — Platform Operations Center
 */

import { db } from '@/lib/db';
import { apiError, apiSuccess } from '@/lib/apiHelpers';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

export async function GET() {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    const now = Date.now();
    const day = 86400000;
    const sevenDaysAgo = new Date(now - 7 * day);

    // 1. Database Health
    const companyCount = await db.company.count();
    const contactCount = await db.contact.count();
    const pursuitCount = await db.pursuit.count();
    const signalCount = await db.companySignal.count();
    const insightCount = await db.aIInsight.count();

    const staleSignals = await db.companySignal.count({
      where: { createdAt: { lt: sevenDaysAgo } },
    });

    const activeInsights = await db.aIInsight.count({ where: { status: 'active' } });
    const expiredInsights = await db.aIInsight.count({ where: { status: 'expired' } });

    const dbHealthScore = Math.min(100,
      (companyCount > 0 ? 20 : 0) +
      (contactCount > 0 ? 20 : 0) +
      (activeInsights > 0 ? 20 : 0) +
      (staleSignals < signalCount * 0.5 ? 20 : 10) +
      (insightCount > 0 ? 20 : 0)
    );

    // 2. AI Engine Health
    const aiReliabilityRecords = await db.aIInsight.findMany({
      where: { sourceType: 'ai_reliability', createdAt: { gte: sevenDaysAgo } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    let aiSuccessCount = 0;
    let aiFailedCount = 0;
    const aiLatencies: number[] = [];
    const recentAiFailures: Array<{ type: string; error: string; at: string }> = [];

    for (const r of aiReliabilityRecords) {
      try {
        const meta = typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata;
        if (meta && meta._reliabilityRecord) {
          if (meta.status === 'success') aiSuccessCount += 1;
          if (meta.status === 'failed') {
            aiFailedCount += 1;
            if (recentAiFailures.length < 5) {
              recentAiFailures.push({
                type: meta.generationType || 'unknown',
                error: meta.errorMessage || 'Unknown error',
                at: r.createdAt.toISOString(),
              });
            }
          }
          if (meta.latencyMs) aiLatencies.push(meta.latencyMs);
        }
      } catch { /* skip */ }
    }

    const totalAiGenerations = aiSuccessCount + aiFailedCount;
    const aiSuccessRate = totalAiGenerations > 0 ? parseFloat(((aiSuccessCount / totalAiGenerations) * 100).toFixed(1)) : 100;
    const avgAiLatency = aiLatencies.length > 0 ? parseFloat((aiLatencies.reduce((a, b) => a + b, 0) / aiLatencies.length).toFixed(0)) : 0;
    const aiEngineHealth = aiSuccessRate >= 95 ? 'healthy' : aiSuccessRate >= 80 ? 'degraded' : 'unhealthy';

    // 3. Queue & Activity Status
    const pendingDrafts = await db.draft.count({ where: { status: 'pending_review' } });
    const suppressedContacts = await db.contact.count({ where: { isSuppressed: true } });
    const bouncedContacts = await db.contact.count({ where: { status: 'bounced' } });

    // 4. Storage Summary
    const storageSummary = {
      companies: companyCount,
      contacts: contactCount,
      pursuits: pursuitCount,
      signals: signalCount,
      aiInsights: insightCount,
    };

    // 5. Recent Audit Events
    const recentAudits = await db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const recentEvents = recentAudits.map(a => ({
      action: a.action,
      entity: a.entity,
      timestamp: a.createdAt.toISOString(),
      userId: a.userId || 'system',
    }));

    // 6. Composite System Health
    const healthInputs = [
      dbHealthScore * 0.3,
      aiSuccessRate * 0.3,
      (100 - Math.min(100, bouncedContacts * 5)) * 0.1,
      pendingDrafts < 20 ? 15 : 5,
      recentAiFailures.length === 0 ? 15 : 5,
    ];
    const systemHealthScore = Math.round(healthInputs.reduce((a, b) => a + b, 0));

    return apiSuccess({
      systemHealth: {
        score: systemHealthScore,
        status: systemHealthScore >= 80 ? 'healthy' : systemHealthScore >= 60 ? 'degraded' : 'unhealthy',
        lastChecked: new Date().toISOString(),
      },
      database: {
        status: dbHealthScore >= 60 ? 'healthy' : 'degraded',
        score: dbHealthScore,
        records: storageSummary,
        activeInsights,
        expiredInsights,
        staleSignals,
      },
      aiEngine: {
        status: aiEngineHealth,
        successRate: aiSuccessRate,
        totalGenerations: totalAiGenerations,
        failures: aiFailedCount,
        avgLatencyMs: avgAiLatency,
        recentAiFailures,
      },
      authentication: {
        totalUsers: 0,
        recentLogins: 0,
        failedAttempts: 0,
      },
      queue: {
        pendingDrafts,
        suppressedContacts,
        bouncedContacts,
      },
      auditTrail: recentEvents,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('[system-health] Error:', { error: error });
    return apiError('Failed to generate system health dashboard', 500);
  }
}
