import { NextResponse } from 'next/server';

export async function GET() {
  const results: Record<string, string> = {};
  
  // Test internal-api.z.ai
  try {
    const r1 = await fetch('https://internal-api.z.ai/v1', { signal: AbortSignal.timeout(5000) });
    results['internal-api'] = `status=${r1.status}`;
  } catch (e: any) {
    results['internal-api'] = `error=${e.cause?.code || e.message}`;
  }
  
  // Test api.z.ai
  try {
    const r2 = await fetch('https://api.z.ai/v1', { signal: AbortSignal.timeout(5000) });
    results['api'] = `status=${r2.status}`;
  } catch (e: any) {
    results['api'] = `error=${e.cause?.code || e.message}`;
  }

  return NextResponse.json(results);
}
