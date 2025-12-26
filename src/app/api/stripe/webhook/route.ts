import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { env } from "@/lib/cf";
import { saveSubscriptionRecord } from "@/lib/billing/subscriptions";
import { saveClientSaasSubscription } from "@/lib/billing/client-saas-subscriptions";
import { syncSaasFeaturesFromPlan } from "@/lib/billing/entitlements";
import { recordCampamentoEvent } from "@/lib/empire/events";
import { resolveTenantId } from "@/lib/tenants/services";
import { resolveWebhookAttribution } from "@/lib/billing/stripe-webhook-attribution";
import { deriveStripeWebhookAnomalies } from "@/lib/billing/stripe-webhook-anomalies";
import { createOrMergeActionFromWebhook } from "@/lib/owner/action-queue-repository";
import { enforcePublicEndpointPolicy } from "@/lib/security/public-endpoints";
import {
  findStripeWebhookEvent,
  insertStripeWebhookReceived,
  updateStripeWebhookProcessed,
  updateStripeWebhookFailed,
} from "@/lib/billing/stripe-webhook-repository";
import { ensureStripeWebhookDedupe } from "@/lib/billing/stripe-webhook-processor";

export const runtime = "nodejs";

function getWebhookSecret(): string {
  if (typeof process !== "undefined" && process.env.STRIPE_WEBHOOK_SECRET) {
    return process.env.STRIPE_WEBHOOK_SECRET;
  }
  const cfEnv = env();
  if (cfEnv?.STRIPE_WEBHOOK_SECRET) {
    return cfEnv.STRIPE_WEBHOOK_SECRET;
  }
  throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
}

type SubscriptionMetadata = {
  tenantId: string;
  clientId: string;
  saasId: string;
  plan: string;
  saasPlanId?: string;
  planCode?: string;
  saasSlug?: string;
};


function extractMetadata(metadata: Stripe.Metadata | null | undefined): SubscriptionMetadata | null {
  if (!metadata) return null;
  const tenantId = metadata.tenantId || metadata.tenant_id;
  const clientId = metadata.clientId || metadata.client_id;
  const saasId = metadata.saasId || metadata.saas_id;
  if (!tenantId || !clientId || !saasId) {
    return null;
  }
  const planValue = metadata.plan || metadata.plan_code || "drako_base_starter";
  const saasPlanId = metadata.saasPlanId || metadata.saas_plan_id || undefined;
  const planCode = metadata.planCode || metadata.plan_code || undefined;
  const saasSlug = metadata.saasSlug || metadata.saas_slug || undefined;
  return { tenantId, clientId, saasId, plan: planValue, saasPlanId, planCode, saasSlug };
}

function getCurrentPeriodEnd(subscription: Stripe.Subscription): number | null {
  const value = (subscription as Stripe.Subscription & { current_period_end?: number | null }).current_period_end;
  if (typeof value === "number") return value;
  return value ?? null;
}

async function persistDrakoBaseSubscriptionFromStripe(
  metadata: SubscriptionMetadata,
  subscription: Stripe.Subscription,
  customerId: string,
) {
  await saveSubscriptionRecord({
    tenantId: metadata.tenantId,
    clientId: metadata.clientId,
    saasId: metadata.saasId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    plan: metadata.plan,
    status: subscription.status,
    currentPeriodEnd: getCurrentPeriodEnd(subscription),
  });
}

async function persistClientSaasSubscriptionFromStripe(
  metadata: SubscriptionMetadata & { saasPlanId: string },
  subscription: Stripe.Subscription,
  customerId: string,
) {
  await saveClientSaasSubscription({
    tenantId: metadata.tenantId,
    clientId: metadata.clientId,
    saasId: metadata.saasId,
    saasPlanId: metadata.saasPlanId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: subscription.id,
    planCode: metadata.planCode ?? metadata.plan,
    status: subscription.status,
    currentPeriodEnd: getCurrentPeriodEnd(subscription),
  });
}

async function persistSubscriptionFromStripe(subscription: Stripe.Subscription) {
  const metadata = extractMetadata(subscription.metadata);
  if (!metadata) {
    console.warn("STRIPE_WEBHOOK_METADATA_MISSING", subscription.id);
    return;
  }
  const customerId = typeof subscription.customer === "string" ? subscription.customer : subscription.customer?.id;
  if (!customerId) {
    console.warn("STRIPE_WEBHOOK_CUSTOMER_MISSING", subscription.id);
    return;
  }
  if (metadata.saasPlanId) {
    await persistClientSaasSubscriptionFromStripe(metadata as SubscriptionMetadata & { saasPlanId: string }, subscription, customerId);
    return;
  }
  await persistDrakoBaseSubscriptionFromStripe(metadata, subscription, customerId);
}

async function handleCheckoutSession(session: Stripe.Checkout.Session) {
  const stripe = getStripe();
  const metadata = extractMetadata(session.metadata);
  if (!metadata) {
    console.warn("CHECKOUT_SESSION_METADATA_MISSING", session.id);
    return;
  }
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  if (!subscriptionId) {
    console.warn("CHECKOUT_SESSION_NO_SUBSCRIPTION", session.id);
    return;
  }
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  subscription.metadata = subscription.metadata ?? {};
  if (!subscription.metadata.tenantId) {
    subscription.metadata.tenantId = metadata.tenantId;
    subscription.metadata.clientId = metadata.clientId;
    subscription.metadata.saasId = metadata.saasId;
    subscription.metadata.plan = metadata.plan;
  }
  if (metadata.saasPlanId && !subscription.metadata.saasPlanId) {
    subscription.metadata.saasPlanId = metadata.saasPlanId;
  }
  if (metadata.planCode && !subscription.metadata.planCode) {
    subscription.metadata.planCode = metadata.planCode;
  }
  await persistSubscriptionFromStripe(subscription);
  if (metadata.saasPlanId) {
    try {
      console.log("[STRIPE_WEBHOOK] Syncing plan features", { tenantId: metadata.tenantId, saasId: metadata.saasId, eventType: "checkout.session.completed" });
      await syncSaasFeaturesFromPlan(env(), metadata.tenantId, metadata.saasId);
    } catch (error) {
      console.error("[STRIPE_WEBHOOK] PLAN_FEATURE_SYNC_ERROR", {
        tenantId: metadata.tenantId,
        saasId: metadata.saasId,
        eventType: "checkout.session.completed",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

async function recordBillingEvent(params: {
  tenantId: string;
  saasId?: string | null;
  saasSlug?: string | null;
  correlationId: string;
  type: string;
  severity: "INFO" | "WARNING" | "ERROR" | "CRITICAL";
  message: string;
  metadata?: Record<string, unknown>;
}) {
  await recordCampamentoEvent({
    tenantId: params.tenantId,
    saasId: params.saasId ?? null,
    type: params.type,
    severity: params.severity,
    source: "STRIPE_WEBHOOK",
    message: params.message,
    metadata: { saasSlug: params.saasSlug ?? null, ...params.metadata },
    correlationId: params.correlationId,
  });
}

async function createWebhookAction(params: {
  tenantId: string;
  saasId?: string | null;
  saasSlug?: string | null;
  priority: "CRITICAL" | "HIGH" | "NORMAL" | "LOW";
  title: string;
  description: string;
  metadata?: Record<string, unknown>;
  correlationId?: string;
}) {
  await createOrMergeActionFromWebhook({
    tenantId: params.tenantId,
    saasId: params.saasId ?? null,
    saasSlug: params.saasSlug ?? null,
    category: "BILLING",
    priority: params.priority,
    title: params.title,
    description: params.description,
    source: "stripe-webhook",
    metadata: params.metadata ?? null,
    correlationId: params.correlationId,
  });
}


export async function POST(request: Request) {
  const requestTenantId = resolveTenantId(request);
  const blocked = await enforcePublicEndpointPolicy({ request, route: "/api/stripe/webhook", tenantId: requestTenantId });
  if (blocked) return blocked;
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  const stripe = getStripe();
  const body = await request.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, getWebhookSecret());
  } catch (error) {
    await recordBillingEvent({
      tenantId: requestTenantId,
      correlationId: `sig_${Date.now()}`,
      type: "security.webhook.invalid_signature",
      severity: "CRITICAL",
      message: "Stripe webhook signature invalid.",
      metadata: { hasSignature: true },
    });
    console.error("STRIPE_WEBHOOK_VERIFY_ERROR", error);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const correlationId = event.id;
  const dedupe = await ensureStripeWebhookDedupe({
    store: {
      findEvent: findStripeWebhookEvent,
      insertReceived: insertStripeWebhookReceived,
      markProcessed: updateStripeWebhookProcessed,
      markFailed: updateStripeWebhookFailed,
    },
    eventId: event.id,
    correlationId,
  });

  if (dedupe.status === "duplicate") {
    return NextResponse.json({ received: true, duplicate: true });
  }

  const attribution = await resolveWebhookAttribution(event);
  const tenantId = attribution.tenantId ?? requestTenantId;

  const anomalies = deriveStripeWebhookAnomalies(attribution);
  for (const anomaly of anomalies) {
    await createWebhookAction({
      tenantId,
      saasId: attribution.saasId,
      saasSlug: attribution.saasSlug ?? null,
      priority: anomaly.priority,
      title: anomaly.title,
      description: anomaly.description,
      metadata: { eventType: event.type, stripeEventId: event.id, kind: anomaly.kind },
      correlationId,
    });
    await recordBillingEvent({
      tenantId,
      correlationId,
      type:
        anomaly.kind === "ATTRIBUTION_MISSING"
          ? "billing.webhook.unattributed"
          : anomaly.kind === "ATTRIBUTION_MISMATCH"
            ? "billing.webhook.attribution_mismatch"
            : "billing.stripe.drift_detected",
      severity: anomaly.priority === "CRITICAL" ? "CRITICAL" : "WARNING",
      message: anomaly.description,
      metadata: { eventType: event.type, kind: anomaly.kind },
    });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutSession(event.data.object as Stripe.Checkout.Session);
        await recordBillingEvent({
          tenantId,
          saasId: attribution.saasId,
          saasSlug: attribution.saasSlug,
          correlationId,
          type: "billing.checkout.completed",
          severity: "INFO",
          message: "Checkout session completed.",
          metadata: { stripeEventId: event.id },
        });
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await persistSubscriptionFromStripe(event.data.object as Stripe.Subscription);
        await recordBillingEvent({
          tenantId,
          saasId: attribution.saasId,
          saasSlug: attribution.saasSlug,
          correlationId,
          type: "billing.subscription.updated",
          severity: "INFO",
          message: "Subscription updated.",
          metadata: { stripeEventId: event.id },
        });
        {
          const subscription = event.data.object as Stripe.Subscription;
          const metadata = extractMetadata(subscription.metadata);
          if (metadata?.saasPlanId) {
            try {
              console.log("[STRIPE_WEBHOOK] Syncing plan features", { tenantId: metadata.tenantId, saasId: metadata.saasId, eventType: event.type });
              await syncSaasFeaturesFromPlan(env(), metadata.tenantId, metadata.saasId);
            } catch (error) {
              console.error("[STRIPE_WEBHOOK] PLAN_FEATURE_SYNC_ERROR", {
                tenantId: metadata.tenantId,
                saasId: metadata.saasId,
                eventType: event.type,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          }
        }
        break;
      case "invoice.paid":
        await recordBillingEvent({
          tenantId,
          saasId: attribution.saasId,
          saasSlug: attribution.saasSlug,
          correlationId,
          type: "billing.invoice.paid",
          severity: "INFO",
          message: "Invoice paid.",
          metadata: { stripeEventId: event.id },
        });
        break;
      case "invoice.payment_failed":
        await recordBillingEvent({
          tenantId,
          saasId: attribution.saasId,
          saasSlug: attribution.saasSlug,
          correlationId,
          type: "billing.invoice.failed",
          severity: "WARNING",
          message: "Invoice payment failed.",
          metadata: { stripeEventId: event.id },
        });
        break;
      default:
        break;
    }
  } catch (error) {
    const lastError = error instanceof Error ? error.message : String(error);
    await updateStripeWebhookFailed({
      eventId: event.id,
      attempts: dedupe.attempts,
      lastError,
      tenantId,
      saasSlug: attribution.saasSlug ?? null,
    });
    console.error("STRIPE_WEBHOOK_PROCESS_ERROR", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }

  await updateStripeWebhookProcessed({
    eventId: event.id,
    attempts: dedupe.attempts,
    tenantId,
    saasSlug: attribution.saasSlug ?? null,
  });

  return NextResponse.json({ received: true });
}
