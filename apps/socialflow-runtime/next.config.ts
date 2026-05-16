import { execSync } from "child_process";
import path from "path";
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
try {
  gitSha = execSync("git rev-parse --short HEAD").toString().trim();
} catch {
  // Ignore local git metadata failures for the inactive canary scaffold.
}

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    externalDir: true,
  },
  outputFileTracingRoot: path.join(process.cwd(), "../.."),
  env: {
    NEXT_PUBLIC_RUNTIME_TARGET: "socialflow-runtime-canary",
    NEXT_PUBLIC_GIT_SHA: gitSha,
    NEXT_PUBLIC_BUILD_TIME: new Date().toISOString(),
  },
};

export default nextConfig;
