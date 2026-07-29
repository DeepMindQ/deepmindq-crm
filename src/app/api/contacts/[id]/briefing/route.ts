import { ConversationEngine } from '@/lib/engines/conversation-engine';
import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

/**
 * POST /api/contacts/[id]/briefing
 * Generate an AI Buyer Intelligence Profile (meeting prep briefing) for a contact.
 * Body: { briefingType?: string, skipNarrative?: boolean }
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json().catch(() => ({}));

    // Look up the contact to get companyId
    const { db } = await import('@/lib/db');
    const contact = await db.contact.findUnique({
      where: { id },
      select: { id: true, companyId: true },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    const result = await ConversationEngine.brief({
      companyId: contact.companyId,
      contactId: id,
      briefingType: body.briefingType || 'meeting_prep',
      skipNarrative: body.skipNarrative ?? false,
    });

    return NextResponse.json(result, { status: result.success ? 200 : 500 });
  } catch (error) {
    logger.error('[briefing] error:', { error: error });
    return NextResponse.json(
      { success: false, error: 'Briefing engine failed' },
      { status: 500 },
    );
  }
}
