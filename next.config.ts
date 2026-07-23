import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  typescript: {
    // TypeScript errors are now resolved. Do not add new errors.
    ignoreBuildErrors: false,
  },
  reactStrictMode: false,
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
  // output: 'standalone', — removed for Render free tier compatibility
  serverExternalPackages: ['nodemailer'],

  // Security headers for all API routes
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
        ],
      },
    ]
  },

  // API route rewrites removed — modern /api/xxx/route.ts structure is used directly
  async rewrites() {
    return [];
  },
};

export default nextConfig;