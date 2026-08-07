/**
 * WI-17C — Single Company Recommendation API
 *
 * GET /api/recommendations/[companyId]
 *
 * Returns the full recommendation for a specific company.
 * This is the detailed view used in the Company Workspace.
 */

import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';
import { generateCompanyRecommendation } from '@/lib/recommendation-engine';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ companyId: string }> },
) {
  const { errorResponse } = await checkApiAuth(request);
  if (errorResponse) return errorResponse;

  const { companyId } = await params;

  try {
    const recommendation = await generateCompanyRecommendation(companyId);

    if (!recommendation) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: recommendation });
  } catch (error) {
    logger.error('[RecommendationAPI] Company recommendation failed:', { error, companyId });
    return NextResponse.json({ error: 'Failed to generate recommendation' }, { status: 500 });
  }
}
