import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  constructVerifiedStripeEvent,
  getStripe,
  extractWorkspaceBillingMetadata,
  syncWorkspaceBillingFromCheckout,
  syncWorkspaceBillingFromSubscription,
  StripeWebhookAuthError,
} = vi.hoisted(() => {
  class HoistedStripeWebhookAuthError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }

  return {
    constructVerifiedStripeEvent: vi.fn(),
    getStripe: vi.fn(),
    extractWorkspaceBillingMetadata: vi.fn(),
    syncWorkspaceBillingFromCheckout: vi.fn(),
    syncWorkspaceBillingFromSubscription: vi.fn(),
    StripeWebhookAuthError: HoistedStripeWebhookAuthError,
  };
});

vi.mock("@/lib/billing/stripe-webhook-security", () => ({
  constructVerifiedStripeEvent,
  StripeWebhookAuthError,
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripe,
}));

vi.mock("@/lib/billing/tenant-workspace", () => ({
  extractWorkspaceBillingMetadata,
  syncWorkspaceBillingFromCheckout,
  syncWorkspaceBillingFromSubscription,
}));

import { POST } from "@/app/api/webhooks/stripe/route";

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getStripe.mockResolvedValue({ id: "stripe_client" });
  });

  it("syncs workspace billing from checkout.session.completed events", async () => {
    constructVerifiedStripeEvent.mockReturnValue({
      type: "checkout.session.completed",
      data: { object: { metadata: { scope: "tenant_workspace", tenantId: "tenant_1", plan: "STARTER" } } },
    });
    extractWorkspaceBillingMetadata.mockReturnValue({
      tenantId: "tenant_1",
      plan: "STARTER",
      scope: "tenant_workspace",
    });

    const response = await POST(new Request("https://drako.systems/api/webhooks/stripe", {
      method: "POST",
      headers: {
        "stripe-signature": "sig_test",
      },
      body: "payload",
    }));

    expect(response.status).toBe(200);
    expect(syncWorkspaceBillingFromCheckout).toHaveBeenCalledTimes(1);
  });

  it("returns the auth error status when signature validation fails", async () => {
    constructVerifiedStripeEvent.mockImplementation(() => {
      throw new StripeWebhookAuthError("Missing Stripe-Signature", 400);
    });

    const response = await POST(new Request("https://drako.systems/api/webhooks/stripe", {
      method: "POST",
      body: "payload",
    }));

    expect(response.status).toBe(400);
    const payload = await response.json() as { code: string };
    expect(payload.code).toBe("Missing Stripe-Signature");
  });
});
