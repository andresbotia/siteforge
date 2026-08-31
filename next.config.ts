import type { NextConfig } from "next";

const externalSourceArchiveLimitBytes = 10_000_000;

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: externalSourceArchiveLimitBytes,
    },
  },
};

export default nextConfig;
