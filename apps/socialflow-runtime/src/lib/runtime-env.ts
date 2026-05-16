import { getCloudflareContextSafeSync } from "@/lib/cloudflare/runtime";

export type SocialFlowRuntimeEnv = {
  DRACO_DB?: D1Database;
  SOCIAL_DB?: D1Database;
  SOCIALFLOW_AUTHS_DB?: D1Database;
  SESSION_SECRET?: string;
  SOCIALFLOW_AUTHS_SECRET?: string;
  DEFAULT_TENANT_ID?: string;
  LINKEDIN_CLIENT_ID?: string;
  CF_PAGES_ENVIRONMENT?: string;
};

let runtimeEnvOverride: SocialFlowRuntimeEnv | null = null;

export function setSocialFlowRuntimeEnv(env: SocialFlowRuntimeEnv | null) {
  runtimeEnvOverride = env;
}

function resolveProcessEnvFallback(): SocialFlowRuntimeEnv | null {
  if (typeof process === "undefined" || !process.env) {
    return null;
  }

  return process.env as unknown as SocialFlowRuntimeEnv;
}

export function getSocialFlowRuntimeEnv(): SocialFlowRuntimeEnv | null {
  if (runtimeEnvOverride) {
    return runtimeEnvOverride;
  }

  const context = getCloudflareContextSafeSync() as { env?: unknown } | null;
  if (context?.env && typeof context.env === "object") {
    return context.env as SocialFlowRuntimeEnv;
  }

  return resolveProcessEnvFallback();
}
