/**
 * Data Intelligence Engine — Main Orchestrator
 *
 * Coordinates the full pipeline:
 * 1. analyze(headers) → column detection + mapping suggestion
 * 2. processChunk(uploadId, rows, mapping) → validate, normalize, dedup, score
 * 3. getReviewData(uploadId) → paginated review data
 * 4. applyCorrections(uploadId, corrections) → user-approved fixes
 * 5. commit(uploadId) → create Company + Contact records from accepted rows
 *
 * ALL business rules come from the database.
 * No hardcoded validation, normalization, or scoring logic.
 */

import { db } from '@/lib/db';
import { detectColumns, buildReverseMapping } from './column-detector';
import { validateRow, type ValidationIssue } from './validator';
import { normalizeRow } from './normalizer';
import { checkAgainstExisting, checkWithinBatch, invalidateDedupCache } from './deduplicator';
import { scoreRowQuality, calculateAggregateScore, type QualityScore } from './quality-scorer';
import { suggestCorrections, type SuggestedCorrection } from './correction-suggester';
import { logAction } from '@/lib/audit';

// ── Types ──

export interface AnalyzeResult {
  headers: string[];
  mapping: Record<string, string>;
  unmatchedHeaders: string[];
  confidence: number;
  previewRows: Record<string, unknown>[];
  totalRows: number;
  fileName: string;
}

export interface ChunkProcessResult {
  processedRows: number;
  acceptedRows: number;
  warningRows: number;
  failedRows: number;
  duplicateRows: number;
}

export interface ReviewRow {
  id: string;
  rowIndex: number;
  rawData: Record<string, unknown>;
  mappedData: Record<string, unknown> | null;
  normalizedData: Record<string, unknown> | null;
  validationIssues: ValidationIssue[];
  suggestedCorrections: SuggestedCorrection[];
  status: string;
  qualityScore: number;
  duplicateOfRow: number | null;
}

export interface ReviewSummary {
  uploadId: string;
  fileName: string;
  totalRows: number;
  acceptedRows: number;
  warningRows: number;
  failedRows: number;
  duplicateRows: number;
  dataQualityScore: number;
  qualityDistribution: { excellent: number; good: number; fair: number; poor: number };
  status: string;
}

export interface CommitResult {
  companiesCreated: number;
  contactsCreated: number;
  batchId: string;
}

// ── In-memory batch dedup state (reset per upload) ──
const batchProcessedRows = new Map<string, Array<{ row: Record<string, unknown>; index: number }>>();

function clearBatchState(uploadId: string) {
  batchProcessedRows.delete(uploadId);
}

// ═══════════════════════════════════════════════════
// STEP 1: Analyze — Column Detection
// ═══════════════════════════════════════════════════

export async function analyzeFile(
  headers: string[],
  previewRows: Record<string, unknown>[],
  totalRows: number,
  fileName: string
): Promise<AnalyzeResult> {
  const detection = await detectColumns(headers);

  return {
    headers,
    mapping: detection.mapping,
    unmatchedHeaders: detection.unmatchedHeaders,
    confidence: detection.confidence,
    previewRows,
    totalRows,
    fileName,
  };
}

// ═══════════════════════════════════════════════════
// STEP 2: Create Upload Job
// ═══════════════════════════════════════════════════

export async function createUploadJob(params: {
  fileName: string;
  totalRows: number;
  columnMapping: Record<string, string>;
  consentSource: string;
  leadSource: string;
}): Promise<string> {
  const upload = await db.dataUpload.create({
    data: {
      fileName: params.fileName,
      totalRows: params.totalRows,
      status: 'mapping_confirmed',
      columnMapping: JSON.stringify(params.columnMapping),
      consentSource: params.consentSource,
      leadSource: params.leadSource,
    },
  });

  // Initialize batch dedup state
  batchProcessedRows.set(upload.id, []);

  await logAction('data_upload_created', 'DataUpload', upload.id, {
    fileName: params.fileName,
    totalRows: params.totalRows,
  });

  return upload.id;
}

// ═══════════════════════════════════════════════════
// STEP 3: Process Chunks
// ═══════════════════════════════════════════════════

export async function processChunk(
  uploadId: string,
  rows: Record<string, unknown>[],
  startRowIndex: number
): Promise<ChunkProcessResult> {
  const upload = await db.dataUpload.findUnique({ where: { id: uploadId } });
  if (!upload) throw new Error('Upload not found');
  if (upload.status === 'cancelled' || upload.status === 'failed') {
    return { processedRows: 0, acceptedRows: 0, warningRows: 0, failedRows: 0, duplicateRows: 0 };
  }

  // Parse the column mapping
  const columnMapping: Record<string, string> = JSON.parse(upload.columnMapping);
  const reverseMap = buildReverseMapping(columnMapping as any);
  const previousRows = batchProcessedRows.get(uploadId) || [];

  // Prepare row data for DB insertion
  const rowRecords: Array<{
    uploadId: string;
    rowIndex: number;
    rawData: string;
    mappedData: string | null;
    normalizedData: string | null;
    validationIssues: string | null;
    suggestedCorrections: string | null;
    status: string;
    duplicateOfRow: number | null;
    qualityScore: number;
  }> = [];

  let acceptedRows = 0;
  let warningRows = 0;
  let failedRows = 0;
  let duplicateRows = 0;

  for (let i = 0; i < rows.length; i++) {
    const rawRow = rows[i];
    const rowIndex = startRowIndex + i;

    // Map columns
    const mappedRow: Record<string, unknown> = {};
    for (const [field, sourceHeader] of Object.entries(reverseMap)) {
      mappedRow[field] = rawRow[sourceHeader] ?? '';
    }

    // Validate
    const issues = await validateRow(mappedRow);
    const hasErrors = issues.some(i => i.severity === 'error');
    const hasWarnings = issues.some(i => i.severity === 'warning');

    // Normalize
    const { normalized: normalizedRow, changes: normChanges } = await normalizeRow(mappedRow);

    // Dedup: check within batch
    const batchDedup = checkWithinBatch(normalizedRow, rowIndex, previousRows);

    // Dedup: check against existing DB
    const dbDedup = await checkAgainstExisting(normalizedRow);

    // Determine status
    let status = 'pending';
    let duplicateOfRow: number | null = null;

    if (hasErrors) {
      status = 'failed';
      failedRows++;
    } else if (batchDedup.isDuplicate && batchDedup.bestMatch) {
      status = 'duplicate';
      duplicateOfRow = batchDedup.bestMatch.batchRowIndex ?? null;
      duplicateRows++;
    } else if (dbDedup.isDuplicate) {
      status = 'duplicate';
      duplicateRows++;
    } else if (hasWarnings) {
      status = 'warning';
      warningRows++;
    } else {
      status = 'accepted';
      acceptedRows++;
    }

    // Quality score
    const quality = await scoreRowQuality(normalizedRow, issues, normChanges.length);

    // Suggest corrections for warnings
    let corrections: SuggestedCorrection[] = [];
    if (hasWarnings || status === 'warning') {
      corrections = await suggestCorrections(normalizedRow, issues);
    }

    // Add to batch dedup tracker
    previousRows.push({ row: normalizedRow, index: rowIndex });

    rowRecords.push({
      uploadId,
      rowIndex,
      rawData: JSON.stringify(rawRow),
      mappedData: JSON.stringify(mappedRow),
      normalizedData: JSON.stringify(normalizedRow),
      validationIssues: issues.length > 0 ? JSON.stringify(issues) : null,
      suggestedCorrections: corrections.length > 0 ? JSON.stringify(corrections) : null,
      status,
      duplicateOfRow,
      qualityScore: quality.total,
    });
  }

  // Batch insert all rows
  if (rowRecords.length > 0) {
    await db.uploadRow.createMany({ data: rowRecords });
  }

  // Update upload progress
  const updatedUpload = await db.dataUpload.update({
    where: { id: uploadId },
    data: {
      status: 'processing',
      processedRows: upload.processedRows + rows.length,
      acceptedRows: upload.acceptedRows + acceptedRows,
      warningRows: upload.warningRows + warningRows,
      failedRows: upload.failedRows + failedRows,
      duplicateRows: upload.duplicateRows + duplicateRows,
    },
  });

  // Check if all rows processed
  if (updatedUpload.processedRows >= updatedUpload.totalRows) {
    // Calculate aggregate quality score
    const allRows = await db.uploadRow.findMany({
      where: { uploadId },
      select: { qualityScore: true },
    });
    const scores = allRows.map(r => r.qualityScore);
    const { score } = calculateAggregateScore(scores);

    await db.dataUpload.update({
      where: { id: uploadId },
      data: {
        status: 'review_ready',
        dataQualityScore: score,
      },
    });

    await logAction('data_upload_processing_complete', 'DataUpload', uploadId, {
      totalRows: updatedUpload.totalRows,
      acceptedRows: updatedUpload.acceptedRows,
      warningRows: updatedUpload.warningRows,
      failedRows: updatedUpload.failedRows,
      duplicateRows: updatedUpload.duplicateRows,
      dataQualityScore: score,
    });
  }

  return {
    processedRows: rows.length,
    acceptedRows,
    warningRows,
    failedRows,
    duplicateRows,
  };
}

// ═══════════════════════════════════════════════════
// STEP 4: Get Review Data
// ═══════════════════════════════════════════════════

export async function getReviewSummary(uploadId: string): Promise<ReviewSummary> {
  const upload = await db.dataUpload.findUnique({ where: { id: uploadId } });
  if (!upload) throw new Error('Upload not found');

  const allRows = await db.uploadRow.findMany({
    where: { uploadId },
    select: { qualityScore: true },
  });
  const scores = allRows.map(r => r.qualityScore);
  const { score, distribution } = calculateAggregateScore(scores);

  return {
    uploadId: upload.id,
    fileName: upload.fileName,
    totalRows: upload.totalRows,
    acceptedRows: upload.acceptedRows,
    warningRows: upload.warningRows,
    failedRows: upload.failedRows,
    duplicateRows: upload.duplicateRows,
    dataQualityScore: upload.dataQualityScore || score,
    qualityDistribution: distribution,
    status: upload.status,
  };
}

export async function getReviewRows(
  uploadId: string,
  filter: 'all' | 'accepted' | 'warning' | 'failed' | 'duplicate' | 'corrected',
  page: number = 1,
  pageSize: number = 50
): Promise<{ rows: ReviewRow[]; total: number; pages: number }> {
  const where: any = { uploadId };
  if (filter !== 'all') {
    if (filter === 'corrected') {
      where.status = { in: ['warning', 'corrected'] };
    } else {
      where.status = filter;
    }
  }

  const [rows, total] = await Promise.all([
    db.uploadRow.findMany({
      where,
      orderBy: { qualityScore: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.uploadRow.count({ where }),
  ]);

  const reviewRows: ReviewRow[] = rows.map(r => ({
    id: r.id,
    rowIndex: r.rowIndex,
    rawData: safeJsonParse(r.rawData),
    mappedData: safeJsonParse(r.mappedData),
    normalizedData: safeJsonParse(r.normalizedData),
    validationIssues: safeJsonParse(r.validationIssues) || [],
    suggestedCorrections: safeJsonParse(r.suggestedCorrections) || [],
    status: r.status,
    qualityScore: r.qualityScore,
    duplicateOfRow: r.duplicateOfRow,
  }));

  return {
    rows: reviewRows,
    total,
    pages: Math.ceil(total / pageSize),
  };
}

// ═══════════════════════════════════════════════════
// STEP 5: Apply Corrections (user-approved)
// ═══════════════════════════════════════════════════

export async function applyCorrections(
  uploadId: string,
  corrections: Array<{
    rowId: string;
    field: string;
    appliedValue: string;
  }>
): Promise<{ updated: number }> {
  let updated = 0;

  // Group corrections by rowId
  const byRow = new Map<string, Array<{ field: string; appliedValue: string }>>();
  for (const c of corrections) {
    if (!byRow.has(c.rowId)) byRow.set(c.rowId, []);
    byRow.get(c.rowId)!.push(c);
  }

  for (const [rowId, fieldCorrections] of byRow) {
    const row = await db.uploadRow.findUnique({ where: { id: rowId } });
    if (!row || row.uploadId !== uploadId) continue;

    // Parse existing normalized data
    const normalizedData: Record<string, unknown> = safeJsonParse(row.normalizedData) || {};

    // Build applied corrections record
    const applied: Array<{ field: string; original: string; applied: string }> = [];
    for (const fc of fieldCorrections) {
      applied.push({
        field: fc.field,
        original: String(normalizedData[fc.field] || ''),
        applied: fc.appliedValue,
      });
      normalizedData[fc.field] = fc.appliedValue;
    }

    // Re-validate after corrections
    const issues = await validateRow(normalizedData);
    const hasErrors = issues.some(i => i.severity === 'error');
    const newStatus = hasErrors ? 'failed' : 'corrected';

    // Recalculate quality
    const quality = await scoreRowQuality(normalizedData, issues, applied.length);

    await db.uploadRow.update({
      where: { id: rowId },
      data: {
        normalizedData: JSON.stringify(normalizedData),
        appliedCorrections: JSON.stringify(applied),
        validationIssues: issues.length > 0 ? JSON.stringify(issues) : null,
        status: newStatus,
        qualityScore: quality.total,
      },
    });

    updated++;
  }

  // Update upload counts
  if (updated > 0) {
    const counts = await db.uploadRow.groupBy({
      by: ['status'],
      where: { uploadId },
      _count: true,
    });

    const updates: Record<string, number> = {
      acceptedRows: 0, warningRows: 0, failedRows: 0, duplicateRows: 0,
    };
    for (const c of counts) {
      if (c.status === 'accepted' || c.status === 'corrected') updates.acceptedRows += c._count;
      else if (c.status === 'warning') updates.warningRows += c._count;
      else if (c.status === 'failed') updates.failedRows += c._count;
      else if (c.status === 'duplicate') updates.duplicateRows += c._count;
    }

    await db.dataUpload.update({
      where: { id: uploadId },
      data: updates,
    });
  }

  return { updated };
}

// ═══════════════════════════════════════════════════
// STEP 6: Commit — Create Company + Contact records
// ═══════════════════════════════════════════════════

export async function commitUpload(uploadId: string): Promise<CommitResult> {
  const upload = await db.dataUpload.findUnique({ where: { id: uploadId } });
  if (!upload) throw new Error('Upload not found');
  if (upload.status === 'completed') throw new Error('Already committed');

  await db.dataUpload.update({
    where: { id: uploadId },
    data: { status: 'committing' },
  });

  // Get all rows to commit (accepted + corrected, not failed/duplicate)
  const rows = await db.uploadRow.findMany({
    where: {
      uploadId,
      status: { in: ['accepted', 'corrected'] },
    },
    orderBy: { rowIndex: 'asc' },
  });

  // Create ImportBatch for backward compatibility
  const batch = await db.importBatch.create({
    data: {
      fileName: upload.fileName,
      fileHash: `data-intel:${upload.id}`,
      totalRows: rows.length,
      status: 'completed',
      mappingProfile: upload.columnMapping,
    },
  });

  let companiesCreated = 0;
  let contactsCreated = 0;
  const companyCache = new Map<string, string>(); // normalizedName → companyId

  // Load existing companies for dedup
  const existingCompanies = await db.company.findMany({
    select: { id: true, normalizedName: true, domain: true },
  });
  for (const c of existingCompanies) {
    companyCache.set(c.normalizedName.toLowerCase(), c.id);
    if (c.domain) companyCache.set(c.domain.toLowerCase(), c.id);
  }

  for (const row of rows) {
    const data: Record<string, unknown> = safeJsonParse(row.normalizedData) || {};
    const rawName = String(data.name || 'Unknown').trim();
    const normalizedName = rawName.toLowerCase().trim();
    const companyName = String(data.company || '').trim();
    const companyNormName = companyName.toLowerCase().trim();
    const email = String(data.email || '').trim();
    const domain = String(data.domain || '').trim();
    const emailDomain = email.includes('@') ? email.split('@')[1]?.toLowerCase() : '';

    // Find or create company
    let companyId = companyCache.get(companyNormName) ||
      (domain ? companyCache.get(domain.toLowerCase()) : null) ||
      (emailDomain ? companyCache.get(emailDomain) : null);

    if (!companyId && companyNormName) {
      const newCompany = await db.company.create({
        data: {
          rawName: companyName || rawName,
          normalizedName: companyNormName || normalizedName,
          domain: domain || emailDomain || undefined,
          industry: String(data.industry || '').trim() || undefined,
          sizeRange: String(data.size || '').trim() || undefined,
          location: String(data.location || '').trim() || undefined,
          country: String(data.country || '').trim() || undefined,
          website: String(data.website || '').trim() || undefined,
          source: 'import',
        },
      });
      companyId = newCompany.id;
      companyCache.set(companyNormName, companyId);
      companiesCreated++;
    }

    if (!companyId) continue; // skip if we can't determine a company

    // Determine role bucket from title
    const titleLower = (String(data.title || '')).toLowerCase();
    let roleBucket = 'other';
    if (/^(ceo|cto|cfo|coo|cmo|cpo|ciso|vp|svp|evp|president|director|head|chief)/.test(titleLower)) {
      roleBucket = 'executive';
    } else if (/^(manager|lead|principal|senior|staff|sr\.|sr )/.test(titleLower)) {
      roleBucket = 'manager';
    } else if (/^(engineer|developer|architect|scientist|analyst|programmer|devops|sre|data)/.test(titleLower)) {
      roleBucket = 'technical';
    }

    await db.contact.create({
      data: {
        rawName,
        normalizedName,
        email: email || 'unknown@no-email.com',
        title: String(data.title || '').trim() || undefined,
        role: roleBucket,
        phone: String(data.phone || '').trim() || undefined,
        linkedinUrl: String(data.linkedin || '').trim() || undefined,
        location: String(data.location || '').trim() || undefined,
        companyId,
        batchId: batch.id,
        status: 'imported',
        consentStatus: 'unknown',
        consentSource: upload.consentSource,
        consentDate: new Date(),
        source: upload.leadSource,
      },
    });
    contactsCreated++;
  }

  // Mark upload as completed
  await db.dataUpload.update({
    where: { id: uploadId },
    data: {
      status: 'completed',
      completedAt: new Date(),
    },
  });

  // Update batch counts
  await db.importBatch.update({
    where: { id: batch.id },
    data: {
      acceptedRows: contactsCreated,
      duplicateRows: upload.duplicateRows,
      invalidRows: upload.failedRows,
    },
  });

  // Clean up batch dedup state
  clearBatchState(uploadId);
  invalidateDedupCache();

  await logAction('data_upload_committed', 'DataUpload', uploadId, {
    companiesCreated,
    contactsCreated,
    batchId: batch.id,
  });

  return { companiesCreated, contactsCreated, batchId: batch.id };
}

// ═══════════════════════════════════════════════════
// Utility: Cancel Upload
// ═══════════════════════════════════════════════════

export async function cancelUpload(uploadId: string): Promise<void> {
  await db.dataUpload.update({
    where: { id: uploadId },
    data: { status: 'cancelled' },
  });
  clearBatchState(uploadId);
}

// ═══════════════════════════════════════════════════
// Utility: Get Upload Progress
// ═══════════════════════════════════════════════════

export async function getUploadProgress(uploadId: string) {
  const upload = await db.dataUpload.findUnique({
    where: { id: uploadId },
    select: {
      id: true,
      status: true,
      totalRows: true,
      processedRows: true,
      acceptedRows: true,
      warningRows: true,
      failedRows: true,
      duplicateRows: true,
      dataQualityScore: true,
    },
  });

  if (!upload) return null;

  const percentComplete = upload.totalRows > 0
    ? Math.round((upload.processedRows / upload.totalRows) * 100)
    : 0;

  return { ...upload, percentComplete };
}

// ═══════════════════════════════════════════════════
// Utility: List Uploads
// ═══════════════════════════════════════════════════

export async function listUploads() {
  return db.dataUpload.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
}

// ── Helpers ──

function safeJsonParse(str: string | null | undefined): any {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return null; }
}