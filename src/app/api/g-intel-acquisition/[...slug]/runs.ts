// GET /api/g-intel-acquisition/runs              → list recent runs (optional ?connectorId filter)
// GET /api/g-intel-acquisition/runs/:id          → get run detail with outcomes

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

// ─── GET runs (list) ───────────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Record<string, string>> },
) {
  const { id } = await params;

  if (id) {
    // ── GET /runs/:id — run detail with intelligence objects ──
    const run = await db.connectorRun.findUnique({
      where: { id },
      include: {
        connector: {
          select: { id: true, name: true, sourceType: true },
        },
      },
    });

    if (!run) {
      return NextResponse.json({ error: 'Run not found' }, { status: 404 });
    }

    // Fetch intelligence objects produced by this run
    const intelObjects = await db.intelligenceObject.findMany({
      where: { connectorRunId: id },
      select: {
        id: true,
        companyId: true,
        sourceType: true,
        status: true,
        originalConfidence: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });

    const successCount = intelObjects.filter((o) => o.status === 'active').length;
    const pendingCount = intelObjects.filter((o) => o.status === 'pending_evidence_mapping').length;

    return NextResponse.json({
      id: run.id,
      connectorId: run.connectorId,
      connector: run.connector,
      status: run.status,
      startedAt: run.startedAt,
      completedAt: run.completedAt,
      recordsAcquired: run.recordsAcquired,
      errorsCount: run.errorsCount,
      errorMessage: run.errorMessage,
      metadata: JSON.parse(run.metadata || '{}'),
      createdAt: run.createdAt,
      _stats: {
        totalObjects: intelObjects.length,
        activeObjects: successCount,
        pendingObjects: pendingCount,
      },
      objects: intelObjects,
    });
  }

  // ── GET /runs — list recent runs ──
  const { searchParams } = new URL(req.url);
  const connectorId = searchParams.get('connectorId');
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10) || 50));
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10) || 0);

  const where = connectorId ? { connectorId } : {};

  const [runs, total] = await Promise.all([
    db.connectorRun.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        connector: {
          select: { id: true, name: true, sourceType: true },
        },
      },
    }),
    db.connectorRun.count({ where }),
  ]);

  return NextResponse.json({
    runs: runs.map((r) => ({
      id: r.id,
      connectorId: r.connectorId,
      connector: r.connector,
      status: r.status,
      startedAt: r.startedAt,
      completedAt: r.completedAt,
      recordsAcquired: r.recordsAcquired,
      errorsCount: r.errorsCount,
      errorMessage: r.errorMessage,
      metadata: JSON.parse(r.metadata || '{}'),
      createdAt: r.createdAt,
    })),
    total,
    limit,
    offset,
  });
}