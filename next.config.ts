import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  compress: false,
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
