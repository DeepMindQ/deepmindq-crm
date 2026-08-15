import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;

    // Find the ingestion record
    const ingestion = await db.dataIngestion.findUnique({ where: { id } });
    if (!ingestion) {
      return NextResponse.json({ error: 'Ingestion record not found' }, { status: 404 });
    }

    if (ingestion.status !== 'failed' && ingestion.status !== 'partial') {
      return NextResponse.json(
        {
          error: `Cannot retry ingestion with status "${ingestion.status}". Only "failed" or "partial" imports can be retried.`,
        },
        { status: 400 },
      );
    }

    // Reset to pending and clear error fields
    const updated = await db.dataIngestion.update({
      where: { id },
      data: {
        status: 'pending',
        errorMessage: null,
        errorDetails: null,
        completedAt: null,
        processedRows: null,
        failedRows: null,
      },
    });

    logger.info(`[Ingestion] Retry initiated for id=${id}, file=${ingestion.fileName}`);

    return NextResponse.json({ data: updated, success: true });
  } catch (error) {
    logger.error('[Ingestion] Retry failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to retry ingestion' }, { status: 500 });
  }
}
