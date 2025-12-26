import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure tracing resolves packages from the workspace root when running inside monorepo-like setups.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
