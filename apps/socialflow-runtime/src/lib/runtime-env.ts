import { getCloudflareContextSafeSync } from "@/lib/cloudflare/runtime";
import {
  isSocialFlowRuntimeBindingKey,
  isSocialFlowRuntimeStringEnvKey,
  socialFlowRuntimeDeployContract,
  type SocialFlowRuntimeBindingKey,
  type SocialFlowRuntimeStringEnvKey,
} from "./runtime-contract";

export type SocialFlowRuntimeEnv = {
  DRACO_DB?: D1Database;
  SOCIAL_DB?: D1Database;
  SOCIALFLOW_AUTHS_DB?: D1Database;
  SOCIALFLOW_AUTHS_SECRET?: string;
  DEFAULT_TENANT_ID?: string;
  LINKEDIN_CLIENT_ID?: string;
  LINKEDIN_CLIENT_SECRET?: string;
  APP_URL?: string;
  NEXT_PUBLIC_APP_URL?: string;
  BASE_URL?: string;
  SITE_URL?: string;
  NEXTAUTH_URL?: string;
  CF_PAGES_URL?: string;
  CF_PAGES_ENVIRONMENT?: string;
  SOCIALFLOW_RUNTIME_TARGET?: string;
  SOCIALFLOW_RUNTIME_STATE?: string;
  SOCIALFLOW_RUNTIME_CONTRACT_VERSION?: string;
  SOCIALFLOW_RUNTIME_COOKIE_NAMESPACE?: string;
  AUTHS_SECRETS_NAME?: string;
  SOCIALFLOW_CANARY_GATED_HOSTS?: string;
  SOCIALFLOW_CANARY_GATE_TOKEN?: string;
};

let runtimeEnvOverride: SocialFlowRuntimeEnv | null = null;

export function setSocialFlowRuntimeEnv(env: SocialFlowRuntimeEnv | null) {
  runtimeEnvOverride = env;
}

function isNodeEnvFallbackAllowed() {
  if (typeof process === "undefined" || !process.env) {
    return false;
  }

  return (
    process.env.NODE_ENV === "development"
    || process.env.NODE_ENV === "test"
    || process.env.OPENNEXT_PHASE === "build"
    || process.env.NEXT_PHASE === "phase-production-build"
  );
}

function readNodeEnvValue(key: SocialFlowRuntimeStringEnvKey): string | undefined {
  if (!isNodeEnvFallbackAllowed() || typeof process === "undefined" || !process.env) {
    return undefined;
  }

  const value = process.env[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function sanitizeRuntimeEnv(input: unknown): SocialFlowRuntimeEnv | null {
  if (!input || typeof input !== "object") {
    return null;
  }

  const candidate = input as Record<string, unknown>;
  const nextEnv: SocialFlowRuntimeEnv = {};

  for (const [key, value] of Object.entries(candidate)) {
    if (isSocialFlowRuntimeBindingKey(key)) {
      (nextEnv as Record<SocialFlowRuntimeBindingKey, unknown>)[key] = value;
      continue;
    }

    if (!isSocialFlowRuntimeStringEnvKey(key)) {
      continue;
    }

    if (typeof value === "string" && value.trim()) {
      (nextEnv as Record<SocialFlowRuntimeStringEnvKey, string>)[key] = value.trim();
    }
  }

  return nextEnv;
}

function resolveNodeEnvFallback(): SocialFlowRuntimeEnv | null {
  const nextEnv: SocialFlowRuntimeEnv = {};

  for (const key of [
    ...socialFlowRuntimeDeployContract.runtimeVars.required,
    ...socialFlowRuntimeDeployContract.runtimeVars.optional,
    ...socialFlowRuntimeDeployContract.runtimeSecrets.required,
    ...socialFlowRuntimeDeployContract.runtimeSecrets.optional,
  ] as SocialFlowRuntimeStringEnvKey[]) {
    const value = readNodeEnvValue(key);
    if (value) {
      (nextEnv as Record<SocialFlowRuntimeStringEnvKey, string>)[key] = value;
    }
  }

  return Object.keys(nextEnv).length > 0 ? nextEnv : null;
}

export function getSocialFlowRuntimeEnv(): SocialFlowRuntimeEnv | null {
  if (runtimeEnvOverride) {
    return sanitizeRuntimeEnv(runtimeEnvOverride);
  }

  const context = getCloudflareContextSafeSync() as { env?: unknown } | null;
  if (context?.env && typeof context.env === "object") {
    return sanitizeRuntimeEnv(context.env);
  }

  return resolveNodeEnvFallback();
}

export function requireSocialFlowRuntimeString(key: SocialFlowRuntimeStringEnvKey): string {
  const value = (getSocialFlowRuntimeEnv() as Record<string, unknown> | null)?.[key];
  if (typeof value === "string" && value.trim()) {
    return value.trim();
  }
  throw new Error(`SOCIALFLOW_RUNTIME_ENV_MISSING:${key}`);
}

export function hasSocialFlowRuntimeBinding(key: SocialFlowRuntimeBindingKey) {
  return Boolean((getSocialFlowRuntimeEnv() as Record<string, unknown> | null)?.[key]);
}

export function getSocialFlowRuntimeReadinessSnapshot() {
  const env = getSocialFlowRuntimeEnv() as Record<string, unknown> | null;
  const missingBindings = socialFlowRuntimeDeployContract.bindings.d1.filter((key) => !env?.[key]);
  const missingRequiredVars = socialFlowRuntimeDeployContract.runtimeVars.required.filter((key) => !env?.[key]);
  const missingRequiredSecrets = socialFlowRuntimeDeployContract.runtimeSecrets.required.filter((key) => !env?.[key]);

  return {
    ok: missingBindings.length === 0 && missingRequiredVars.length === 0 && missingRequiredSecrets.length === 0,
    missingBindings,
    missingRequiredVars,
    missingRequiredSecrets,
  };
}
