import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class StripeWebhookAuthError extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  }

  return {
    getStripe: vi.fn(),
    recordCampamentoEvent: vi.fn(),
    enforcePublicEndpointPolicy: vi.fn(),
    constructVerifiedStripeEvent: vi.fn(),
    resolveWebhookAttribution: vi.fn(),
    ensureStripeWebhookDedupe: vi.fn(),
    upsertCanonicalSubscriptionState: vi.fn(),
    syncSaasUsageQuotasFromPlan: vi.fn(),
    syncWorkspaceBillingFromCheckout: vi.fn(),
    syncWorkspaceBillingFromSubscription: vi.fn(),
    extractWorkspaceBillingMetadata: vi.fn(),
    StripeWebhookAuthError,
  };
});

vi.mock("@/lib/stripe/client", () => ({
  getStripe: mocks.getStripe,
}));

vi.mock("@/lib/env", () => ({
  safeEnv: { STRIPE_WEBHOOK_SECRET: "whsec_test" },
}));

vi.mock("@/lib/cf", () => ({
  env: () => ({}),
}));

vi.mock("@/lib/billing/subscriptions", () => ({
  saveSubscriptionRecord: vi.fn(),
  upsertCanonicalSubscriptionState: mocks.upsertCanonicalSubscriptionState,
  syncSaasUsageQuotasFromPlan: mocks.syncSaasUsageQuotasFromPlan,
}));

vi.mock("@/lib/billing/tenant-workspace", () => ({
  extractWorkspaceBillingMetadata: mocks.extractWorkspaceBillingMetadata,
  syncWorkspaceBillingFromCheckout: mocks.syncWorkspaceBillingFromCheckout,
  syncWorkspaceBillingFromSubscription: mocks.syncWorkspaceBillingFromSubscription,
}));

vi.mock("@/lib/billing/client-saas-subscriptions", () => ({
  saveClientSaasSubscription: vi.fn(),
}));

vi.mock("@/lib/billing/entitlements", () => ({
  syncSaasFeaturesFromPlan: vi.fn(),
}));

vi.mock("@/lib/empire/events", () => ({
  recordCampamentoEvent: mocks.recordCampamentoEvent,
}));

vi.mock("@/lib/billing/stripe-webhook-attribution", () => ({
  resolveWebhookAttribution: mocks.resolveWebhookAttribution,
}));

vi.mock("@/lib/billing/stripe-webhook-anomalies", () => ({
  deriveStripeWebhookAnomalies: vi.fn(() => []),
}));

vi.mock("@/lib/owner/action-queue-repository", () => ({
  createOrMergeActionFromWebhook: vi.fn(),
}));

vi.mock("@/lib/security/public-endpoints", () => ({
  enforcePublicEndpointPolicy: mocks.enforcePublicEndpointPolicy,
}));

vi.mock("@/lib/http/errors", () => ({
  respondDatabaseError: vi.fn(() => null),
}));

vi.mock("@/lib/campamento-base/saas-factory-orchestrator", () => ({
  createSaasFromBlueprint: vi.fn(),
}));

vi.mock("@/lib/campamento-base/saas-factory-helpers", () => ({
  withCampamentoBaseProfile: vi.fn((input) => input),
}));

vi.mock("@/lib/billing/stripe-webhook-repository", () => ({
  findStripeWebhookEvent: vi.fn(),
  insertStripeWebhookReceived: vi.fn(),
  updateStripeWebhookProcessed: vi.fn(),
  updateStripeWebhookFailed: vi.fn(),
}));

vi.mock("@/lib/billing/stripe-webhook-processor", () => ({
  ensureStripeWebhookDedupe: mocks.ensureStripeWebhookDedupe,
}));

vi.mock("@/lib/os/lifecycle", () => ({
  transitionToPastDue: vi.fn(),
  resumeToActive: vi.fn(),
}));

vi.mock("@/lib/billing/stripe-webhook-security", () => ({
  constructVerifiedStripeEvent: mocks.constructVerifiedStripeEvent,
  StripeWebhookAuthError: mocks.StripeWebhookAuthError,
}));

import { POST } from "@/app/api/stripe/webhook/route";

describe("/api/stripe/webhook signature validation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enforcePublicEndpointPolicy.mockResolvedValue(null);
    mocks.getStripe.mockResolvedValue({ webhooks: { constructEvent: vi.fn() } });
    mocks.resolveWebhookAttribution.mockResolvedValue({
      tenantId: "tenant_alpha",
      saasId: "saas_alpha",
      saasSlug: "drako",
      source: "metadata",
      mismatch: false,
      drift: false,
    });
    mocks.ensureStripeWebhookDedupe.mockResolvedValue({ status: "accepted", attempts: 1 });
    mocks.extractWorkspaceBillingMetadata.mockReturnValue(null);
    mocks.constructVerifiedStripeEvent.mockImplementation(() => {
      throw new mocks.StripeWebhookAuthError("Invalid signature", 400);
    });
  });

  it("returns 400 when signature is invalid", async () => {
    const request = new Request("https://drako.systems/api/stripe/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=1,v1=invalid",
      },
      body: JSON.stringify({ id: "evt_invalid" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(mocks.recordCampamentoEvent).toHaveBeenCalledTimes(1);
  });

  it("updates canonical subscription state and quotas on customer.subscription.updated", async () => {
    mocks.constructVerifiedStripeEvent.mockReturnValue({
      id: "evt_subscription_updated",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
          status: "active",
          current_period_end: 1_700_000_000,
          cancel_at_period_end: false,
          customer: "cus_123",
          items: {
            data: [{ price: { id: "price_starter" } }],
          },
          metadata: {
            tenantId: "tenant_alpha",
            clientId: "client_alpha",
            saasId: "saas_alpha",
            saasSlug: "drako",
            planCode: "starter",
          },
        },
      },
    });

    const request = new Request("https://drako.systems/api/stripe/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "stripe-signature": "t=1,v1=valid",
      },
      body: JSON.stringify({ id: "evt_subscription_updated" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mocks.upsertCanonicalSubscriptionState).toHaveBeenCalledTimes(1);
    expect(mocks.syncSaasUsageQuotasFromPlan).toHaveBeenCalledTimes(1);
  });

  it("routes tenant_workspace checkout completion into tenant_billing without touching product billing", async () => {
    mocks.resolveWebhookAttribution.mockResolvedValue({
      tenantId: "tenant_workspace_1",
      saasId: null,
      saasSlug: null,
      source: "metadata",
      mismatch: false,
      drift: false,
    });
    mocks.extractWorkspaceBillingMetadata.mockImplementation((metadata: Record<string, string> | null | undefined) => {
      if (metadata?.scope !== "tenant_workspace" || !metadata.tenantId) return null;
      return {
        tenantId: metadata.tenantId,
        plan: "PRO",
        scope: "tenant_workspace",
      };
    });
    mocks.constructVerifiedStripeEvent.mockReturnValue({
      id: "evt_workspace_checkout",
      type: "checkout.session.completed",
      data: {
        object: {
          id: "cs_workspace_1",
          customer: "cus_workspace_1",
          subscription: "sub_workspace_1",
          metadata: {
            tenantId: "tenant_workspace_1",
            plan: "PRO",
            scope: "tenant_workspace",
          },
        },
      },
    });

    const response = await POST(
      new Request("https://drako.systems/api/stripe/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "stripe-signature": "t=1,v1=valid",
        },
        body: JSON.stringify({ id: "evt_workspace_checkout" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.syncWorkspaceBillingFromCheckout).toHaveBeenCalledTimes(1);
    expect(mocks.upsertCanonicalSubscriptionState).not.toHaveBeenCalled();
    expect(mocks.syncSaasUsageQuotasFromPlan).not.toHaveBeenCalled();
  });

  it("routes tenant_workspace invoice failures into tenant_billing without touching product billing", async () => {
    mocks.resolveWebhookAttribution.mockResolvedValue({
      tenantId: "tenant_workspace_1",
      saasId: null,
      saasSlug: null,
      source: "metadata",
      mismatch: false,
      drift: false,
    });
    mocks.extractWorkspaceBillingMetadata.mockImplementation((metadata: Record<string, string> | null | undefined) => {
      if (metadata?.scope !== "tenant_workspace" || !metadata.tenantId) return null;
      return {
        tenantId: metadata.tenantId,
        plan: "STARTER",
        scope: "tenant_workspace",
      };
    });
    mocks.getStripe.mockResolvedValue({
      subscriptions: {
        retrieve: vi.fn().mockResolvedValue({
          id: "sub_workspace_1",
          status: "active",
          customer: "cus_workspace_1",
          metadata: {
            tenantId: "tenant_workspace_1",
            plan: "STARTER",
            scope: "tenant_workspace",
          },
          items: { data: [{ price: { id: "price_workspace" } }] },
        }),
      },
    });
    mocks.constructVerifiedStripeEvent.mockReturnValue({
      id: "evt_workspace_failed",
      type: "invoice.payment_failed",
      data: {
        object: {
          subscription: "sub_workspace_1",
          billing_reason: "subscription_cycle",
        },
      },
    });

    const response = await POST(
      new Request("https://drako.systems/api/stripe/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "stripe-signature": "t=1,v1=valid",
        },
        body: JSON.stringify({ id: "evt_workspace_failed" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.syncWorkspaceBillingFromSubscription).toHaveBeenCalledWith(
      expect.objectContaining({ id: "sub_workspace_1" }),
      { statusOverride: "past_due" },
    );
    expect(mocks.upsertCanonicalSubscriptionState).not.toHaveBeenCalled();
  });
});
