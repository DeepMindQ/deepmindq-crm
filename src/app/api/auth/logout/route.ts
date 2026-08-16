import { NextResponse } from 'next/server';
import { destroyCurrentSession } from '@/lib/session';
import { logger } from '@/lib/logger';

export async function POST() {
  try {
    await destroyCurrentSession();
    return NextResponse.json({ success: true, message: 'Logged out' });
  } catch (error) {
    logger.error('[auth/logout] Error:', { error: error });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
