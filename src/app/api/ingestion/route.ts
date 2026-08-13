import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '10', 10), 50);

    const ingestions = await db.dataIngestion.findMany({
      orderBy: { uploadedAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ data: ingestions });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch ingestion history' }, { status: 500 });
  }
}
