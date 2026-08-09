/**
 * Data Export API Routes — Task 4.6: Bulk Import/Export Pipeline
 *
 * POST   /api/data-export              — Create export job
 * GET    /api/data-export              — List export jobs (paginated)
 * GET    /api/data-export/[id]         — Get export details + progress
 * GET    /api/data-export/[id]/download — Download exported file
 * DELETE /api/data-export/[id]         — Cancel/delete export
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiPaginated, safeInt } from '@/lib/apiHelpers';
import { checkApiAuth } from '@/lib/api-auth';
import {
  createExportJob,
  listExports,
} from '@/lib/data-export/streaming-export';
import { logAction } from '@/lib/audit';
import { checkRateLimit } from '@/lib/rate-limit';

// ═══════════════════════════════════════════════════════════════
// POST /api/data-export — Create export job
// ═══════════════════════════════════════════════════════════════

export async function POST(req: NextRequest) {
  const { session, errorResponse } = await checkApiAuth(req);
  if (errorResponse) return errorResponse;

  const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  if (!checkRateLimit(clientIp, 10)) {
    return apiError('Rate limit exceeded. Maximum 10 export operations per minute.', 429);
  }

  try {
    const body = await req.json();
    const { format, entityType, filters, fields } = body;

    // Validate required fields
    if (!format || typeof format !== 'string') {
      return apiError('format is required and must be a string (csv, json, xlsx)', 400);
    }
    if (!entityType || typeof entityType !== 'string') {
      return apiError('entityType is required and must be a string (companies, contacts, opportunities, signals)', 400);
    }

    const validFormats = ['csv', 'json', 'xlsx'];
    if (!validFormats.includes(format)) {
      return apiError(`Invalid format: ${format}. Must be one of: ${validFormats.join(', ')}`, 400);
    }

    const validEntities = ['companies', 'contacts', 'opportunities', 'signals'];
    if (!validEntities.includes(entityType)) {
      return apiError(`Invalid entityType: ${entityType}. Must be one of: ${validEntities.join(', ')}`, 400);
    }

    if (fields && !Array.isArray(fields)) {
      return apiError('fields must be an array of strings', 400);
    }

    const exportJob = await createExportJob(
      { format: format as 'csv' | 'json' | 'xlsx', entityType: entityType as 'companies' | 'contacts' | 'opportunities' | 'signals', filters: filters ?? undefined, fields: fields ?? undefined },
      session?.id,
    );

    return apiSuccess(exportJob);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to create export job';
    return apiError(message, message.includes('Invalid') ? 400 : 500);
  }
}

// ═══════════════════════════════════════════════════════════════
// GET /api/data-export — List export jobs
// ═══════════════════════════════════════════════════════════════

export async function GET(req: NextRequest) {
  const { errorResponse } = await checkApiAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, safeInt(searchParams.get('page'), 1));
    const limit = Math.min(100, Math.max(1, safeInt(searchParams.get('limit'), 20)));
    const status = searchParams.get('status') ?? undefined;

    const result = await listExports(page, limit, status);

    return apiPaginated(result.items, result.total, page, limit);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to list exports';
    return apiError(message);
  }
}
