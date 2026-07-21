import { NextRequest, NextResponse } from 'next/server';
import { createUploadJob } from '@/lib/data-intelligence';
import { validateBody } from '@/lib/validate';
import { z } from 'zod/v4';

/**
 * POST /api/g-data/upload/create
 *
 * Create a new upload job with confirmed column mapping.
 * Client should call this after user reviews the mapping from /analyze.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const uploadBody = z.object({
      fileName: z.string().min(1, 'fileName is required'),
      totalRows: z.number().int().positive('totalRows must be a positive integer'),
      columnMapping: z.record(z.string(), z.string()).refine(
        obj => Object.keys(obj).length > 0,
        { message: 'columnMapping must have at least one entry' }
      ),
      consentSource: z.string().optional(),
      leadSource: z.string().optional(),
    });
    const validated = validateBody(uploadBody, body);
    if (!validated.success) {
      return NextResponse.json({ error: 'Validation failed', details: validated.error }, { status: 400 });
    }
    const { fileName, totalRows, columnMapping, consentSource, leadSource } = validated.data;

    const uploadId = await createUploadJob({
      fileName,
      totalRows,
      columnMapping,
      consentSource: consentSource || 'manual_upload',
      leadSource: leadSource || 'manual',
    });

    return NextResponse.json({ success: true, uploadId });
  } catch (error: any) {
    console.error('[upload/create]', error.message);
    return NextResponse.json({ error: 'Failed to create upload', detail: error.message }, { status: 500 });
  }
}