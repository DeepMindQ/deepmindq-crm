/**
 * GET /api/companies/[id]/maturity
 * Returns the Intelligence Maturity Index for a company.
 * Phase 4 — Item 7.3
 */
import { NextRequest, NextResponse } from 'next/server';
import { computeIntelligenceMaturityIndex } from '@/lib/intelligence-maturity-index';
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
    const maturity = await computeIntelligenceMaturityIndex(id);
    return NextResponse.json(maturity);
  } catch (_) {
    return NextResponse.json(
      { error: 'Failed to compute maturity index' },
      { status: 500 },
    );
  }
}
