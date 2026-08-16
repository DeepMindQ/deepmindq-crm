import { NextResponse } from 'next/server';
import { checkApiAuth } from '@/lib/api-auth';

export async function GET() {
  // ── Authentication Guard ──
  const { errorResponse } = await checkApiAuth();
  if (errorResponse) return errorResponse;

  return NextResponse.json(
    { status: 'ok', version: '1.0', timestamp: new Date().toISOString() },
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store',
      },
    },
  );
}
