export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { constructVerifiedStripeEvent, StripeWebhookAuthError } from "@/lib/billing/stripe-webhook-security";
import { ensureStripeWebhookDedupe } from "@/lib/billing/stripe-webhook-processor";
import {
  findStripeWebhookEvent,
  insertStripeWebhookReceived,
  updateStripeWebhookFailed,
  updateStripeWebhookProcessed,
} from "@/lib/billing/stripe-webhook-repository";
import { findStripeMappingByStripeIds } from "@/lib/billing/stripe-mapping-repository";
import { getStripe } from "@/lib/stripe/client";
import {
  transitionToPastDue,
  autoPauseIfPastDueExceeded,
  resumeToActive,
  archiveSaaS,
} from "@/lib/os/lifecycle";
import { env as resolveEnv } from "@/lib/cf";
import { writeBillingAuditLog } from "@/lib/billing/billing-audit";

type AuditOutcome = "processed" | "failed" | "ignored_no_mapping" | "duplicate";
type LifecycleAction =
  | "resume_to_active"
  | "transition_to_past_due"
  | "auto_pause_check"
  | "archive_saas"
  | "none";

type StripeInvoiceLike = Stripe.Invoice & { subscription?: string | null };

type HandlerResult = {
  billingStatus: string;
  tenantId: string;
  saasSlug: string;
  saasId: string;
  lifecycleAction: LifecycleAction;
};

function resolveCorrelationId(event: Stripe.Event): string {
  return `${event.id}_${event.created}`;
}

function extractStripeIds(event: Stripe.Event) {
  const obj = event.data.object as Stripe.Invoice | Stripe.Subscription | Stripe.Checkout.Session;
  let productId: string | null = null;
  let priceId: string | null = null;
  if (obj && "lines" in obj && obj.lines?.data?.length) {
    const first = obj.lines.data[0] as Stripe.InvoiceLineItem & { price?: { product?: string | null; id?: string | null } };
    productId = (first.price?.product as string) ?? null;
    priceId = first.price?.id ?? null;
  }
  if ("items" in obj && Array.isArray(obj.items?.data)) {
    const first = obj.items.data[0] as Stripe.SubscriptionItem & { price?: { product?: string | null; id?: string | null } };
    productId = productId ?? ((first.price?.product as string) ?? null);
    priceId = priceId ?? (first.price?.id ?? null);
  }
  return { productId, priceId };
}

async function resolveTenantContext(event: Stripe.Event) {
  const { productId, priceId } = extractStripeIds(event);
  const mapping = await findStripeMappingByStripeIds({
    stripeProductId: productId ?? undefined,
    stripePriceId: priceId ?? undefined,
  });
  if (!mapping) return null;
  return {
    tenantId: mapping.tenantId,
    saasId: mapping.saasId,
    saasSlug: mapping.saasSlug,
  };
}

async function handleInvoicePaid(event: Stripe.Event, ctx: { tenantId: string; saasId: string; saasSlug: string }): Promise<HandlerResult> {
  await resumeToActive(ctx.saasId, event.id);
  return {
    billingStatus: "active",
    tenantId: ctx.tenantId,
    saasSlug: ctx.saasSlug,
    saasId: ctx.saasId,
    lifecycleAction: "resume_to_active",
  };
}

async function handleInvoicePaymentFailed(event: Stripe.Event, ctx: { tenantId: string; saasId: string; saasSlug: string }): Promise<HandlerResult> {
  await transitionToPastDue(ctx.saasId, "stripe_payment_failed", event.id);
  await autoPauseIfPastDueExceeded(ctx.saasId, new Date());
  return {
    billingStatus: "past_due",
    tenantId: ctx.tenantId,
    saasSlug: ctx.saasSlug,
    saasId: ctx.saasId,
    lifecycleAction: "transition_to_past_due",
  };
}

async function handleSubscriptionUpdated(event: Stripe.Event, ctx: { tenantId: string; saasId: string; saasSlug: string }): Promise<HandlerResult> {
  const subscription = event.data.object as Stripe.Subscription;
  const status = subscription.status;
  if (status === "canceled" || status === "unpaid" || status === "incomplete_expired") {
    await archiveSaaS(ctx.saasId, `stripe_subscription_${status}`);
    return {
      billingStatus: status,
      tenantId: ctx.tenantId,
      saasSlug: ctx.saasSlug,
      saasId: ctx.saasId,
      lifecycleAction: "archive_saas",
    };
  }
  if (status === "past_due") {
    await transitionToPastDue(ctx.saasId, "stripe_subscription_past_due", event.id);
    await autoPauseIfPastDueExceeded(ctx.saasId, new Date());
    return {
      billingStatus: status,
      tenantId: ctx.tenantId,
      saasSlug: ctx.saasSlug,
      saasId: ctx.saasId,
      lifecycleAction: "transition_to_past_due",
    };
  }
  await resumeToActive(ctx.saasId, event.id);
  return {
    billingStatus: status,
    tenantId: ctx.tenantId,
    saasSlug: ctx.saasSlug,
    saasId: ctx.saasId,
    lifecycleAction: "resume_to_active",
  };
}

async function handleSubscriptionDeleted(event: Stripe.Event, ctx: { tenantId: string; saasId: string; saasSlug: string }): Promise<HandlerResult> {
  await archiveSaaS(ctx.saasId, "stripe_subscription_deleted");
  return {
    billingStatus: "canceled",
    tenantId: ctx.tenantId,
    saasSlug: ctx.saasSlug,
    saasId: ctx.saasId,
    lifecycleAction: "archive_saas",
  };
}

async function dispatchStripeEvent(event: Stripe.Event) {
  const correlationId = resolveCorrelationId(event);
  const dedupe = await ensureStripeWebhookDedupe({
    store: {
      findEvent: findStripeWebhookEvent,
      insertReceived: ({ eventId, correlationId: cid }) => insertStripeWebhookReceived({ eventId, correlationId: cid }),
      markProcessed: ({ eventId, attempts, tenantId, saasSlug }) =>
        updateStripeWebhookProcessed({ eventId, attempts, tenantId, saasSlug }),
      markFailed: ({ eventId, attempts, lastError, tenantId, saasSlug }) =>
        updateStripeWebhookFailed({ eventId, attempts, lastError, tenantId, saasSlug }),
    },
    eventId: event.id,
    correlationId,
  });

  if (dedupe.status === "duplicate") {
    await writeBillingAuditLog({
      eventType: event.type,
      stripeEventId: event.id,
      outcome: "duplicate",
      severity: "info",
      metadata: {
        outcome: "duplicate",
        lifecycle_action: "none",
        billing_status: null,
        message: "duplicate webhook event",
        saas_id: null,
      },
      correlationId,
    });
    return { ok: true, deduped: true };
  }

  const ctx = await resolveTenantContext(event);
  if (!ctx) {
    await updateStripeWebhookProcessed({ eventId: event.id, attempts: dedupe.attempts, tenantId: null, saasSlug: null });
    await writeBillingAuditLog({
      eventType: event.type,
      stripeEventId: event.id,
      outcome: "ignored_no_mapping",
      severity: "warning",
      metadata: {
        outcome: "ignored_no_mapping",
        lifecycle_action: "none",
        billing_status: null,
        message: "stripe event without mapping",
        saas_id: null,
      },
      correlationId,
    });
    return { ok: true, unmapped: true };
  }

  try {
    let result: HandlerResult | null = null;
    switch (event.type) {
      case "invoice.paid":
        result = await handleInvoicePaid(event, ctx);
        break;
      case "invoice.payment_failed":
        result = await handleInvoicePaymentFailed(event, ctx);
        break;
      case "customer.subscription.updated":
        result = await handleSubscriptionUpdated(event, ctx);
        break;
      case "customer.subscription.deleted":
        result = await handleSubscriptionDeleted(event, ctx);
        break;
      default:
        break;
    }

    await updateStripeWebhookProcessed({
      eventId: event.id,
      attempts: dedupe.attempts,
      tenantId: ctx.tenantId,
      saasSlug: ctx.saasSlug,
    });

    await writeBillingAuditLog({
      eventType: event.type,
      stripeEventId: event.id,
      tenantId: ctx.tenantId,
      saasSlug: ctx.saasSlug,
      outcome: "processed",
      severity: "info",
      metadata: {
        outcome: "processed",
        lifecycle_action: result?.lifecycleAction ?? "none",
        billing_status: result?.billingStatus ?? null,
        saas_id: ctx.saasId,
      },
      correlationId,
    });

    return { ok: true, handled: Boolean(result), billingStatus: result?.billingStatus ?? null };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await updateStripeWebhookFailed({
      eventId: event.id,
      attempts: dedupe.attempts + 1,
      lastError: message,
      tenantId: ctx.tenantId,
      saasSlug: ctx.saasSlug,
    });
    await writeBillingAuditLog({
      eventType: event.type,
      stripeEventId: event.id,
      tenantId: ctx.tenantId,
      saasSlug: ctx.saasSlug,
      outcome: "failed",
      severity: "error",
      metadata: {
        outcome: "failed",
        lifecycle_action: "none",
        billing_status: null,
        message,
        saas_id: ctx.saasId,
      },
      correlationId,
    });
    throw error;
  }
}

export async function POST(request: Request) {
  try {
    const signature = request.headers.get("stripe-signature");
    const body = await request.text();
    const stripe = await getStripe();
    if (!stripe) {
      return NextResponse.json({ ok: false, code: "STRIPE_NOT_CONFIGURED" }, { status: 503 });
    }

    const event = await constructVerifiedStripeEvent({
      stripe,
      rawBody: body,
      signature,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET ?? resolveEnv()?.STRIPE_WEBHOOK_SECRET ?? null,
    });

    await dispatchStripeEvent(event);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof StripeWebhookAuthError) {
      return NextResponse.json({ ok: false, code: error.message }, { status: error.status });
    }
    console.error("STRIPE_WEBHOOK_ERROR", error);
    return NextResponse.json({ ok: false, code: "INTERNAL_ERROR" }, { status: 500 });
  }
}
