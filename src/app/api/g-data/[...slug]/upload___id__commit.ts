import { NextRequest, NextResponse } from 'next/server';
import { commitUpload } from '@/lib/data-intelligence';

/**
 * POST /api/g-data/upload/[id]/commit
 *
 * Commit all accepted/corrected rows to production tables
 * (Company + Contact). Creates an ImportBatch for backward compatibility.
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

    const result = await commitUpload(uploadId);

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[upload/commit]', error.message);
    return NextResponse.json(
      { error: 'Commit failed', detail: error.message },
      { status: error.message === 'Already committed' ? 409 : 500 }
    );
  }
}