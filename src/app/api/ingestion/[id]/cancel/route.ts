import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * POST /api/ingestion/[id]/cancel — Cancel an in-progress or pending ingestion.
 *
 * Sets status to 'cancelled' and sets completedAt.
 * Only allows cancellation of 'pending' or 'processing' ingestions.
 *
 * Authentication: Session-based via checkApiAuth.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;

    const ingestion = await db.dataIngestion.findUnique({
      where: { id },
    });

    if (!ingestion) {
      return NextResponse.json({ error: 'Ingestion not found' }, { status: 404 });
    }

    // Only allow cancellation of pending or processing
    if (ingestion.status !== 'pending' && ingestion.status !== 'processing') {
      const msg =
        ingestion.status === 'cancelled'
          ? 'Ingestion is already cancelled'
          : `Cannot cancel ingestion with status '${ingestion.status}'. Only 'pending' or 'processing' can be cancelled.`;
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    await db.dataIngestion.update({
      where: { id },
      data: {
        status: 'cancelled',
        completedAt: new Date(),
      },
    });

    logger.info('[Ingestion] Cancelled', { id, fileName: ingestion.fileName });

    return NextResponse.json({ success: true, message: 'Import cancelled' });
  } catch (_error) {
    logger.error('[Ingestion] Cancel failed', { error: _error });
    return NextResponse.json({ error: 'Failed to cancel ingestion' }, { status: 500 });
  }
}
