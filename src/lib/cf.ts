import { getRequestContext } from "@cloudflare/next-on-pages";

export type DracoEnv = {
  DRACO_DB: D1Database;
  SESSION_SECRET: string;
  DEFAULT_TENANT_ID?: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
  USER_PASSWORD?: string;
  FIREWORKS_API_KEY?: string;
  ORCHESTRATOR_MODEL?: string;
  STRIPE_PUBLISHABLE_KEY?: string;
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  DRAKO_BASE_PRODUCT_ID?: string;
  DRAKO_BASE_STARTER_PRICE_ID?: string;
  DRAKO_CLINIC_STARTER_PRICE_ID?: string;
  DRAKO_DEMO_MODE?: string;
  APP_URL?: string;
  DRACO_RATE_LIMIT_ENABLED?: string;
  DRACO_PUBLIC_RPM?: string;
  DRACO_PUBLIC_BURST?: string;
  DRACO_PUBLIC_LOCKDOWN_ENABLED?: string;
  DRACO_PUBLIC_SIGNATURE_REQUIRED?: string;
  DRACO_PUBLIC_SIGNATURE_MODE?: string;
  DRACO_AI_RATE_LIMIT_ENABLED?: string;
  DRACO_AI_RPM_PER_TENANT?: string;
  DRACO_AI_RPM_PER_SAAS?: string;
  DRACO_AI_MONTHLY_TOKENS_SOFT?: string;
  DRACO_AI_MONTHLY_TOKENS_HARD?: string;
  DRACO_AI_CB_FAILURE_THRESHOLD?: string;
  DRACO_AI_CB_COOLDOWN_SECONDS?: string;
  DRACO_AI_CB_HALF_OPEN_TRIALS?: string;
  CF_API_TOKEN?: string;
  CF_ACCOUNT_ID?: string;
  CF_ZONE_ID?: string;
  CF_PAGES_ENVIRONMENT?: string;
  CF_PAGES_BRANCH?: string;
  CF_PAGES_COMMIT_SHA?: string;
  CF_PAGES_URL?: string;
  CF_PAGES_BUILD_ID?: string;
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_ZONE_ID?: string;
  CLOUDFLARE_PROVISIONING_MODE?: string;
  AI_GATEWAY_ID?: string;
  AI_GATEWAY_COMPAT_TOKEN?: string;
};

type CtxWithEnv = { env?: DracoEnv };

export function env(): DracoEnv | null {
  try {
    // 1. Try Next-on-Pages context (standard)
    const rawCtx = getRequestContext();
    if (rawCtx && typeof rawCtx === "object" && "env" in rawCtx) {
      return (rawCtx as unknown as CtxWithEnv).env ?? null;
    }

    // 2. Fallback to process.env (some versions of next-on-pages/cloudflare populate this)
    // In Edge runtime, process.env is often available as a proxy to bindings
    if (typeof process !== "undefined" && process.env) {
      // Check for a known binding like DRACO_DB to see if it's likely working
      if (process.env.DRACO_DB || process.env.AI || process.env.SESSION_SECRET) {
        return process.env as unknown as DracoEnv;
      }
    }

    console.error("CF_ENV_ERROR: Both getRequestContext and process.env fallbacks failed.");
    return null;
  } catch (err) {
    console.error("CF_ENV_ERROR: Exception in env()", err);
    return null;
  }
}
