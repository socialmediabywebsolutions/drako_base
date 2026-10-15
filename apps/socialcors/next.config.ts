import path from "node:path";
import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

if (process.argv.some((arg) => arg === "dev" || arg.endsWith("/next-dev.js"))) {
  void initOpenNextCloudflareForDev();
}

// Etapa alias (P3–P9): el código compartido vive en ../../src y los paquetes en
// ../../node_modules. La raíz del repo es la raíz de tracing.
const repoRoot = path.resolve(__dirname, "../..");

const nextConfig: NextConfig = {
  // output: 'standalone' is incompatible with OpenNext for Cloudflare — OpenNext
  // has its own Cloudflare Worker bundler and does not consume the standalone output.
  // Setting it produces a broken worker that returns 500 on all routes.
  outputFileTracingRoot: repoRoot,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-3e782268d66e465bbe7c7fa767074ee2.r2.dev",
      },
    ],
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // El typecheck se ejecuta aparte (pnpm --dir apps/socialcors typecheck), como en el monolito.
  typescript: {
    ignoreBuildErrors: true,
  },
  serverExternalPackages: ["@cf-wasm/photon"],
  experimental: {
    // Permite compilar los imports a ../../src resueltos por los paths de tsconfig.
    externalDir: true,
  },
};

export default nextConfig;
