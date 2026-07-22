import { NextRequest, NextResponse } from 'next/server';

/**
 * Security headers + landing page routing.
 *
 * - Unauthenticated visitors to / get the static landing page (fast, no JS bundle)
 * - Authenticated visitors to / get the Next.js dashboard
 * - Static HTML files (.html) bypass middleware entirely (no CSP interference)
 * - Security headers applied only to API routes and Next.js page routes
 */
export function middleware(request: NextRequest) {
  const { pathname } = new URL(request.url);
  const sessionCookie = request.cookies.get('dmq_session');

  // Landing page routing: if no session and hitting root, serve static HTML
  if ((pathname === '/' || pathname === '') && !sessionCookie?.value) {
    const url = request.nextUrl.clone();
    url.pathname = '/landing-page.html';
    return NextResponse.rewrite(url);
  }

  // If authenticated and trying to access login, redirect to dashboard (or returnTo)
  if (pathname === '/login' && sessionCookie?.value) {
    const returnTo = request.nextUrl.searchParams.get('returnTo') || '/';
    return NextResponse.redirect(new URL(returnTo, request.url));
  }

  // Build response with security headers
  const response = NextResponse.next();

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  );
  response.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob: https:",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https:",
    ].join('; '),
  );

  return response;
}

export const config = {
  matcher: [
    // Match API routes
    '/api/:path*',
    // Match page routes only — explicitly exclude static files including .html
    '/((?!_next/static|_next/image|_next/fonts|favicon\\.ico|icons|fonts|.*\\.(?:svg|png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot|html|css)).*)',
  ],
};
