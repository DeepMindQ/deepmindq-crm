// GET /api/g-intelligence/conflicts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const severity = searchParams.get('severity') || '';
  const status = searchParams.get('status') || 'open';
  const companyId = searchParams.get('companyId') || '';
  const page = parseInt(searchParams.get('page') || '1', 10) || 1;
  const limit = Math.min(50, parseInt(searchParams.get('limit') || '20', 10) || 20);

  const where: Record<string, unknown> = {};
  if (severity) where.severity = severity;
  if (status) where.status = status;
  if (companyId) where.companyId = companyId;

  const [conflicts, total] = await Promise.all([
    db.intelligenceConflict.findMany({
      where,
      include: {
        company: { select: { rawName: true, normalizedName: true } },
      },
      orderBy: { detectedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.intelligenceConflict.count({ where }),
  ]);

  return NextResponse.json({
    conflicts: conflicts.map(c => ({
      id: c.id,
      companyId: c.companyId,
      companyName: c.company.rawName || c.company.normalizedName || 'Unknown',
      conflictType: c.conflictType,
      description: c.description,
      severity: c.severity,
      status: c.status,
      relatedSignals: c.relatedSignals,
      detectedAt: c.detectedAt,
      resolvedAt: c.resolvedAt,
    })),
    total,
    page,
    limit,
  });
}