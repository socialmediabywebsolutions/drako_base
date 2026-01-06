// Edge-safe access to Cloudflare bindings from OpenNext or next-on-pages.
import { getCloudflareContext } from "@opennextjs/cloudflare";
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
  CLOUDFLARE_API_TOKEN?: string;
  CLOUDFLARE_ACCOUNT_ID?: string;
  CLOUDFLARE_ZONE_ID?: string;
  CLOUDFLARE_PROVISIONING_MODE?: string;
  AI_GATEWAY_ID?: string;
  AI_GATEWAY_COMPAT_TOKEN?: string;
};

type CtxWithEnv = { env?: DracoEnv };
type Adapter = "opennext" | "next-on-pages" | "unknown";

let lastAdapter: Adapter = "unknown";

export function env(): DracoEnv | null {
  try {
    const ctx = getCloudflareContext() as unknown as CtxWithEnv | null;
    if (ctx?.env) {
      lastAdapter = "opennext";
      return ctx.env;
    }
  } catch {
    // fall through
  }
  try {
    const ctx = getRequestContext() as CtxWithEnv | null;
    if (ctx?.env) {
      lastAdapter = "next-on-pages";
      return ctx.env;
    }
  } catch {
    // fall through
  }
  lastAdapter = "unknown";
  return null;
}

export function runtimeAdapter(): Adapter {
  return lastAdapter;
}
