import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure tracing resolves packages from the workspace root when running inside monorepo-like setups.
  outputFileTracingRoot: __dirname,

  // Optimize for Cloudflare Pages deployment
  // experimental: {
  //   runtime: 'edge',
  // },
};

export default nextConfig;
