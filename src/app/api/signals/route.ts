import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const severity = searchParams.get('severity');
    const status = searchParams.get('status') || 'detected,validated,analyzed';
    const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 200);

    const where: Record<string, unknown> = {};
    if (organizationId) where.organizationId = organizationId;
    if (severity) where.severity = severity;
    if (status) where.status = { in: status.split(',') };

    const signals = await db.signal.findMany({
      where,
      orderBy: { detectedAt: 'desc' },
      take: limit,
      include: {
        organization: { select: { name: true, domain: true, industry: true } },
        evidence: { take: 5 },
      },
    });

    return NextResponse.json({ data: signals });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch signals' }, { status: 500 });
  }
}
