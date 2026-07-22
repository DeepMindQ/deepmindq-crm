import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

// GET /api/audit — returns audit entries in the shape audit-screen.tsx expects
export async function GET(request: NextRequest) {
  try {
    const limit = parseInt(request.nextUrl.searchParams.get('limit') || '200', 10);

    const auditLogs = await db.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 500),
    });

    // Map DB shape → frontend shape
    const entries = auditLogs.map((log) => ({
      id: log.id,
      timestamp: log.createdAt.toISOString(),
      userId: log.userId || 'system',
      action: log.action,
      entityType: log.entity,
      entityName: log.entityId || log.entity || '',
      details: log.details || '',
    }));

    return NextResponse.json(entries);
  } catch (error) {
    console.error('Audit error:', error);
    return NextResponse.json([]);
  }
}