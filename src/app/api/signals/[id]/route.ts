import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkApiAuth } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const paramsSchema = z.object({
  id: z.string().min(1),
});

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { id } = paramsSchema.parse(await params);

    const signal = await db.signal.findUnique({
      where: { id },
      include: {
        evidence: { take: 20, orderBy: { createdAt: 'desc' } },
        insights: { take: 10, orderBy: { createdAt: 'desc' } },
        organization: { select: { id: true, name: true, domain: true, industry: true } },
      },
    });

    if (!signal) {
      return NextResponse.json({ success: false, error: 'Signal not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: signal, timestamp: new Date().toISOString() });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: error.flatten() },
        { status: 400 },
      );
    }
    logger.error('[signals/get] Error:', { error });
    return NextResponse.json({ success: false, error: 'Failed to fetch signal' }, { status: 500 });
  }
}
