/**
 * Intelligence Brief — High-level intelligence summary
 *
 * GET /api/intelligence/brief
 * Returns aggregated intelligence data for the dashboard.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import { apiSuccess, apiError } from '@/lib/apiHelpers';

export async function GET(request: Request) {
  // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const [totalCompanies, companiesWithSignals, avgScoreRaw, recentSignals] =
      await Promise.all([
        // Total companies
        db.company.count(),

        // Companies that have at least one signal
        db.company.count({
          where: { signals: { some: {} } },
        }),

        // Average intelligence score (health score proxy)
        db.company.aggregate({
          _avg: { intelligenceScore: true },
        }),

        // Top 5 most recent signals
        db.companySignal.findMany({
          take: 5,
          orderBy: { extractedAt: 'desc' },
          include: {
            company: {
              select: { id: true, rawName: true, domain: true },
            },
          },
        }),
      ]);

    const avgHealthScore = Math.round(
      (avgScoreRaw as { _avg: { intelligenceScore: number | null } })._avg
        .intelligenceScore ?? 0
    );

    const topInsights = recentSignals.map((s) => ({
      id: s.id,
      type: s.signalType,
      headline: s.title,
      summary: s.description ?? '',
      confidenceScore: Math.round(s.confidence * 100),
      freshnessTimestamp: s.extractedAt.toISOString(),
      source: s.source ?? 'unknown',
      priority:
        s.severity === 'critical'
          ? 'critical'
          : s.severity === 'high'
            ? 'high'
            : s.severity === 'low'
              ? 'low'
              : 'medium',
      reasoning: `Signal detected for ${s.company.rawName}`,
      status: s.status as string,
      accountId: s.companyId,
      accountName: s.company.rawName,
      evidenceAvailable: (s.evidenceIds as unknown[])?.length > 0,
      evidenceCount: (s.evidenceIds as unknown[])?.length ?? 0,
      tags: [s.signalType, s.severity],
    }));

    const recentActivity = recentSignals.map((s) => ({
      id: s.id,
      type: 'signal_detected' as const,
      headline: `${s.signalType} signal for ${s.company.rawName}`,
      description: s.title,
      timestamp: s.extractedAt.toISOString(),
      source: s.source ?? 'unknown',
      confidence: Math.round(s.confidence * 100),
      trustLevel: s.sourceQuality === 'premium' ? ('high' as const) : ('medium' as const),
    }));

    return apiSuccess({
      brief: {
        totalCompanies,
        companiesWithSignals,
        avgHealthScore,
        topInsights,
        recentActivity,
      },
      // Also expose flat arrays for the dashboard screen
      signals: topInsights,
      recommendations: [],
      activity: recentActivity,
    });
  } catch (error) {
    logger.error('[intelligence/brief] failed', { error });
    return apiError('Failed to fetch intelligence brief');
  }
}
