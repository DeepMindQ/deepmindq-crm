import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { checkApiAuth } from '@/lib/api-auth';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
    // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

try {
    const { id } = await params;
    await db.conversationPlan.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('[conversation-plans DELETE]', { error: error });
    return NextResponse.json({ error: 'Failed to delete plan' }, { status: 500 });
  }
}