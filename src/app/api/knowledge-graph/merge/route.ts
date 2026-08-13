import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { mergeOrganizations } from '@/lib/intelligence/knowledge-graph';
import { db } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const { targetId, sourceId } = body;

    if (!targetId || !sourceId) {
      return NextResponse.json(
        { error: 'targetId and sourceId are required' },
        { status: 400 }
      );
    }

    if (targetId === sourceId) {
      return NextResponse.json(
        { error: 'Cannot merge an entity into itself' },
        { status: 400 }
      );
    }

    // Validate both exist
    const [target, source] = await Promise.all([
      db.organization.findUnique({ where: { id: targetId }, select: { id: true, name: true } }),
      db.organization.findUnique({ where: { id: sourceId }, select: { id: true, name: true } }),
    ]);

    if (!target || !source) {
      return NextResponse.json(
        { error: 'One or both organizations not found' },
        { status: 404 }
      );
    }

    await mergeOrganizations(targetId, sourceId);

    return NextResponse.json({
      data: {
        merged: true,
        target: target.name,
        source: source.name,
        message: `${source.name} merged into ${target.name}. Source deleted.`,
      },
    });
  } catch (_error) {
    return NextResponse.json(
      { error: 'Merge failed' },
      { status: 500 }
    );
  }
}
