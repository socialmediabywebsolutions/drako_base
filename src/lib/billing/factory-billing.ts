import { queryOne } from "@/lib/db";
import { getCanonicalBillingSnapshot } from "@/lib/billing/subscriptions";

export type FactoryPlan = "free" | "pro" | "enterprise";

export type FactoryQuota = {
  plan: FactoryPlan;
  maxSaas: number;
  maxDomains: number;
  maxConcurrentJobs: number;
};

export type FactoryUsage = {
  saasCount: number;
  activeJobCount: number;
  domainCount: number;
};

export type FactoryLimits = {
  saasRemaining: number | null;
  jobSlotsRemaining: number | null;
  domainsRemaining: number | null;
};

export type FactoryBillingState = {
  tenantId: string;
  saasSlug: string;
  subscriptionStatus: string | null;
  hasVerifiedSubscription: boolean;
  planCode: string | null;
  plan: FactoryPlan | null;
  quota: FactoryQuota | null;
  usage: FactoryUsage;
  limits: FactoryLimits | null;
  eligibleToCreate: boolean;
};

const ACTIVE_FACTORY_STATUSES = new Set(["active", "trialing"]);

const FACTORY_QUOTAS: Record<FactoryPlan, FactoryQuota> = {
  free: {
    plan: "free",
    maxSaas: 1,
    maxDomains: 1,
    maxConcurrentJobs: 1,
  },
  pro: {
    plan: "pro",
    maxSaas: 5,
    maxDomains: 10,
    maxConcurrentJobs: 3,
  },
  enterprise: {
    plan: "enterprise",
    maxSaas: Number.POSITIVE_INFINITY,
    maxDomains: Number.POSITIVE_INFINITY,
    maxConcurrentJobs: 10,
  },
};

function normalizeFactoryPlan(plan: string | null | undefined): FactoryPlan | null {
  const normalized = plan?.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.startsWith("drako_base_")) {
    return normalizeFactoryPlan(normalized.replace("drako_base_", ""));
  }
  if (normalized === "free" || normalized === "starter") return "free";
  if (normalized === "pro") return "pro";
  if (normalized === "enterprise" || normalized === "scale") return "enterprise";
  return null;
}

function normalizeCount(value: unknown): number {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(numeric) ? Math.trunc(numeric) : 0;
}

function normalizeSaasSlug(value: string | null | undefined): string {
  const normalized = value?.trim().toLowerCase();
  return normalized && normalized.length > 0 ? normalized : "drako";
}

function computeRemaining(limit: number, used: number): number | null {
  if (!Number.isFinite(limit)) return null;
  return Math.max(0, Math.trunc(limit - used));
}

async function countForTenant(sql: string, tenantId: string): Promise<number> {
  const row = await queryOne<{ count: number | string }>(sql, tenantId);
  return normalizeCount(row?.count);
}

async function resolveFactorySaasSlug(tenantId: string): Promise<string> {
  const tenant = await queryOne<{ saas_slug: string | null }>(
    "SELECT saas_slug FROM tenants WHERE id = ? LIMIT 1",
    tenantId,
  );
  return normalizeSaasSlug(tenant?.saas_slug);
}

function resolveFactoryQuota(params: {
  plan: FactoryPlan | null;
  subscriptionStatus: string | null;
}): FactoryQuota | null {
  if (!params.plan) return null;
  const status = params.subscriptionStatus?.trim().toLowerCase() ?? "";
  if (!ACTIVE_FACTORY_STATUSES.has(status)) return null;
  return FACTORY_QUOTAS[params.plan];
}

export class FactoryBillingError extends Error {
  code: "PLAN_INACTIVE" | "SAAS_LIMIT_REACHED" | "FACTORY_CONCURRENCY_LIMIT";

  constructor(code: FactoryBillingError["code"]) {
    super(code);
    this.name = "FactoryBillingError";
    this.code = code;
  }
}

export async function getFactoryBillingState(tenantId: string): Promise<FactoryBillingState> {
  const saasSlug = await resolveFactorySaasSlug(tenantId);
  const [snapshot, saasCount, activeJobCount, domainCount] = await Promise.all([
    getCanonicalBillingSnapshot({ tenantId, saasSlug }),
    countForTenant("SELECT COUNT(*) AS count FROM saas WHERE tenant_id = ?", tenantId),
    countForTenant(
      `SELECT COUNT(*) AS count
       FROM provisioning_jobs
       WHERE tenant_id = ?
         AND current_state IN ('CREATED','RUNNING')`,
      tenantId,
    ),
    countForTenant("SELECT COUNT(*) AS count FROM saas_domains WHERE tenant_id = ?", tenantId),
  ]);

  const subscriptionStatus = snapshot.subscription.status ?? null;
  const planCode = snapshot.subscription.planCode ?? null;
  const plan = normalizeFactoryPlan(planCode);
  const quota = resolveFactoryQuota({ plan, subscriptionStatus });
  const hasVerifiedSubscription = Boolean(
    snapshot.subscription.stripeCustomerId && snapshot.subscription.stripeSubscriptionId,
  );
  const workspaceLimit = snapshot.entitlements.limits.workspaces;
  const eligibleToCreate =
    hasVerifiedSubscription
    && Boolean(quota)
    && typeof workspaceLimit === "number"
    && Number.isFinite(workspaceLimit)
    && (workspaceLimit === -1 || workspaceLimit > 0);

  const usage: FactoryUsage = {
    saasCount,
    activeJobCount,
    domainCount,
  };

  const limits = quota
    ? {
        saasRemaining: computeRemaining(quota.maxSaas, saasCount),
        jobSlotsRemaining: computeRemaining(quota.maxConcurrentJobs, activeJobCount),
        domainsRemaining: computeRemaining(quota.maxDomains, domainCount),
      }
    : null;

  return {
    tenantId,
    saasSlug,
    subscriptionStatus,
    hasVerifiedSubscription,
    planCode,
    plan,
    quota,
    usage,
    limits,
    eligibleToCreate,
  };
}

export async function getFactoryQuota(tenantId: string): Promise<FactoryQuota> {
  const state = await getFactoryBillingState(tenantId);
  if (!state.quota) {
    throw new FactoryBillingError("PLAN_INACTIVE");
  }
  return state.quota;
}

export async function assertFactoryQuota(
  tenantId: string,
  preloadedState?: FactoryBillingState,
): Promise<void> {
  const state = preloadedState ?? await getFactoryBillingState(tenantId);
  if (!state.quota) {
    throw new FactoryBillingError("PLAN_INACTIVE");
  }

  if (Number.isFinite(state.quota.maxSaas) && state.usage.saasCount >= state.quota.maxSaas) {
    throw new FactoryBillingError("SAAS_LIMIT_REACHED");
  }

  if (
    Number.isFinite(state.quota.maxConcurrentJobs)
    && state.usage.activeJobCount >= state.quota.maxConcurrentJobs
  ) {
    throw new FactoryBillingError("FACTORY_CONCURRENCY_LIMIT");
  }
}
