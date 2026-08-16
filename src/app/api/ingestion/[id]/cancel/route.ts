import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const ingestion = await db.dataIngestion.findUnique({ where: { id } });
    if (!ingestion) {
      return NextResponse.json({ error: 'Ingestion not found' }, { status: 404 });
    }

    if (ingestion.status !== 'pending' && ingestion.status !== 'processing') {
      return NextResponse.json(
        { error: `Cannot cancel ingestion with status "${ingestion.status}"` },
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

    logger.info(`[Ingestion] Cancelled id=${id}, file=${ingestion.fileName}`);
    return NextResponse.json({ data: updated, success: true });
  } catch (error) {
    logger.error('[Ingestion] Cancel failed', { error });
    return NextResponse.json({ error: 'Failed to cancel ingestion' }, { status: 500 });
  }
}
