import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { getSubgraph } from '@/lib/intelligence/knowledge-graph';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const depth = parseInt(searchParams.get('depth') || '2', 10);

    const subgraph = await getSubgraph(id, Math.min(depth, 4));
    return NextResponse.json({ data: subgraph });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch subgraph' },
      { status: 500 }
    );
  }
}
