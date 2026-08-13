import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { getConnections } from '@/lib/intelligence/knowledge-graph';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const connections = await getConnections(id);
    return NextResponse.json({ data: connections });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch connections' },
      { status: 500 }
    );
  }
}
