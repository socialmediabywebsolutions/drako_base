import { execSync } from "child_process";
import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

function isNextDevCommand(): boolean {
  const lifecycle = process.env.npm_lifecycle_event ?? "";
  if (lifecycle === "dev") {
    return true;
  }

  return process.argv.some((arg) => arg === "dev" || arg.endsWith("/next-dev.js"));
}

if (isNextDevCommand()) {
  void initOpenNextCloudflareForDev();
}

let gitSha = "unknown";
try { gitSha = execSync("git rev-parse --short HEAD").toString().trim(); } catch { /* ignore */ }

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_GIT_SHA: gitSha,
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-3e782268d66e465bbe7c7fa767074ee2.r2.dev",
      },
    ],
  },
  // Ensure tracing resolves packages from the workspace root when running inside monorepo-like setups.

  // outputFileTracingRoot: __dirname,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },

  // Packages that use Node.js APIs incompatible with Cloudflare Workers edge runtime.
  // Marking them as external prevents them from being bundled into handler.mjs,
  // keeping the worker under the 64 MiB uncompressed size limit.
  serverExternalPackages: ["@react-pdf/renderer", "@cf-wasm/photon", "jszip", "exifr"],

  experimental: {
    // runtime: 'edge',
  },
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
