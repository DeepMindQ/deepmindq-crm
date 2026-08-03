/**
 * WI-17D — Single Company Explainability API
 *
 * GET /api/recommendations/[companyId]/explain
 *
 * Returns the full intelligence trail for a specific recommendation.
 * This is the detailed explainability view used in Company Workspace.
 *
 * Response structure:
 *   recommendation → priority, score, confidence
 *   reasoning      → score decomposition, why this account
 *   evidence        → categorized evidence with quality assessment
 *   sources         → where data came from, reliability
 *   confidence      → 6-dimension breakdown, improvements
 *   risks           → identified risks with mitigations
 *   action          → recommended action with rationale
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import { generateExplainabilityReport } from '@/lib/explainability-engine';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

  const { companyId } = await params;

  try {
    const report = await generateExplainabilityReport(companyId);

    if (!report) {
      return NextResponse.json({ error: 'Company not found or no recommendation available' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: report });
  } catch (error) {
    logger.error('[ExplainabilityAPI] Single company report failed:', { error, companyId });
    return NextResponse.json({ error: 'Failed to generate explainability report' }, { status: 500 });
  }
}
