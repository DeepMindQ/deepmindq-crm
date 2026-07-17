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

    // Map DB shape → frontend shape (matches AuditItem interface in command-center-screen)
    const entries = auditLogs.map((log) => ({
      id: log.id,
      action: log.action || '',
      entity: log.entity || '',
      entityId: log.entityId || undefined,
      details: log.details || '',
      createdAt: log.createdAt.toISOString(),
    }));

    return NextResponse.json(entries);
  } catch (error) {
    console.error('Audit error:', error);
    return NextResponse.json([]);
  }
}