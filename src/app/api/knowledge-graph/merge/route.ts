import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { mergeOrganizations } from '@/lib/intelligence/knowledge-graph';
import { db } from '@/lib/db';

const mergePostSchema = z
  .object({
    sourceId: z.string().min(1),
    targetId: z.string().min(1),
  })
  .refine((d) => d.sourceId !== d.targetId, {
    message: 'Cannot merge an entity into itself',
  });

export async function POST(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const parsed = mergePostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { targetId, sourceId } = parsed.data;

    // Validate both exist
    const [target, source] = await Promise.all([
      db.organization.findUnique({ where: { id: targetId }, select: { id: true, name: true } }),
      db.organization.findUnique({ where: { id: sourceId }, select: { id: true, name: true } }),
    ]);

    if (!target || !source) {
      return NextResponse.json({ error: 'One or both organizations not found' }, { status: 404 });
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
    return NextResponse.json({ error: 'Merge failed' }, { status: 500 });
  }
}
