import { db } from '@/lib/db';
import { NextResponse } from 'next/server';
import { getCompanyEvidence, getEvidenceSummary, getEvidenceForField } from '@/lib/research-engine';

/**
 * GET /api/g-crm/companies/[id]/evidence
 *   List evidence for a company with optional field filter and pagination.
 *
 * GET /api/g-crm/companies/[id]/evidence?summary=true
 *   Get evidence summary (counts per field, avg confidence, tier breakdown).
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: companyId } = await params;
    const { searchParams } = new URL(request.url);

    // Verify company exists
    const company = await db.company.findUnique({ where: { id: companyId } });
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    // Summary mode
    if (searchParams.get('summary') === 'true') {
      const summary = await getEvidenceSummary(companyId);
      return NextResponse.json({ summary });
    }

    // Per-field mode
    const field = searchParams.get('field');
    if (field) {
      const evidence = await getEvidenceForField(companyId, field);
      return NextResponse.json({ evidence, field });
    }

    // List mode with pagination
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const result = await getCompanyEvidence(companyId, { limit, offset });

    return NextResponse.json({
      evidence: result.evidence.map(e => ({
        ...e,
        sourceDate: e.sourceDate?.toISOString() || null,
        createdAt: e.createdAt.toISOString(),
      })),
      total: result.total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('[companies/id/evidence] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch evidence' }, { status: 500 });
  }
}