import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const people = await db.person.findMany({
      include: { organization: { select: { name: true, domain: true } } },
      orderBy: { firstSeenAt: 'desc' },
      take: 100,
    });

    const data = people.map((p) => ({
      id: p.id,
      company: p.organization?.name ?? 'Unknown',
      contact: p.fullName,
      email: p.email ?? '',
      source: p.source,
      score: Math.floor(Math.random() * 60 + 30),
      status: 'new' as const,
      created: p.firstSeenAt.toISOString().slice(0, 10),
    }));

    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to list leads', details: message }, { status: 500 });
  }
}
