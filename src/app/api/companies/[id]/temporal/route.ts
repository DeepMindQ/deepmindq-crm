/**
 * GET /api/companies/[id]/temporal
 * Returns temporal intelligence metrics for a company.
 * Phase 4 — Item 7.4
 */
import { NextRequest, NextResponse } from 'next/server';
import { computeTemporalMetrics } from '@/lib/intelligence-temporal-tracker';
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
    const temporal = await computeTemporalMetrics(id);
    return NextResponse.json(temporal);
  } catch (_) {
    return NextResponse.json(
      { error: 'Failed to compute temporal metrics' },
      { status: 500 },
    );
  }
}
