import { NextResponse } from 'next/server';
import { destroyCurrentSession } from '@/lib/session';

export async function POST() {
  try {
    await destroyCurrentSession();

    // Explicitly clear the cookie in the response
    // (cookieStore.delete in session.ts may not work reliably in route handlers)
    const response = NextResponse.json({ success: true, message: 'Logged out' });
    response.cookies.set('dmq_session', '', {
      path: '/',
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    return response;
  } catch (error) {
    console.error('[auth/logout] Error:', error);

    // Even if DB deletion fails, clear the cookie
    const response = NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    response.cookies.set('dmq_session', '', {
      path: '/',
      maxAge: 0,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
    });
    return response;
  }
}