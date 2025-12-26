"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Badge from "@/components/ui/badge";
import EmptyState from "@/components/ui/empty-state";

const PLAN_LABEL = "Campamento Base Starter";
const PLAN_PRICE = "29 €/month";

type SubscriptionState = {
  id: string;
  status: string;
  currentPeriodEnd: number | null;
  updatedAt: string;
};

type SubscriptionSummary = {
  hasActiveDrakoBaseStarter: boolean;
  status: string;
  renewsAt: string | null;
};

type SubscriptionResponse = {
  subscription: {
    id: string;
    status: string;
    currentPeriodEnd: number | null;
    updatedAt: string;
  } | null;
  summary?: SubscriptionSummary;
  error?: string;
};

export default function BillingPage() {
  const searchParams = useSearchParams();
  const tenantId = searchParams?.get("tenantId") ?? "demo-tenant";
  const [subscription, setSubscription] = useState<SubscriptionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [redirecting, setRedirecting] = useState(false);
  const [summary, setSummary] = useState<SubscriptionSummary | null>(null);
  const [saasCount, setSaasCount] = useState<number | null>(null);
  const [saasSubscriptionsCount, setSaasSubscriptionsCount] = useState<number | null>(null);

  const loadSubscription = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/billing/subscription?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" });
      const data = (await res.json()) as SubscriptionResponse;
      if (!res.ok) {
        throw new Error(data.error ?? "Unable to load billing status");
      }
      setSubscription(
        data.subscription
          ? {
              id: data.subscription.id,
              status: data.subscription.status,
              currentPeriodEnd: data.subscription.currentPeriodEnd,
              updatedAt: data.subscription.updatedAt,
            }
          : null,
      );
      setSummary(data.summary ?? null);
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Unable to load billing status");
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  const loadTenantStats = useCallback(async () => {
    try {
      const [saasRes, subsRes] = await Promise.all([
        fetch(`/api/saas?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" }),
        fetch(`/api/saas/subscriptions?tenantId=${encodeURIComponent(tenantId)}`, { cache: "no-store" }),
      ]);
      if (saasRes.ok) {
        const saasData = (await saasRes.json()) as { items?: unknown[] };
        setSaasCount((saasData.items ?? []).length);
      } else {
        setSaasCount(null);
      }
      if (subsRes.ok) {
        const subsData = (await subsRes.json()) as { items?: unknown[] };
        setSaasSubscriptionsCount((subsData.items ?? []).length);
      } else {
        setSaasSubscriptionsCount(null);
      }
    } catch (error) {
      console.error(error);
      setSaasCount(null);
      setSaasSubscriptionsCount(null);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadSubscription();
    void loadTenantStats();
  }, [loadSubscription, loadTenantStats]);

  const statusLabel = useMemo(() => {
    const status = summary?.status ?? subscription?.status ?? 'none';
    return status === 'none' ? 'sin suscripción' : status;
  }, [summary, subscription]);

  const statusBadgeVariant = useMemo(() => {
    const status = summary?.status ?? subscription?.status ?? 'none';
    if (status === 'active') return 'ok';
    if (status === 'trialing') return 'info';
    if (status === 'none') return 'warn';
    return 'warn';
  }, [summary, subscription]);

  const formattedRenewalDate = useMemo(() => {
    if (summary?.renewsAt) {
      return new Date(summary.renewsAt).toLocaleDateString();
    }
    if (!subscription?.currentPeriodEnd) return null;
    const date = new Date(subscription.currentPeriodEnd * 1000);
    return date.toLocaleDateString();
  }, [summary, subscription]);

  const handleCheckout = useCallback(async () => {
    setRedirecting(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/stripe/checkout?tenantId=${encodeURIComponent(tenantId)}`, {
        method: "POST",
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        throw new Error(data.error ?? "Checkout initiation failed");
      }
      window.location.href = data.url;
    } catch (error) {
      console.error(error);
      setMessage(error instanceof Error ? error.message : "Unable to redirect to Stripe");
      setRedirecting(false);
    }
  }, [tenantId]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-[var(--muted)]">Billing</p>
          <h1 className="text-3xl font-semibold">Campamento Base – Subscription</h1>
          <p className="text-sm text-[var(--muted)]">Manage your Campamento Base Starter plan.</p>
        </div>
        <Badge variant="outline">Tenant: {tenantId}</Badge>
      </div>

      <Card tone="glass" title="Plan status" subtitle="Starter subscription overview">
        {loading ? (
          <p className="text-sm text-[var(--muted)]">Loading subscription status…</p>
        ) : summary?.status && summary.status !== "none" ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Badge variant={statusBadgeVariant}>{statusLabel}</Badge>
              {formattedRenewalDate && (
                <span className="text-sm text-[var(--muted)]">Renews on {formattedRenewalDate}</span>
              )}
            </div>
            <p className="text-sm text-[var(--muted)]">
              {summary.hasActiveDrakoBaseStarter ? "Subscription active." : "Pending confirmation after checkout."}
            </p>
            {typeof saasCount === "number" && typeof saasSubscriptionsCount === "number" && (
              <p className="text-sm text-[var(--muted)]">
                {saasCount} SaaS activos · {saasSubscriptionsCount} suscripciones SaaS en Stripe
              </p>
            )}
            {subscription?.updatedAt && (
              <p className="text-sm text-[var(--muted)]">Last update: {new Date(subscription.updatedAt).toLocaleString()}</p>
            )}
          </div>
        ) : (
          <EmptyState title="No active subscription" subtitle="Activate Campamento Base Starter to unlock billing coverage" />
        )}

        {message && <p className="mt-4 text-sm text-[var(--muted)]">{message}</p>}

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold">{PLAN_LABEL}</p>
            <p className="text-xs text-[var(--muted)]">{PLAN_PRICE}</p>
          </div>
          <Button onClick={() => void handleCheckout()} disabled={redirecting}>
            {redirecting ? "Redirecting…" : "Activate Campamento Base (29 €/month)"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
