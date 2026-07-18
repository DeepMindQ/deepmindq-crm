import { NextRequest, NextResponse } from 'next/server';
import { cancelUpload } from '@/lib/data-intelligence';

/**
 * POST /api/g-data/upload/[id]/cancel
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string[] }> }
) {
  try {
    const { slug } = await params;
    const uploadId = slug[1];

    if (!uploadId) {
      return NextResponse.json({ error: 'Upload ID required' }, { status: 400 });
    }

    await cancelUpload(uploadId);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[upload/cancel]', error.message);
    return NextResponse.json({ error: 'Cancel failed' }, { status: 500 });
  }
}