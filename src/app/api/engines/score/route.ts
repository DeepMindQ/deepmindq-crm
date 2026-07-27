/**
 * POST /api/engines/score
 *
 * Revenue Intelligence Score Engine API.
 *
 * Modes:
 *   - single:  Score one company (requires companyId)
 *   - batch:   Score multiple companies (requires companyIds[])
 *   - catalog: Return score dimension catalog (no scoring)
 *
 * Input (POST body):
 *   { mode: 'single', companyId: string, skipNarrative?: boolean }
 *   { mode: 'batch', companyIds: string[], skipNarrative?: boolean }
 *   { mode: 'catalog' }
 *
 * Output:
 *   { score: RevenueScore }                          — single mode
 *   { scores: RevenueScore[], total: number }         — batch mode
 *   { dimensions: ScoreDimensionConfig[] }            — catalog mode
 */

import { NextRequest, NextResponse } from 'next/server';
import { ScoringEngine } from '@/lib/engines/scoring-engine';
import { getCurrentSession, requireAuth } from '@/lib/session';
import { logger } from '@/lib/logger';

export async function POST(req: NextRequest) {
  try {
    await requireAuth();
    const session = await getCurrentSession();
    const body = await req.json();
    const mode = body.mode || 'single';

    // ── Catalog mode ──
    if (mode === 'catalog') {
      return NextResponse.json({
        dimensions: [
          { key: 'technology_trigger', label: 'Technology Trigger', maxPoints: 25, description: 'Tech changes, migrations, new platforms' },
          { key: 'growth_signal', label: 'Growth Signal', maxPoints: 20, description: 'Funding, hiring, expansion' },
          { key: 'executive_change', label: 'Executive Change', maxPoints: 15, description: 'New C-suite, leadership shifts' },
          { key: 'engagement', label: 'Engagement', maxPoints: 12, description: 'Contacts, replies, interactions' },
          { key: 'contact_influence', label: 'Contact Influence', maxPoints: 10, description: 'Stakeholder buying power' },
          { key: 'opportunity_strength', label: 'Opportunity Strength', maxPoints: 10, description: 'Deal win probability' },
          { key: 'buying_intent', label: 'Buying Intent', maxPoints: 10, description: 'Market signals + timing' },
          { key: 'data_coverage', label: 'Data Coverage', maxPoints: 8, description: 'Intelligence enrichment completeness' },
          { key: 'risk', label: 'Risk', maxPoints: -10, description: 'Vendor lock-in, budget cuts, compliance' },
        ],
        gradingScale: [
          { grade: 'A', min: 85, label: 'Critical Priority' },
          { grade: 'B', min: 70, label: 'High Priority' },
          { grade: 'C', min: 55, label: 'Medium Priority' },
          { grade: 'D', min: 35, label: 'Low Priority' },
          { grade: 'F', min: 0, label: 'Nurture' },
        ],
      });
    }

    // ── Single mode ──
    if (mode === 'single') {
      const { companyId, skipNarrative } = body;
      if (!companyId) {
        return NextResponse.json({ error: 'companyId is required for single mode' }, { status: 400 });
      }

      logger.info(`[api/engines/score] single score for ${companyId} by user ${session?.id ?? 'unknown'}`);
      const result = await ScoringEngine.score({ companyId, skipNarrative });

      return NextResponse.json({ score: result });
    }

    // ── Batch mode ──
    if (mode === 'batch') {
      const { companyIds, skipNarrative } = body;
      if (!Array.isArray(companyIds) || companyIds.length === 0) {
        return NextResponse.json({ error: 'companyIds array is required for batch mode' }, { status: 400 });
      }
      if (companyIds.length > 20) {
        return NextResponse.json({ error: 'Maximum 20 companies per batch' }, { status: 400 });
      }

      logger.info(`[api/engines/score] batch score for ${companyIds.length} companies by user ${session?.id ?? 'unknown'}`);
      const results = await ScoringEngine.scoreBatch(companyIds, { skipNarrative });

      return NextResponse.json({ scores: results, total: results.length });
    }

    return NextResponse.json({ error: `Unknown mode: ${mode}. Use 'single', 'batch', or 'catalog'` }, { status: 400 });
  } catch (err) {
    if (err instanceof Error && err.message.includes('Unauthorized')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    logger.error(`[api/engines/score] error: ${err instanceof Error ? err.message : err}`);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
