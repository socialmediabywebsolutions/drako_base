import { queryOne } from "@/lib/db";

type FactoryPlan = "free" | "pro" | "enterprise";

export type FactoryQuota = {
  plan: FactoryPlan;
  maxSaas: number;
  maxDomains: number;
  maxConcurrentJobs: number;
};

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

export class FactoryBillingError extends Error {
  code: "PLAN_INACTIVE" | "SAAS_LIMIT_REACHED" | "FACTORY_CONCURRENCY_LIMIT";

  constructor(code: FactoryBillingError["code"]) {
    super(code);
    this.name = "FactoryBillingError";
    this.code = code;
  }
}

export async function getFactoryQuota(tenantId: string): Promise<FactoryQuota> {
  const subscription = await queryOne<{ plan?: string | null; plan_code?: string | null; status: string | null }>(
    `SELECT plan_code AS plan, status
     FROM saas_subscriptions
     WHERE tenant_id = ?
     ORDER BY updated_at DESC
     LIMIT 1`,
    tenantId,
  );

  const status = subscription?.status?.trim().toLowerCase() ?? "";
  if (!subscription || !["active", "trialing"].includes(status)) {
    throw new FactoryBillingError("PLAN_INACTIVE");
  }

  const plan = normalizeFactoryPlan(subscription.plan ?? subscription.plan_code);
  if (!plan) {
    throw new FactoryBillingError("PLAN_INACTIVE");
  }

  return FACTORY_QUOTAS[plan];
}

export async function assertFactoryQuota(tenantId: string): Promise<void> {
  const quota = await getFactoryQuota(tenantId);

  const saasCountRow = await queryOne<{ count: number | string }>(
    "SELECT COUNT(*) AS count FROM saas WHERE tenant_id = ?",
    tenantId,
  );
  const saasCount = normalizeCount(saasCountRow?.count);
  if (Number.isFinite(quota.maxSaas) && saasCount >= quota.maxSaas) {
    throw new FactoryBillingError("SAAS_LIMIT_REACHED");
  }

  const activeJobsRow = await queryOne<{ count: number | string }>(
    `SELECT COUNT(*) AS count
     FROM provisioning_jobs
     WHERE tenant_id = ?
       AND current_state IN ('CREATED','RUNNING')`,
    tenantId,
  );
  const activeJobs = normalizeCount(activeJobsRow?.count);
  if (Number.isFinite(quota.maxConcurrentJobs) && activeJobs >= quota.maxConcurrentJobs) {
    throw new FactoryBillingError("FACTORY_CONCURRENCY_LIMIT");
  }
}
