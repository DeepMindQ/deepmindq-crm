import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

const querySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
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

    const { limit } = parsed.data;

    const signals = await db.signal.findMany({
      where: { status: { in: ['acted_upon', 'dismissed', 'expired'] } },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      include: {
        organization: { select: { name: true, domain: true } },
      },
    });

    const timeline = signals.map((signal) => ({
      id: signal.id,
      organizationName: signal.organization?.name || 'Unknown',
      status: signal.status,
      title: signal.title,
      timestamp: signal.updatedAt,
    }));

    return NextResponse.json({ data: timeline });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch activation timeline' }, { status: 500 });
  }
}
