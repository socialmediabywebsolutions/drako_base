import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  getCanonicalBillingEntitlements: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  run: mocks.run,
}));

vi.mock("@/lib/billing/subscriptions", () => ({
  getCanonicalBillingEntitlements: mocks.getCanonicalBillingEntitlements,
}));

import { checkQuota, incrementQuota } from "@/lib/billing/quota-guard";

describe("quota-guard canonical wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.run.mockResolvedValue(true);
  });

  it("fails closed when no verified subscription exists", async () => {
    mocks.getCanonicalBillingEntitlements.mockResolvedValue({
      tenantId: "tenant_alpha",
      saasSlug: "drako",
      saasId: "saas_drako",
      subscriptionStatus: null,
      hasVerifiedSubscription: false,
      limits: {},
      features: [],
      usage: {},
    });

    await expect(
      checkQuota({ tenantId: "tenant_alpha", saasSlug: "drako", quotaKey: "ai_calls", increment: 1 }),
    ).resolves.toEqual({
      allowed: false,
      reason: "SUBSCRIPTION_MISSING",
      statusCode: 403,
    });
  });

  it("aligns with canonical blocking for past_due subscriptions", async () => {
    mocks.getCanonicalBillingEntitlements.mockResolvedValue({
      tenantId: "tenant_alpha",
      saasSlug: "drako",
      saasId: "saas_drako",
      subscriptionStatus: "past_due",
      hasVerifiedSubscription: true,
      limits: { ai_calls: 100 },
      features: [],
      usage: { ai_calls: 4 },
    });

    await expect(
      checkQuota({ tenantId: "tenant_alpha", saasSlug: "drako", quotaKey: "ai_calls", increment: 1 }),
    ).resolves.toEqual({
      allowed: false,
      reason: "PAST_DUE_BLOCK",
      statusCode: 402,
    });
  });

  it("fails closed when the requested quota is missing from canonical entitlements", async () => {
    mocks.getCanonicalBillingEntitlements.mockResolvedValue({
      tenantId: "tenant_alpha",
      saasSlug: "drako",
      saasId: "saas_drako",
      subscriptionStatus: "active",
      hasVerifiedSubscription: true,
      limits: {},
      features: [],
      usage: {},
    });

    await expect(
      checkQuota({ tenantId: "tenant_alpha", saasSlug: "drako", quotaKey: "ai_calls", increment: 1 }),
    ).resolves.toEqual({
      allowed: false,
      reason: "QUOTA_NOT_INITIALIZED",
      statusCode: 403,
    });
  });

  it("blocks when the canonical quota would be exceeded", async () => {
    mocks.getCanonicalBillingEntitlements.mockResolvedValue({
      tenantId: "tenant_alpha",
      saasSlug: "drako",
      saasId: "saas_drako",
      subscriptionStatus: "active",
      hasVerifiedSubscription: true,
      limits: { ai_calls: 100 },
      features: [],
      usage: { ai_calls: 99 },
    });

    await expect(
      checkQuota({ tenantId: "tenant_alpha", saasSlug: "drako", quotaKey: "ai_calls", increment: 2 }),
    ).resolves.toEqual({
      allowed: false,
      reason: "QUOTA_EXCEEDED",
      current: 99,
      limit: 100,
      statusCode: 429,
    });
  });

  it("allows unlimited canonical quotas", async () => {
    mocks.getCanonicalBillingEntitlements.mockResolvedValue({
      tenantId: "tenant_alpha",
      saasSlug: "drako",
      saasId: "saas_drako",
      subscriptionStatus: "trialing",
      hasVerifiedSubscription: true,
      limits: { ai_calls: -1 },
      features: [],
      usage: { ai_calls: 9_999 },
    });

    await expect(
      checkQuota({ tenantId: "tenant_alpha", saasSlug: "drako", quotaKey: "ai_calls", increment: 50 }),
    ).resolves.toEqual({
      allowed: true,
      current: 9_999,
      limit: -1,
    });
  });

  it("returns allowance when canonical usage is under limit", async () => {
    mocks.getCanonicalBillingEntitlements.mockResolvedValue({
      tenantId: "tenant_alpha",
      saasSlug: "drako",
      saasId: "saas_drako",
      subscriptionStatus: "active",
      hasVerifiedSubscription: true,
      limits: { ai_calls: 100 },
      features: [],
      usage: { ai_calls: 40 },
    });

    await expect(
      checkQuota({ tenantId: "tenant_alpha", saasSlug: "drako", quotaKey: "ai_calls", increment: 2 }),
    ).resolves.toEqual({
      allowed: true,
      current: 40,
      limit: 100,
    });
  });

  it("fails closed with system error when canonical billing lookup throws", async () => {
    mocks.getCanonicalBillingEntitlements.mockRejectedValue(new Error("boom"));

    await expect(
      checkQuota({ tenantId: "tenant_alpha", saasSlug: "drako", quotaKey: "ai_calls", increment: 1 }),
    ).resolves.toEqual({
      allowed: false,
      reason: "SYSTEM_ERROR",
      statusCode: 403,
    });
  });

  it("keeps incrementQuota as a focused usage updater", async () => {
    await incrementQuota({
      tenantId: "tenant_alpha",
      saasSlug: "drako",
      quotaKey: "ai_calls",
      amount: 2,
    });

    expect(mocks.run).toHaveBeenCalledWith(
      `UPDATE saas_usage_quotas 
     SET current_value = current_value + ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE tenant_id = ? AND saas_slug = ? AND quota_key = ?`,
      2,
      "tenant_alpha",
      "drako",
      "ai_calls",
    );
  });
});
