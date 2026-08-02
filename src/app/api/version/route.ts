import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    version: process.env.npm_package_version || '0.2.0',
    environment: process.env.NODE_ENV || 'unknown',
  });
}
