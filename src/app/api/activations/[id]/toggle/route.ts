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

    const org = await db.organization.findUnique({ where: { id } });
    if (!org) {
      return NextResponse.json(
        { success: false, error: 'Organization not found' },
        { status: 404 },
      );
    }

    let newStatus: 'active' | 'paused';
    if (org.trackingStatus === 'active') {
      newStatus = 'paused';
    } else {
      // paused or archived → active
      newStatus = 'active';
    }

    const organization = await db.organization.update({
      where: { id },
      data: { trackingStatus: newStatus },
    });

    return NextResponse.json({ success: true, organization });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: error.flatten() },
        { status: 400 },
      );
    }
    logger.error('[activations/toggle] Error:', { error });
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
