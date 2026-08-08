/**
 * Data Export Download API — Task 4.6
 *
 * GET /api/data-export/[id]/download — Download the exported file
 */

import { NextRequest } from 'next/server';
import { apiError, apiNotFound } from '@/lib/apiHelpers';
import { checkApiAuth } from '@/lib/api-auth';
import { getExport, getContentType } from '@/lib/data-export/streaming-export';
import { createReadStream, existsSync, statSync } from 'fs';
import { basename, join } from 'path';
import { logAction } from '@/lib/audit';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { session, errorResponse } = await checkApiAuth(req);
  if (errorResponse) return errorResponse;

  try {
    const { id } = await params;

    const exportJob = await getExport(id);
    if (!exportJob) {
      return apiNotFound('DataExport');
    }

    if (exportJob.status !== 'completed') {
      return apiError(`Export is not ready for download. Current status: ${exportJob.status}`, 400);
    }

    if (!exportJob.filePath || !existsSync(exportJob.filePath)) {
      return apiError('Export file not found on disk', 404);
    }

    const fileStat = statSync(exportJob.filePath);
    const fileName = basename(exportJob.filePath);
    const contentType = getContentType(exportJob.format as 'csv' | 'json' | 'xlsx');

    // Audit log (fire-and-forget)
    logAction('download', 'data_export', id, {
      format: exportJob.format,
      fileSize: fileStat.size,
    }, session?.id).catch(() => {});

    const fileStream = createReadStream(exportJob.filePath);

    return new Response(fileStream as unknown as BodyInit, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${fileName}"`,
        'Content-Length': String(fileStat.size),
        'Cache-Control': 'no-cache',
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to download export';
    return apiError(message);
  }
}
