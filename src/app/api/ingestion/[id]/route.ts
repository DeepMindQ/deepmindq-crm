import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const ingestion = await db.dataIngestion.findUnique({ where: { id } });
    if (!ingestion) {
      return NextResponse.json({ error: 'Ingestion not found' }, { status: 404 });
    }
    return NextResponse.json({ data: ingestion });
  } catch (error) {
    logger.error('[Ingestion] GET by ID failed', { error });
    return NextResponse.json({ error: 'Failed to fetch ingestion' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const ingestion = await db.dataIngestion.findUnique({ where: { id } });
    if (!ingestion) {
      return NextResponse.json({ error: 'Ingestion not found' }, { status: 404 });
    }

    // Only allow deleting failed/partial/completed imports
    if (ingestion.status === 'pending' || ingestion.status === 'processing') {
      return NextResponse.json(
        { error: 'Cannot delete an import that is currently being processed' },
        { status: 400 },
      );
    }

    await db.dataIngestion.delete({ where: { id } });
    await db.dataIngestionRow.deleteMany({ where: { ingestionId: id } });

    logger.info(`[Ingestion] Deleted id=${id}, file=${ingestion.fileName}`);
    return NextResponse.json({ success: true, message: 'Ingestion deleted' });
  } catch (error) {
    logger.error('[Ingestion] DELETE failed', { error });
    return NextResponse.json({ error: 'Failed to delete ingestion' }, { status: 500 });
  }
}
