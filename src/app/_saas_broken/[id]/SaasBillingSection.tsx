"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import Badge from "@/components/ui/badge";
import Select from "@/components/ui/select";
import EmptyState from "@/components/ui/empty-state";

type SaasPlanRecord = {
  id: string;
  saasId: string;
  planCode: string;
  name: string;
  billingInterval: "month" | "year";
  amount: number;
  currency: string;
  status: "active" | "archived";
};

type SaasSubscriptionRecord = {
  id: string;
  clientId: string;
  saasId: string;
  saasPlanId: string;
  planCode: string;
  status: string;
  currentPeriodEnd: number | null;
  updatedAt: string;
};

type ClientOption = { id: string; name: string };

type Props = {
  saasId: string | null;
};

const planStatusVariant: Record<string, "ok" | "warn"> = {
  active: "ok",
  archived: "warn",
};

const subscriptionStatusVariant: Record<string, "ok" | "info" | "warn" | "err"> = {
  active: "ok",
  trialing: "info",
  past_due: "warn",
  canceled: "err",
  cancelled: "err",
};

function formatPrice(plan: SaasPlanRecord) {
  const formatter = new Intl.NumberFormat("es-ES", { style: "currency", currency: plan.currency ?? "EUR" });
  const amount = formatter.format(plan.amount / 100);
  return `${amount} / ${plan.billingInterval === "month" ? "mes" : "año"}`;
}

function formatRenewal(epoch: number | null) {
  if (!epoch) return "Sin fecha";
  return new Date(epoch * 1000).toLocaleDateString();
}

export default function SaasBillingSection({ saasId }: Props) {
  const [plans, setPlans] = useState<SaasPlanRecord[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [subscriptions, setSubscriptions] = useState<SaasSubscriptionRecord[]>([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(true);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [clientsLoading, setClientsLoading] = useState(true);
  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [checkoutPlanId, setCheckoutPlanId] = useState<string | null>(null);
  const [checkoutMessage, setCheckoutMessage] = useState<string | null>(null);

  const clientsMap = useMemo(() => {
    const map = new Map<string, string>();
    clients.forEach((client) => map.set(client.id, client.name));
    return map;
  }, [clients]);

  const loadPlans = useCallback(async () => {
    if (!saasId) {
      setPlans([]);
      setPlansLoading(false);
      return;
    }
    setPlansLoading(true);
    try {
      const res = await fetch(`/api/saas/plans?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" });
      const data = (await res.json()) as { items?: SaasPlanRecord[] };
      setPlans(data.items ?? []);
    } catch (error) {
      console.error(error);
      setPlans([]);
    } finally {
      setPlansLoading(false);
    }
  }, [saasId]);

  const loadSubscriptions = useCallback(async () => {
    if (!saasId) {
      setSubscriptions([]);
      setSubscriptionsLoading(false);
      return;
    }
    setSubscriptionsLoading(true);
    try {
      const res = await fetch(`/api/saas/subscriptions?saasId=${encodeURIComponent(saasId)}`, { cache: "no-store" });
      const data = (await res.json()) as { items?: SaasSubscriptionRecord[] };
      setSubscriptions(data.items ?? []);
    } catch (error) {
      console.error(error);
      setSubscriptions([]);
    } finally {
      setSubscriptionsLoading(false);
    }
  }, [saasId]);

  const loadClients = useCallback(async () => {
    setClientsLoading(true);
    try {
      const res = await fetch("/api/clients", { cache: "no-store" });
      const data = (await res.json()) as { items?: { id: string; name: string }[] };
      const mapped = (data.items ?? []).map((item) => ({ id: item.id, name: item.name }));
      setClients(mapped);
      if (mapped[0]) {
        setSelectedClientId((prev) => prev || mapped[0].id);
      }
    } catch (error) {
      console.error(error);
      setClients([]);
    } finally {
      setClientsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlans();
    void loadSubscriptions();
  }, [loadPlans, loadSubscriptions]);

  useEffect(() => {
    void loadClients();
  }, [loadClients]);

  const handlePlanCheckout = useCallback(
    async (planId: string) => {
      if (!saasId) return;
      if (!selectedClientId) {
        setCheckoutMessage("Selecciona un cliente antes de iniciar el checkout.");
        return;
      }
      setCheckoutPlanId(planId);
      setCheckoutMessage(null);
      try {
        const res = await fetch("/api/stripe/checkout-saas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ saasId, saasPlanId: planId, clientId: selectedClientId }),
        });
        const data = (await res.json()) as { url?: string; error?: string };
        if (!res.ok || !data.url) {
          throw new Error(data.error ?? "Checkout initiation failed");
        }
        window.location.href = data.url;
      } catch (error) {
        console.error(error);
        setCheckoutMessage(error instanceof Error ? error.message : "Unable to create checkout session");
        setCheckoutPlanId(null);
      }
    },
    [saasId, selectedClientId],
  );

  if (!saasId) {
    return (
      <Card tone="glass" title="SaaS billing" subtitle="Selecciona un SaaS para administrar sus planes">
        <p className="text-sm text-[var(--muted)]">Sin identificador de SaaS.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card tone="glass" title="Planes del SaaS" subtitle="Gestiona planes y checkout de clientes">
        <div className="flex flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="text-sm text-[var(--muted)]">Cliente destino</span>
            <Select value={selectedClientId} onChange={(event) => setSelectedClientId(event.target.value)} disabled={clientsLoading}>
              {clients.length === 0 && <option value="">Sin clientes disponibles</option>}
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
        {plansLoading ? (
          <p className="text-sm text-[var(--muted)]">Cargando planes…</p>
        ) : plans.length === 0 ? (
          <EmptyState title="Sin planes configurados" subtitle="Añade planes en Stripe para habilitar nuevos checkouts" />
        ) : (
          <div className="space-y-3">
            {plans.map((plan) => (
              <div key={plan.id} className="rounded-2xl border border-[var(--border)]/50 bg-[var(--panel)]/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold">{plan.name}</p>
                    <p className="text-sm text-[var(--muted)]">{formatPrice(plan)} · Código {plan.planCode}</p>
                  </div>
                  <Badge variant={planStatusVariant[plan.status] ?? "warn"}>{plan.status}</Badge>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3">
                  <Button
                    variant="brand"
                    size="sm"
                    onClick={() => void handlePlanCheckout(plan.id)}
                    disabled={plan.status !== "active" || !selectedClientId || checkoutPlanId === plan.id}
                  >
                    {checkoutPlanId === plan.id ? "Redirigiendo…" : "Subscribe client"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
        {checkoutMessage && <p className="mt-3 text-sm text-rose-400">{checkoutMessage}</p>}
      </Card>

      <Card tone="glass" title="Suscripciones activas" subtitle="Clientes conectados a este SaaS">
        {subscriptionsLoading ? (
          <p className="text-sm text-[var(--muted)]">Sincronizando suscripciones…</p>
        ) : subscriptions.length === 0 ? (
          <EmptyState title="Sin suscripciones" subtitle="Los clientes se listarán aquí tras completar el checkout" />
        ) : (
          <div className="space-y-3">
            {subscriptions.map((subscription) => (
              <div key={subscription.id} className="rounded-2xl border border-[var(--border)]/50 bg-[var(--panel)]/40 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold">{clientsMap.get(subscription.clientId) ?? subscription.clientId}</p>
                    <p className="text-sm text-[var(--muted)]">Plan {subscription.planCode}</p>
                  </div>
                  <Badge variant={subscriptionStatusVariant[subscription.status] ?? "info"}>{subscription.status}</Badge>
                </div>
                <p className="mt-2 text-xs text-[var(--muted)]">Renovación: {formatRenewal(subscription.currentPeriodEnd)}</p>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
