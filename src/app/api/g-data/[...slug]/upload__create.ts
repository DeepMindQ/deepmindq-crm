import { NextRequest, NextResponse } from 'next/server';
import { createUploadJob } from '@/lib/data-intelligence';

/**
 * POST /api/g-data/upload/create
 *
 * Create a new upload job with confirmed column mapping.
 * Client should call this after user reviews the mapping from /analyze.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fileName, totalRows, columnMapping, consentSource, leadSource } = body;

    if (!fileName || !totalRows || !columnMapping) {
      return NextResponse.json({ error: 'fileName, totalRows, and columnMapping are required' }, { status: 400 });
    }

    if (!columnMapping || Object.keys(columnMapping).length === 0) {
      return NextResponse.json({ error: 'columnMapping must have at least one entry' }, { status: 400 });
    }

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