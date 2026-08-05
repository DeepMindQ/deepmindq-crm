import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  typescript: {
    // Type-checking enforced both at build time AND via `npx tsc --noEmit` (CI step).
    // M4 Phase 3: ignoreBuildErrors removed — tsc --noEmit passes clean with 0 errors.
    // Build-time type errors now block deployment.
  },
  reactStrictMode: true,
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
  // Standalone output — enables Docker deployment (server.js entry point).
  // Compatible with Render, Railway, Fly.io, and self-hosted Docker.
  // Vercel overrides this to its own output; standalone is only used for non-Vercel deploys.
  output: process.env.VERCEL ? undefined : 'standalone',
  serverExternalPackages: ['nodemailer'],

  // Bundle analysis — enabled via ANALYZE=true environment variable
  // Usage: ANALYZE=true npm run build
  ...(process.env.ANALYZE === 'true' ? {
    experimental: {
      optimizePackageImports: [
        'lucide-react',
        'recharts',
        '@radix-ui/react-icons',
        'date-fns',
        'lodash',
      ],
    },
  } : {}),

  // Security headers are consolidated in src/lib/auth-helpers.ts (getSecurityHeaders)
  // and applied via Edge middleware (src/middleware.ts). Removing duplicate
  // headers here to maintain a single source of truth (E-H2).
  async headers() {
    return [];
  },

  // API route rewrites removed — modern /api/xxx/route.ts structure is used directly
  async rewrites() {
    return [];
  },
};

export default nextConfig;