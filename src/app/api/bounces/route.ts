import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    // Bounces are tracked via ingestion errors — return structured empty result
    // until a dedicated Bounce model is added
    const data: Array<{
      id: string;
      email: string;
      company: string;
      bounceType: 'hard' | 'soft' | 'spam';
      reason: string;
      bouncedAt: string;
      status: 'unresolved' | 'resolved';
    }> = [];

    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to list bounces', details: message },
      { status: 500 },
    );
  }
}
