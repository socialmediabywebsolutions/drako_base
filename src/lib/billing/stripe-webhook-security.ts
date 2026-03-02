import type Stripe from "stripe";

export class StripeWebhookAuthError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "StripeWebhookAuthError";
    this.status = status;
  }
}

export function constructVerifiedStripeEvent(params: {
  stripe: Stripe;
  rawBody: string;
  signature: string | null;
  webhookSecret: string | null;
}): Stripe.Event {
  if (!params.signature) {
    throw new StripeWebhookAuthError("Missing Stripe-Signature", 400);
  }
  if (!params.webhookSecret) {
    throw new StripeWebhookAuthError("Missing STRIPE_WEBHOOK_SECRET", 503);
  }

  try {
    return params.stripe.webhooks.constructEvent(params.rawBody, params.signature, params.webhookSecret);
  } catch (error) {
    throw new StripeWebhookAuthError(
      `Invalid Stripe signature: ${error instanceof Error ? error.message : String(error)}`,
      400,
    );
  }
}
