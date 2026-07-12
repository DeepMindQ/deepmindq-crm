import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const batches = await db.importBatch.findMany({
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(batches);
  } catch (error) {
    console.error('Batches error:', error);
    return NextResponse.json(
      { error: 'Failed to load batches' },
      { status: 500 }
    );
  }
}