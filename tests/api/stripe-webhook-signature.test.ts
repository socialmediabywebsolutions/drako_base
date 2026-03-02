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
  resolveWebhookAttribution: vi.fn(),
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
  ensureStripeWebhookDedupe: vi.fn(),
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
});
