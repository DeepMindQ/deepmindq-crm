import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { id } = await params;

    const organization = await db.organization.findUnique({
      where: { id },
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

    return NextResponse.json({ data: organization });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch organization' }, { status: 500 });
  }
}
