import { NextResponse } from 'next/server';
import { getCurrentSession, requireAuth, AuthError } from '@/lib/session';

export async function GET() {
  try {
    const user = await getCurrentSession();

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    return NextResponse.json({ user });
  } catch (error) {
    if (error instanceof AuthError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error('[auth/me] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}