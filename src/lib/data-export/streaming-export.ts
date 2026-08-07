/**
 * Streaming Export Engine — Task 4.6: Bulk Import/Export Pipeline
 *
 * Production-grade streaming export for Companies, Contacts, Opportunities (Pursuit/OpportunityRecommendation),
 * and Signals (CompanySignal) as CSV, JSON, or Excel.
 *
 * Features:
 * - Node.js streams for memory-efficient export (handles 100K+ rows)
 * - Field selection (user chooses which columns to export)
 * - Filtering (export only companies with tier=HOT, status=active, etc.)
 * - Progress tracking: records exported, total, percentage, duration
 * - Export result stored as downloadable artifact (DataExport model)
 * - Async export for large datasets: starts background job, returns export ID
 */

import { pipeline as streamPipeline, Readable, PassThrough } from 'stream';
import { promisify } from 'util';
import { createWriteStream, mkdirSync, existsSync, unlinkSync, statSync } from 'fs';
import { join } from 'path';
import { db } from '@/lib/db';
import { logger } from '@/lib/logger';
import { logAction } from '@/lib/audit';
import { createCsvFormatterStream, getCsvBom, getCsvContentType, getCsvExtension } from './formatters/csv-formatter';
import { createJsonFormatterStream, getJsonContentType, getJsonExtension } from './formatters/json-formatter';
import { createXlsxFormatterStream, getXlsxContentType, getXlsxExtension } from './formatters/xlsx-formatter';
import type { CsvFormatterOptions } from './formatters/csv-formatter';
import type { JsonFormatterOptions } from './formatters/json-formatter';
import type { XlsxFormatterOptions } from './formatters/xlsx-formatter';

const pipeline = promisify(streamPipeline);

// ─── Constants ──────────────────────────────────────────────

const EXPORT_DIR = join(process.cwd(), 'db', 'exports');
const BATCH_SIZE = 500; // Rows fetched per DB query batch
const STREAM_THRESHOLD = 1000; // Use streaming for datasets above this size

// Ensure export directory exists
if (!existsSync(EXPORT_DIR)) {
  mkdirSync(EXPORT_DIR, { recursive: true });
}

// ─── Types ──────────────────────────────────────────────────

export type ExportFormat = 'csv' | 'json' | 'xlsx';
export type ExportEntityType = 'companies' | 'contacts' | 'opportunities' | 'signals';

export interface ExportFilter {
  status?: string | string[];
  priorityTier?: string | string[];
  industry?: string | string[];
  country?: string | string[];
  source?: string | string[];
  signalType?: string | string[];
  createdAtAfter?: string;
  createdAtBefore?: string;
  assignedTo?: string;
  tags?: string[];
  [key: string]: unknown; // Allow arbitrary filter keys
}

export interface ExportProgress {
  exportId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  totalRows: number;
  exportedRows: number;
  percentage: number;
  durationMs: number;
  startedAt: string | null;
  completedAt: string | null;
  errorMessage: string | null;
}

export interface CreateExportRequest {
  format: ExportFormat;
  entityType: ExportEntityType;
  filters?: ExportFilter;
  fields?: string[];
}

// ─── Field Definitions per Entity ───────────────────────────

const ENTITY_FIELDS: Record<ExportEntityType, string[]> = {
  companies: [
    'id', 'rawName', 'normalizedName', 'domain', 'industry', 'sizeRange',
    'location', 'country', 'website', 'internalSummary', 'tags', 'status',
    'lifecycleStage', 'assignedTo', 'intelligenceScore', 'engagementScore',
    'accountPriorityScore', 'priorityTier', 'lastEnrichedAt', 'lastActivityAt',
    'source', 'createdAt', 'updatedAt',
  ],
  contacts: [
    'id', 'rawName', 'normalizedName', 'editedName', 'email', 'linkedinUrl',
    'title', 'role', 'phone', 'location', 'companyId', 'consentStatus',
    'emailHealth', 'emailHealthScore', 'status', 'leadScore', 'isSuppressed',
    'companyFitScore', 'engagementScore', 'enrichmentScore', 'aiConversionScore',
    'assignedTo', 'source', 'createdAt', 'updatedAt',
  ],
  opportunities: [
    'id', 'companyId', 'signalId', 'capabilityMatchId', 'opportunityTitle',
    'businessTrigger', 'whyNow', 'businessProblem', 'recommendedCapability',
    'recommendedStakeholders', 'suggestedConversation', 'confidenceScore',
    'freshnessScore', 'matchScore', 'opportunityScore', 'priority', 'status',
    'rejectionReason', 'reviewedBy', 'createdAt', 'updatedAt',
  ],
  signals: [
    'id', 'companyId', 'signalType', 'title', 'description', 'source',
    'sourceUrl', 'severity', 'impact', 'signalDate', 'extractedAt',
    'confidence', 'opportunityType', 'publicationDate', 'deadline',
    'buyingArea', 'techRequirement', 'serviceRequirement', 'sourceQuality',
    'meaningCategory', 'createdAt',
  ],
};

// ─── Main Export Function ──────────────────────────────────

/**
 * Create a new export job and start processing.
 * For small datasets (< STREAM_THRESHOLD), processes synchronously.
 * For large datasets, starts async processing and returns immediately.
 *
 * @param request - Export configuration
 * @param userId - User initiating the export
 * @returns The created DataExport record
 */
export async function createExportJob(
  request: CreateExportRequest,
  userId?: string,
): Promise<import('@prisma/client').DataExport> {
  // Validate inputs
  validateExportRequest(request);

  // Resolve fields
  const fields = request.fields && request.fields.length > 0
    ? request.fields.filter((f) => ENTITY_FIELDS[request.entityType].includes(f))
    : ENTITY_FIELDS[request.entityType];

  // Count total matching rows
  const totalRows = await countExportRows(request.entityType, request.filters ?? {});

  // Create DataExport record
  const exportRecord = await db.dataExport.create({
    data: {
      format: request.format,
      entityType: request.entityType,
      filters: request.filters ? JSON.parse(JSON.stringify(request.filters)) : undefined,
      fields: fields as unknown as object,
      status: 'pending',
      totalRows,
      exportedRows: 0,
      createdBy: userId,
    },
  });

  // For small datasets, process synchronously
  if (totalRows <= STREAM_THRESHOLD) {
    await processExport(exportRecord.id, fields, userId).catch(async (err) => {
      const errorMsg = err instanceof Error ? err.message : 'Unknown export error';
      await db.dataExport.update({
        where: { id: exportRecord.id },
        data: { status: 'failed', errorMessage: errorMsg, completedAt: new Date() },
      });
    });

    // Fetch and return updated record
    return db.dataExport.findUniqueOrThrow({ where: { id: exportRecord.id } });
  }

  // For large datasets, start async processing (fire-and-forget)
  processExport(exportRecord.id, fields, userId).catch(async (err) => {
    const errorMsg = err instanceof Error ? err.message : 'Unknown export error';
    await db.dataExport.update({
      where: { id: exportRecord.id },
      data: { status: 'failed', errorMessage: errorMsg, completedAt: new Date() },
    });
    logger.error('[Export] Async export failed', { exportId: exportRecord.id, error: errorMsg });
  });

  return exportRecord;
}

/**
 * Process an export job: stream data from DB → formatter → file.
 */
async function processExport(
  exportId: string,
  fields: string[],
  userId?: string,
): Promise<void> {
  const startedAt = new Date();

  // Mark as processing
  const exportRecord = await db.dataExport.update({
    where: { id: exportId },
    data: { status: 'processing', startedAt },
  });

  const filePath = join(EXPORT_DIR, `${exportId}${getExtension(exportRecord.format as ExportFormat)}`);
  let exportedRows = 0;

  try {
    // Create file write stream
    const fileStream = createWriteStream(filePath);

    // Get the formatter stream
    const formatterStream = createFormatterStream(
      exportRecord.format as ExportFormat,
      fields,
    );

    // Add BOM for CSV
    if (exportRecord.format === 'csv') {
      fileStream.write(getCsvBom());
    }

    // Create cursor-based readable stream from DB
    const dbStream = createDbStream(
      exportRecord.entityType as ExportEntityType,
      exportRecord.filters as ExportFilter | null,
      fields,
    );

    // Track progress
    const progressTracker = new PassThrough({ objectMode: true });
    progressTracker.on('data', () => {
      exportedRows++;
    });

    // Pipeline: DB → progress counter → formatter → file
    await pipeline(
      dbStream,
      progressTracker,
      formatterStream,
      fileStream,
    );

    // Get file size
    let fileSize: number | null = null;
    try {
      fileSize = statSync(filePath).size;
    } catch {
      // File may have been deleted
    }

    const completedAt = new Date();
    const durationMs = completedAt.getTime() - startedAt.getTime();

    // Update record as completed
    await db.dataExport.update({
      where: { id: exportId },
      data: {
        status: 'completed',
        exportedRows,
        fileSize,
        filePath,
        completedAt,
      },
    });

    // Audit log
    logAction(
      'export',
      exportRecord.entityType,
      exportId,
      {
        format: exportRecord.format,
        totalRows: exportRecord.totalRows,
        exportedRows,
        fileSize,
        durationMs,
      },
      userId,
    ).catch(() => {});

    logger.info('[Export] Export completed', {
      exportId,
      entityType: exportRecord.entityType,
      format: exportRecord.format,
      totalRows: exportRecord.totalRows,
      exportedRows,
      durationMs,
    });
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : 'Unknown export error';

    // Clean up partial file
    try { unlinkSync(filePath); } catch { /* ignore */ }

    await db.dataExport.update({
      where: { id: exportId },
      data: { status: 'failed', errorMessage: errorMsg, completedAt: new Date() },
    });

    throw err;
  }
}

// ─── DB Stream (Cursor-based pagination) ────────────────────

/**
 * Creates an object-mode Readable stream that fetches rows from the DB
 * in batches using cursor-based pagination. Memory-efficient for 100K+ rows.
 */
function createDbStream(
  entityType: ExportEntityType,
  filters: ExportFilter | null,
  fields: string[],
): Readable {
  let cursor: string | null = null;
  let exhausted = false;

  return new Readable({
    objectMode: true,
    read() {
      if (exhausted) {
        this.push(null);
        return;
      }

      fetchBatch(entityType, filters, fields, cursor, BATCH_SIZE)
        .then((rows) => {
          if (rows.length === 0) {
            exhausted = true;
            this.push(null);
            return;
          }

          for (const row of rows) {
            this.push(row);
          }

          // Set cursor for next batch (use last row's id)
          const lastRow = rows[rows.length - 1];
          cursor = (lastRow as Record<string, unknown>).id as string;
        })
        .catch((err) => {
          logger.error('[Export] DB stream fetch error', { error: err.message });
          this.destroy(err);
        });
    },
  });
}

/**
 * Fetch a batch of rows for export.
 */
async function fetchBatch(
  entityType: ExportEntityType,
  filters: ExportFilter | null,
  fields: string[],
  cursor: string | null,
  batchSize: number,
): Promise<Record<string, unknown>[]> {
  const whereClause = buildWhereClause(entityType, filters);

  // Add cursor condition for pagination
  if (cursor) {
    whereClause.id = { gt: cursor };
  }

  // Select only requested fields plus id for cursor pagination
  const selectFields: Record<string, boolean> = { id: true };
  for (const field of fields) {
    selectFields[field] = true;
  }

  switch (entityType) {
    case 'companies': {
      const rows = await db.company.findMany({
        where: whereClause,
        select: selectFields,
        orderBy: { id: 'asc' },
        take: batchSize,
      });
      return rows.map(flattenRow);
    }

    case 'contacts': {
      const rows = await db.contact.findMany({
        where: whereClause,
        select: selectFields,
        orderBy: { id: 'asc' },
        take: batchSize,
      });
      return rows.map(flattenRow);
    }

    case 'opportunities': {
      const rows = await db.opportunityRecommendation.findMany({
        where: whereClause,
        select: selectFields,
        orderBy: { id: 'asc' },
        take: batchSize,
      });
      return rows.map(flattenRow);
    }

    case 'signals': {
      const rows = await db.companySignal.findMany({
        where: whereClause,
        select: selectFields,
        orderBy: { id: 'asc' },
        take: batchSize,
      });
      return rows.map(flattenRow);
    }

    default:
      return [];
  }
}

/**
 * Build a Prisma `where` clause from export filters.
 */
function buildWhereClause(
  entityType: ExportEntityType,
  filters: ExportFilter | null,
): Record<string, unknown> {
  if (!filters) return {};

  const where: Record<string, unknown> = {};

  if (filters.status) {
    where.status = Array.isArray(filters.status) ? { in: filters.status } : filters.status;
  }

  if (filters.priorityTier && entityType === 'companies') {
    where.priorityTier = Array.isArray(filters.priorityTier)
      ? { in: filters.priorityTier }
      : filters.priorityTier;
  }

  if (filters.industry) {
    where.industry = Array.isArray(filters.industry) ? { in: filters.industry } : filters.industry;
  }

  if (filters.country) {
    where.country = Array.isArray(filters.country) ? { in: filters.country } : filters.country;
  }

  if (filters.source) {
    where.source = Array.isArray(filters.source) ? { in: filters.source } : filters.source;
  }

  if (filters.signalType && entityType === 'signals') {
    where.signalType = Array.isArray(filters.signalType)
      ? { in: filters.signalType }
      : filters.signalType;
  }

  if (filters.assignedTo) {
    where.assignedTo = filters.assignedTo;
  }

  if (filters.createdAtAfter) {
    where.createdAt = { ...(where.createdAt as Record<string, unknown> ?? {}), gte: new Date(filters.createdAtAfter) };
  }

  if (filters.createdAtBefore) {
    where.createdAt = { ...(where.createdAt as Record<string, unknown> ?? {}), lte: new Date(filters.createdAtBefore) };
  }

  return where;
}

// ─── Formatter Stream Factory ───────────────────────────────

/**
 * Create the appropriate formatter stream based on export format.
 */
function createFormatterStream(
  format: ExportFormat,
  fields: string[],
): NodeJS.ReadWriteStream {
  switch (format) {
    case 'csv':
      return createCsvFormatterStream(fields);
    case 'json':
      return createJsonFormatterStream({ indent: 2 });
    case 'xlsx':
      return createXlsxFormatterStream(fields);
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

// ─── Export Listing & Details ───────────────────────────────

/**
 * List export jobs with pagination and optional status filter.
 */
export async function listExports(
  page = 1,
  limit = 20,
  status?: string,
): Promise<{ items: import('@prisma/client').DataExport[]; total: number }> {
  const where: Record<string, unknown> = {};
  if (status) {
    where.status = status;
  }

  const [items, total] = await Promise.all([
    db.dataExport.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.dataExport.count({ where }),
  ]);

  return { items, total };
}

/**
 * Get a single export job by ID.
 */
export async function getExport(exportId: string): Promise<import('@prisma/client').DataExport | null> {
  return db.dataExport.findUnique({ where: { id: exportId } });
}

/**
 * Get the progress of an export job.
 */
export async function getExportProgress(exportId: string): Promise<ExportProgress | null> {
  const exp = await db.dataExport.findUnique({ where: { id: exportId } });
  if (!exp) return null;

  const startedAt = exp.startedAt ? exp.startedAt.getTime() : 0;
  const completedAt = exp.completedAt ? exp.completedAt.getTime() : Date.now();
  const durationMs = exp.completedAt && exp.startedAt
    ? exp.completedAt.getTime() - exp.startedAt.getTime()
    : exp.startedAt
      ? Date.now() - exp.startedAt.getTime()
      : 0;

  const percentage = exp.totalRows > 0
    ? Math.round((exp.exportedRows / exp.totalRows) * 100)
    : 0;

  return {
    exportId: exp.id,
    status: exp.status as ExportProgress['status'],
    totalRows: exp.totalRows,
    exportedRows: exp.exportedRows,
    percentage,
    durationMs,
    startedAt: exp.startedAt?.toISOString() ?? null,
    completedAt: exp.completedAt?.toISOString() ?? null,
    errorMessage: exp.errorMessage,
  };
}

/**
 * Cancel or delete an export job.
 */
export async function cancelExport(exportId: string): Promise<boolean> {
  const exp = await db.dataExport.findUnique({ where: { id: exportId } });
  if (!exp) return false;

  // Can only cancel pending or processing exports
  if (exp.status !== 'pending' && exp.status !== 'processing') {
    return false;
  }

  // Delete file if exists
  if (exp.filePath) {
    try { unlinkSync(exp.filePath); } catch { /* ignore */ }
  }

  await db.dataExport.update({
    where: { id: exportId },
    data: { status: 'cancelled', completedAt: new Date() },
  });

  return true;
}

/**
 * Delete an export job and its file.
 */
export async function deleteExport(exportId: string): Promise<boolean> {
  const exp = await db.dataExport.findUnique({ where: { id: exportId } });
  if (!exp) return false;

  // Delete file if exists
  if (exp.filePath) {
    try { unlinkSync(exp.filePath); } catch { /* ignore */ }
  }

  await db.dataExport.delete({ where: { id: exportId } });
  return true;
}

/**
 * Get the available fields for an entity type.
 */
export function getAvailableFields(entityType: ExportEntityType): string[] {
  return ENTITY_FIELDS[entityType] ?? [];
}

// ─── Row Counting ───────────────────────────────────────────

/**
 * Count total rows matching the given filters for an entity type.
 */
async function countExportRows(
  entityType: ExportEntityType,
  filters: ExportFilter,
): Promise<number> {
  const where = buildWhereClause(entityType, filters);

  switch (entityType) {
    case 'companies':
      return db.company.count({ where });
    case 'contacts':
      return db.contact.count({ where });
    case 'opportunities':
      return db.opportunityRecommendation.count({ where });
    case 'signals':
      return db.companySignal.count({ where });
    default:
      return 0;
  }
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Flatten a Prisma row object, converting nested objects and dates to strings.
 */
function flattenRow(row: Record<string, unknown>): Record<string, unknown> {
  const flat: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) {
      flat[key] = value.toISOString();
    } else if (value === null || value === undefined) {
      flat[key] = '';
    } else if (typeof value === 'object') {
      // JSON-serialize complex objects (arrays, nested objects)
      flat[key] = JSON.stringify(value);
    } else {
      flat[key] = value;
    }
  }
  return flat;
}

/**
 * Validate an export request.
 */
function validateExportRequest(request: CreateExportRequest): void {
  const validFormats: ExportFormat[] = ['csv', 'json', 'xlsx'];
  if (!validFormats.includes(request.format)) {
    throw new Error(`Invalid format: ${request.format}. Must be one of: ${validFormats.join(', ')}`);
  }

  const validEntities: ExportEntityType[] = ['companies', 'contacts', 'opportunities', 'signals'];
  if (!validEntities.includes(request.entityType)) {
    throw new Error(`Invalid entityType: ${request.entityType}. Must be one of: ${validEntities.join(', ')}`);
  }

  // Validate requested fields against entity fields
  if (request.fields && request.fields.length > 0) {
    const entityFields = ENTITY_FIELDS[request.entityType];
    const invalidFields = request.fields.filter((f) => !entityFields.includes(f));
    if (invalidFields.length > 0) {
      throw new Error(`Invalid fields for ${request.entityType}: ${invalidFields.join(', ')}`);
    }
  }
}

/**
 * Get the file extension for a given format.
 */
function getExtension(format: ExportFormat): string {
  switch (format) {
    case 'csv': return getCsvExtension();
    case 'json': return getJsonExtension();
    case 'xlsx': return getXlsxExtension();
  }
}

/**
 * Get the Content-Type for a given format.
 */
export function getContentType(format: ExportFormat): string {
  switch (format) {
    case 'csv': return getCsvContentType();
    case 'json': return getJsonContentType();
    case 'xlsx': return getXlsxContentType();
  }
}
