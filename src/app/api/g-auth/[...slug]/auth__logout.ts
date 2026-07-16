import { NextResponse } from 'next/server';
import { destroyCurrentSession } from '@/lib/session';

export async function POST() {
  try {
    await destroyCurrentSession();
    return NextResponse.json({ success: true, message: 'Logged out' });
  } catch (error) {
    console.error('[auth/logout] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}