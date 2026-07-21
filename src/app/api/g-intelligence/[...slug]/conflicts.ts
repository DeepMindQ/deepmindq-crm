// GET /api/g-intelligence/conflicts
// PATCH /api/g-intelligence/conflicts/[id]  (resolve a conflict)
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { resolveConflict } from '@/lib/contradiction-detection';

export async function GET(_req: NextRequest) {

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

// Note: This handler is not matched by the current route registry since
// PATCH /conflicts/[id] needs to be added to the route dispatcher.
// For now, conflict resolution is handled through the validate endpoint
// or direct DB access. This is a placeholder for future route expansion.
export async function PATCH(_req: NextRequest) {
  return NextResponse.json({ error: 'Not implemented. Use POST validate to re-detect conflicts.' }, { status: 501 });
}