import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { discoverRelationships } from '@/lib/intelligence/knowledge-graph';

const discoverPostSchema = z.object({
  organizationId: z.string().optional(),
}).passthrough();

export async function POST(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const parsed = discoverPostSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid request body', details: parsed.error.flatten() }, { status: 400 });
    }
    const { organizationId } = parsed.data;

    const created = await discoverRelationships(organizationId);
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
