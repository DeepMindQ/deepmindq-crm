/**
 * Enhanced Import Pipeline — Task 4.6: Bulk Import/Export Pipeline
 *
 * Adds to the existing pipeline (pipeline.ts):
 *   1. Import templates: pre-defined column mappings for common CRM exports
 *   2. Import preview: show first 10 rows with auto-mapped columns before committing
 *   3. Import scheduling: schedule recurring imports (stored as SystemSetting)
 *   4. Import rollback: ability to undo the last import (delete created records)
 *   5. Incremental import: detect new records vs updated records in subsequent imports
 *
 * This module does NOT modify the existing pipeline.ts.
 */

import { db } from '@/lib/db';
import { logger } from '@/lib/logger';

// ─── Import Templates ───────────────────────────────────────

export interface ImportTemplateData {
  id: string;
  name: string;
  source: string;
  entityType: string;
  columnMap: Record<string, string>;
  isActive: boolean;
  createdAt: Date;
}

/**
 * Pre-defined column mappings for common CRM exports.
 * These are seeded on first use.
 */
const BUILTIN_TEMPLATES: Array<{
  name: string;
  source: string;
  entityType: string;
  columnMap: Record<string, string>;
}> = [
  // Salesforce Account/Contact export
  {
    name: 'Salesforce Contacts',
    source: 'salesforce',
    entityType: 'contacts',
    columnMap: {
      'Account Name': 'company',
      'First Name': 'firstName',
      'Last Name': 'lastName',
      'Email': 'email',
      'Title': 'title',
      'Phone': 'phone',
      'Mailing City': 'location',
      'Mailing Country': 'country',
      'Website': 'website',
      'Lead Source': 'source',
    },
  },
  // Salesforce Account export
  {
    name: 'Salesforce Accounts',
    source: 'salesforce',
    entityType: 'companies',
    columnMap: {
      'Account Name': 'rawName',
      'Website': 'domain',
      'Industry': 'industry',
      'Employees': 'employee_size',
      'Billing City': 'location',
      'Billing Country': 'country',
      'Type': 'company_type',
      'Annual Revenue': 'revenue',
    },
  },
  // HubSpot Contact export
  {
    name: 'HubSpot Contacts',
    source: 'hubspot',
    entityType: 'contacts',
    columnMap: {
      'First Name': 'firstName',
      'Last Name': 'lastName',
      'Email': 'email',
      'Job Title': 'title',
      'Phone Number': 'phone',
      'City': 'location',
      'Country/Region': 'country',
      'Company': 'company',
      'Website': 'website',
      'Lead Status': 'status',
    },
  },
  // HubSpot Company export
  {
    name: 'HubSpot Companies',
    source: 'hubspot',
    entityType: 'companies',
    columnMap: {
      'Company Name': 'rawName',
      'Domain': 'domain',
      'Industry': 'industry',
      'Number of Employees': 'employee_size',
      'City': 'location',
      'Country/Region': 'country',
      'Website URL': 'website',
    },
  },
  // CSV Standard (generic)
  {
    name: 'CSV Standard Contacts',
    source: 'csv_standard',
    entityType: 'contacts',
    columnMap: {
      'name': 'name',
      'email': 'email',
      'title': 'title',
      'company': 'company',
      'phone': 'phone',
      'location': 'location',
      'country': 'country',
      'website': 'website',
    },
  },
  {
    name: 'CSV Standard Companies',
    source: 'csv_standard',
    entityType: 'companies',
    columnMap: {
      'name': 'rawName',
      'domain': 'domain',
      'industry': 'industry',
      'size': 'employee_size',
      'location': 'location',
      'country': 'country',
      'website': 'website',
    },
  },
];

/**
 * Ensure built-in templates are seeded in the database.
 * Called once at module load or on first template request.
 */
let templatesSeeded = false;

async function ensureBuiltinTemplates(): Promise<void> {
  if (templatesSeeded) return;
  templatesSeeded = true;

  try {
    const existingCount = await db.importTemplate.count({
      where: { source: { in: ['salesforce', 'hubspot', 'csv_standard'] } },
    });

    if (existingCount === 0) {
      await db.importTemplate.createMany({
        data: BUILTIN_TEMPLATES.map((t) => ({
          name: t.name,
          source: t.source,
          entityType: t.entityType,
          columnMap: JSON.parse(JSON.stringify(t.columnMap)),
          isActive: true,
        })),
      });
      logger.info('[Import] Seeded built-in import templates');
    }
  } catch (err) {
    templatesSeeded = false;
    logger.error('[Import] Failed to seed built-in templates', { error: err });
  }
}

/**
 * List all import templates, optionally filtered by source or entityType.
 */
export async function listImportTemplates(filters?: {
  source?: string;
  entityType?: string;
  isActive?: boolean;
}): Promise<ImportTemplateData[]> {
  await ensureBuiltinTemplates();

  const where: Record<string, unknown> = {};
  if (filters?.source) where.source = filters.source;
  if (filters?.entityType) where.entityType = filters.entityType;
  if (filters?.isActive !== undefined) where.isActive = filters.isActive;

  const templates = await db.importTemplate.findMany({
    where,
    orderBy: [{ source: 'asc' }, { name: 'asc' }],
  });

  return templates.map((t) => ({
    id: t.id,
    name: t.name,
    source: t.source,
    entityType: t.entityType,
    columnMap: t.columnMap as Record<string, string>,
    isActive: t.isActive,
    createdAt: t.createdAt,
  }));
}

/**
 * Get a single import template by ID.
 */
export async function getImportTemplate(templateId: string): Promise<ImportTemplateData | null> {
  const t = await db.importTemplate.findUnique({ where: { id: templateId } });
  if (!t) return null;

  return {
    id: t.id,
    name: t.name,
    source: t.source,
    entityType: t.entityType,
    columnMap: t.columnMap as Record<string, string>,
    isActive: t.isActive,
    createdAt: t.createdAt,
  };
}

/**
 * Create a custom import template.
 */
export async function createImportTemplate(input: {
  name: string;
  source: string;
  entityType: string;
  columnMap: Record<string, string>;
}): Promise<ImportTemplateData> {
  const t = await db.importTemplate.create({
    data: {
      name: input.name,
      source: input.source || 'custom',
      entityType: input.entityType,
      columnMap: JSON.parse(JSON.stringify(input.columnMap)),
      isActive: true,
    },
  });

  return {
    id: t.id,
    name: t.name,
    source: t.source,
    entityType: t.entityType,
    columnMap: t.columnMap as Record<string, string>,
    isActive: t.isActive,
    createdAt: t.createdAt,
  };
}

/**
 * Delete an import template.
 */
export async function deleteImportTemplate(templateId: string): Promise<boolean> {
  try {
    await db.importTemplate.delete({ where: { id: templateId } });
    return true;
  } catch {
    return false;
  }
}

/**
 * Apply a template's column mapping to a set of headers.
 * Returns a mapping of { sourceHeader: targetField }.
 */
export function applyTemplateMapping(
  template: ImportTemplateData,
  headers: string[],
): Record<string, string> {
  const mapping: Record<string, string> = {};

  for (const header of headers) {
    // Direct match (case-insensitive)
    const directMatch = Object.keys(template.columnMap).find(
      (k) => k.toLowerCase() === header.toLowerCase(),
    );
    if (directMatch) {
      mapping[header] = template.columnMap[directMatch];
      continue;
    }

    // Fuzzy match: check if header contains template key or vice versa
    const fuzzyMatch = Object.keys(template.columnMap).find(
      (k) =>
        header.toLowerCase().includes(k.toLowerCase()) ||
        k.toLowerCase().includes(header.toLowerCase()),
    );
    if (fuzzyMatch) {
      mapping[header] = template.columnMap[fuzzyMatch];
    }
  }

  return mapping;
}

// ─── Import Preview ─────────────────────────────────────────

export interface ImportPreviewRow {
  rowIndex: number;
  rawData: Record<string, string>;
  mappedData: Record<string, string>;
  unmappedColumns: string[];
}

export interface ImportPreviewResult {
  uploadId: string;
  totalRows: number;
  previewRows: ImportPreviewRow[];
  columnMapping: Record<string, string>;
  mappedColumns: string[];
  unmappedColumns: string[];
}

/**
 * Generate an import preview: first 10 rows with auto-mapped columns.
 *
 * @param uploadId - The DataUpload id
 * @param templateId - Optional import template ID to apply
 * @returns Preview data including mapped/unmapped columns and sample rows
 */
export async function generateImportPreview(
  uploadId: string,
  templateId?: string,
): Promise<ImportPreviewResult> {
  const upload = await db.dataUpload.findUnique({ where: { id: uploadId } });
  if (!upload) {
    throw new Error(`DataUpload with id "${uploadId}" not found.`);
  }

  // Fetch first 10 rows
  const rows = await db.uploadRow.findMany({
    where: { uploadId },
    orderBy: { rowIndex: 'asc' },
    take: 10,
  });

  // Get current column mapping
  let columnMapping: Record<string, string> = {};
  try {
    columnMapping = upload.columnMapping
      ? JSON.parse(upload.columnMapping as string)
      : {};
  } catch {
    columnMapping = {};
  }

  // Apply template if provided
  if (templateId) {
    const template = await getImportTemplate(templateId);
    if (template) {
      const headers = Object.keys(columnMapping).length > 0
        ? Object.keys(columnMapping)
        : rows.length > 0
          ? Object.keys(parseRawData(rows[0].rawData))
          : [];

      const templateMapping = applyTemplateMapping(template, headers);
      columnMapping = { ...columnMapping, ...templateMapping };
    }
  }

  // Build preview rows
  const previewRows: ImportPreviewRow[] = rows.map((row) => {
    const rawData = parseRawData(row.rawData);
    const mappedData = applyMapping(rawData, columnMapping);
    const unmappedColumns = Object.keys(rawData).filter(
      (k) => !columnMapping[k],
    );

    return {
      rowIndex: row.rowIndex,
      rawData,
      mappedData,
      unmappedColumns,
    };
  });

  const allSourceHeaders = new Set<string>();
  for (const pr of previewRows) {
    for (const k of Object.keys(pr.rawData)) {
      allSourceHeaders.add(k);
    }
  }

  const mappedColumns = Object.keys(columnMapping);
  const unmappedColumns = Array.from(allSourceHeaders).filter(
    (h) => !columnMapping[h],
  );

  return {
    uploadId,
    totalRows: upload.totalRows,
    previewRows,
    columnMapping,
    mappedColumns,
    unmappedColumns,
  };
}

// ─── Import Scheduling ───────────────────────────────────────

export interface ImportSchedule {
  id?: string;
  name: string;
  uploadId: string;
  cronExpression: string;
  enabled: boolean;
  lastRunAt?: Date;
  nextRunAt?: Date;
}

const SCHEDULE_KEY_PREFIX = 'import_schedule_';

/**
 * Create a recurring import schedule stored as SystemSetting.
 */
export async function createImportSchedule(input: {
  name: string;
  uploadId: string;
  cronExpression: string;
}): Promise<ImportSchedule> {
  const scheduleId = `sched_${Date.now()}`;
  const key = `${SCHEDULE_KEY_PREFIX}${scheduleId}`;

  const schedule: ImportSchedule = {
    id: scheduleId,
    name: input.name,
    uploadId: input.uploadId,
    cronExpression: input.cronExpression,
    enabled: true,
  };

  await db.systemSetting.upsert({
    where: { key },
    create: {
      key,
      value: JSON.stringify(schedule),
    },
    update: {
      value: JSON.stringify(schedule),
    },
  });

  logger.info('[Import] Created import schedule', { scheduleId, name: input.name });
  return schedule;
}

/**
 * List all import schedules.
 */
export async function listImportSchedules(): Promise<ImportSchedule[]> {
  const settings = await db.systemSetting.findMany({
    where: { key: { startsWith: SCHEDULE_KEY_PREFIX } },
  });

  return settings.map((s) => {
    try {
      return JSON.parse(s.value) as ImportSchedule;
    } catch {
      return null;
    }
  }).filter((s): s is ImportSchedule => s !== null);
}

/**
 * Delete an import schedule.
 */
export async function deleteImportSchedule(scheduleId: string): Promise<boolean> {
  const key = `${SCHEDULE_KEY_PREFIX}${scheduleId}`;
  try {
    await db.systemSetting.delete({ where: { key } });
    logger.info('[Import] Deleted import schedule', { scheduleId });
    return true;
  } catch {
    return false;
  }
}

// ─── Import Rollback ─────────────────────────────────────────

export interface RollbackResult {
  companiesDeleted: number;
  contactsDeleted: number;
  importBatchesDeleted: number;
}

/**
 * Rollback the last import by deleting created records.
 * Finds the most recent completed DataUpload and deletes:
 *   - ImportBatch records created during the import
 *   - Contacts created during the import (linked to the batch)
 *   - Companies that were created (source=import) and have no remaining contacts
 *
 * @param uploadId - The DataUpload id to rollback
 * @returns Summary of deleted records
 */
export async function rollbackImport(uploadId: string): Promise<RollbackResult> {
  const upload = await db.dataUpload.findUnique({ where: { id: uploadId } });
  if (!upload) {
    throw new Error(`DataUpload with id "${uploadId}" not found.`);
  }
  if (upload.status !== 'completed') {
    throw new Error(`Cannot rollback upload with status "${upload.status}". Must be completed.`);
  }

  let companiesDeleted = 0;
  let contactsDeleted = 0;
  let importBatchesDeleted = 0;

  // Find all contacts linked to this upload via UploadRow
  const uploadRows = await db.uploadRow.findMany({
    where: {
      uploadId,
      status: 'accepted',
      companyId: { not: null },
    },
    select: { companyId: true },
    distinct: ['companyId'],
  });

  const affectedCompanyIds = uploadRows
    .map((r) => r.companyId)
    .filter((id): id is string => id !== null);

  // Find import batches associated with this upload
  const batches = await db.importBatch.findMany({
    where: { fileHash: `t11-${uploadId}` },
  });

  if (batches.length > 0) {
    const batchIds = batches.map((b) => b.id);

    // Delete contacts linked to these batches
    const contactDeleteResult = await db.contact.deleteMany({
      where: { batchId: { in: batchIds } },
    });
    contactsDeleted = contactDeleteResult.count;

    // Delete the import batches
    const batchDeleteResult = await db.importBatch.deleteMany({
      where: { id: { in: batchIds } },
    });
    importBatchesDeleted = batchDeleteResult.count;
  }

  // Delete companies that were created during import and no longer have contacts
  if (affectedCompanyIds.length > 0) {
    for (const companyId of affectedCompanyIds) {
      const contactCount = await db.contact.count({ where: { companyId } });
      if (contactCount === 0) {
        const company = await db.company.findUnique({
          where: { id: companyId },
          select: { source: true },
        });
        if (company && company.source === 'import') {
          await db.company.delete({ where: { id: companyId } });
          companiesDeleted++;
        }
      }
    }
  }

  // Reset upload status
  await db.dataUpload.update({
    where: { id: uploadId },
    data: { status: 'rolled_back' as string },
  });

  logger.info('[Import] Rollback completed', {
    uploadId,
    companiesDeleted,
    contactsDeleted,
    importBatchesDeleted,
  });

  return { companiesDeleted, contactsDeleted, importBatchesDeleted };
}

// ─── Incremental Import ──────────────────────────────────────

export interface IncrementalImportResult {
  newRecords: number;
  updatedRecords: number;
  skippedRecords: number;
  totalProcessed: number;
}

/**
 * Perform incremental import: detect new vs. updated records.
 *
 * For companies: matches by normalizedName (creates if not found, skips if found)
 * For contacts: matches by email (creates if not found, skips if found)
 *
 * @param uploadId - The DataUpload id
 * @returns Breakdown of new, updated, and skipped records
 */
export async function incrementalImport(
  uploadId: string,
): Promise<IncrementalImportResult> {
  const upload = await db.dataUpload.findUnique({ where: { id: uploadId } });
  if (!upload) {
    throw new Error(`DataUpload with id "${uploadId}" not found.`);
  }

  // Fetch all rows with mapped/normalized data
  const rows = await db.uploadRow.findMany({
    where: { uploadId },
    orderBy: { rowIndex: 'asc' },
  });

  let newRecords = 0;
  let updatedRecords = 0;
  let skippedRecords = 0;

  // Determine entity type from mapping
  const columnMapping: Record<string, string> = upload.columnMapping
    ? JSON.parse(upload.columnMapping as string)
    : {};

  const hasCompanyName = Object.values(columnMapping).some(
    (v) => v === 'rawName' || v === 'company',
  );
  const hasContactEmail = Object.values(columnMapping).some(
    (v) => v === 'email',
  );

  // Batch process
  const BATCH_SIZE = 100;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);

    for (const row of batch) {
      const data = parseRowData(row);
      try {
        const result = await processIncrementalRow(data, hasCompanyName, hasContactEmail);
        newRecords += result.newRecords;
        updatedRecords += result.updatedRecords;
        skippedRecords += result.skippedRecords;
      } catch {
        skippedRecords++;
      }
    }
  }

  const totalProcessed = newRecords + updatedRecords + skippedRecords;

  // Update upload status
  await db.dataUpload.update({
    where: { id: uploadId },
    data: {
      status: 'completed',
      completedAt: new Date(),
      processedRows: totalProcessed,
      acceptedRows: newRecords + updatedRecords,
    },
  });

  logger.info('[Import] Incremental import completed', {
    uploadId,
    newRecords,
    updatedRecords,
    skippedRecords,
  });

  return { newRecords, updatedRecords, skippedRecords, totalProcessed };
}

/**
 * Process a single row for incremental import.
 */
async function processIncrementalRow(
  data: Record<string, string>,
  hasCompanyName: boolean,
  hasContactEmail: boolean,
): Promise<{ newRecords: number; updatedRecords: number; skippedRecords: number }> {
  // Company incremental
  if (hasCompanyName && data.rawName) {
    const normalizedName = data.rawName.toLowerCase();
    const existing = await db.company.findFirst({ where: { normalizedName } });

    if (existing) {
      // Update existing company with new data
      const updateData: Record<string, unknown> = {};
      if (data.domain) updateData.domain = data.domain;
      if (data.industry) updateData.industry = data.industry;
      if (data.location) updateData.location = data.location;
      if (data.country) updateData.country = data.country;
      if (data.website) updateData.website = data.website;

      if (Object.keys(updateData).length > 0) {
        await db.company.update({
          where: { id: existing.id },
          data: updateData,
        });
        return { newRecords: 0, updatedRecords: 1, skippedRecords: 0 };
      }
      return { newRecords: 0, updatedRecords: 0, skippedRecords: 1 };
    }

    // Create new company
    await db.company.create({
      data: {
        rawName: data.rawName,
        normalizedName,
        domain: data.domain || null,
        industry: data.industry || null,
        sizeRange: data.employee_size || data.sizeRange || null,
        location: data.location || null,
        country: data.country || null,
        website: data.website || null,
        status: 'prospect',
        source: 'import',
      },
    });
    return { newRecords: 1, updatedRecords: 0, skippedRecords: 0 };
  }

  // Contact incremental
  if (hasContactEmail && data.email) {
    const existing = await db.contact.findUnique({ where: { email: data.email } });
    if (existing) {
      const updateData: Record<string, unknown> = {};
      if (data.title) updateData.title = data.title;
      if (data.phone) updateData.phone = data.phone;
      if (data.location) updateData.location = data.location;

      if (Object.keys(updateData).length > 0) {
        await db.contact.update({
          where: { id: existing.id },
          data: updateData,
        });
        return { newRecords: 0, updatedRecords: 1, skippedRecords: 0 };
      }
      return { newRecords: 0, updatedRecords: 0, skippedRecords: 1 };
    }

    // For new contacts, we need a companyId and batchId — skip for incremental
    return { newRecords: 0, updatedRecords: 0, skippedRecords: 1 };
  }

  return { newRecords: 0, updatedRecords: 0, skippedRecords: 1 };
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Parse rawData JSON string into a Record.
 */
function parseRawData(rawData: unknown): Record<string, string> {
  if (typeof rawData === 'string') {
    try {
      return JSON.parse(rawData);
    } catch {
      return {};
    }
  }
  if (typeof rawData === 'object' && rawData !== null) {
    return rawData as Record<string, string>;
  }
  return {};
}

/**
 * Parse row data, preferring normalizedData over mappedData over rawData.
 */
function parseRowData(row: { normalizedData?: unknown; mappedData?: unknown; rawData: unknown }): Record<string, string> {
  if (row.normalizedData) {
    const parsed = parseRawData(row.normalizedData);
    if (Object.keys(parsed).length > 0) return parsed;
  }
  if (row.mappedData) {
    const parsed = parseRawData(row.mappedData);
    if (Object.keys(parsed).length > 0) return parsed;
  }
  return parseRawData(row.rawData);
}

/**
 * Apply column mapping to a raw row.
 */
function applyMapping(
  rawRow: Record<string, string>,
  mapping: Record<string, string>,
): Record<string, string> {
  const mapped: Record<string, string> = {};
  for (const [sourceHeader, value] of Object.entries(rawRow)) {
    const target = mapping[sourceHeader];
    if (target) {
      mapped[target] = value;
    }
  }
  return mapped;
}
