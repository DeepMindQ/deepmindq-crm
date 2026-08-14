import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

const signalsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  severity: z.enum(['critical', 'high', 'medium', 'low']).optional(),
  status: z.string().default('detected,validated,analyzed'),
  organizationId: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const parsed = signalsQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { limit, severity, status, organizationId } = parsed.data;

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
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch signals' }, { status: 500 });
  }
}
