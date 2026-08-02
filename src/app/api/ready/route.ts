import { db } from '@/lib/db';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  let dbReady = false;
  try {
    await db.$queryRaw`SELECT 1`;
    dbReady = true;
  } catch {
    dbReady = false;
  }
  if (!dbReady) {
    return NextResponse.json({ status: 'not_ready', db: false }, { status: 503 });
  }
  return NextResponse.json({ status: 'ready', db: true }, { status: 200 });
}
