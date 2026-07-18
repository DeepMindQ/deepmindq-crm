import { NextRequest, NextResponse } from 'next/server';
import { getUploadProgress } from '@/lib/data-intelligence';

/**
 * GET /api/g-data/upload/[id]/progress
 *
 * Poll upload progress. Client calls this every 2s during processing.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await params;
    const uploadId = slug[1];

    if (!uploadId) {
      return NextResponse.json({ error: 'Upload ID required' }, { status: 400 });
    }

    const progress = await getUploadProgress(uploadId);
    if (!progress) {
      return NextResponse.json({ error: 'Upload not found' }, { status: 404 });
    }

    return NextResponse.json(progress);
  } catch (error: any) {
    console.error('[upload/progress]', error.message);
    return NextResponse.json({ error: 'Failed to get progress' }, { status: 500 });
  }
}