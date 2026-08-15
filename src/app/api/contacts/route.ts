import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

const querySchema = z.object({
  organizationId: z.string().min(1, 'organizationId is required'),
});

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { organizationId } = parsed.data;

    const contacts = await db.person.findMany({
      where: { organizationId },
      orderBy: { updatedAt: 'desc' },
    });

    return NextResponse.json({ data: contacts });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 });
  }
}
