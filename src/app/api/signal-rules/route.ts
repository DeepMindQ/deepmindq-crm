import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

const listQuerySchema = z.object({
  signalType: z.string().optional(),
});

const createRuleSchema = z.object({
  name: z.string().min(1).max(200),
  signalType: z.string().min(1),
  enabled: z.boolean().default(true),
  severityThreshold: z.number().int().min(0).max(100).default(0),
  customConditions: z.string().optional(),
  organizationId: z.string().nullable().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const parsed = listQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid parameters' }, { status: 400 });
    }

    const where: Record<string, unknown> = {};
    if (parsed.data.signalType) where.signalType = parsed.data.signalType;

    const rules = await db.signalRule.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ data: rules });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch signal rules' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { errorResponse, session } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const body = await request.json();
    const parsed = createRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const rule = await db.signalRule.create({
      data: {
        ...parsed.data,
        createdBy: session?.id,
      },
    });

    return NextResponse.json({ data: rule }, { status: 201 });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to create signal rule' }, { status: 500 });
  }
}
