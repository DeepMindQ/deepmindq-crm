import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { unlink } from 'fs/promises';
import { logger } from '@/lib/logger';

/**
 * DELETE /api/ingestion/[id] — Delete an ingestion record and its rows.
 *
 * Also deletes the physical file from disk if storedFilePath exists.
 * Only allows deletion of completed, failed, or cancelled ingestions.
 * Active/processing ingestions must be cancelled first.
 *
 * Authentication: Session-based via checkApiAuth.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
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

    // Prevent deletion of active/processing ingestions
    if (ingestion.status === 'processing') {
      return NextResponse.json(
        { error: 'Cannot delete a processing ingestion. Cancel it first.' },
        { status: 400 },
      );
    }

    // Delete physical file
    if (ingestion.storedFilePath) {
      try {
        await unlink(ingestion.storedFilePath);
      } catch {
        // File may not exist — ignore
      }
    }

    // Delete rows (cascade would handle this, but explicit for logging)
    const rowsDeleted = await db.dataIngestionRow.deleteMany({
      where: { ingestionId: id },
    });

    // Delete ingestion record
    await db.dataIngestion.delete({
      where: { id },
    });

    logger.info('[Ingestion] Deleted', {
      id,
      fileName: ingestion.fileName,
      rowsDeleted: rowsDeleted.count,
    });

    return NextResponse.json({ success: true, message: 'Import deleted' });
  } catch (_error) {
    logger.error('[Ingestion] Delete failed', { error: _error });
    return NextResponse.json({ error: 'Failed to delete ingestion' }, { status: 500 });
  }
}
