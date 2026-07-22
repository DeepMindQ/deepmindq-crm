import { NextRequest, NextResponse } from 'next/server';

/**
 * Security headers + landing page routing.
 * 
 * - Unauthenticated visitors to / get the static landing page (fast, no JS bundle)
 * - Authenticated visitors to / get the Next.js dashboard
 * - Login page is always accessible
 * - Security headers applied to all routes
 */
export function middleware(request: NextRequest) {
  const { pathname } = new URL(request.url);
  const sessionCookie = request.cookies.get('dmq_session');

  // Landing page routing: if no session and hitting root or specific landing routes,
  // serve the static HTML landing page directly (bypasses Next.js bundle)
  const isLandingRoute = pathname === '/' || pathname === '';
  const isLoginPage = pathname === '/login';
  const isApiRoute = pathname.startsWith('/api/');
  const isStaticAsset = pathname.startsWith('/_next') || pathname.startsWith('/landing-page') || pathname.match(/\.(svg|png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot|css|js|html)$/);

  // If not authenticated and on root, serve the static landing page
  if (isLandingRoute && !sessionCookie?.value) {
    const url = request.nextUrl.clone();
    url.pathname = '/landing-page.html';
    return NextResponse.rewrite(url);
  }

  // If authenticated and trying to access login page, redirect to dashboard
  if (isLoginPage && sessionCookie?.value) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Build response with security headers
  const response = NextResponse.next();

  // Apply security headers to all matched routes
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=()',
  );

  // Relaxed CSP for landing page (needs CDN scripts)
  if (isLandingRoute && sessionCookie?.value) {
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
  } else {
    response.headers.set(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self' 'unsafe-eval' 'unsafe-inline'",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https:",
        "font-src 'self' https://fonts.gstatic.com",
        "connect-src 'self' https:",
      ].join('; '),
    );
  }

  return response;
}

export const config = {
  matcher: [
    // Match API routes
    '/api/:path*',
    // Match page routes (but not static files, _next, fonts, icons)
    '/((?!_next/static|_next/image|_next/fonts|favicon\\.ico|icons|fonts|.*\\.(?:svg|png|jpg|jpeg|gif|ico|woff|woff2|ttf|eot)).*)',
  ],
};
