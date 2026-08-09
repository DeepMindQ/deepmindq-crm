/**
 * Data Export Detail API — Task 4.6
 *
 * GET    /api/data-export/[id]  — Get export details + progress
 * DELETE /api/data-export/[id]  — Cancel/delete export
 */

import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiNotFound } from '@/lib/apiHelpers';
import { checkApiAuth } from '@/lib/api-auth';
import { getExport, getExportProgress, cancelExport, deleteExport } from '@/lib/data-export/streaming-export';
import { logAction } from '@/lib/audit';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { errorResponse } = await checkApiAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;

    const exportJob = await getExport(id);
    if (!exportJob) {
      return apiNotFound('DataExport');
    }

    const progress = await getExportProgress(id);

    // Audit log (fire-and-forget)
    logAction('view', 'data_export', id, { format: exportJob.format, status: exportJob.status }).catch(() => {});

    return apiSuccess({
      ...exportJob,
      progress,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to get export details';
    return apiError(message);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, errorResponse } = await checkApiAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;

    // Try cancel first (for pending/processing), then delete
    const cancelled = await cancelExport(id);
    if (!cancelled) {
      // If cancel fails, try hard delete
      const deleted = await deleteExport(id);
      if (!deleted) {
        return apiNotFound('DataExport');
      }
    }

    // Audit log (fire-and-forget)
    logAction('delete', 'data_export', id, {}, session?.id).catch(() => {});

    return apiSuccess({ id, deleted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete export';
    return apiError(message);
  }
}
