import type Stripe from "stripe";
import { env } from "@/lib/cf";
import { getStripe } from "@/lib/stripe/client";
import { upsertTenantBilling, type WorkspacePlan } from "@/lib/auth/campamento-core";

export type WorkspaceBillingMetadata = {
  tenantId: string;
  plan: WorkspacePlan;
  scope: "tenant_workspace";
};

function normalizePlan(value: string | null | undefined): WorkspacePlan {
  const upper = (value ?? "STARTER").trim().toUpperCase();
  if (upper === "PRO") return "PRO";
  if (upper === "ENTERPRISE") return "ENTERPRISE";
  return "STARTER";
}

export function getWorkspaceStripePriceId(plan: WorkspacePlan): string | null {
  const cfEnv = env();
  if (plan === "PRO") {
    return process.env.DRAKO_BASE_PRO_PRICE_ID ?? ((cfEnv as Record<string, string | undefined> | null)?.DRAKO_BASE_PRO_PRICE_ID ?? null);
  }
  if (plan === "ENTERPRISE") {
    return process.env.DRAKO_BASE_ENTERPRISE_PRICE_ID ?? ((cfEnv as Record<string, string | undefined> | null)?.DRAKO_BASE_ENTERPRISE_PRICE_ID ?? null);
  }
  return process.env.DRAKO_BASE_STARTER_PRICE_ID ?? cfEnv?.DRAKO_BASE_STARTER_PRICE_ID ?? null;
}

export function extractWorkspaceBillingMetadata(metadata: Stripe.Metadata | null | undefined): WorkspaceBillingMetadata | null {
  if (!metadata) return null;
  const scope = metadata.scope ?? metadata.billingScope;
  const tenantId = metadata.tenantId ?? metadata.tenant_id;
  if (scope !== "tenant_workspace" || !tenantId) return null;
  return {
    tenantId,
    plan: normalizePlan(metadata.plan ?? metadata.planCode ?? null),
    scope: "tenant_workspace",
  };
}

function getCurrentPeriodEnd(subscription: Stripe.Subscription): string | null {
  const raw = (subscription as Stripe.Subscription & { current_period_end?: number | null }).current_period_end;
  if (typeof raw === "number") {
    return new Date(raw * 1000).toISOString();
  }
  return null;
}

export async function syncWorkspaceBillingFromSubscription(subscription: Stripe.Subscription): Promise<void> {
  const metadata = extractWorkspaceBillingMetadata(subscription.metadata);
  if (!metadata) return;
  const stripeCustomerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? null;
  await upsertTenantBilling({
    tenantId: metadata.tenantId,
    stripeCustomerId,
    stripeSubscriptionId: subscription.id,
    plan: metadata.plan,
    status: subscription.status,
    currentPeriodEnd: getCurrentPeriodEnd(subscription),
  });
}

export async function syncWorkspaceBillingFromCheckout(session: Stripe.Checkout.Session): Promise<void> {
  const metadata = extractWorkspaceBillingMetadata(session.metadata);
  if (!metadata) return;
  const subscriptionId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
  const stripeCustomerId = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
  if (!subscriptionId) {
    await upsertTenantBilling({
      tenantId: metadata.tenantId,
      stripeCustomerId,
      stripeSubscriptionId: null,
      plan: metadata.plan,
      status: "checkout_completed",
      currentPeriodEnd: null,
    });
    return;
  }
  const stripe = await getStripe();
  if (!stripe) {
    await upsertTenantBilling({
      tenantId: metadata.tenantId,
      stripeCustomerId,
      stripeSubscriptionId: subscriptionId,
      plan: metadata.plan,
      status: "checkout_completed",
      currentPeriodEnd: null,
    });
    return;
  }
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  await syncWorkspaceBillingFromSubscription(subscription);
}
