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
};

export default nextConfig