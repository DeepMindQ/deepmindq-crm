import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

const FEATURES = [
  'reasoning',
  'briefing',
  'signal_analysis',
  'entity_resolution',
  'relationship_discovery',
] as const;

const CAPABILITY_META: Record<string, { name: string; description: string }> = {
  reasoning: {
    name: 'Predictive Lead Scoring',
    description:
      'AI-powered scoring of organizations based on intelligence signals, growth indicators, and market position to prioritize outreach efforts.',
  },
  briefing: {
    name: 'Intelligent Briefing',
    description:
      'Automated generation of comprehensive intelligence briefings with key findings, risk factors, and recommended actions.',
  },
  signal_analysis: {
    name: 'Signal Detection',
    description:
      'Real-time detection and classification of business signals including funding events, hiring changes, and market movements.',
  },
  entity_resolution: {
    name: 'Entity Resolution',
    description:
      'Automatic identification and resolution of entity references across data sources to build a unified intelligence graph.',
  },
  relationship_discovery: {
    name: 'Relationship Discovery',
    description:
      'Discovery of hidden relationships between organizations, people, and signals through AI-powered graph analysis.',
  },
};

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const usageLogs = await db.aIUsageLog.findMany({
      select: {
        feature: true,
        latencyMs: true,
        qualityScore: true,
        error: true,
      },
    });

    // Group by feature
    const groups: Record<
      string,
      {
        totalCalls: number;
        totalLatency: number;
        qualitySum: number;
        qualityCount: number;
        errorCount: number;
      }
    > = {};

    for (const log of usageLogs) {
      const feature = log.feature || 'unknown';
      if (!groups[feature]) {
        groups[feature] = {
          totalCalls: 0,
          totalLatency: 0,
          qualitySum: 0,
          qualityCount: 0,
          errorCount: 0,
        };
      }
      const g = groups[feature];
      g.totalCalls++;
      g.totalLatency += log.latencyMs;
      if (log.qualityScore != null) {
        g.qualitySum += log.qualityScore;
        g.qualityCount++;
      }
      if (log.error) {
        g.errorCount++;
      }
    }

    // Build capability cards for each feature
    const capabilities = FEATURES.map((feature) => {
      const stats = groups[feature] || {
        totalCalls: 0,
        totalLatency: 0,
        qualitySum: 0,
        qualityCount: 0,
        errorCount: 0,
      };
      const meta = CAPABILITY_META[feature] || { name: feature, description: '' };
      const avgLatency =
        stats.totalCalls > 0 ? Math.round(stats.totalLatency / stats.totalCalls) : 0;
      const accuracy =
        stats.qualityCount > 0
          ? Math.round((stats.qualitySum / stats.qualityCount) * 100) / 100
          : 0;
      const errorRate =
        stats.totalCalls > 0 ? Math.round((stats.errorCount / stats.totalCalls) * 100) / 100 : 0;

      return {
        id: feature,
        name: meta.name,
        description: meta.description,
        feature,
        status: 'active' as const,
        accuracy,
        latency: avgLatency,
        totalCalls: stats.totalCalls,
        errorRate,
      };
    });

    // Add Competitive Analysis (aggregated from all features)
    const allStats = {
      totalCalls: 0,
      totalLatency: 0,
      qualitySum: 0,
      qualityCount: 0,
      errorCount: 0,
    };
    for (const feature of FEATURES) {
      const s = groups[feature];
      if (s) {
        allStats.totalCalls += s.totalCalls;
        allStats.totalLatency += s.totalLatency;
        allStats.qualitySum += s.qualitySum;
        allStats.qualityCount += s.qualityCount;
        allStats.errorCount += s.errorCount;
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (capabilities as any[]).push({
      id: 'competitive_analysis',
      name: 'Competitive Analysis',
      description:
        'Cross-engine competitive intelligence that combines all AI capabilities for comprehensive market and competitor analysis.',
      feature: 'reasoning',
      status: 'active' as const,
      accuracy:
        allStats.qualityCount > 0
          ? Math.round((allStats.qualitySum / allStats.qualityCount) * 100) / 100
          : 0,
      latency:
        allStats.totalCalls > 0 ? Math.round(allStats.totalLatency / allStats.totalCalls) : 0,
      totalCalls: allStats.totalCalls,
      errorRate:
        allStats.totalCalls > 0
          ? Math.round((allStats.errorCount / allStats.totalCalls) * 100) / 100
          : 0,
    });

    return NextResponse.json({ data: capabilities });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch capabilities' }, { status: 500 });
  }
}
