import { NextResponse } from 'next/server'

export function middleware(request: Request) {
  const { pathname } = new URL(request.url)

  // Allow public routes
  const publicPaths = ['/', '/login', '/favicon.ico']
  if (publicPaths.some(p => pathname === p)) return NextResponse.next()

  // Allow Next.js internals
  if (pathname.startsWith('/_next') || pathname.startsWith('/api/auth')) return NextResponse.next()

  // API routes: skip auth for demo (auth middleware layer handles it)
  if (pathname.startsWith('/api/')) return NextResponse.next()

  // Protect /app routes (auth disabled for demo — allow all)
  if (pathname.startsWith('/app')) return NextResponse.next()

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}