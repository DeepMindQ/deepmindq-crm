import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { parseStringArray } from '@/lib/json-fields';

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

    const insights = await db.insight.findMany({
      where: { organizationId, status: 'active' },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const notes = insights.map((insight) => ({
      ...insight,
      evidenceIds: parseStringArray(insight.evidenceIds),
      signalIds: parseStringArray(insight.signalIds),
    }));

    return NextResponse.json({ data: notes });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch notes' }, { status: 500 });
  }
}

const createNoteSchema = z.object({
  organizationId: z.string().min(1),
  title: z.string().min(1),
  narrative: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const parsed = createNoteSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const { organizationId, title, narrative } = parsed.data;

    const note = await db.insight.create({
      data: {
        organizationId,
        title,
        narrative,
        category: 'note',
        reasoningMethod: 'manual',
        confidence: 'medium',
      },
    });

    return NextResponse.json({ data: note }, { status: 201 });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to create note' }, { status: 500 });
  }
}
