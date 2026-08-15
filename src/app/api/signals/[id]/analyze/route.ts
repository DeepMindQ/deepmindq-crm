import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { checkApiAuth } from '@/lib/api-auth';
import { logger } from '@/lib/logger';
import { z } from 'zod';

const paramsSchema = z.object({
  id: z.string().min(1),
});

const ANALYZABLE_STATUSES = ['detected', 'validated'];

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { session, errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { id } = paramsSchema.parse(await params);

    const signal = await db.signal.findUnique({ where: { id } });
    if (!signal) {
      return NextResponse.json({ success: false, error: 'Signal not found' }, { status: 404 });
    }

    if (!ANALYZABLE_STATUSES.includes(signal.status)) {
      return NextResponse.json(
        {
          success: false,
          error: `Cannot analyze a signal with status '${signal.status}'. Only 'detected' or 'validated' signals can be analyzed.`,
        },
        { status: 409 },
      );
    }

    // Basic analysis: enrich the signal description with structured reasoning
    const enrichedDescription = buildAnalysis(signal);

    const fromStatus = signal.status;
    const updated = await db.signal.update({
      where: { id },
      data: {
        status: 'analyzed',
        analyzedAt: new Date(),
        description: enrichedDescription,
      },
    });

    await db.signalEvent.create({
      data: {
        signalId: id,
        fromStatus,
        toStatus: 'analyzed',
        userId: session?.id ?? null,
        reason: 'AI analysis completed',
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
    logger.error('[signals/analyze] Error:', { error });
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * Basic analysis enrichment — builds a structured analysis narrative.
 * In the future this can be replaced by a call to an LLM.
 */
function buildAnalysis(signal: {
  title: string;
  description: string;
  signalType: string;
  severity: string;
  confidenceScore: number | null;
  impactScore: number | null;
}): string {
  const parts = [signal.description];

  const severityContext: Record<string, string> = {
    critical: 'This is a critical-priority signal requiring immediate attention.',
    high: 'This high-severity signal should be prioritized for action.',
    medium: 'This medium-severity signal warrants monitoring and potential follow-up.',
    low: 'This is a low-severity signal that can be tracked for future reference.',
  };

  if (severityContext[signal.severity]) {
    parts.push(severityContext[signal.severity]);
  }

  if (signal.confidenceScore !== null) {
    parts.push(`Confidence score: ${signal.confidenceScore}/100.`);
  }

  if (signal.impactScore !== null) {
    parts.push(`Estimated business impact: ${signal.impactScore}/100.`);
  }

  return parts.join(' ');
}
