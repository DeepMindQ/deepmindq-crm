import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

/**
 * POST /api/ingestion/[id]/cancel — Cancel an in-progress or pending ingestion.
 *
 * Sets status to 'failed' with a cancellation message.
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
      return NextResponse.json(
        {
          error: `Cannot cancel ingestion with status '${ingestion.status}'. Only 'pending' or 'processing' can be cancelled.`,
        },
        { status: 400 },
      );
    }

    const updated = await db.dataIngestion.update({
      where: { id },
      data: {
        status: 'failed',
        errorMessage: 'Cancelled by user',
        completedAt: new Date(),
      },
    });

    logger.info('[Ingestion] Cancelled', { id, fileName: ingestion.fileName });

    return NextResponse.json({ data: updated, success: true });
  } catch (_error) {
    logger.error('[Ingestion] Cancel failed', { error: _error });
    return NextResponse.json({ error: 'Failed to cancel ingestion' }, { status: 500 });
  }
}
