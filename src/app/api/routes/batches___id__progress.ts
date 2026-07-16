import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { batchProgress } from '@/app/api/batches/route';

/* ═══════════════════════════════════════════════════
   GET /api/batches/[id]/progress
   Returns real-time processing status for large imports
   ═══════════════════════════════════════════════════ */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Check in-memory progress first (for active large file processing)
    const memProgress = batchProgress.get(id);
    if (memProgress) {
      const elapsed = (Date.now() - memProgress.startedAt) / 1000;
      const rowsPerSecond = memProgress.processedRows > 0 ? memProgress.processedRows / elapsed : 0;
      const remaining = memProgress.totalRows - memProgress.processedRows;
      const eta = rowsPerSecond > 0 ? Math.ceil(remaining / rowsPerSecond) : 0;

      return NextResponse.json({
        status: memProgress.status,
        processedRows: memProgress.processedRows,
        totalRows: memProgress.totalRows,
        acceptedRows: memProgress.acceptedRows,
        duplicateRows: memProgress.duplicateRows,
        invalidRows: memProgress.invalidRows,
        percentComplete: memProgress.totalRows > 0
          ? Math.round((memProgress.processedRows / memProgress.totalRows) * 100)
          : 0,
        eta,
      });
    }

    // Fall back to database
    const batch = await db.importBatch.findUnique({ where: { id } });
    if (!batch) {
      return NextResponse.json({ error: 'Batch not found' }, { status: 404 });
    }

    return NextResponse.json({
      status: batch.status,
      processedRows: batch.totalRows,
      totalRows: batch.totalRows,
      acceptedRows: batch.acceptedRows,
      duplicateRows: batch.duplicateRows,
      invalidRows: batch.invalidRows,
      percentComplete: batch.status === 'completed' ? 100 : 0,
      eta: 0,
    });
  } catch (error) {
    console.error('Progress error:', error);
    return NextResponse.json({ error: 'Failed to get progress' }, { status: 500 });
  }
}

/* ═══════════════════════════════════════════════════
   POST /api/batches/[id]/progress — Cancel batch
   ═══════════════════════════════════════════════════ */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body;

    if (action === 'cancel') {
      const memProgress = batchProgress.get(id);
      if (memProgress) {
        memProgress.cancelled = true;
        return NextResponse.json({ success: true, message: 'Batch cancellation requested' });
      }
      return NextResponse.json({ error: 'Batch is not actively processing' }, { status: 400 });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Progress cancel error:', error);
    return NextResponse.json({ error: 'Failed to cancel batch' }, { status: 500 });
  }
}