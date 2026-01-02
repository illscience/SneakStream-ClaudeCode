import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: __dirname,
  },
  eslint: {
    // Prevent known circular JSON error in eslint-config-next during CI builds
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
