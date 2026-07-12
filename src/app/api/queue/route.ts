import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const sequences = await db.emailSequence.findMany({
    include: { steps: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json(sequences);
}