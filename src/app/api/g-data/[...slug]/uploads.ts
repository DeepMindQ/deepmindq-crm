import { NextResponse } from 'next/server';
import { listUploads } from '@/lib/data-intelligence';

/**
 * GET /api/g-data/uploads
 * List recent uploads
 */
export async function GET() {
  try {
    const uploads = await listUploads();
    return NextResponse.json(uploads);
  } catch (error: any) {
    console.error('[uploads]', error.message);
    return NextResponse.json({ error: 'Failed to load uploads' }, { status: 500 });
  }
}