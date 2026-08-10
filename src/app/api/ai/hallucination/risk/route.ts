/**
 * GET /api/ai/hallucination/risk?hours=24
 *
 * Phase 2.6: Hallucination Risk Dashboard API
 *
 * Reads hallucination check data from AIGenerationAudit records.
 * Returns:
 *   - Overall hallucination risk distribution
 *   - Per-generation-type hallucination rates
 *   - Recent high-risk generations (for review)
 *   - Trend data (hourly risk over time window)
 *   - Top hallucinated citation patterns
 *
 * All data sourced from AIGenerationAudit.governanceChecks JSON field
 * where hallucination_risk entries exist (written by Phase 2.4 wiring).
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

const HOURS_MIN = 1;
const HOURS_MAX = 720;
const HOURS_DEFAULT = 24;

export async function GET(req: NextRequest) {
  const { errorResponse } = await checkApiAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const hours = Math.max(HOURS_MIN, Math.min(HOURS_MAX, parseInt(searchParams.get('hours') || String(HOURS_DEFAULT), 10)));
    const since = new Date(Date.now() - hours * 60 * 60 * 1000);

    // ── 1. Fetch all audit records in time window ──
    const audits = await db.aIGenerationAudit.findMany({
      where: { createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 2000,
    });

    // ── 2. Parse hallucination_risk from governanceChecks ──
    const parsed = audits.map(a => {
      let hallucRisk: {
        passed: boolean;
        message: string;
        value: number;
      } | null = null;

      try {
        const checks = typeof a.governanceChecks === 'string'
          ? JSON.parse(a.governanceChecks)
          : a.governanceChecks;
        if (checks?.hallucination_risk) {
          hallucRisk = checks.hallucination_risk;
        }
      } catch {
        // governanceChecks unparseable — skip
      }

      return {
        id: a.id,
        generationType: a.generationType,
        companyId: a.companyId,
        governancePassed: a.governancePassed,
        hallucRisk,
        createdAt: a.createdAt,
      };
    });

    const totalGenerations = parsed.length;
    const checked = parsed.filter(p => p.hallucRisk !== null);
    const unchecked = parsed.filter(p => p.hallucRisk === null);

    // ── 3. Risk distribution ──
    const riskDistribution = { minimal: 0, low: 0, medium: 0, high: 0, critical: 0 };

    for (const p of checked) {
      const msg = p.hallucRisk!.message;
      if (msg.includes('critical')) riskDistribution.critical++;
      else if (msg.includes('high')) riskDistribution.high++;
      else if (msg.includes('medium')) riskDistribution.medium++;
      else if (msg.includes('low')) riskDistribution.low++;
      else riskDistribution.minimal++;
    }

    // ── 4. Average risk score ──
    const totalRiskScore = checked.reduce((sum, p) => sum + (p.hallucRisk?.value ?? 0), 0);
    const averageRiskScore = checked.length > 0 ? Math.round((totalRiskScore / checked.length) * 100) / 100 : 0;

    // ── 5. Overall pass rate (% of checked with minimal/low risk) ──
    const passedCount = checked.filter(p => p.hallucRisk?.passed === true).length;
    const overallPassRate = checked.length > 0 ? Math.round((passedCount / checked.length) * 10000) / 100 : 0;

    // ── 6. Per-generation-type breakdown ──
    const typeBuckets = new Map<string, { total: number; checked: number; highRisk: number; riskSum: number; passed: number }>();

    for (const p of parsed) {
      if (!typeBuckets.has(p.generationType)) {
        typeBuckets.set(p.generationType, { total: 0, checked: 0, highRisk: 0, riskSum: 0, passed: 0 });
      }
      const bucket = typeBuckets.get(p.generationType)!;
      bucket.total++;

      if (p.hallucRisk) {
        bucket.checked++;
        bucket.riskSum += p.hallucRisk.value;
        if (p.hallucRisk.message.includes('high') || p.hallucRisk.message.includes('critical')) {
          bucket.highRisk++;
        }
        if (p.hallucRisk.passed) bucket.passed++;
      }
    }

    const perTypeRisk = Array.from(typeBuckets.entries()).map(([generationType, bucket]) => ({
      generationType,
      total: bucket.total,
      checked: bucket.checked,
      highRisk: bucket.highRisk,
      averageRiskScore: bucket.checked > 0 ? Math.round((bucket.riskSum / bucket.checked) * 100) / 100 : 0,
      passRate: bucket.checked > 0 ? Math.round((bucket.passed / bucket.checked) * 10000) / 100 : 0,
    }));
    perTypeRisk.sort((a, b) => b.highRisk - a.highRisk);

    // ── 7. High-risk generations (for review queue) ──
    const highRiskGens = checked
      .filter(p => p.hallucRisk && (p.hallucRisk.message.includes('high') || p.hallucRisk.message.includes('critical')))
      .slice(0, 10)
      .map(p => {
        const verifiedMatch = p.hallucRisk!.message.match(/Verified: (\d+)/);
        const unverifiedMatch = p.hallucRisk!.message.match(/Unverified: (\d+)/);
        const uncitedMatch = p.hallucRisk!.message.match(/Uncited: (\d+)/);

        return {
          id: p.id,
          generationType: p.generationType,
          companyId: p.companyId,
          riskScore: p.hallucRisk!.value,
          riskLevel: p.hallucRisk!.message.includes('critical') ? 'critical' : 'high',
          verifiedClaims: parseInt(verifiedMatch?.[1] || '0'),
          unverifiedClaims: parseInt(unverifiedMatch?.[1] || '0'),
          uncitedClaims: parseInt(uncitedMatch?.[1] || '0'),
          createdAt: p.createdAt.toISOString(),
        };
      });

    // ── 8. Hourly trend ──
    const hourlyBuckets = new Map<string, { total: number; checked: number; riskSum: number; highRisk: number }>();

    for (const p of parsed) {
      const hourKey = p.createdAt.toISOString().slice(0, 13);
      if (!hourlyBuckets.has(hourKey)) {
        hourlyBuckets.set(hourKey, { total: 0, checked: 0, riskSum: 0, highRisk: 0 });
      }
      const bucket = hourlyBuckets.get(hourKey)!;
      bucket.total++;
      if (p.hallucRisk) {
        bucket.checked++;
        bucket.riskSum += p.hallucRisk.value;
        if (p.hallucRisk.message.includes('high') || p.hallucRisk.message.includes('critical')) {
          bucket.highRisk++;
        }
      }
    }

    const hourlyTrend = Array.from(hourlyBuckets.entries())
      .map(([hour, bucket]) => ({
        hour,
        total: bucket.total,
        checked: bucket.checked,
        avgRiskScore: bucket.checked > 0 ? Math.round((bucket.riskSum / bucket.checked) * 100) / 100 : 0,
        highRiskCount: bucket.highRisk,
      }))
      .sort((a, b) => a.hour.localeCompare(b.hour));

    return NextResponse.json({
      success: true,
      data: {
        period: { hours, since: since.toISOString() },
        stats: {
          totalGenerations,
          checkedGenerations: checked.length,
          uncheckedGenerations: unchecked.length,
          riskDistribution,
          averageRiskScore,
          overallPassRate,
        },
        perTypeRisk,
        highRiskGens,
        hourlyTrend,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    logger.error('[hallucination-risk] GET failed', { error: message });
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 },
    );
  }
}
