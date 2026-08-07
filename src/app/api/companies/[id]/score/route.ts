import { ScoringEngine } from '@/lib/engines/scoring-engine';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

/**
 * POST /api/companies/[id]/score
 * Trigger a Revenue Intelligence Score for a company.
 * Body: { skipNarrative?: boolean }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const result = await ScoringEngine.score({
      companyId: id,
      skipNarrative: body.skipNarrative ?? false,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error) {
    logger.error('[score] error:', { error: error });
    return NextResponse.json(
      { success: false, error: 'Scoring engine failed' },
      { status: 500 },
    );
  }
}
