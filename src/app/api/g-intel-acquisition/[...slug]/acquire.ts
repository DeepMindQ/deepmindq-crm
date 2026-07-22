// POST /api/g-intel-acquisition/acquire  → run acquisition pipeline on uploaded data

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { CsvConnector, ExcelConnector, WebsiteConnector, RssConnector } from '@/lib/intelligence-sources';
import { processAcquisitionResult } from '@/lib/intelligence-sources/acquisition-engine';
import { validateBody } from '@/lib/apiHelpers';
import { z } from 'zod';
import type { RawIntelligenceObject, IConnector } from '@/lib/intelligence-sources';
import type { AcquisitionContext } from '@/lib/intelligence-sources/acquisition-engine';

// ─── Validation ────────────────────────────────────────────────

const acquireSchema = z.object({
  connectorId: z.string().min(1),
  connectorType: z.enum(['csv', 'excel', 'website', 'rss']),
  config: z.record(z.unknown()),
  defaultCategory: z.string().optional(),
  rows: z.array(z.record(z.unknown())).optional(),
});

// ─── Connector Factory ─────────────────────────────────────────

function getConnector(type: string): IConnector & { sourceType: string; name: string } {
  const map: Record<string, IConnector & { sourceType: string; name: string }> = {
    csv: new CsvConnector() as unknown as IConnector & { sourceType: string; name: string },
    excel: new ExcelConnector() as unknown as IConnector & { sourceType: string; name: string },
    website: new WebsiteConnector() as unknown as IConnector & { sourceType: string; name: string },
    rss: new RssConnector() as unknown as IConnector & { sourceType: string; name: string },
  };
  const conn = map[type];
  if (!conn) throw new Error(`Unknown connector type: ${type}`);
  return conn;
}

// ─── POST handler ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const data = validateBody(acquireSchema, body);
    if (data instanceof Response) return data;

    const { connectorId, connectorType, config, defaultCategory, rows } = data;

    // Validate or create the connector record
    let connectorRecord = await db.connector.findUnique({ where: { id: connectorId } });

    if (!connectorRecord) {
      connectorRecord = await db.connector.create({
        data: {
          id: connectorId,
          name: `${connectorType} Acquisition`,
          sourceType: connectorType,
          config: JSON.stringify(config),
        },
      });
    }

    // Create a ConnectorRun record
    const run = await db.connectorRun.create({
      data: {
        connectorId,
        status: 'running',
        startedAt: new Date(),
      },
    });

    // Update connector's last run tracking
    await db.connector.update({
      where: { id: connectorId },
      data: {
        lastRunAt: new Date(),
        totalRuns: { increment: 1 },
        config: JSON.stringify(config),
      },
    });

    // Build intelligence objects from pre-parsed rows (CSV/Excel) or run connector
    let intelObjects: RawIntelligenceObject[];
    let errors: string[] = [];
    let metadata: Record<string, unknown> = {};

    if (rows && rows.length > 0) {
      // Pre-parsed rows (from file upload) → convert to RawIntelligenceObject[]
      intelObjects = rows.map((row) => {
        const entries = Object.entries(row) as [string, unknown][];
        // Try to find company column
        const companyPatterns = [
          'company', 'account name', 'organization', 'customer', 'account',
          'company name', 'organisation', 'firm', 'client', 'account_name',
          'company_name', 'org', 'org name',
        ];
        const firstKey = entries[0]?.[0] ?? '';
        let companyKey = entries.find(([k]) =>
          companyPatterns.includes(k.trim().toLowerCase()),
        )?.[0];

        const companyName = companyKey ? String(row[companyKey] ?? '') : String(row[firstKey] ?? '');

        // Build content from all fields except company
        const contentParts = entries
          .filter(([k]) => k !== companyKey && k !== firstKey || !!String(row[k]))
          .filter(([k, v]) => k !== (companyKey || firstKey) && v)
          .map(([k, v]) => `${k}: ${v}`);

        return {
          companyIdentifier: companyName || 'Unknown',
          content: contentParts.join('\n'),
          category: defaultCategory,
          metadata: { source: `${connectorType}_upload`, rowData: row },
        } satisfies RawIntelligenceObject;
      });
      metadata = { source: 'pre-parsed', totalRows: rows.length };
    } else {
      // Run the connector's acquire method
      const connector = getConnector(connectorType);
      const result = await connector.acquire(config);
      intelObjects = result.intelligenceObjects;
      errors = result.errors;
      metadata = result.metadata;
    }

    // Fire-and-forget: process through acquisition engine in background
    const connectorForEngine = getConnector(connectorType);

    processAcquisitionResult(
      { intelligenceObjects: intelObjects, errors, metadata },
      {
        connectorId,
        connectorRunId: run.id,
        connector: connectorForEngine,
        defaultCategory,
      } as AcquisitionContext,
    ).then(async (result) => {
      await db.connectorRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          recordsAcquired: result.successCount,
          errorsCount: result.failCount + result.totalErrors,
          metadata: JSON.stringify({ ...metadata, outcomes: { success: result.successCount, fail: result.failCount } }),
        },
      });
      await db.connector.update({
        where: { id: connectorId },
        data: { lastSuccessAt: new Date() },
      });
    }).catch(async (err) => {
      const message = err instanceof Error ? err.message : 'Unknown error';
      await db.connectorRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          completedAt: new Date(),
          errorMessage: message.slice(0, 2000),
        },
      });
      await db.connector.update({
        where: { id: connectorId },
        data: {
          failureCount: { increment: 1 },
          errorMessage: message.slice(0, 1000),
        },
      });
    });

    return NextResponse.json({
      runId: run.id,
      status: 'processing',
      objectCount: intelObjects.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Acquisition pipeline failed';
    console.error('[g-intel-acquisition:acquire]', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}