import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  poweredByHeader: false,
  images: {
    unoptimized: true,
  },
  // output: 'standalone' removed — was stripping static JS chunks from served output
};

export default nextConfig