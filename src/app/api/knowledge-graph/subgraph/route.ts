import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { getSubgraph } from '@/lib/intelligence/knowledge-graph';

const subgraphIdSchema = z.string().min(1);
const subgraphQuerySchema = z.object({
  depth: z.coerce.number().int().min(1).max(4).default(2),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const idParsed = subgraphIdSchema.safeParse(id);
    if (!idParsed.success) {
      return NextResponse.json(
        { error: 'Invalid entity ID', details: idParsed.error.flatten() },
        { status: 400 },
      );
    }

    const { searchParams } = new URL(request.url);
    const queryParsed = subgraphQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!queryParsed.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: queryParsed.error.flatten() },
        { status: 400 },
      );
    }
    const { depth } = queryParsed.data;

    const subgraph = await getSubgraph(idParsed.data, depth);
    return NextResponse.json({ data: subgraph });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch subgraph' }, { status: 500 });
  }
}
