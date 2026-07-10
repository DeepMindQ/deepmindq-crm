import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'logo.clearbit.com' },
    ],
  },
  allowedDevOrigins: ['*'],
};

export default nextConfig;
