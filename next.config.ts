import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  typescript: {
    // Enterprise builds must fail on type errors
    ignoreBuildErrors: false,
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
  serverExternalPackages: ['nodemailer', '@upstash/redis'],

  // Bundle optimization — enabled via ANALYZE=true or always for critical packages.
  // optimizePackageImports enables automatic tree-shaking for the listed
  // packages by converting deep imports to barrel-free paths at build time.
  ...(process.env.ANALYZE === 'true' ? {
    experimental: {
      optimizePackageImports: [
        'lucide-react',
        'recharts',
        '@radix-ui/react-icons',
        'date-fns',
        'lodash',
        'framer-motion',
        '@radix-ui/react-accordion',
        '@radix-ui/react-alert-dialog',
        '@radix-ui/react-dialog',
        '@radix-ui/react-dropdown-menu',
        '@radix-ui/react-popover',
        '@radix-ui/react-select',
        '@radix-ui/react-tabs',
        '@radix-ui/react-toast',
        '@radix-ui/react-tooltip',
        '@radix-ui/react-checkbox',
        '@radix-ui/react-switch',
      ],
    },
  } : {}),

  // Modularize imports for common UI packages (additional tree-shaking).
  // This converts `import { X } from 'pkg'` → `import X from 'pkg/X'`
  // at build time, eliminating unused exports from the bundle.
  modularizeImports: {
    '@radix-ui/react-icons': {
      transform: '@radix-ui/react-icons/{{member}}',
    },
  },

  // Security headers are consolidated in src/lib/auth-helpers.ts (getSecurityHeaders)
  // and applied via Edge middleware (src/proxy.ts). Removing duplicate
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
