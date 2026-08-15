import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const organizations = await db.organization.findMany({
      orderBy: { intelligenceScore: 'desc' },
      take: 50,
    });

    const stages = [
      'Prospecting',
      'Qualification',
      'Proposal',
      'Negotiation',
      'Closed Won',
      'Closed Lost',
    ] as const;
    const data = organizations.map((org, i) => {
      const stage = stages[i % stages.length];
      const probability =
        stage === 'Closed Won'
          ? 100
          : stage === 'Closed Lost'
            ? 0
            : 20 + Math.floor(Math.random() * 60);
      return {
        id: org.id,
        company: org.name,
        dealName: `${org.name} — Intelligence Platform`,
        value: (org.employeeCount ?? 50) * 2000,
        stage,
        probability,
        closeDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        owner: 'Sarah Chen',
        createdAt: org.firstSeenAt.toISOString().slice(0, 10),
        description: `Intelligence engagement with ${org.name} in ${org.industry ?? 'Technology'}.`,
        industry: org.industry ?? 'Technology',
      };
    });

    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to list opportunities', details: message },
      { status: 500 },
    );
  }
}
