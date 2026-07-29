import { ActionEngine } from '@/lib/engines/action-engine';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * POST /api/companies/[id]/actions
 * Generate AI-powered action recommendations for a company.
 * Body: { contactId?: string, opportunityId?: string, skipNarrative?: boolean }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    const result = await ActionEngine.recommend({
      companyId: id,
      contactId: body.contactId,
      opportunityId: body.opportunityId,
      skipNarrative: body.skipNarrative ?? false,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error) {
    logger.error('[actions] error:', { error: error });
    return NextResponse.json(
      { success: false, error: 'Action engine failed' },
      { status: 500 },
    );
  }
}
