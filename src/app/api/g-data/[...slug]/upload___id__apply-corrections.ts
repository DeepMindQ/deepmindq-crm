import { NextRequest, NextResponse } from 'next/server';
import { applyCorrections } from '@/lib/data-intelligence';

/**
 * POST /api/g-data/upload/[id]/apply-corrections
 *
 * Apply user-approved corrections to warning rows.
 * Body: { corrections: [{ rowId, field, appliedValue }] }
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

    const body = await request.json();
    const { corrections } = body;

    if (!Array.isArray(corrections) || corrections.length === 0) {
      return NextResponse.json({ error: 'corrections array is required' }, { status: 400 });
    }

    if (corrections.length > 500) {
      return NextResponse.json({ error: 'Maximum 500 corrections per request' }, { status: 400 });
    }

    const result = await applyCorrections(uploadId, corrections);

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    console.error('[upload/apply-corrections]', error.message);
    return NextResponse.json({ error: 'Failed to apply corrections', detail: error.message }, { status: 500 });
  }
}