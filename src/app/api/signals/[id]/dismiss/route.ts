import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkApiAuth } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const paramsSchema = z.object({
  id: z.string().min(1),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { id } = paramsSchema.parse(await params);

    const signal = await db.signal.update({
      where: { id },
      data: { status: 'dismissed', analyzedAt: new Date() },
    });

    return NextResponse.json({ success: true, signal });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: error.flatten() },
        { status: 400 },
      );
    }
    logger.error('[signals/dismiss] Error:', { error });
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
