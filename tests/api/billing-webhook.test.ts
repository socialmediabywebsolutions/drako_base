import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class HoistedStripeWebhookAuthError extends Error {
    status: number;

    constructor(message: string, status: number) {
      super(message);
      this.status = status;
    }
  }

  return {
    constructVerifiedStripeEvent: vi.fn(),
    ensureStripeWebhookDedupe: vi.fn(),
    findStripeMappingByStripeIds: vi.fn(),
    getStripe: vi.fn(),
    resumeToActive: vi.fn(),
    transitionToPastDue: vi.fn(),
    autoPauseIfPastDueExceeded: vi.fn(),
    archiveSaaS: vi.fn(),
    writeBillingAuditLog: vi.fn(),
    findStripeWebhookEvent: vi.fn(),
    insertStripeWebhookReceived: vi.fn(),
    updateStripeWebhookFailed: vi.fn(),
    updateStripeWebhookProcessed: vi.fn(),
    StripeWebhookAuthError: HoistedStripeWebhookAuthError,
  };
});

vi.mock("@/lib/billing/stripe-webhook-security", () => ({
  constructVerifiedStripeEvent: mocks.constructVerifiedStripeEvent,
  StripeWebhookAuthError: mocks.StripeWebhookAuthError,
}));

vi.mock("@/lib/billing/stripe-webhook-processor", () => ({
  ensureStripeWebhookDedupe: mocks.ensureStripeWebhookDedupe,
}));

vi.mock("@/lib/billing/stripe-webhook-repository", () => ({
  findStripeWebhookEvent: mocks.findStripeWebhookEvent,
  insertStripeWebhookReceived: mocks.insertStripeWebhookReceived,
  updateStripeWebhookFailed: mocks.updateStripeWebhookFailed,
  updateStripeWebhookProcessed: mocks.updateStripeWebhookProcessed,
}));

vi.mock("@/lib/billing/stripe-mapping-repository", () => ({
  findStripeMappingByStripeIds: mocks.findStripeMappingByStripeIds,
}));

vi.mock("@/lib/stripe/client", () => ({
  getStripe: mocks.getStripe,
}));

vi.mock("@/lib/os/lifecycle", () => ({
  resumeToActive: mocks.resumeToActive,
  transitionToPastDue: mocks.transitionToPastDue,
  autoPauseIfPastDueExceeded: mocks.autoPauseIfPastDueExceeded,
  archiveSaaS: mocks.archiveSaaS,
}));

vi.mock("@/lib/cf", () => ({
  env: () => ({ STRIPE_WEBHOOK_SECRET: "whsec_test" }),
}));

vi.mock("@/lib/billing/billing-audit", () => ({
  writeBillingAuditLog: mocks.writeBillingAuditLog,
}));

import { POST } from "@/app/api/webhooks/stripe/route";

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getStripe.mockResolvedValue({ id: "stripe_client" });
    mocks.ensureStripeWebhookDedupe.mockResolvedValue({ status: "new", attempts: 1 });
    mocks.findStripeMappingByStripeIds.mockResolvedValue({
      tenantId: "tenant_1",
      saasId: "saas_1",
      saasSlug: "mentoria",
    });
    mocks.updateStripeWebhookProcessed.mockResolvedValue(undefined);
    mocks.updateStripeWebhookFailed.mockResolvedValue(undefined);
    mocks.writeBillingAuditLog.mockResolvedValue(undefined);
    mocks.resumeToActive.mockResolvedValue(undefined);
    mocks.transitionToPastDue.mockResolvedValue(undefined);
    mocks.autoPauseIfPastDueExceeded.mockResolvedValue(undefined);
    mocks.archiveSaaS.mockResolvedValue(undefined);
  });

  it("processes invoice.paid events through the canonical webhook lifecycle", async () => {
    mocks.constructVerifiedStripeEvent.mockResolvedValue({
      id: "evt_paid_1",
      created: 1710000000,
      type: "invoice.paid",
      data: {
        object: {
          lines: {
            data: [{ price: { product: "prod_1", id: "price_1" } }],
          },
        },
      },
    });

    const response = await POST(
      new Request("https://drako.systems/api/webhooks/stripe", {
        method: "POST",
        headers: {
          "stripe-signature": "sig_test",
        },
        body: "payload",
      }),
    );

    expect(response.status).toBe(200);
    expect(mocks.ensureStripeWebhookDedupe).toHaveBeenCalledTimes(1);
    expect(mocks.findStripeMappingByStripeIds).toHaveBeenCalledWith({
      stripeProductId: "prod_1",
      stripePriceId: "price_1",
    });
    expect(mocks.resumeToActive).toHaveBeenCalledWith("saas_1", "evt_paid_1");
    expect(mocks.updateStripeWebhookProcessed).toHaveBeenCalled();
  });

  it("returns the auth error status when signature validation fails", async () => {
    mocks.constructVerifiedStripeEvent.mockRejectedValue(
      new mocks.StripeWebhookAuthError("Missing Stripe-Signature", 400),
    );

    const response = await POST(
      new Request("https://drako.systems/api/webhooks/stripe", {
        method: "POST",
        body: "payload",
      }),
    );

    expect(response.status).toBe(400);
    const payload = (await response.json()) as { code: string };
    expect(payload.code).toBe("Missing Stripe-Signature");
  });
});
