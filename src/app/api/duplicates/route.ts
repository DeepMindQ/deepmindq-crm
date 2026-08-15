import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    // Find potential duplicate persons by similar email domains
    const people = await db.person.findMany({
      where: { email: { not: null } },
      select: { id: true, email: true, fullName: true, organizationId: true },
      take: 200,
    });

    const domainGroups = new Map<string, typeof people>();
    for (const p of people) {
      const domain = p.email?.split('@')[1]?.toLowerCase() ?? '';
      if (!domain) continue;
      const existing = domainGroups.get(domain) ?? [];
      existing.push(p);
      domainGroups.set(domain, existing);
    }

    const data = [];
    let idx = 0;
    for (const [, group] of domainGroups) {
      if (group.length < 2) continue;
      idx++;
      data.push({
        id: `dup-${idx}`,
        field: 'domain' as const,
        values: group.map((g) => g.email ?? g.fullName).join(' / '),
        sourceRecords: group.length,
        confidence: Math.min(98, 70 + group.length * 5),
        status: 'unreviewed' as const,
      });
    }

    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to list duplicates', details: message },
      { status: 500 },
    );
  }
}
