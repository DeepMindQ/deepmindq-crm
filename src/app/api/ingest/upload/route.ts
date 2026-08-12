import { NextRequest, NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';
import { ingestFile } from '@/lib/intelligence/ingestion';
import { logger } from '@/lib/logger';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_TYPES: Record<string, string> = {
  'text/csv': 'csv',
  'application/vnd.ms-excel': 'xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
  'application/json': 'json',
};

export async function POST(request: NextRequest) {
  try {
    // Auth check
    const { session, errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const userId = session?.userId;

    // Parse multipart form
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided. Use form field "file".' },
        { status: 400 }
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB.` },
        { status: 400 }
      );
    }

    // Validate file type
    const fileType = ALLOWED_TYPES[file.type];
    if (!fileType) {
      return NextResponse.json(
        {
          error: `Unsupported file type: ${file.type}. Allowed types: CSV, XLSX, XLS, JSON.`,
        },
        { status: 400 }
      );
    }

    // Read file buffer
    const buffer = Buffer.from(await file.arrayBuffer());

    // Run ingestion pipeline
    const result = await ingestFile(buffer, file.name, fileType as 'csv' | 'xlsx' | 'xls' | 'json', {
      userId,
      deduplicate: true,
    });

    return NextResponse.json({
      success: true,
      data: result,
    });
  } catch (error) {
    logger.error('[API/INGEST] Upload failed', { error: error instanceof Error ? error.message : 'Unknown' });

    return NextResponse.json(
      { error: 'Ingestion failed. Please check your file format and try again.' },
      { status: 500 }
    );
  }
}
