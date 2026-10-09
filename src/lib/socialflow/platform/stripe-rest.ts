// Copia de src/lib/stripe/rest.ts para SocialCors (P5). El holding conserva el original; no se comparten módulos.
import "server-only";

import { env } from "@/lib/cf";

type StripeMetadata = Record<string, string>;

type StripeCheckoutSession = {
  id: string;
  url: string | null;
  metadata?: StripeMetadata | null;
  subscription?: string | StripeSubscription | null;
};

type StripeSubscription = {
  id: string;
  status: string;
  metadata: StripeMetadata;
  customer: string | { id?: string } | null;
  cancel_at_period_end: boolean;
  current_period_end?: number | null;
  items: {
    data: Array<{
      price?: {
        id?: string | null;
      } | null;
    }>;
  };
};

function resolveSecretKey(): string | null {
  if (typeof process !== "undefined" && process.env.STRIPE_SECRET_KEY) {
    return process.env.STRIPE_SECRET_KEY;
  }
  const cfEnv = env();
  if (cfEnv?.STRIPE_SECRET_KEY) {
    return cfEnv.STRIPE_SECRET_KEY;
  }
  return null;
}

async function stripeRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const secretKey = resolveSecretKey();
  if (!secretKey) {
    throw new Error("STRIPE_NOT_CONFIGURED");
  }

  const response = await fetch(`https://api.stripe.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${secretKey}`,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`STRIPE_API_ERROR:${response.status}:${body}`);
  }

  return response.json() as Promise<T>;
}

function appendMetadata(params: URLSearchParams, metadata: StripeMetadata, prefix: string) {
  for (const [key, value] of Object.entries(metadata)) {
    params.append(`${prefix}[${key}]`, value);
  }
}

export async function createStripeCustomer(input: {
  email: string;
  metadata: StripeMetadata;
}): Promise<{ id: string }> {
  const params = new URLSearchParams();
  params.set("email", input.email);
  appendMetadata(params, input.metadata, "metadata");

  return stripeRequest<{ id: string }>("/v1/customers", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
}

export async function createStripeCheckoutSession(input: {
  customer: string;
  priceId: string;
  successUrl: string;
  cancelUrl: string;
  metadata: StripeMetadata;
}): Promise<{ id: string; url: string | null }> {
  const params = new URLSearchParams();
  params.set("mode", "subscription");
  params.set("customer", input.customer);
  params.set("line_items[0][price]", input.priceId);
  params.set("line_items[0][quantity]", "1");
  params.set("success_url", input.successUrl);
  params.set("cancel_url", input.cancelUrl);
  params.set("allow_promotion_codes", "true");
  appendMetadata(params, input.metadata, "metadata");
  appendMetadata(params, input.metadata, "subscription_data[metadata]");

  return stripeRequest<{ id: string; url: string | null }>("/v1/checkout/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
}

export async function createStripeBillingPortalSession(input: {
  customer: string;
  returnUrl: string;
}): Promise<{ id: string; url: string | null }> {
  const params = new URLSearchParams();
  params.set("customer", input.customer);
  params.set("return_url", input.returnUrl);

  return stripeRequest<{ id: string; url: string | null }>("/v1/billing_portal/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });
}

export async function retrieveStripeCheckoutSession(sessionId: string): Promise<StripeCheckoutSession> {
  return stripeRequest<StripeCheckoutSession>(
    `/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription`,
    { method: "GET" },
  );
}

export async function retrieveStripeSubscription(subscriptionId: string): Promise<StripeSubscription> {
  return stripeRequest<StripeSubscription>(
    `/v1/subscriptions/${encodeURIComponent(subscriptionId)}`,
    { method: "GET" },
  );
}
