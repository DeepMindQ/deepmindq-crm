import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { getConnections } from '@/lib/intelligence/knowledge-graph';

const connectionsIdSchema = z.string().min(1);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const idParsed = connectionsIdSchema.safeParse(id);
    if (!idParsed.success) {
      return NextResponse.json({ error: 'Invalid entity ID', details: idParsed.error.flatten() }, { status: 400 });
    }

    const connections = await getConnections(idParsed.data);
    return NextResponse.json({ data: connections });
  } catch (_error) {
    return NextResponse.json(
      { error: 'Failed to fetch connections' },
      { status: 500 }
    );
  }
}
