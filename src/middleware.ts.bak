import { NextResponse } from 'next/server'

export function middleware(request: Request) {
  const { pathname } = new URL(request.url)

  // Public routes - always allow
  const publicPaths = ['/', '/login', '/signup', '/favicon.ico']
  if (publicPaths.some(p => pathname === p)) return NextResponse.next()

  // Next.js internals - always allow
  if (pathname.startsWith('/_next') || pathname.startsWith('/api/auth')) return NextResponse.next()

  // Check for session token (real or mock)
  const cookieHeader = request.headers.get('cookie') || ''
  const hasSessionToken = cookieHeader.includes('next-auth.session-token') ||
                          cookieHeader.includes('deepmindq-mock-auth=true')

  // For API routes - return 401 if no session (in production)
  if (pathname.startsWith('/api/')) {
    if (!hasSessionToken && process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 })
    }
    return NextResponse.next()
  }

  // For page routes - redirect to login if no session (in production)
  if (!hasSessionToken && process.env.NODE_ENV === 'production') {
    const loginUrl = new URL('/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}