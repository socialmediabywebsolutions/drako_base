import { getCanonicalBillingSnapshot } from "@/lib/billing/subscriptions";

export type SubscriptionAccessSummary = {
  hasActiveDrakoBaseStarter: boolean;
  status: string;
  renewsAt: string | null;
};

export async function getDrakoBaseSubscriptionAccess(tenantId: string) {
  const snapshot = await getCanonicalBillingSnapshot({ tenantId, saasSlug: "drako" });
  const subscription =
    snapshot.subscription.stripeCustomerId && snapshot.subscription.stripeSubscriptionId
      ? snapshot.subscription
      : null;
  const status = subscription?.status ?? "none";
  const renewsAt =
    subscription?.currentPeriodEnd != null ? new Date(subscription.currentPeriodEnd).toISOString() : null;

  return {
    subscription: subscription
      ? {
          id: subscription.stripeSubscriptionId,
          status: subscription.status,
          currentPeriodEnd: subscription.currentPeriodEnd,
          updatedAt: subscription.updatedAt,
        }
      : null,
    summary: {
      hasActiveDrakoBaseStarter: status === "active" || status === "trialing",
      status,
      renewsAt,
    } satisfies SubscriptionAccessSummary,
  };
}
