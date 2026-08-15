import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkApiAuth } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const paramsSchema = z.object({
  id: z.string().min(1),
});

const ESCALATABLE_STATUSES = ['validated', 'analyzed'];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { id } = paramsSchema.parse(await params);

    const signal = await db.signal.findUnique({ where: { id } });
    if (!signal) {
      return NextResponse.json({ success: false, error: 'Signal not found' }, { status: 404 });
    }

    if (!ESCALATABLE_STATUSES.includes(signal.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot escalate a signal with status '${signal.status}'. Only 'validated' or 'analyzed' signals can be escalated.`,
        },
        { status: 409 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const reason = body?.reason || null;

    const fromStatus = signal.status;
    const updated = await db.signal.update({
      where: { id },
      data: { status: 'acted_upon' },
    });

    await db.signalEvent.create({
      data: {
        signalId: id,
        fromStatus,
        toStatus: 'acted_upon',
        userId: session?.id ?? null,
        reason,
      },
    });

    return NextResponse.json({ success: true, signal: updated });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: error.flatten() },
        { status: 400 },
      );
    }
    logger.error('[signals/escalate] Error:', { error });
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
