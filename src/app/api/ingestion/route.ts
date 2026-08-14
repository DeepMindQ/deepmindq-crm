import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { checkApiAuth } from '@/lib/api-auth';
import { db } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import { logger } from '@/lib/logger';

const ACCEPTED_EXTENSIONS = ['.csv', '.xlsx', '.xls', '.json'];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const UPLOAD_DIR = join(process.cwd(), 'uploads', 'ingestion');

const ingestionGetQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
  status: z.enum(['pending', 'processing', 'completed', 'failed']).optional(),
});

const ingestionFileSchema = z.object({
  name: z.string().min(1),
  size: z.number().int().min(1).max(MAX_FILE_SIZE),
  type: z.string().min(1),
});

function getFileExtension(filename: string): string {
  return filename.slice(filename.lastIndexOf('.')).toLowerCase();
}

function mapFileType(ext: string): 'csv' | 'xlsx' | 'xls' | 'json' {
  const map: Record<string, 'csv' | 'xlsx' | 'xls' | 'json'> = {
    '.csv': 'csv',
    '.xlsx': 'xlsx',
    '.xls': 'xls',
    '.json': 'json',
  };
  return map[ext] || 'csv';
}

export async function GET(request: NextRequest) {
  try {
    const { errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const { searchParams } = new URL(request.url);
    const parsed = ingestionGetQuerySchema.safeParse(Object.fromEntries(searchParams));
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid parameters', details: parsed.error.flatten() },
        { status: 400 },
      );
    }
    const { limit } = parsed.data;

    const ingestions = await db.dataIngestion.findMany({
      orderBy: { uploadedAt: 'desc' },
      take: limit,
    });

    return NextResponse.json({ data: ingestions });
  } catch (_error) {
    return NextResponse.json({ error: 'Failed to fetch ingestion history' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { session, errorResponse } = await checkApiAuth(request);
    if (errorResponse) return errorResponse;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file provided. Use FormData with a "file" field.' },
        { status: 400 },
      );
    }

    // Zod validation for file metadata
    const fileParsed = ingestionFileSchema.safeParse({
      name: file.name,
      size: file.size,
      type: file.type,
    });
    if (!fileParsed.success) {
      return NextResponse.json(
        { error: 'Invalid file', details: fileParsed.error.flatten() },
        { status: 400 },
      );
    }

    // Validate file extension
    const ext = getFileExtension(file.name);
    if (!ACCEPTED_EXTENSIONS.includes(ext)) {
      return NextResponse.json(
        { error: `Unsupported file type "${ext}". Accepted: ${ACCEPTED_EXTENSIONS.join(', ')}` },
        { status: 400 },
      );
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum is 50MB.` },
        { status: 400 },
      );
    }

    // Ensure upload directory exists
    if (!existsSync(UPLOAD_DIR)) {
      await mkdir(UPLOAD_DIR, { recursive: true });
    }

    // Save file to disk
    const uniqueId = crypto.randomUUID();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storedFileName = `${uniqueId}${ext}`;
    const filePath = join(UPLOAD_DIR, storedFileName);

    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    // Create database record
    const fileType = mapFileType(ext);
    const ingestion = await db.dataIngestion.create({
      data: {
        fileName: safeName,
        fileSize: file.size,
        fileType,
        status: 'pending',
        uploadedBy: session?.id ?? null,
      },
    });

    logger.info(
      `[Ingestion] File uploaded: ${safeName} (${fileType}, ${file.size} bytes) — id=${ingestion.id}`,
    );

    return NextResponse.json({ data: ingestion, success: true });
  } catch (error) {
    logger.error('[Ingestion] Upload failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
  }
}
