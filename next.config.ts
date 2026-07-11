import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'logo.clearbit.com' },
      { protocol: 'https', hostname: '**.googleusercontent.com' },
    ],
  },
  // Vercel serverless doesn't support Prisma binary well — output standalone
  output: 'standalone',
};

export default nextConfig