import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * Drako Knowledge System - Global Environment Type
 */
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
  MENTOR_IA_PRICE_ID?: string;
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
  AI?: { run: (model: string, inputs: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown> };
};

/**
 * REGLA DURA (Hard Rule): 
 * env() solo puede resolverse dentro de una request.
 * Si se llama fuera de un handler, lanza un error claro.
 */
export function env(): DracoEnv {
  try {
    // 1. Try OpenNext Cloudflare context (Workers Runtime)
    const ctx = getCloudflareContext();
    if (ctx && ctx.env && typeof ctx.env === "object") {
      return ctx.env as unknown as DracoEnv;
    }
  } catch {
    // In local development, we might not have the context yet
    // but the users wants a HARD FAIL if called outside request.
  }

  // 2. Fallback to process.env ONLY if we are in Development and NOT in a Worker
  const isDev = process.env.NODE_ENV === "development";
  if (isDev && typeof process !== "undefined" && process.env) {
    // Simple filter to ensure we act like we have bindings
    if (process.env.DRACO_DB || process.env.AI || process.env.SESSION_SECRET) {
      return process.env as unknown as DracoEnv;
    }
  }

  // 3. ACTUAL HARD FAIL
  const errorMsg = "CF_CONTEXT_ERROR: env() called outside request scope. Environment bindings (D1/AI) are only available within a request context.";
  console.error(errorMsg);
  throw new Error(errorMsg);
}
