import { getCloudflareContextSafeSync, isBuildPhase } from "@/lib/cloudflare/runtime";

/**
 * Drako Knowledge System - Global Environment Type
 */
export type DracoEnv = {
  DRACO_DB: D1Database;
  DB?: D1Database;
  SOCIAL_DB?: D1Database;
  MENTORIA_DB?: D1Database;
  DRAKOS_AUTHS_DB?: D1Database;
  MENTORIAS_AUTHS_DB?: D1Database;
  SOCIALFLOW_AUTHS_DB?: D1Database;
  BASES_AUTHS_DB?: D1Database;
  SESSION_SECRET: string;
  DEFAULT_TENANT_ID?: string;
  ADMIN_EMAIL?: string;
  ADMIN_PASSWORD?: string;
  USER_PASSWORD?: string;
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
  CRON_SECRET?: string;
  AI?: { run: (model: string, inputs: Record<string, unknown>, options?: Record<string, unknown>) => Promise<unknown> };
  SAAS_FACTORY_QUEUE?: { send: (msg: any) => Promise<void> };
  SCHEDULER?: Fetcher; // Service Binding to drako-scheduler
  PROVISIONING_QUEUE?: { send: (msg: any) => Promise<void> }; // Cloudflare Queue Producer
  INTERNAL_API_SECRET?: string; // Phase 3.1 Hardening
  PROVISIONING_FAULT_AT?:
    | "STRIPE_AFTER_CREATE"
    | "CLOUDFLARE_AFTER_CREATE"
    | "BOOTSTRAP_PARTIAL_READY"
    | "BOOTSTRAP_CONSISTENCY_BREAK"
    | "CUSTOM_DOMAIN_CONSISTENCY_BREAK";
  ENVIRONMENT?: string;
  AUTHS_REQUIRE_CONTEXT_DB?: string;
  ALLOW_LEGACY_AUTH_DB_FALLBACK?: string;
  DRAKO_LEGACY_COMPAT_SAMPLE_RATE?: string;
};


let globalEnv: DracoEnv | null = null;

export function setGlobalEnv(e: DracoEnv) {
  globalEnv = e;
}

function canUseProcessEnvFallback(): boolean {
  if (typeof process === "undefined" || !process.env) {
    return false;
  }

  return Boolean(process.env.DRACO_DB || process.env.AI || process.env.SESSION_SECRET);
}

/**
 * OLIMPO RULE: 
 * env() NEVER throws. Returns null when Cloudflare context is unavailable.
 * This allows graceful degradation on Vercel and prevents middleware crashes.
 */
export function env(): DracoEnv | null {
  if (globalEnv) return globalEnv;

  if (isBuildPhase()) {
    return canUseProcessEnvFallback() ? (process.env as unknown as DracoEnv) : null;
  }

  try {
    // 1. Try OpenNext Cloudflare context (Workers Runtime)
    const ctx = getCloudflareContextSafeSync() as { env?: unknown } | null;
    if (ctx && ctx.env && typeof ctx.env === "object") {
      return ctx.env as unknown as DracoEnv;
    }
  } catch {
    // Cloudflare context not available - this is expected on Vercel
  }

  // 2. Fallback to process.env in Development
  const isDev = typeof process !== "undefined" && process.env.NODE_ENV === "development";
  if ((isDev || isBuildPhase()) && typeof process !== "undefined" && process.env) {
    // If we have key env vars, treat process.env as DracoEnv for local dev
    if (canUseProcessEnvFallback()) {
      return process.env as unknown as DracoEnv;
    }
  }

  // 3. FAIL-SAFE: Return null instead of throwing
  // This allows the app to continue without Cloudflare bindings (e.g., on Vercel)
  if (typeof process !== "undefined" && process.env.NODE_ENV === "development") {
    console.warn("CF_CONTEXT_UNAVAILABLE: Cloudflare bindings not available. Some features will be disabled.");
  }
  return null;
}
