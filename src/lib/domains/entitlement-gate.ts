import { getSubscriptionForTenant, type SubscriptionRecord } from "@/lib/billing/subscriptions";
import { queryOne } from "@/lib/db";

type QueryOneFn = <T>(sql: string, ...params: unknown[]) => Promise<T | null>;
type GetSubscriptionFn = (tenantId: string) => Promise<SubscriptionRecord | null>;

type EntitlementDeps = {
  queryOne: QueryOneFn;
  getSubscriptionForTenant: GetSubscriptionFn;
};

type SaasInstanceRow = {
  id: string;
  tenant_id: string;
  plan_tier: string | null;
};

type TenantRow = {
  id: string;
  plan: string | null;
  saas_slug: string | null;
};

type StripeConnectRow = {
  connect_account_id: string | null;
  onboarding_status: string | null;
};

export type CustomDomainEntitlement = {
  allowed: boolean;
  code:
    | "ENTITLED"
    | "SAAS_NOT_FOUND"
    | "PLAN_LOCKED"
    | "SUBSCRIPTION_INACTIVE"
    | "STRIPE_CONNECT_REQUIRED";
  message: string;
  context: {
    isDrakoFactoryTenant: boolean;
    planTier: string | null;
    tenantPlan: string | null;
    subscriptionStatus: string | null;
    connectStatus: string | null;
  };
};

const BLOCKED_PLAN_TIERS = new Set(["starter", "locked", "free"]);
const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing", "trial"]);
const CONNECT_READY_STATUSES = new Set(["completed"]);

function normalize(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

function isMissingTableError(error: unknown): boolean {
  return error instanceof Error && /no such table/i.test(error.message);
}

export async function evaluateCustomDomainEntitlement(
  params: { tenantId: string; saasId: string },
  deps?: Partial<EntitlementDeps>,
): Promise<CustomDomainEntitlement> {
  const query = deps?.queryOne ?? queryOne;
  const getTenantSubscription = deps?.getSubscriptionForTenant ?? getSubscriptionForTenant;

  const saas = await query<SaasInstanceRow>(
    "SELECT id, tenant_id, plan_tier FROM saas_instances WHERE id = ? AND tenant_id = ? LIMIT 1",
    params.saasId,
    params.tenantId,
  );
  if (!saas) {
    return {
      allowed: false,
      code: "SAAS_NOT_FOUND",
      message: "SaaS instance not found for tenant",
      context: {
        isDrakoFactoryTenant: false,
        planTier: null,
        tenantPlan: null,
        subscriptionStatus: null,
        connectStatus: null,
      },
    };
  }

  const tenant = await query<TenantRow>("SELECT id, plan, saas_slug FROM tenants WHERE id = ? LIMIT 1", params.tenantId);
  const planTier = normalize(saas.plan_tier);
  const tenantPlan = normalize(tenant?.plan);
  const isDrakoFactoryTenant = normalize(tenant?.saas_slug) === "drako";

  if (!planTier || BLOCKED_PLAN_TIERS.has(planTier)) {
    return {
      allowed: false,
      code: "PLAN_LOCKED",
      message: "Plan does not allow custom domains",
      context: {
        isDrakoFactoryTenant,
        planTier,
        tenantPlan,
        subscriptionStatus: null,
        connectStatus: null,
      },
    };
  }

  const subscription = await getTenantSubscription(params.tenantId);
  const subscriptionStatus = normalize(subscription?.status);
  if (!subscriptionStatus || !ACTIVE_SUBSCRIPTION_STATUSES.has(subscriptionStatus)) {
    return {
      allowed: false,
      code: "SUBSCRIPTION_INACTIVE",
      message: "Active subscription required for custom domains",
      context: {
        isDrakoFactoryTenant,
        planTier,
        tenantPlan,
        subscriptionStatus,
        connectStatus: null,
      },
    };
  }

  let connectStatus: string | null = null;
  if (isDrakoFactoryTenant) {
    let stripeConnect: StripeConnectRow | null = null;
    try {
      stripeConnect = await query<StripeConnectRow>(
        "SELECT connect_account_id, onboarding_status FROM tenant_stripe_connect WHERE tenant_id = ? LIMIT 1",
        params.tenantId,
      );
    } catch (error) {
      if (!isMissingTableError(error)) throw error;
    }
    connectStatus = normalize(stripeConnect?.onboarding_status);
    const hasConnectAccount = Boolean(stripeConnect?.connect_account_id);
    if (!hasConnectAccount || !connectStatus || !CONNECT_READY_STATUSES.has(connectStatus)) {
      return {
        allowed: false,
        code: "STRIPE_CONNECT_REQUIRED",
        message: "Stripe Connect onboarding must be completed before custom domains",
        context: {
          isDrakoFactoryTenant,
          planTier,
          tenantPlan,
          subscriptionStatus,
          connectStatus,
        },
      };
    }
  }

  return {
    allowed: true,
    code: "ENTITLED",
    message: "Custom domain entitlement granted",
    context: {
      isDrakoFactoryTenant,
      planTier,
      tenantPlan,
      subscriptionStatus,
      connectStatus,
    },
  };
}
