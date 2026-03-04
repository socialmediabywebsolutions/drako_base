export const dynamic = "force-dynamic";


import Stripe from "stripe";
import { NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe/client";
import { env } from "@/lib/cf";
import { safeEnv } from "@/lib/env";
import {
  saveSubscriptionRecord,
  syncSaasUsageQuotasFromPlan,
  upsertCanonicalSubscriptionState,
} from "@/lib/billing/subscriptions";
import { saveClientSaasSubscription } from "@/lib/billing/client-saas-subscriptions";
import { syncSaasFeaturesFromPlan } from "@/lib/billing/entitlements";
import { recordCampamentoEvent } from "@/lib/empire/events";
import { resolveWebhookAttribution } from "@/lib/billing/stripe-webhook-attribution";
import { deriveStripeWebhookAnomalies } from "@/lib/billing/stripe-webhook-anomalies";
import { createOrMergeActionFromWebhook } from "@/lib/owner/action-queue-repository";
import { enforcePublicEndpointPolicy } from "@/lib/security/public-endpoints";
import { respondDatabaseError } from "@/lib/http/errors";
import { queryOne } from "@/lib/db";
import { createSaasFromBlueprint } from "@/lib/campamento-base/saas-factory-orchestrator";
import { withCampamentoBaseProfile } from "@/lib/campamento-base/saas-factory-helpers";
import {
  findStripeWebhookEvent,
  insertStripeWebhookReceived,
  updateStripeWebhookProcessed,
  updateStripeWebhookFailed,
} from "@/lib/billing/stripe-webhook-repository";
import { ensureStripeWebhookDedupe } from "@/lib/billing/stripe-webhook-processor";
import { transitionToPastDue, resumeToActive } from "@/lib/os/lifecycle";
import { constructVerifiedStripeEvent, StripeWebhookAuthError } from "@/lib/billing/stripe-webhook-security";

function getWebhookSecret(): string {
  return safeEnv.STRIPE_WEBHOOK_SECRET;
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

function normalizeCanonicalPlanCode(rawPlan: string | null | undefined): string | null {
  if (!rawPlan) return null;
  const normalized = rawPlan.trim().toLowerCase();
  if (!normalized) return null;
  if (normalized.startsWith("drako_base_")) {
    return normalized.replace("drako_base_", "");
  }
  return normalized;
}

async function resolveSaasSlugForCanonicalState(params: {
  tenantId: string;
  preferredSaasSlug?: string | null;
  saasId?: string | null;
}): Promise<string> {
  const preferred = params.preferredSaasSlug?.trim().toLowerCase();
  if (preferred) return preferred;

  if (params.saasId) {
    const byTenant = await queryOne<{ slug: string }>(
      "SELECT slug FROM saas WHERE tenant_id = ? AND id = ? LIMIT 1",
      params.tenantId,
      params.saasId,
    );
    if (byTenant?.slug) return byTenant.slug.trim().toLowerCase();

    const byId = await queryOne<{ slug: string }>(
      "SELECT slug FROM saas WHERE id = ? LIMIT 1",
      params.saasId,
    );
    if (byId?.slug) return byId.slug.trim().toLowerCase();
  }

  return "drako";
}

async function persistCanonicalSubscriptionState(params: {
  subscription: Stripe.Subscription;
  attribution: {
    tenantId?: string | null;
    saasSlug?: string | null;
    saasId?: string | null;
  };
  statusOverride?: string;
  fallbackPlanCode?: string | null;
}): Promise<void> {
  const metadata = extractMetadata(params.subscription.metadata);
  const tenantId = metadata?.tenantId ?? params.attribution.tenantId ?? null;
  if (!tenantId) {
    console.warn("CANONICAL_SUBSCRIPTION_TENANT_MISSING", params.subscription.id);
    return;
  }

  const saasSlug = await resolveSaasSlugForCanonicalState({
    tenantId,
    preferredSaasSlug: metadata?.saasSlug ?? params.attribution.saasSlug ?? null,
    saasId: metadata?.saasId ?? params.attribution.saasId ?? null,
  });
  const stripeCustomerId =
    typeof params.subscription.customer === "string"
      ? params.subscription.customer
      : params.subscription.customer?.id ?? null;
  if (!stripeCustomerId) {
    console.warn("CANONICAL_SUBSCRIPTION_CUSTOMER_MISSING", params.subscription.id);
    return;
  }

  const primaryPriceId = params.subscription.items.data[0]?.price?.id ?? null;
  const planCode = normalizeCanonicalPlanCode(
    metadata?.planCode ?? metadata?.plan ?? params.fallbackPlanCode ?? null,
  );
  const status = (params.statusOverride ?? params.subscription.status).trim().toLowerCase();

  await upsertCanonicalSubscriptionState({
    tenantId,
    saasSlug,
    stripeCustomerId,
    stripeSubscriptionId: params.subscription.id,
    stripePriceId: primaryPriceId,
    planCode,
    status,
    currentPeriodEnd: getCurrentPeriodEnd(params.subscription),
    cancelAtPeriodEnd: Boolean(params.subscription.cancel_at_period_end),
  });

  await syncSaasUsageQuotasFromPlan({
    tenantId,
    saasSlug,
    planCode,
    status,
  });
}

async function handleCheckoutSession(
  stripe: Stripe,
  session: Stripe.Checkout.Session,
): Promise<{ subscription: Stripe.Subscription; metadata: SubscriptionMetadata } | null> {
  const metadata = extractMetadata(session.metadata);
  if (!metadata) {
    console.warn("CHECKOUT_SESSION_METADATA_MISSING", session.id);
    return null;
  }
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  if (!subscriptionId) {
    console.warn("CHECKOUT_SESSION_NO_SUBSCRIPTION", session.id);
    return null;
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

  if (metadata.plan === "mentoria_ia") {
    try {
      console.log("[STRIPE_WEBHOOK] Triggering MentorIA SaaS Factory", { tenantId: metadata.tenantId });
      const blueprint = withCampamentoBaseProfile({
        ownerTenantId: metadata.tenantId,
        saasName: "MentorIA Escolar",
        proposedSlug: metadata.saasSlug ?? "mentor-ia-escolar",
        proposedSubdomain: metadata.saasSlug ?? "mentor-ia-escolar",
        verticalId: "OTHER",
        summary: "IA para tutoría escolar",
        targetAudience: "Instituciones educativas",
        mainProblem: "Falta de apoyo personalizado",
        mainGoal: "Brindar tutoría mediante IA",
        packsByDepartment: {
          accounting: "BASIC",
          marketing: "BASIC",
          support: "BASIC"
        },
        initialPricing: {
          currentMonthlyPrice: 49,
          estimatedVendorCostMonthly: 10,
        },
        aiProfile: {
          tier: "BALANCED",
        }
      });

      await createSaasFromBlueprint({
        env: env(),
        ownerTenantId: metadata.tenantId,
        blueprint,
      });

      console.log("[STRIPE_WEBHOOK] MentorIA SaaS Factory completed", { tenantId: metadata.tenantId });
    } catch (error) {
      console.error("[STRIPE_WEBHOOK] MENTOR_IA_FACTORY_ERROR", {
        tenantId: metadata.tenantId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return { subscription, metadata };
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
  try {
    const requestTenantId = "public";
    const blocked = await enforcePublicEndpointPolicy({ request, route: "/api/stripe/webhook", tenantId: requestTenantId });
    if (blocked) return blocked;
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const stripe = await getStripe();
    if (!stripe) {
      return NextResponse.json(
        { ok: false, reason: "stripe_not_configured", hint: "Set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET." },
        { status: 503 }
      );
    }
    const webhookSecret = getWebhookSecret();
    if (!webhookSecret) {
      return NextResponse.json(
        { ok: false, reason: "stripe_not_configured", hint: "Set STRIPE_WEBHOOK_SECRET in the environment." },
        { status: 503 }
      );
    }
    const body = await request.text();
    let event: Stripe.Event;
    try {
      event = constructVerifiedStripeEvent({
        stripe,
        rawBody: body,
        signature,
        webhookSecret,
      });
    } catch (error) {
      if (error instanceof StripeWebhookAuthError) {
        await recordBillingEvent({
          tenantId: requestTenantId,
          correlationId: `sig_${Date.now()}`,
          type: "security.webhook.invalid_signature",
          severity: "CRITICAL",
          message: "Stripe webhook signature invalid.",
          metadata: { hasSignature: Boolean(signature), reason: error.message },
        });
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      await recordBillingEvent({
        tenantId: requestTenantId,
        correlationId: `sig_${Date.now()}`,
        type: "security.webhook.invalid_signature",
        severity: "CRITICAL",
        message: "Stripe webhook signature invalid.",
        metadata: { hasSignature: Boolean(signature) },
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
          {
            const checkoutResult = await handleCheckoutSession(stripe, event.data.object as Stripe.Checkout.Session);
            if (checkoutResult) {
              await persistCanonicalSubscriptionState({
                subscription: checkoutResult.subscription,
                attribution,
                fallbackPlanCode: checkoutResult.metadata.planCode ?? checkoutResult.metadata.plan,
              });
            }
          }
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
          {
            const sub = event.data.object as Stripe.Subscription;
            await persistSubscriptionFromStripe(sub);
            await persistCanonicalSubscriptionState({ subscription: sub, attribution });

            // LIFECYCLE: Resume if active
            if (sub.status === "active" && extractMetadata(sub.metadata)?.saasId) {
              const meta = extractMetadata(sub.metadata);
              if (meta?.saasId) await resumeToActive(meta.saasId, event.id);
            }

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
              const metadata = extractMetadata(sub.metadata);
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
          }
          break;
        case "invoice.paid":
          {
            const invoice = event.data.object as Stripe.Invoice;
            const invoiceSubscription = (invoice as Stripe.Invoice & { subscription?: string | { id?: string } }).subscription;
            const invoiceSubscriptionId =
              typeof invoiceSubscription === "string" ? invoiceSubscription : invoiceSubscription?.id;
            if (invoiceSubscriptionId) {
              const subscription = await stripe.subscriptions.retrieve(invoiceSubscriptionId);
              await persistCanonicalSubscriptionState({
                subscription,
                attribution,
                statusOverride: "active",
              });
            }
            // LIFECYCLE: Payment success -> Active
            if (attribution.saasId) {
              await resumeToActive(attribution.saasId, event.id);
            }
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
          }
          break;
        case "invoice.payment_failed":
          {
            const inv = event.data.object as Stripe.Invoice;
            const invoiceSubscription = (inv as Stripe.Invoice & { subscription?: string | { id?: string } }).subscription;
            const invoiceSubscriptionId =
              typeof invoiceSubscription === "string" ? invoiceSubscription : invoiceSubscription?.id;
            if (invoiceSubscriptionId) {
              const subscription = await stripe.subscriptions.retrieve(invoiceSubscriptionId);
              await persistCanonicalSubscriptionState({
                subscription,
                attribution,
                statusOverride: "past_due",
              });
            }
            // LIFECYCLE: Payment failed -> Past Due
            if (attribution.saasId) {
              const reason = inv.billing_reason || "payment_failed";
              await transitionToPastDue(attribution.saasId, reason, event.id);
            }
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
          }
          break;
        default:
          break;
      }
    } catch (error) {
      const dbError = respondDatabaseError(error);
      if (dbError) return dbError;
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
  } catch (error) {
    const dbError = respondDatabaseError(error);
    if (dbError) return dbError;
    console.error("STRIPE_WEBHOOK_FATAL", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}
