import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

const briefingIdSchema = z.string().min(1);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const idParsed = briefingIdSchema.safeParse(id);
    if (!idParsed.success) {
      return NextResponse.json({ error: 'Invalid briefing ID', details: idParsed.error.flatten() }, { status: 400 });
    }
    const validId = idParsed.data;

    const briefing = await db.briefing.findFirst({
      where: { organizationId: validId },
      orderBy: { generatedAt: 'desc' },
      include: {
        organization: {
          include: {
            people: true,
            signals: {
              where: { status: { in: ['detected', 'validated', 'analyzed'] } },
              orderBy: { detectedAt: 'desc' },
              take: 10,
            },
            insights: {
              where: { status: 'active' },
              orderBy: { createdAt: 'desc' },
              take: 10,
            },
          },
        },
      },
    });

    if (!briefing) {
      return NextResponse.json({ error: 'No briefing found for this organization' }, { status: 404 });
    }

    return NextResponse.json({ data: briefing });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch briefing' }, { status: 500 });
  }
}
