// GET  /api/g-intel-acquisition/connectors           → list all connectors
// POST /api/g-intel-acquisition/connectors           → create connector
// GET    /api/g-intel-acquisition/connectors/:id     → get connector detail
// PUT    /api/g-intel-acquisition/connectors/:id     → update connector config/status
// DELETE /api/g-intel-acquisition/connectors/:id     → disable connector
// POST   /api/g-intel-acquisition/connectors/:id/run → trigger acquisition run

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { validateBody } from '@/lib/apiHelpers';
import { z } from 'zod';

// ─── Validation Schemas ──────────────────────────────────────

const createConnectorSchema = z.object({
  name: z.string().min(1).max(255),
  sourceType: z.enum(['csv', 'excel', 'website', 'rss', 'document', 'human']),
  config: z.record(z.unknown()).optional().default({}),
  scheduleFrequency: z.enum(['manual', 'hourly', 'daily', 'weekly']).optional(),
});

const updateConnectorSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  config: z.record(z.unknown()).optional(),
  status: z.enum(['active', 'paused', 'disabled', 'failed']).optional(),
  scheduleFrequency: z.enum(['manual', 'hourly', 'daily', 'weekly']).optional(),
});

// ─── Helper ──────────────────────────────────────────────────

function parseParams(params: Promise<Record<string, string>>) {
  return params;
}

// ─── GET connectors (list) ────────────────────────────────────

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<Record<string, string>> },
) {
  const { id } = await parseParams(params);

  if (!id) {
    // List all connectors
    const connectors = await db.connector.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { runs: true } } },
    });
    return NextResponse.json(
      connectors.map((c) => ({
        id: c.id,
        name: c.name,
        sourceType: c.sourceType,
        status: c.status,
        config: JSON.parse(c.config),
        scheduleFrequency: c.scheduleFrequency,
        lastRunAt: c.lastRunAt,
        lastSuccessAt: c.lastSuccessAt,
        recordsAcquired: c.recordsAcquired,
        totalRuns: c.totalRuns,
        failureCount: c.failureCount,
        errorMessage: c.errorMessage,
        runCount: c._count.runs,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
    );
  }

  // Get single connector by id
  const connector = await db.connector.findUnique({
    where: { id },
    include: {
      runs: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  });

  if (!connector) {
    return NextResponse.json({ error: 'Connector not found' }, { status: 404 });
  }

  return NextResponse.json({
    ...connector,
    config: JSON.parse(connector.config),
    metadata: JSON.parse(connector.runs[0]?.metadata || '{}'),
  });
}

// ─── POST connectors (create) / connectors/:id/run ───────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<Record<string, string>> },
) {
  const { id } = await parseParams(params);

  if (id) {
    // ── POST /connectors/:id/run — trigger acquisition run ──
    const connector = await db.connector.findUnique({ where: { id } });
    if (!connector) {
      return NextResponse.json({ error: 'Connector not found' }, { status: 404 });
    }

    if (connector.status !== 'active') {
      return NextResponse.json({ error: `Connector is ${connector.status}, cannot run` }, { status: 400 });
    }

    const run = await db.connectorRun.create({
      data: {
        connectorId: id,
        status: 'running',
        startedAt: new Date(),
      },
    });

    // Update connector's last run tracking
    await db.connector.update({
      where: { id },
      data: {
        lastRunAt: new Date(),
        totalRuns: { increment: 1 },
      },
    });

    // Fire-and-forget: process the connector in the background.
    // The caller can poll GET /runs/:id for status.
    processRunInBackground(id, run.id, connector).catch((err) => {
      console.error(`[connector-run:${run.id}] background error:`, err);
    });

    return NextResponse.json({ runId: run.id, status: 'running' });
  }

  // ── POST /connectors — create new connector ──
  const body = await req.json();
  const data = validateBody(createConnectorSchema, body);
  if (data instanceof Response) return data;

  const connector = await db.connector.create({
    data: {
      name: data.name,
      sourceType: data.sourceType,
      config: JSON.stringify(data.config),
      scheduleFrequency: data.scheduleFrequency ?? 'manual',
    },
  });

  return NextResponse.json({
    id: connector.id,
    name: connector.name,
    sourceType: connector.sourceType,
    status: connector.status,
    config: JSON.parse(connector.config),
    scheduleFrequency: connector.scheduleFrequency,
    createdAt: connector.createdAt,
    updatedAt: connector.updatedAt,
  }, { status: 201 });
}

// ─── PUT connectors/:id (update) ─────────────────────────────

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<Record<string, string>> },
) {
  const { id } = await parseParams(params);

  const connector = await db.connector.findUnique({ where: { id } });
  if (!connector) {
    return NextResponse.json({ error: 'Connector not found' }, { status: 404 });
  }

  const body = await req.json();
  const data = validateBody(updateConnectorSchema, body);
  if (data instanceof Response) return data;

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) updateData.name = data.name;
  if (data.config !== undefined) updateData.config = JSON.stringify(data.config);
  if (data.status !== undefined) updateData.status = data.status;
  if (data.scheduleFrequency !== undefined) updateData.scheduleFrequency = data.scheduleFrequency;

  // If re-activating from failed state, reset failure count
  if (data.status === 'active' && connector.status === 'failed') {
    updateData.failureCount = 0;
    updateData.errorMessage = null;
  }

  const updated = await db.connector.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    sourceType: updated.sourceType,
    status: updated.status,
    config: JSON.parse(updated.config),
    scheduleFrequency: updated.scheduleFrequency,
    lastRunAt: updated.lastRunAt,
    lastSuccessAt: updated.lastSuccessAt,
    recordsAcquired: updated.recordsAcquired,
    totalRuns: updated.totalRuns,
    failureCount: updated.failureCount,
    errorMessage: updated.errorMessage,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt,
  });
}

// ─── DELETE connectors/:id (disable) ─────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<Record<string, string>> },
) {
  const { id } = await parseParams(params);

  const connector = await db.connector.findUnique({ where: { id } });
  if (!connector) {
    return NextResponse.json({ error: 'Connector not found' }, { status: 404 });
  }

  // Soft-disable rather than hard delete to preserve run history
  const updated = await db.connector.update({
    where: { id },
    data: { status: 'disabled' },
  });

  return NextResponse.json({
    id: updated.id,
    name: updated.name,
    sourceType: updated.sourceType,
    status: updated.status,
    message: 'Connector disabled',
  });
}

// ─── Background run processor ────────────────────────────────

async function processRunInBackground(
  connectorId: string,
  runId: string,
  connector: { sourceType: string; config: string },
) {
  try {
    const { CsvConnector, ExcelConnector, WebsiteConnector, RssConnector } =
      await import('@/lib/intelligence-sources');
    const { processAcquisitionResult } =
      await import('@/lib/intelligence-sources/acquisition-engine');

    const config = JSON.parse(connector.config);
    let result;

    const connectorMap: Record<string, unknown> = {
      csv: new CsvConnector(),
      excel: new ExcelConnector(),
      website: new WebsiteConnector(),
      rss: new RssConnector(),
    };

    const conn = connectorMap[connector.sourceType] as
      | { acquire: (c: Record<string, unknown>) => Promise<unknown> }
      | { run: (c: Record<string, unknown>) => Promise<unknown> }
      | undefined;

    if (!conn) {
      throw new Error(`Unknown connector type: ${connector.sourceType}`);
    }

    // Use new acquire() if available, fall back to legacy run()
    if ('acquire' in conn && typeof conn.acquire === 'function') {
      result = await conn.acquire(config);
    } else if ('run' in conn && typeof conn.run === 'function') {
      result = await conn.run(config);
    } else {
      throw new Error(`Connector has no acquire or run method`);
    }

    const acqResult = result as {
      intelligenceObjects?: unknown[];
      errors?: string[];
      metadata?: Record<string, unknown>;
      status?: string;
      messages?: Array<{ message: string }>;
    };

    const intelObjects = acqResult.intelligenceObjects ?? [];
    const errors = acqResult.errors ??
      acqResult.messages?.map((m) => m.message) ?? [];
    const metadata = (acqResult.metadata ?? {}) as Record<string, unknown>;

    // If we got intelligence objects, run them through the acquisition engine
    if (intelObjects.length > 0) {
      // We need a connector instance that satisfies IConnector for the engine
      const connForEngine = connectorMap[connector.sourceType] as {
        sourceType: string;
        name: string;
      };

      await processAcquisitionResult(
        {
          intelligenceObjects: intelObjects as import('@/lib/intelligence-sources').RawIntelligenceObject[],
          errors,
          metadata,
        },
        {
          connectorId,
          connectorRunId: runId,
          connector: connForEngine as import('@/lib/intelligence-sources/acquisition-engine').AcquisitionContext['connector'],
        },
      );
    } else {
      // No objects — just finalize the run
      await db.connectorRun.update({
        where: { id: runId },
        data: {
          status: 'completed',
          completedAt: new Date(),
          metadata: JSON.stringify(metadata),
          errorsCount: errors.length,
        },
      });
    }

    // Update connector's last success tracking
    await db.connector.update({
      where: { id: connectorId },
      data: { lastSuccessAt: new Date() },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    await db.connectorRun.update({
      where: { id: runId },
      data: {
        status: 'failed',
        completedAt: new Date(),
        errorMessage: message,
      },
    });
    await db.connector.update({
      where: { id: connectorId },
      data: {
        failureCount: { increment: 1 },
        errorMessage: message.slice(0, 1000),
      },
    });
  }
}
