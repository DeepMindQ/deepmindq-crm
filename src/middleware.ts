import { NextRequest, NextResponse } from 'next/server';

/**
 * Security headers middleware (S10a).
 * Applies strict security headers to all API and page routes.
 * Skips static files, _next internals, fonts, and icons.
 */
export function middleware(request: NextRequest) {
  const { pathname } = new URL(request.url);

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