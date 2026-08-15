import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    // No dedicated Sequence model — return structured empty array
    const data: Array<{
      id: string;
      name: string;
      status: string;
      steps: number;
      enrolled: number;
      replyRate: number;
    }> = [];

    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to list sequences', details: message },
      { status: 500 },
    );
  }
}
