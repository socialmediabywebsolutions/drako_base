import { getSubscriptionForTenant } from "@/lib/billing/subscriptions";

export type SubscriptionAccessSummary = {
  hasActiveDrakoBaseStarter: boolean;
  status: string;
  renewsAt: string | null;
};

export async function getDrakoBaseSubscriptionAccess(tenantId: string) {
  const subscription = await getSubscriptionForTenant(tenantId);
  const status = subscription?.status ?? "none";
  const renewsAt =
    subscription?.currentPeriodEnd != null ? new Date(subscription.currentPeriodEnd * 1000).toISOString() : null;

  return {
    subscription: subscription
      ? {
          id: subscription.id,
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
