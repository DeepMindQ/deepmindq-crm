import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

const updateRuleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  enabled: z.boolean().optional(),
  severityThreshold: z.number().int().min(0).max(100).optional(),
  customConditions: z.string().nullable().optional(),
});

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { errorResponse } = await checkApiAuth(_request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const rule = await db.signalRule.findUnique({ where: { id } });
    if (!rule) {
      return NextResponse.json({ error: 'Signal rule not found' }, { status: 404 });
    }
    return NextResponse.json({ data: rule });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch signal rule' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const body = await request.json();
    const parsed = updateRuleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const rule = await db.signalRule.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json({ data: rule });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to update signal rule' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    await db.signalRule.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to delete signal rule' }, { status: 500 });
  }
}
