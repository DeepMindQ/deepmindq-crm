import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const users = await db.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
        sessions: {
          select: { id: true, createdAt: true, expiresAt: true },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const data = users.map((u) => ({
      id: u.id,
      name: u.name ?? u.email,
      email: u.email,
      role: u.role,
      status: 'active' as const,
      lastActive: u.sessions[0]?.createdAt?.toISOString() ?? u.updatedAt.toISOString(),
      sessions: u.sessions.length,
    }));

    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Failed to list users', details: message }, { status: 500 });
  }
}
