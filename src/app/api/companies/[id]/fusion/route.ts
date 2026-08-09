/**
 * GET /api/companies/[id]/fusion
 * Returns the Intelligence Fusion Score for a company.
 * Phase 3 — Item 7.2
 *
 * Fetches signals + evidence from DB, then delegates to the pure
 * computeFusionScore() function from intelligence-fusion-score.ts.
 */
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { computeFusionScore, type FusionScoreInput } from '@/lib/intelligence-fusion-score';
import { checkApiAuth } from '@/lib/api-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;

    // Fetch signals and evidence count in parallel
    const [signals, evidenceCount] = await Promise.all([
      db.companySignal.findMany({
        where: { companyId: id },
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          signalType: true,
          source: true,
          confidence: true,
          createdAt: true,
          impact: true,
        },
      }),
      db.evidence.count({ where: { companyId: id } }).catch(() => 0),
    ]);

    // Map DB signals to FusionScoreInput signals format
    const fusionSignals: FusionScoreInput['signals'] = signals.map((s) => ({
      id: s.id,
      type: s.signalType,
      source: s.source ?? 'unknown',
      sourceType: mapSourceType(s.source),
      confidence: s.confidence ?? 0.5,
      timestamp: s.createdAt.toISOString(),
      impact: mapImpact(s.impact),
    }));

    // Compute an aggregate source reliability score from signals
    const sourceReliabilityScore = computeSourceReliability(signals);

    const input: FusionScoreInput = {
      companyId: id,
      signals: fusionSignals,
      evidenceCount,
      sourceReliabilityScore,
    };

    const result = computeFusionScore(input);
    return NextResponse.json(result);
  } catch (_) {
    return NextResponse.json(
      { error: 'Failed to compute fusion score' },
      { status: 500 },
    );
  }
}

// ── Helpers ──

/** Map a free-text source string to a FusionScoreInput sourceType. */
function mapSourceType(source: string | null): FusionScoreInput['signals'][0]['sourceType'] {
  if (!source) return 'ai_inferred';
  const lower = source.toLowerCase();
  if (lower.includes('sec') || lower.includes('edgar')) return 'sec_filing';
  if (lower.includes('crunchbase')) return 'crunchbase';
  if (lower.includes('linkedin')) return 'social';
  if (lower.includes('news') || lower.includes('techcrunch') || lower.includes('reuters') || lower.includes('bloomberg')) return 'news';
  if (lower.includes('scrape') || lower.includes('web')) return 'web_scrape';
  if (lower.includes('manual') || lower.includes('user')) return 'manual';
  return 'ai_inferred';
}

/** Map Prisma impact to fusion impact. */
function mapImpact(impact: string | null): FusionScoreInput['signals'][0]['impact'] {
  if (impact === 'high' || impact === 'critical') return 'high';
  if (impact === 'medium') return 'medium';
  return 'low';
}

/** Compute an aggregate source reliability score (0-1) from signal sources. */
function computeSourceReliability(signals: Array<{ source: string | null; confidence: number | null }>): number {
  if (signals.length === 0) return 0.5;
  const domainReliability: Record<string, number> = {
    'sec.gov': 0.95, 'reuters.com': 0.92, 'bloomberg.com': 0.92,
    'crunchbase.com': 0.80, 'linkedin.com': 0.75, 'techcrunch.com': 0.78,
  };
  let total = 0;
  let count = 0;
  for (const sig of signals) {
    if (sig.source) {
      const lower = sig.source.toLowerCase();
      const matched = Object.entries(domainReliability).find(([d]) => lower.includes(d));
      total += matched ? matched[1] : 0.6;
      count++;
    }
  }
  return count > 0 ? total / count : 0.5;
}
