import { describe, expect, it } from "vitest";
import Stripe from "stripe";
import { constructVerifiedStripeEvent, StripeWebhookAuthError } from "@/lib/billing/stripe-webhook-security";

const stripe = new Stripe("sk_test_123", { apiVersion: "2024-12-18.acacia" as any });

describe("constructVerifiedStripeEvent", () => {
  it("verifies valid Stripe signature using raw body", () => {
    const payload = JSON.stringify({ id: "evt_test_verified", object: "event", type: "invoice.paid", data: { object: {} } });
    const secret = "whsec_test_secret";
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret });

    const event = constructVerifiedStripeEvent({
      stripe,
      rawBody: payload,
      signature,
      webhookSecret: secret,
    });

    expect(event.id).toBe("evt_test_verified");
  });

  it("rejects invalid signature", () => {
    const payload = JSON.stringify({ id: "evt_test_invalid", object: "event", type: "invoice.paid", data: { object: {} } });

    expect(() =>
      constructVerifiedStripeEvent({
        stripe,
        rawBody: payload,
        signature: "t=1,v1=invalid",
        webhookSecret: "whsec_test_secret",
      }),
    ).toThrowError(StripeWebhookAuthError);
  });
});
