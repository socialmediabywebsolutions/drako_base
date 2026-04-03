import { describe, expect, it, vi } from "vitest";
import { evaluateCustomDomainEntitlement } from "@/lib/domains/entitlement-gate";

function buildQueryOneMock(options: {
  planTier?: string | null;
  tenantSaasSlug?: string | null;
  tenantPlan?: string | null;
  connectAccountId?: string | null;
  connectStatus?: string | null;
  missingSaas?: boolean;
}) {
  return vi.fn(async (sql: string) => {
    if (sql.includes("FROM saas_instances")) {
      if (options.missingSaas) return null;
      return { id: "saas_1", tenant_id: "tenant_1", plan_tier: options.planTier ?? "pro" };
    }
    if (sql.includes("FROM tenants")) {
      return { id: "tenant_1", plan: options.tenantPlan ?? "pro", saas_slug: options.tenantSaasSlug ?? "drako" };
    }
    if (sql.includes("FROM tenant_stripe_connect")) {
      return {
        connect_account_id: options.connectAccountId ?? "acct_123",
        onboarding_status: options.connectStatus ?? "completed",
      };
    }
    return null;
  });
}

describe("evaluateCustomDomainEntitlement", () => {
  it("allows custom domains when plan, subscription and connect are active", async () => {
    const queryOne = buildQueryOneMock({});
    const getBillingEntitlements = vi.fn().mockResolvedValue({
      tenantId: "tenant_1",
      saasSlug: "drako",
      saasId: "saas_1",
      subscriptionStatus: "active",
      hasVerifiedSubscription: true,
      limits: {},
      features: [],
      usage: {},
    });

    const result = await evaluateCustomDomainEntitlement(
      { tenantId: "tenant_1", saasId: "saas_1" },
      { queryOne: queryOne as any, getBillingEntitlements },
    );

    expect(result.allowed).toBe(true);
    expect(result.code).toBe("ENTITLED");
  });

  it("denies custom domain when subscription is inactive", async () => {
    const queryOne = buildQueryOneMock({});
    const getBillingEntitlements = vi.fn().mockResolvedValue({
      tenantId: "tenant_1",
      saasSlug: "drako",
      saasId: "saas_1",
      subscriptionStatus: "canceled",
      hasVerifiedSubscription: true,
      limits: {},
      features: [],
      usage: {},
    });

    const result = await evaluateCustomDomainEntitlement(
      { tenantId: "tenant_1", saasId: "saas_1" },
      { queryOne: queryOne as any, getBillingEntitlements },
    );

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("SUBSCRIPTION_INACTIVE");
  });

  it("allows custom domains during verified trialing subscriptions", async () => {
    const queryOne = buildQueryOneMock({});
    const getBillingEntitlements = vi.fn().mockResolvedValue({
      tenantId: "tenant_1",
      saasSlug: "drako",
      saasId: "saas_1",
      subscriptionStatus: "trialing",
      hasVerifiedSubscription: true,
      limits: {},
      features: [],
      usage: {},
    });

    const result = await evaluateCustomDomainEntitlement(
      { tenantId: "tenant_1", saasId: "saas_1" },
      { queryOne: queryOne as any, getBillingEntitlements },
    );

    expect(result.allowed).toBe(true);
    expect(result.code).toBe("ENTITLED");
  });

  it("fails closed when billing is not verified even if status looks active", async () => {
    const queryOne = buildQueryOneMock({});
    const getBillingEntitlements = vi.fn().mockResolvedValue({
      tenantId: "tenant_1",
      saasSlug: "drako",
      saasId: "saas_1",
      subscriptionStatus: "active",
      hasVerifiedSubscription: false,
      limits: {},
      features: [],
      usage: {},
    });

    const result = await evaluateCustomDomainEntitlement(
      { tenantId: "tenant_1", saasId: "saas_1" },
      { queryOne: queryOne as any, getBillingEntitlements },
    );

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("SUBSCRIPTION_INACTIVE");
    expect(result.context.subscriptionStatus).toBe("active");
  });

  it("denies drako tenant when connect onboarding is not completed", async () => {
    const queryOne = buildQueryOneMock({ connectStatus: "pending", connectAccountId: "acct_123", tenantSaasSlug: "drako" });
    const getBillingEntitlements = vi.fn().mockResolvedValue({
      tenantId: "tenant_1",
      saasSlug: "drako",
      saasId: "saas_1",
      subscriptionStatus: "active",
      hasVerifiedSubscription: true,
      limits: {},
      features: [],
      usage: {},
    });

    const result = await evaluateCustomDomainEntitlement(
      { tenantId: "tenant_1", saasId: "saas_1" },
      { queryOne: queryOne as any, getBillingEntitlements },
    );

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("STRIPE_CONNECT_REQUIRED");
  });

  it("fails closed when canonical billing lookup throws", async () => {
    const queryOne = buildQueryOneMock({});
    const getBillingEntitlements = vi.fn().mockRejectedValue(new Error("boom"));

    const result = await evaluateCustomDomainEntitlement(
      { tenantId: "tenant_1", saasId: "saas_1" },
      { queryOne: queryOne as any, getBillingEntitlements },
    );

    expect(result.allowed).toBe(false);
    expect(result.code).toBe("SUBSCRIPTION_INACTIVE");
    expect(result.context.subscriptionStatus).toBeNull();
  });
});
