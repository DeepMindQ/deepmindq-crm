import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { discoverRelationships } from '@/lib/intelligence/knowledge-graph';

export async function POST(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const orgId = body.organizationId || undefined;

    const created = await discoverRelationships(orgId);
    return NextResponse.json({
      data: { relationshipsCreated: created },
    });
  } catch (_error) {
    return NextResponse.json(
      { error: 'Relationship discovery failed' },
      { status: 500 }
    );
  }
}
