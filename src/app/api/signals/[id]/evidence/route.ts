import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { checkApiAuth } from '@/lib/api-auth';
import { logger } from '@/lib/logger';

const paramsSchema = z.object({
  id: z.string().min(1),
});

const evidenceSchema = z.object({
  claim: z.string().min(1),
  sourceType: z
    .enum(['web', 'document', 'database', 'user_report', 'ai_generated'])
    .optional()
    .default('web'),
  sourceUrl: z.string().url().optional().or(z.literal('')),
  sourceTitle: z.string().optional(),
  sourceDate: z.string().optional(),
  excerpt: z.string().optional(),
  reliability: z.number().min(0).max(100).optional().default(50),
});

/**
 * Map a 0-100 numeric reliability score to the EvidenceReliability enum.
 */
function mapReliability(score: number): 'verified' | 'likely' | 'inferred' | 'unverified' {
  if (score >= 76) return 'verified';
  if (score >= 51) return 'likely';
  if (score >= 26) return 'inferred';
  return 'unverified';
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { id } = paramsSchema.parse(await params);

    const signal = await db.signal.findUnique({ where: { id } });
    if (!signal) {
      return NextResponse.json({ success: false, error: 'Signal not found' }, { status: 404 });
    }

    const body = await request.json();
    const parsed = evidenceSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid evidence data', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const evidence = await db.evidence.create({
      data: {
        signalId: id,
        organizationId: signal.organizationId,
        claim: parsed.data.claim,
        sourceType: parsed.data.sourceType,
        sourceUrl: parsed.data.sourceUrl || null,
        sourceTitle: parsed.data.sourceTitle || null,
        sourceDate: parsed.data.sourceDate ? new Date(parsed.data.sourceDate) : null,
        excerpt: parsed.data.excerpt || null,
        reliability: mapReliability(parsed.data.reliability),
      },
    });

    return NextResponse.json({
      success: true,
      data: evidence,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Invalid input', details: error.flatten() },
        { status: 400 },
      );
    }
    logger.error('[signals/evidence] Error:', { error });
    return NextResponse.json(
      { success: false, error: 'Failed to create evidence' },
      { status: 500 },
    );
  }
}
