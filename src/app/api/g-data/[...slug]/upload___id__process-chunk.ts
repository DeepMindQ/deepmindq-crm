import { NextRequest, NextResponse } from 'next/server';
import { processChunk } from '@/lib/data-intelligence';

/**
 * POST /api/g-data/upload/[id]/process-chunk
 *
 * Process a chunk of rows. Client sends rows in batches (200-500 at a time).
 * Returns counts for this chunk. Progress is tracked in DB.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await params;
    // Route: upload/[id]/process-chunk → slug = ['upload', id, 'process-chunk']
    const uploadId = slug[1];

    if (!uploadId) {
      return NextResponse.json({ error: 'Upload ID required' }, { status: 400 });
    }

    const body = await request.json();
    const { rows, startRowIndex } = body;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'rows array is required' }, { status: 400 });
    }

    if (rows.length > 500) {
      return NextResponse.json({ error: 'Maximum 500 rows per chunk' }, { status: 400 });
    }

    const result = await processChunk(uploadId, rows, startRowIndex || 0);

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[upload/process-chunk]', error.message);
    return NextResponse.json({ error: 'Chunk processing failed', detail: error.message }, { status: 500 });
  }
}