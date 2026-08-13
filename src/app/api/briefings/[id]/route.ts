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

    const briefing = await db.briefing.findFirst({
      where: { organizationId: id },
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
