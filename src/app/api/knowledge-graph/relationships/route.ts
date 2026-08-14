import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { createRelationship, getConnectionPaths } from '@/lib/intelligence/knowledge-graph';

const relationshipsPostSchema = z.object({
  type: z.string().min(1),
  label: z.string().optional(),
  weight: z.number().min(0).max(1).optional(),
  sourceOrgId: z.string().optional(),
  targetOrgId: z.string().optional(),
  sourcePersonId: z.string().optional(),
  targetPersonId: z.string().optional(),
  evidenceId: z.string().optional(),
}).refine(d => (d.sourceOrgId || d.sourcePersonId) && (d.targetOrgId || d.targetPersonId), {
  message: 'Source and target are required (provide sourceOrgId or sourcePersonId, and targetOrgId or targetPersonId)',
});

const relationshipsGetQuerySchema = z.object({
  source: z.string().min(1),
  target: z.string().min(1),
  maxHops: z.coerce.number().int().min(1).max(10).default(4),
});

export async function POST(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const parsed = relationshipsPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
    }
    const { type, label, weight, sourceOrgId, targetOrgId, sourcePersonId, targetPersonId, evidenceId } = parsed.data;

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
    const parsed = relationshipsGetQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid parameters', details: parsed.error.flatten() }, { status: 400 });
    }
    const { source, target, maxHops } = parsed.data;

    const paths = await getConnectionPaths(source, target, maxHops);
    return NextResponse.json({ data: paths });
  } catch (_error) {
    return NextResponse.json(
      { error: 'Failed to find connection paths' },
      { status: 500 }
    );
  }
}
