/**
 * Ticket 11 — Data Import API Routes
 *
 * POST /api/data-import/upload          — Upload + auto-analyze
 * POST /api/data-import/confirm-mapping — Confirm column mapping
 * POST /api/data-import/validate         — Validate all rows
 * POST /api/data-import/normalize        — Normalize all rows
 * POST /api/data-import/commit           — Commit import
 * GET  /api/data-import                  — List uploads
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, safeInt } from '@/lib/apiHelpers';
import { checkApiAuth } from '@/lib/api-auth';
import {
  createDataUpload,
  autoMapColumns,
  validateRows,
  normalizeRows,
  commitImport,
  listUploads,
} from '@/lib/data-import/pipeline';
import { db } from '@/lib/db';

// ═══════════════════════════════════════════════════════════════
// GET /api/data-import — List uploads
// ═══════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  // Auth gate: authenticated users only for data import
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, safeInt(searchParams.get('page'), 1));
    const limit = Math.min(100, Math.max(1, safeInt(searchParams.get('limit'), 20)));

    const result = await listUploads(page, limit);

    return apiSuccess({
      items: result.items,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list uploads';
    return apiError(message);
  }
}

// ═══════════════════════════════════════════════════════════════
// POST /api/data-import/upload — Upload + auto-analyze
// ═══════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  // Auth gate: authenticated users only for data import
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

  try {
    const body = await req.json();
    const action = body.action;

    // Route to sub-actions based on `action` field
    if (action === 'upload') {
      return await handleUpload(body);
    }
    if (action === 'confirm-mapping') {
      return await handleConfirmMapping(body);
    }
    if (action === 'validate') {
      return await handleValidate(body);
    }
    if (action === 'normalize') {
      return await handleNormalize(body);
    }
    if (action === 'commit') {
      return await handleCommit(body);
    }

    return apiError(
      `Unknown action "${action}". Use: upload, confirm-mapping, validate, normalize, commit`,
      400,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    const status = message.includes('not found') ? 404 : 500;
    return apiError(message, status);
  }
}

// ─── Action Handlers ──────────────────────────────────────────

async function handleUpload(body: Record<string, unknown>) {
  const { fileName, totalRows, headers, rows, consentSource, leadSource } = body;

  if (!fileName || typeof fileName !== 'string') {
    return apiError('fileName is required and must be a string', 400);
  }
  if (typeof totalRows !== 'number' || totalRows < 0) {
    return apiError('totalRows must be a non-negative number', 400);
  }

  // Phase 1: Create upload record
  const upload = await createDataUpload({
    fileName,
    totalRows,
    consentSource: typeof consentSource === 'string' ? consentSource : undefined,
    leadSource: typeof leadSource === 'string' ? leadSource : undefined,
  });

  // Phase 2: Auto-map columns (if headers provided)
  let columnMapping: Record<string, string> = {};
  if (Array.isArray(headers) && headers.length > 0) {
    columnMapping = await autoMapColumns(upload.id, headers as string[]);
  }

  // Create UploadRow records (if rows provided)
  let createdRows = 0;
  if (Array.isArray(rows)) {
    const createData = (rows as Record<string, string>[]).map(
      (row: Record<string, string>, index: number) => ({
        uploadId: upload.id,
        rowIndex: index,
        rawData: JSON.stringify(row),
        mappedData: columnMapping
          ? JSON.stringify(remapRow(row, columnMapping))
          : null,
        status: 'pending' as const,
      }),
    );

    // Create in batches of 100 to avoid query limits
    for (let i = 0; i < createData.length; i += 100) {
      await db.uploadRow.createMany({ data: createData.slice(i, i + 100) });
      createdRows += Math.min(100, createData.length - i);
    }
  }

  return apiSuccess({
    upload,
    columnMapping,
    rowsCreated: createdRows,
  });
}

async function handleConfirmMapping(body: Record<string, unknown>) {
  const { uploadId, columnMapping } = body;

  if (!uploadId || typeof uploadId !== 'string') {
    return apiError('uploadId is required', 400);
  }
  if (!columnMapping || typeof columnMapping !== 'object') {
    return apiError('columnMapping is required and must be an object', 400);
  }

  const upload = await db.dataUpload.findUnique({ where: { id: uploadId } });
  if (!upload) {
    return apiError(`DataUpload with id "${uploadId}" not found.`, 404);
  }
  if (upload.status !== 'created') {
    return apiError(
      `Cannot confirm mapping for upload with status "${upload.status}". Must be created.`,
      400,
    );
  }

  const updated = await db.dataUpload.update({
    where: { id: uploadId },
    data: {
      columnMapping: JSON.stringify(columnMapping),
      status: 'mapping_confirmed',
    },
  });

  return apiSuccess(updated);
}

async function handleValidate(body: Record<string, unknown>) {
  const { uploadId } = body;

  if (!uploadId || typeof uploadId !== 'string') {
    return apiError('uploadId is required', 400);
  }

  const upload = await db.dataUpload.findUnique({ where: { id: uploadId } });
  if (!upload) {
    return apiError(`DataUpload with id "${uploadId}" not found.`, 404);
  }

  // Fetch rows with mappedData
  const rows = await db.uploadRow.findMany({
    where: { uploadId },
    orderBy: { rowIndex: 'asc' },
  });

  const mappedRows: Record<string, string>[] = rows.map((r) => {
    try {
      return r.mappedData ? JSON.parse(r.mappedData) : {};
    } catch {
      return {};
    }
  });

  // Update status to processing
  await db.dataUpload.update({
    where: { id: uploadId },
    data: { status: 'processing' },
  });

  const results = await validateRows(uploadId, mappedRows);

  return apiSuccess({
    totalRows: results.length,
    failedRows: results.filter((r) => r.status === 'failed').length,
    warningRows: results.filter((r) => r.status === 'warning').length,
    pendingRows: results.filter((r) => r.status === 'pending').length,
  });
}

async function handleNormalize(body: Record<string, unknown>) {
  const { uploadId } = body;

  if (!uploadId || typeof uploadId !== 'string') {
    return apiError('uploadId is required', 400);
  }

  const upload = await db.dataUpload.findUnique({ where: { id: uploadId } });
  if (!upload) {
    return apiError(`DataUpload with id "${uploadId}" not found.`, 404);
  }

  // Fetch rows with mappedData
  const rows = await db.uploadRow.findMany({
    where: { uploadId },
    orderBy: { rowIndex: 'asc' },
  });

  const mappedRows: Record<string, string>[] = rows.map((r) => {
    try {
      return r.mappedData ? JSON.parse(r.mappedData) : {};
    } catch {
      return {};
    }
  });

  const results = await normalizeRows(uploadId, mappedRows);

  // Update status to review_ready
  await db.dataUpload.update({
    where: { id: uploadId },
    data: { status: 'review_ready' },
  });

  return apiSuccess({
    totalRows: results.length,
    normalizedRows: results.filter((r) => r.appliedCorrections.length > 0).length,
    unchangedRows: results.filter((r) => r.appliedCorrections.length === 0).length,
  });
}

async function handleCommit(body: Record<string, unknown>) {
  const { uploadId } = body;

  if (!uploadId || typeof uploadId !== 'string') {
    return apiError('uploadId is required', 400);
  }

  const result = await commitImport(uploadId);

  return apiSuccess(result);
}

// ─── Helpers ──────────────────────────────────────────────────

/** Remap a raw row object using the column mapping. */
function remapRow(
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
