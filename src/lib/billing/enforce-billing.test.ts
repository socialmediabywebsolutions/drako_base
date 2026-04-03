import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  run: vi.fn(),
  writeBillingAuditLog: vi.fn(),
  getCanonicalBillingEntitlements: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  run: mocks.run,
}));

vi.mock("@/lib/billing/billing-audit", () => ({
  writeBillingAuditLog: mocks.writeBillingAuditLog,
}));

vi.mock("@/lib/billing/subscriptions", () => ({
  getCanonicalBillingEntitlements: mocks.getCanonicalBillingEntitlements,
}));

import { enforceBilling } from "@/lib/billing/enforce-billing";

describe("enforceBilling canonical entitlements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.run.mockResolvedValue(true);
    mocks.writeBillingAuditLog.mockResolvedValue(undefined);
  });

  it("fails closed with needs_billing when no verified subscription exists", async () => {
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

    const result = await enforceBilling("drako", "tenant_alpha", "ai_calls", 1);
    expect(result).toEqual({ allowed: false, reason: "needs_billing", status: 403 });
  });

  it("fails closed when quota is undefined in entitlements", async () => {
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

    const result = await enforceBilling("drako", "tenant_alpha", "ai_calls", 1);
    expect(result).toEqual({ allowed: false, reason: "QUOTA_NOT_DEFINED", status: 403 });
  });

  it("allows active/trial/trialing without quota increment", async () => {
    for (const status of ["active", "trial", "trialing"]) {
      mocks.getCanonicalBillingEntitlements.mockResolvedValueOnce({
        tenantId: "t1",
        saasSlug: "drako",
        saasId: "saas_drako",
        subscriptionStatus: status,
        hasVerifiedSubscription: true,
        limits: {},
        features: ["SOCIAL"],
        usage: {},
      });
      const result = await enforceBilling("drako", "t1", "feature_access", 0);
      expect(result).toEqual({ allowed: true, status: 200 });
    }
  });

  it("blocks past_due for any action", async () => {
    mocks.getCanonicalBillingEntitlements.mockResolvedValue({
      tenantId: "t1",
      saasSlug: "drako",
      saasId: "saas_drako",
      subscriptionStatus: "past_due",
      hasVerifiedSubscription: true,
      limits: {},
      features: [],
      usage: {},
    });
    const result = await enforceBilling("drako", "t1", "feature_access", 0);
    expect(result).toEqual({ allowed: false, reason: "PAST_DUE_BLOCK", status: 402 });
    expect(mocks.writeBillingAuditLog).toHaveBeenCalled();
  });

  it("blocks incomplete explicitly", async () => {
    mocks.getCanonicalBillingEntitlements.mockResolvedValue({
      tenantId: "t1",
      saasSlug: "drako",
      saasId: "saas_drako",
      subscriptionStatus: "incomplete",
      hasVerifiedSubscription: true,
      limits: {},
      features: [],
      usage: {},
    });
    const result = await enforceBilling("drako", "t1", "feature_access", 0);
    expect(result).toEqual({ allowed: false, reason: "SUBSCRIPTION_INCOMPLETE", status: 402 });
  });

  it("blocks unpaid/canceled/incomplete_expired and unknown", async () => {
    const blocked = ["unpaid", "canceled", "incomplete_expired", "unknown_state"] as const;
    for (const status of blocked) {
      mocks.getCanonicalBillingEntitlements.mockResolvedValueOnce({
        tenantId: "t1",
        saasSlug: "drako",
        saasId: "saas_drako",
        subscriptionStatus: status,
        hasVerifiedSubscription: true,
        limits: {},
        features: [],
        usage: {},
      });
      const result = await enforceBilling("drako", "t1", "feature_access", 0);
      expect(result.allowed).toBe(false);
      expect(result.status).toBe(402);
    }
  });

  it("fails closed when the canonical usage snapshot is missing for the requested quota", async () => {
    mocks.getCanonicalBillingEntitlements.mockResolvedValue({
      tenantId: "tenant_alpha",
      saasSlug: "drako",
      saasId: "saas_drako",
      subscriptionStatus: "active",
      hasVerifiedSubscription: true,
      limits: { ai_calls: 100 },
      features: [],
      usage: {},
    });

    const result = await enforceBilling("drako", "tenant_alpha", "ai_calls", 1);
    expect(result).toEqual({ allowed: false, reason: "QUOTA_NOT_DEFINED", status: 403 });
  });

  it("blocks when canonical usage exceeds the canonical limit", async () => {
    mocks.getCanonicalBillingEntitlements.mockResolvedValue({
      tenantId: "tenant_alpha",
      saasSlug: "drako",
      saasId: "saas_drako",
      subscriptionStatus: "active",
      hasVerifiedSubscription: true,
      limits: { ai_calls: 100 },
      features: ["SOCIAL"],
      usage: { ai_calls: 99 },
    });

    const result = await enforceBilling("drako", "tenant_alpha", "ai_calls", 2);
    expect(result).toEqual({ allowed: false, reason: "QUOTA_EXCEEDED", status: 429 });
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("allows when canonical usage is under the limit and persists the increment", async () => {
    mocks.getCanonicalBillingEntitlements.mockResolvedValue({
      tenantId: "tenant_alpha",
      saasSlug: "drako",
      saasId: "saas_drako",
      subscriptionStatus: "active",
      hasVerifiedSubscription: true,
      limits: { ai_calls: 100 },
      features: ["SOCIAL"],
      usage: { ai_calls: 40 },
    });

    const result = await enforceBilling("drako", "tenant_alpha", "ai_calls", 2);
    expect(result).toEqual({ allowed: true, status: 200 });
    expect(mocks.run).toHaveBeenCalledWith(
      `UPDATE saas_usage_quotas SET current_value = current_value + ?, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
         WHERE saas_slug = ? AND tenant_id = ? AND quota_key = ?`,
      2,
      "drako",
      "tenant_alpha",
      "ai_calls",
    );
  });

  it("keeps unlimited quotas working when the canonical limit is -1", async () => {
    mocks.getCanonicalBillingEntitlements.mockResolvedValue({
      tenantId: "tenant_alpha",
      saasSlug: "drako",
      saasId: "saas_drako",
      subscriptionStatus: "trialing",
      hasVerifiedSubscription: true,
      limits: { ai_calls: -1 },
      features: ["SOCIAL"],
      usage: { ai_calls: 9999 },
    });

    const result = await enforceBilling("drako", "tenant_alpha", "ai_calls", 50);
    expect(result).toEqual({ allowed: true, status: 200 });
    expect(mocks.run).toHaveBeenCalledTimes(1);
  });

  it("fails closed with system error if canonical billing lookup throws", async () => {
    mocks.getCanonicalBillingEntitlements.mockRejectedValue(new Error("boom"));

    const result = await enforceBilling("drako", "tenant_alpha", "ai_calls", 1);
    expect(result).toEqual({ allowed: false, reason: "SYSTEM_ERROR", status: 403 });
  });
});
