import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ensure tracing resolves packages from the workspace root when running inside monorepo-like setups.

  outputFileTracingRoot: __dirname,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // Optimize for Cloudflare Pages deployment
  // experimental: {
  //   runtime: 'edge',
  // },
  async redirects() {
    return [
      {
        source: "/agentes",
        destination: "/agents",
        permanent: true,
      },
      {
        source: "/departamentos",
        destination: "/departments",
        permanent: true,
      },
      {
        source: "/agentes/:slug",
        destination: "/agents/:slug",
        permanent: true,
      },
      {
        source: "/departamentos/:slug",
        destination: "/departments/:slug",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
