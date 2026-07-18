import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getAccountIntelligence } from '@/lib/intelligence-contract';

/**
 * GET /api/g-crm/companies/[id]/account-intelligence
 *
 * Phase 5 Readiness: Aggregated intelligence score for lead qualification.
 * Used by sales execution layer to prioritize accounts.
 *
 * Returns:
 * - Composite intelligence score (0-100)
 * - Component breakdown (data completeness, evidence quality, freshness, signals, contacts)
 * - Qualification tier (hot/warm/cold/unknown)
 * - Human-readable score factors
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: companyId } = await params;

    // Quick existence check
    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const intelligence = await getAccountIntelligence(companyId);

    return NextResponse.json(intelligence);
  } catch (error) {
    console.error('[account-intelligence] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to compute account intelligence' },
      { status: 500 },
    );
  }
}