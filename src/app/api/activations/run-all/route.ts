import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkApiAuth } from '@/lib/api-auth';

export async function POST(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const result = await db.organization.updateMany({
      where: { trackingStatus: 'paused' },
      data: { trackingStatus: 'active' },
    });

    return NextResponse.json({
      success: true,
      activatedCount: result.count,
    });
  } catch (error) {
    console.error('[activations/run-all] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
