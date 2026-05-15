import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: ".next-socialflow-runtime",
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  env: {
    NEXT_PUBLIC_RUNTIME_TARGET: "socialflow-runtime-canary",
  },
};

export default nextConfig;
