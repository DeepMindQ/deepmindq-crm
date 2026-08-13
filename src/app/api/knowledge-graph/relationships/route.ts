import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { createRelationship, getConnectionPaths } from '@/lib/intelligence/knowledge-graph';

export async function POST(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const body = await request.json();

    const { type, label, weight, sourceOrgId, targetOrgId, sourcePersonId, targetPersonId, evidenceId } = body;

    if (!type) {
      return NextResponse.json({ error: 'Relationship type is required' }, { status: 400 });
    }

    if ((!sourceOrgId && !sourcePersonId) || (!targetOrgId && !targetPersonId)) {
      return NextResponse.json({ error: 'Source and target are required' }, { status: 400 });
    }

    const edge = await createRelationship({
      type,
      label,
      weight,
      sourceOrgId,
      targetOrgId,
      sourcePersonId,
      targetPersonId,
      evidenceId,
    });

    return NextResponse.json({ data: edge }, { status: 201 });
  } catch (_error) {
    return NextResponse.json(
      { error: 'Failed to create relationship' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const source = searchParams.get('source');
    const target = searchParams.get('target');
    const maxHops = parseInt(searchParams.get('maxHops') || '4', 10);

    if (!source || !target) {
      return NextResponse.json(
        { error: 'source and target query params are required' },
        { status: 400 }
      );
    }

    const paths = await getConnectionPaths(source, target, maxHops);
    return NextResponse.json({ data: paths });
  } catch (_error) {
    return NextResponse.json(
      { error: 'Failed to find connection paths' },
      { status: 500 }
    );
  }
}
