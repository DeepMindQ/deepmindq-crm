import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

/**
 * GET /api/trust-score/[orgId]
 *
 * Compute a data-driven trust score for an organization across 4 dimensions:
 * 1. Data Verification — how many fields are filled vs total possible
 * 2. Source Diversity — how many different sources contributed data
 * 3. Signal Reliability — evidence reliability scores across signals
 * 4. Recency — how recently the entity was enriched/updated
 *
 * FIX EI-5: Replaces hardcoded trust score with computed values.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { orgId } = await params;

    const org = await db.organization.findUnique({
      where: { id: orgId },
      include: {
        people: true,
        signals: { where: { status: { in: ['detected', 'validated', 'analyzed'] } } },
        evidence: true,
        relationships: { take: 50 },
        insights: { where: { status: 'active' }, take: 20 },
      },
    });

    if (!org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Dimension 1: Data Verification (0-100)
    const totalFields = 8;
    const filledFields = [
      org.domain,
      org.industry,
      org.description,
      org.website,
      org.headquarters,
      org.employeeCount,
      org.revenue,
      org.foundedYear,
    ].filter(Boolean).length;
    const dataVerificationScore = Math.round((filledFields / totalFields) * 100);

    // Dimension 2: Source Diversity (0-100)
    const sources = new Set<string>();
    sources.add(org.source);
    for (const person of org.people) sources.add(person.source);
    for (const signal of org.signals) sources.add(signal.source);
    const sourceDiversityScore = Math.min(100, sources.size * 20);

    // Dimension 3: Signal Reliability (0-100)
    let signalReliabilityScore = 50;
    if (org.evidence.length > 0) {
      const reliabilityMap: Record<string, number> = {
        verified: 100,
        likely: 80,
        inferred: 60,
        unverified: 30,
      };
      const avgReliability =
        org.evidence.reduce((sum, e) => sum + (reliabilityMap[e.reliability] ?? 50), 0) /
        org.evidence.length;
      signalReliabilityScore = Math.round(avgReliability);
    } else if (org.signals.length > 0) {
      signalReliabilityScore = Math.min(75, 40 + org.signals.length * 5);
    }

    // Dimension 4: Recency (0-100)
    let recencyScore = 50;
    const now = Date.now();
    if (org.lastEnrichedAt) {
      const daysSinceEnrich = (now - org.lastEnrichedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceEnrich <= 7) recencyScore = 100;
      else if (daysSinceEnrich <= 14) recencyScore = 85;
      else if (daysSinceEnrich <= 30) recencyScore = 65;
      else if (daysSinceEnrich <= 90) recencyScore = 40;
      else recencyScore = 20;
    }

    const overallScore = Math.round(
      dataVerificationScore * 0.3 +
        sourceDiversityScore * 0.2 +
        signalReliabilityScore * 0.3 +
        recencyScore * 0.2,
    );

    const dimensions = [
      {
        key: 'dataVerification',
        label: 'Data Verification',
        score: dataVerificationScore,
        detail: `${filledFields} of ${totalFields} fields populated`,
      },
      {
        key: 'sourceDiversity',
        label: 'Source Diversity',
        score: sourceDiversityScore,
        detail: `${sources.size} unique source${sources.size !== 1 ? 's' : ''}: ${[...sources].join(', ')}`,
      },
      {
        key: 'signalReliability',
        label: 'Signal Reliability',
        score: signalReliabilityScore,
        detail:
          org.evidence.length > 0
            ? `${org.evidence.length} evidence records, ${org.evidence.filter((e) => e.reliability === 'verified').length} verified`
            : org.signals.length > 0
              ? `${org.signals.length} signals detected`
              : 'No signals or evidence yet',
      },
      {
        key: 'recency',
        label: 'Data Recency',
        score: recencyScore,
        detail: org.lastEnrichedAt
          ? `Last enriched ${Math.round((now - org.lastEnrichedAt.getTime()) / (1000 * 60 * 60 * 24))} days ago`
          : 'Never enriched from external sources',
      },
    ];

    const trustHistory = org.evidence
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5)
      .map((e) => ({
        date: e.createdAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        score:
          e.reliability === 'verified'
            ? 95
            : e.reliability === 'likely'
              ? 80
              : e.reliability === 'inferred'
                ? 60
                : 35,
        event: `${e.sourceType}: ${e.claim.slice(0, 80)}`,
      }));

    const recommendations = [];
    if (dataVerificationScore < 60) {
      recommendations.push({
        priority: 'high',
        title: 'Enrich missing data fields',
        detail: `${totalFields - filledFields} of ${totalFields} fields are empty. Run external enrichment to fill gaps.`,
        action: 'Enrich Data',
      });
    }
    if (sourceDiversityScore < 40) {
      recommendations.push({
        priority: 'high',
        title: 'Diversify data sources',
        detail: 'Data comes from a single source. Cross-reference with external providers.',
        action: 'Add Sources',
      });
    }
    if (signalReliabilityScore < 50) {
      recommendations.push({
        priority: 'medium',
        title: 'Improve signal reliability',
        detail: 'Signals lack verified evidence. Validate through external verification.',
        action: 'Validate Signals',
      });
    }
    if (recencyScore < 40) {
      recommendations.push({
        priority: 'medium',
        title: 'Refresh stale data',
        detail: 'Entity data is outdated. Trigger re-enrichment to update intelligence.',
        action: 'Refresh Now',
      });
    }
    if (recommendations.length === 0) {
      recommendations.push({
        priority: 'low',
        title: 'Trust score is healthy',
        detail: 'All dimensions are above threshold. Continue monitoring for changes.',
        action: 'Monitor',
      });
    }

    return NextResponse.json({
      organizationId: org.id,
      organizationName: org.name,
      overallScore,
      dimensions,
      trustHistory,
      recommendations,
    });
  } catch (error) {
    logger.error('[TRUST-SCORE] Error computing trust score', {
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return NextResponse.json({ error: 'Failed to compute trust score' }, { status: 500 });
  }
}
