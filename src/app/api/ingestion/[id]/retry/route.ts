import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { readFile } from 'fs/promises';
import { logger } from '@/lib/logger';
import { ingestFile } from '@/lib/intelligence/ingestion';

/**
 * POST /api/ingestion/[id]/retry — Retry a failed or partial ingestion.
 *
 * Now actually re-processes the stored file (#8):
 *   1. Validates status is 'failed' or 'partial'
 *   2. Checks storedFilePath exists on disk
 *   3. Reads the file and re-invokes the ingestion engine
 *   4. Returns the updated ingestion record
 *
 * Authentication: Session-based via checkApiAuth.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;

    // Find ingestion record
    const ingestion = await db.dataIngestion.findUnique({
      where: { id },
    });

    if (!ingestion) {
      return NextResponse.json({ error: 'Ingestion not found' }, { status: 404 });
    }

    // Only allow retry for failed or partial
    if (ingestion.status !== 'failed' && ingestion.status !== 'partial') {
      return NextResponse.json(
        {
          error: `Cannot retry ingestion with status '${ingestion.status}'. Only 'failed' or 'partial' can be retried.`,
        },
        { status: 400 },
      );
    }

    // Check for stored file
    if (!ingestion.storedFilePath) {
      return NextResponse.json(
        {
          error:
            'No stored file found for this ingestion. The file may have been deleted by retention policy.',
        },
        { status: 400 },
      );
    }

    // Reset to pending first
    await db.dataIngestion.update({
      where: { id },
      data: {
        status: 'pending',
        errorMessage: null,
        errorDetails: null,
        completedAt: null,
        processedRows: 0,
        failedRows: 0,
        organizationsCreated: 0,
        peopleCreated: 0,
        totalRows: 0,
      },
    });

    // Also reset/delete existing ingestion rows
    await db.dataIngestionRow.deleteMany({
      where: { ingestionId: id },
    });

    // Read file and trigger ingestion engine
    const fileBuffer = await readFile(ingestion.storedFilePath);

    logger.info('[Ingestion Retry] Re-processing', { id, fileName: ingestion.fileName });

    // Fire-and-forget: process in background
    ingestFile(fileBuffer, ingestion.fileName, ingestion.fileType, {
      existingIngestionId: id,
      storedFilePath: ingestion.storedFilePath,
      userId: ingestion.uploadedBy ?? undefined,
    }).catch((err) => {
      logger.error('[Ingestion Retry] Background processing failed', {
        id,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    // Return the reset record immediately
    const updated = await db.dataIngestion.findUnique({ where: { id } });
    return NextResponse.json({ data: updated, success: true });
  } catch (_error) {
    logger.error('[Ingestion Retry] Unexpected error', { error: _error });
    return NextResponse.json({ error: 'Failed to retry ingestion' }, { status: 500 });
  }
}
