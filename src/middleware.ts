import { NextResponse } from 'next/server'

export function middleware(request: Request) {
  const { pathname } = request.nextUrl

  // Allow public routes
  const publicPaths = ['/', '/login', '/api/auth', '/favicon.ico']
  if (publicPaths.some(p => pathname === p) || pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Redirect unauthenticated users to login
  // For now, allow all access (auth is credentials-based, not session)
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api/).*)*'],
}