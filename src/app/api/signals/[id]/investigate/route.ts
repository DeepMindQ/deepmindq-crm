import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkApiAuth } from '@/lib/api-auth';
import { z } from 'zod';

const paramsSchema = z.object({
  id: z.string().min(1),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { id } = paramsSchema.parse(await params);

    // Update signal status to analyzed
    const signal = await db.signal.update({
      where: { id },
      data: { status: 'analyzed', analyzedAt: new Date() },
    });

    // Create an insight for this investigation
    await db.insight.create({
      data: {
        organizationId: signal.organizationId,
        signalId: signal.id,
        category: 'pattern',
        title: `Investigation: ${signal.title}`,
        narrative: signal.description,
        reasoningMethod: 'manual_investigation',
        confidence: 'medium',
      },
    });

    return NextResponse.json({ success: true, signal });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: error.flatten() },
        { status: 400 },
      );
    }
    console.error('[signals/investigate] Error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
