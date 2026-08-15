import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const logs = await db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const data = logs.map((log) => ({
      id: log.id,
      timestamp: log.createdAt.toISOString(),
      user: log.userId ?? 'System',
      action: log.action,
      resource: log.resource ?? '',
      ipAddress: log.ipAddress ?? '',
      details: log.details ?? '',
    }));

    return NextResponse.json({ data });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to list audit logs', details: message },
      { status: 500 },
    );
  }
}
