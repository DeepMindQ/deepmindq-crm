import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { parseStringArray } from '@/lib/json-fields';

const idParamSchema = z.string().min(1);

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;
    const idParsed = idParamSchema.safeParse(id);
    if (!idParsed.success) {
      return NextResponse.json(
        { error: 'Invalid organization ID', details: idParsed.error.flatten() },
        { status: 400 },
      );
    }
    const validId = idParsed.data;

    const organization = await db.organization.findUnique({
      where: { id: validId },
      include: {
        people: {
          orderBy: { updatedAt: 'desc' },
        },
        signals: {
          where: { status: { in: ['detected', 'validated', 'analyzed'] } },
          orderBy: { detectedAt: 'desc' },
          take: 20,
        },
        insights: {
          where: { status: 'active' },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
        evidence: {
          orderBy: { createdAt: 'desc' },
          take: 20,
        },
        briefings: {
          orderBy: { generatedAt: 'desc' },
          take: 1,
        },
        _count: {
          select: {
            signals: true,
            insights: true,
            evidence: true,
            briefings: true,
            people: true,
          },
        },
      },
    });

    if (!organization) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // Parse JSON-encoded string fields for SQLite compatibility
    const org = {
      ...organization,
      aliases: parseStringArray(organization.aliases),
      briefings: organization.briefings.map((b: Record<string, unknown>) => ({
        ...b,
        keyFindings: parseStringArray(b.keyFindings),
        riskFactors: parseStringArray(b.riskFactors),
        recommendedActions: parseStringArray(b.recommendedActions),
      })),
      insights: organization.insights.map((i: Record<string, unknown>) => ({
        ...i,
        evidenceIds: parseStringArray(i.evidenceIds),
        signalIds: parseStringArray(i.signalIds),
      })),
    };

    return NextResponse.json({ data: org });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch organization' }, { status: 500 });
  }
}
