// ═══════════════════════════════════════════════════════════════════════════
// DeepMindQ Intelligence OS — Data Ingestion Engine
//
// Takes raw business data (CSV, Excel, JSON) and converts it into
// structured intelligence entities (Organization, Person, Signal).
//
// Pipeline: Upload → Parse → Detect Columns → Extract Entities → Store
//
// v2: Refactored for batched operations, existing ingestionId support,
//     JSON parsing, transaction safety, AIUsageLog tracking.
// ═══════════════════════════════════════════════════════════════════════════

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { readFile } from 'fs/promises';
import { parseCSV, parseExcelRow, parseJSON, type ParsedRow } from './parsers';
import { detectColumns } from './column-detector';
import { extractEntities } from './entity-extractor';
import type { IngestionFileType } from '@prisma/client';

export interface IngestionResult {
  ingestionId: string;
  totalRows: number;
  processedRows: number;
  failedRows: number;
  organizationsCreated: number;
  peopleCreated: number;
  errors: Array<{ row: number; error: string }>;
}

export interface IngestionOptions {
  userId?: string;
  existingIngestionId?: string;
  storedFilePath?: string;
  deduplicate?: boolean;
  skipRows?: number;
  maxRows?: number;
}

/** Number of rows to batch together for DB operations */
const BATCH_SIZE = 50;

/**
 * Main ingestion pipeline.
 * Takes a file buffer, parses it, detects columns, extracts entities, stores them.
 *
 * If `existingIngestionId` is provided, uses that record instead of creating a new one.
 * If `storedFilePath` is provided, reads the file from disk (used by retry/cron).
 */
export async function ingestFile(
  fileBuffer: Buffer,
  fileName: string,
  fileType: IngestionFileType,
  options: IngestionOptions = {},
): Promise<IngestionResult> {
  const {
    userId,
    existingIngestionId,
    storedFilePath,
    deduplicate = true,
    skipRows = 0,
    maxRows = 10000,
  } = options;

  const startTime = Date.now();
  logger.info('[INGEST] Starting file ingestion', {
    fileName,
    fileType,
    userId,
    existingIngestionId,
  });

  // 1. Create or use existing ingestion record
  let ingestion;
  if (existingIngestionId) {
    ingestion = await db.dataIngestion.update({
      where: { id: existingIngestionId },
      data: {
        status: 'processing',
        errorMessage: null,
        errorDetails: null,
        completedAt: null,
        processedRows: 0,
        failedRows: 0,
        ...(storedFilePath ? { storedFilePath } : {}),
      },
    });
  } else {
    ingestion = await db.dataIngestion.create({
      data: {
        fileName,
        fileSize: fileBuffer.length,
        fileType,
        status: 'processing',
        uploadedBy: userId,
      },
    });
  }

  const result: IngestionResult = {
    ingestionId: ingestion.id,
    totalRows: 0,
    processedRows: 0,
    failedRows: 0,
    organizationsCreated: 0,
    peopleCreated: 0,
    errors: [],
  };

  try {
    // 2. Parse the file into rows
    let rows: ParsedRow[];

    if (storedFilePath) {
      // Read from disk for retry/cron scenarios
      const diskBuffer = await readFile(storedFilePath);
      rows = await parseFile(diskBuffer, fileType);
    } else {
      rows = await parseFile(fileBuffer, fileType);
    }

    result.totalRows = rows.length;
    logger.info('[INGEST] File parsed', { totalRows: rows.length });

    if (rows.length === 0) {
      await finalizeIngestion(ingestion.id, result, startTime);
      return result;
    }

    // 3. Detect column mapping from first row
    const columnMapping = detectColumns(rows[0]);
    logger.info('[INGEST] Columns detected', { mapping: columnMapping });

    // Store column map
    await db.dataIngestion.update({
      where: { id: ingestion.id },
      data: { columnMap: JSON.stringify(columnMapping) },
    });

    // 4. Process rows in batches
    const processStart = skipRows;
    const processEnd = Math.min(rows.length, skipRows + maxRows);

    for (let batchStart = processStart; batchStart < processEnd; batchStart += BATCH_SIZE) {
      const batchEnd = Math.min(batchStart + BATCH_SIZE, processEnd);
      const batchRows = rows.slice(batchStart, batchEnd);

      await processBatch(batchRows, batchStart, columnMapping, ingestion.id, result, deduplicate);
    }

    // 5. Finalize ingestion record
    await finalizeIngestion(ingestion.id, result, startTime);

    // 6. Auto-discover relationships in the knowledge graph
    if (result.organizationsCreated > 0) {
      try {
        const { discoverRelationships } = await import('@/lib/intelligence/knowledge-graph');
        const relsCreated = await discoverRelationships();
        logger.info('[INGEST] Knowledge graph relationships discovered', { relsCreated });
      } catch (kgError) {
        logger.warn('[INGEST] Knowledge graph discovery failed (non-blocking)', {
          error: kgError instanceof Error ? kgError.message : 'Unknown',
        });
      }
    }

    // Trigger signal detection for newly created organizations
    if (result.organizationsCreated > 0) {
      try {
        const { detectSignalsForOrganization } = await import('@/lib/intelligence/signals');
        // Get the org IDs that were created during this ingestion
        const newOrgs = await db.organization.findMany({
          where: { sourceIngestionId: ingestion.id },
          select: { id: true },
        });
        for (const org of newOrgs) {
          await detectSignalsForOrganization(org.id);
        }
        logger.info('[INGEST] Signal detection triggered for imported organizations', {
          ingestionId: ingestion.id,
          orgCount: newOrgs.length,
        });
      } catch (sigErr) {
        logger.warn('[INGEST] Signal detection failed after ingestion (non-blocking)', {
          error: sigErr instanceof Error ? sigErr.message : String(sigErr),
        });
      }
    }

    // 7. Log to AIUsageLog for pipeline metrics (#13)
    const durationMs = Date.now() - startTime;
    const successRate =
      result.processedRows > 0
        ? Math.round(((result.processedRows - result.failedRows) / result.processedRows) * 100)
        : 0;
    try {
      await db.aIUsageLog.create({
        data: {
          provider: 'system',
          model: 'ingestion-pipeline',
          feature: 'data_ingestion',
          latencyMs: durationMs,
          qualityScore: successRate,
          totalTokens: result.totalRows,
          promptTokens: result.organizationsCreated,
          completionTokens: result.peopleCreated,
        },
      });
      logger.info('[INGEST] Usage logged', { durationMs, successRate });
    } catch (logError) {
      logger.warn('[INGEST] Failed to log usage (non-blocking)', {
        error: logError instanceof Error ? logError.message : 'Unknown',
      });
    }

    logger.info('[INGEST] File ingestion complete', {
      ingestionId: ingestion.id,
      totalRows: result.totalRows,
      processedRows: result.processedRows,
      failedRows: result.failedRows,
      organizationsCreated: result.organizationsCreated,
      peopleCreated: result.peopleCreated,
      durationMs,
    });
  } catch (error) {
    // Pipeline-level failure
    const errorMsg = error instanceof Error ? error.message : 'Unknown pipeline error';
    await db.dataIngestion.update({
      where: { id: ingestion.id },
      data: {
        status: 'failed',
        errorMessage: errorMsg,
        completedAt: new Date(),
      },
    });

    logger.error('[INGEST] Pipeline failure', { ingestionId: ingestion.id, error: errorMsg });
    throw error;
  }

  return result;
}

/**
 * Parse a file buffer based on its type.
 */
async function parseFile(buffer: Buffer, fileType: IngestionFileType): Promise<ParsedRow[]> {
  switch (fileType) {
    case 'csv':
      return parseCSV(buffer.toString('utf-8'));
    case 'json':
      return parseJSON(buffer);
    case 'xlsx':
    case 'xls':
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return parseExcelRow(buffer as any);
    default:
      throw new Error(`Unsupported file type: ${fileType}`);
  }
}

/**
 * Process a batch of rows: extract entities, deduplicate, store.
 * Uses batched DB operations to reduce round-trips.
 */
async function processBatch(
  batchRows: ParsedRow[],
  batchOffset: number,
  columnMapping: ReturnType<typeof detectColumns>,
  ingestionId: string,
  result: IngestionResult,
  deduplicate: boolean,
): Promise<void> {
  // Phase 1: Extract all entities from the batch first
  interface RowExtraction {
    rowNumber: number;
    rawData: string;
    organization?: ReturnType<typeof extractEntities>['organization'];
    person?: ReturnType<typeof extractEntities>['person'];
    extractionError?: string;
  }

  const extractions: RowExtraction[] = [];
  const domainBatch: string[] = [];
  const emailBatch: string[] = [];

  for (let i = 0; i < batchRows.length; i++) {
    const row = batchRows[i];
    const rowNumber = batchOffset + i + 1;
    try {
      const entities = extractEntities(row, columnMapping);
      if (entities.organization?.domain) domainBatch.push(entities.organization.domain);
      if (entities.person?.email) emailBatch.push(entities.person.email);
      extractions.push({
        rowNumber,
        rawData: JSON.stringify(row),
        organization: entities.organization,
        person: entities.person,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Extraction error';
      extractions.push({
        rowNumber,
        rawData: JSON.stringify(row),
        extractionError: errorMsg,
      });
      result.failedRows++;
      result.errors.push({ row: rowNumber, error: errorMsg });
    }
  }

  // Phase 2: Batch dedup lookup — one query for domains, one for emails
  const domainSet = [...new Set(domainBatch.filter(Boolean))];
  const emailSet = [...new Set(emailBatch.filter(Boolean))];

  const [existingOrgs, existingPeople] = await Promise.all([
    domainSet.length > 0 && deduplicate
      ? db.organization.findMany({
          where: { domain: { in: domainSet } },
          select: { id: true, domain: true },
        })
      : Promise.resolve([]),
    emailSet.length > 0 && deduplicate
      ? db.person.findMany({
          where: { email: { in: emailSet } },
          select: { id: true, email: true },
        })
      : Promise.resolve([]),
  ]);

  const orgByDomain = new Map(existingOrgs.map((o) => [o.domain, o.id]));
  const personByEmail = new Map(existingPeople.map((p) => [p.email, p.id]));

  // Phase 3: Create entities and ingestion rows in a loop (SQLite doesn't support createMany)
  for (const ext of extractions) {
    if (ext.extractionError) {
      // Store failed row
      await db.dataIngestionRow.create({
        data: {
          ingestionId,
          rawData: ext.rawData,
          rowNumber: ext.rowNumber,
          status: 'failed',
          error: ext.extractionError,
        },
      });
      continue;
    }

    let orgId: string | undefined;

    try {
      // Create or find Organization
      if (ext.organization) {
        const existingOrgId = ext.organization.domain
          ? orgByDomain.get(ext.organization.domain)
          : undefined;

        if (existingOrgId) {
          orgId = existingOrgId;
        } else {
          const org = await db.organization.create({
            data: {
              name: ext.organization.name,
              domain: ext.organization.domain,
              industry: ext.organization.industry,
              description: ext.organization.description,
              website: ext.organization.domain ? `https://${ext.organization.domain}` : null,
              employeeCount: ext.organization.employeeCount,
              revenue: ext.organization.revenue,
              headquarters: ext.organization.headquarters,
              // FIX EI-4: Set source dynamically based on data richness
              // 'upload' = basic file import, 'external' = data has structured fields suggesting external source
              source:
                ext.organization.domain && ext.organization.industry && ext.organization.revenue
                  ? 'external'
                  : 'upload',
              sourceIngestionId: ingestionId,
            },
          });
          orgId = org.id;
          if (ext.organization.domain) orgByDomain.set(ext.organization.domain, org.id);
          result.organizationsCreated++;

          // Run entity resolution to flag potential duplicates (log-only, no auto-merge)
          try {
            const { resolveEntity } = await import('@/lib/intelligence/knowledge-graph');
            const matches = await resolveEntity({ name: ext.organization.name });
            const potentialDupes = matches.filter((m) => m.score >= 80 && m.nodeId !== org.id);
            if (potentialDupes.length > 0) {
              logger.warn('[INGEST] Potential duplicate organizations detected during ingestion', {
                newOrg: ext.organization.name,
                newOrgId: org.id,
                potentialDupes: potentialDupes.map((d) => ({
                  id: d.nodeId,
                  name: d.label,
                  score: d.score,
                  matchedFields: d.matchedFields,
                })),
                rowNumber: ext.rowNumber,
              });
            }
          } catch (erError) {
            logger.warn('[INGEST] Entity resolution check failed (non-blocking)', {
              error: erError instanceof Error ? erError.message : 'Unknown',
            });
          }
        }
      }

      // Create Person if extracted
      let personId: string | undefined;

      if (ext.person) {
        const existingPersonId = ext.person.email ? personByEmail.get(ext.person.email) : undefined;

        if (existingPersonId) {
          personId = existingPersonId;
        } else {
          const person = await db.person.create({
            data: {
              fullName: ext.person.fullName,
              email: ext.person.email,
              title: ext.person.title,
              department: ext.person.department,
              organizationId: orgId,
              source: 'upload',
              sourceIngestionId: ingestionId,
            },
          });
          personId = person.id;
          if (ext.person.email) personByEmail.set(ext.person.email, person.id);
          result.peopleCreated++;
        }
      }

      // Store the ingestion row
      await db.dataIngestionRow.create({
        data: {
          ingestionId,
          rawData: ext.rawData,
          rowNumber: ext.rowNumber,
          organizationId: orgId,
          personId,
          status: 'extracted',
        },
      });

      result.processedRows++;
    } catch (rowError) {
      const errorMsg = rowError instanceof Error ? rowError.message : 'Unknown store error';
      result.failedRows++;
      result.errors.push({ row: ext.rowNumber, error: errorMsg });

      await db.dataIngestionRow.create({
        data: {
          ingestionId,
          rawData: ext.rawData,
          rowNumber: ext.rowNumber,
          status: 'failed',
          error: errorMsg,
        },
      });
    }
  }
}

/**
 * Finalize ingestion record with final status and stats.
 */
async function finalizeIngestion(
  ingestionId: string,
  result: IngestionResult,
  startTime: number,
): Promise<void> {
  const durationMs = Date.now() - startTime;
  const status =
    result.failedRows === 0 ? 'completed' : result.processedRows > 0 ? 'partial' : 'failed';

  await db.dataIngestion.update({
    where: { id: ingestionId },
    data: {
      status,
      totalRows: result.totalRows,
      processedRows: result.processedRows,
      failedRows: result.failedRows,
      organizationsCreated: result.organizationsCreated,
      peopleCreated: result.peopleCreated,
      errorDetails: result.errors.length > 0 ? JSON.stringify(result.errors.slice(0, 100)) : null,
      completedAt: new Date(),
    },
  });

  logger.info('[INGEST] Finalized', { ingestionId, status, durationMs });
}

/**
 * Recover stuck ingestions — finds records with status='processing' and
 * completedAt=null where createdAt is older than 10 minutes, and resets
 * them to 'pending' so the cron can pick them up.
 *
 * This handles cases where the ingestion process crashed or the server
 * restarted mid-processing.
 *
 * Returns count of recovered records.
 */
export async function recoverStuckIngestions(): Promise<number> {
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  const stuck = await db.dataIngestion.findMany({
    where: {
      status: 'processing',
      completedAt: null,
      uploadedAt: { lt: tenMinutesAgo },
    },
    select: { id: true },
  });

  if (stuck.length === 0) return 0;

  for (const record of stuck) {
    try {
      await db.dataIngestion.update({
        where: { id: record.id },
        data: {
          status: 'pending',
          errorMessage: 'Reset from stuck processing state (timeout recovery)',
        },
      });
      logger.warn('[INGEST-RECOVERY] Reset stuck ingestion', { id: record.id });
    } catch (err) {
      logger.error('[INGEST-RECOVERY] Failed to reset stuck ingestion', {
        id: record.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  logger.info('[INGEST-RECOVERY] Recovered stuck ingestions', { count: stuck.length });
  return stuck.length;
}

/**
 * Process all pending ingestion jobs — used by cron job processor (#9).
 * Finds all 'pending' ingestions with a storedFilePath and processes them.
 * Also recovers any stuck 'processing' records older than 10 minutes.
 * Returns count of jobs processed.
 */
export async function processPendingIngestions(): Promise<{ processed: number; errors: number }> {
  // First recover any stuck ingestions
  const recovered = await recoverStuckIngestions();
  if (recovered > 0) {
    logger.info('[INGEST-CRON] Recovered stuck ingestions before processing', { recovered });
  }
  const pending = await db.dataIngestion.findMany({
    where: {
      status: 'pending',
      storedFilePath: { not: null },
    },
    orderBy: { uploadedAt: 'asc' },
    take: 5, // Process max 5 per cron tick to avoid overload
  });

  let processed = 0;
  let errors = 0;

  for (const ingestion of pending) {
    try {
      const { readFile: rf } = await import('fs/promises');
      const buffer = await rf(ingestion.storedFilePath!);
      await ingestFile(buffer, ingestion.fileName, ingestion.fileType, {
        existingIngestionId: ingestion.id,
        storedFilePath: ingestion.storedFilePath!,
        userId: ingestion.uploadedBy ?? undefined,
      });
      processed++;
    } catch (err) {
      logger.error('[INGEST-CRON] Failed to process pending ingestion', {
        id: ingestion.id,
        error: err instanceof Error ? err.message : String(err),
      });
      errors++;
    }
  }

  logger.info('[INGEST-CRON] Batch complete', { total: pending.length, processed, errors });
  return { processed, errors };
}
