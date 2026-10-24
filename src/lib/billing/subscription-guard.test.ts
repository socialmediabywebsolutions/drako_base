import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCanonicalBillingSnapshot: vi.fn(),
}));

vi.mock("@/lib/billing/subscriptions", () => ({
  getCanonicalBillingSnapshot: mocks.getCanonicalBillingSnapshot,
}));

import { getDrakoBaseSubscriptionAccess } from "@/lib/billing/subscription-guard";

describe("getDrakoBaseSubscriptionAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns none when no verified subscription is present", async () => {
    mocks.getCanonicalBillingSnapshot.mockResolvedValue({
      tenantId: "tenant_alpha",
      saasSlug: "drako",
      saasId: "saas_drako",
      subscription: {
        status: null,
        planCode: null,
        currentPeriodStart: null,
        currentPeriodEnd: null,
        trial: null,
        cancelAtPeriodEnd: null,
        stripeCustomerId: null,
        stripeSubscriptionId: null,
        stripePriceId: null,
        updatedAt: null,
      },
      entitlements: {
        limits: {},
        features: [],
        usage: {},
      },
    });

    const result = await getDrakoBaseSubscriptionAccess("tenant_alpha");

    expect(result).toEqual({
      subscription: null,
      summary: {
        hasActiveDrakoBaseStarter: false,
        status: "none",
        renewsAt: null,
      },
    });
  });

  it.each([
    ["active", true],
    ["trial", false],
    ["trialing", true],
    ["past_due", false],
    ["canceled", false],
  ] satisfies Array<[string, boolean]>)(
    "keeps stable access semantics for status %s",
    async (status, expectedActive) => {
      mocks.getCanonicalBillingSnapshot.mockResolvedValue({
        tenantId: "tenant_alpha",
        saasSlug: "drako",
        saasId: "saas_drako",
        subscription: {
          status,
          planCode: "starter",
          currentPeriodStart: "2026-04-01T00:00:00.000Z",
          currentPeriodEnd: "2026-05-01T00:00:00.000Z",
          trial: status === "trial" || status === "trialing",
          cancelAtPeriodEnd: false,
          stripeCustomerId: "cus_123",
          stripeSubscriptionId: "sub_123",
          stripePriceId: "price_123",
          updatedAt: "2026-04-03T00:00:00.000Z",
        },
        entitlements: {
          limits: { ai_calls: 1000 },
          features: ["SOCIAL"],
          usage: { ai_calls: 12 },
        },
      });

      const result = await getDrakoBaseSubscriptionAccess("tenant_alpha");

      expect(result).toEqual({
        subscription: {
          id: "sub_123",
          status,
          currentPeriodEnd: "2026-05-01T00:00:00.000Z",
          updatedAt: "2026-04-03T00:00:00.000Z",
        },
        summary: {
          hasActiveDrakoBaseStarter: expectedActive,
          status,
          renewsAt: "2026-05-01T00:00:00.000Z",
        },
      });
    },
  );
});
