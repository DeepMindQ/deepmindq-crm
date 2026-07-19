import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { computeEvidenceQuality } from '@/lib/research-engine/evidence-quality';

/**
 * GET /api/g-crm/companies/[id]/evidence-quality
 *
 * Phase 4 B2: Evidence quality scoring for a company's evidence base.
 *
 * Returns:
 * - Overall quality score (0-100)
 * - Per-dimension breakdown (coverage, freshness, sourceQuality, corroboration, volume)
 * - Supporting metrics (fields covered, source counts, avg recency)
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id: companyId } = await params;

    const company = await db.company.findUnique({
      where: { id: companyId },
      select: { id: true },
    });

    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const quality = await computeEvidenceQuality(companyId);

    return NextResponse.json(quality);
  } catch (error) {
    console.error('[evidence-quality] Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to compute evidence quality' },
      { status: 500 },
    );
  }
}