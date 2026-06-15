"use client";

import { useState, useTransition } from "react";
import Card from "@/components/ui/card";
import Button from "@/components/ui/button";
import type { SocialFlowPlanCode, SocialFlowPlanDefinition } from "@/lib/socialflow/billing/plans";

type SocialFlowBillingSettingsProps = {
  currentPlanCode: SocialFlowPlanCode;
  currentPlanLabel: string;
  status: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean | null;
  canManageBilling: boolean;
  paidPlans: SocialFlowPlanDefinition[];
};

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  trial: "Trial",
  past_due: "Payment past due",
  unpaid: "Unpaid",
  canceled: "Cancelled",
  incomplete: "Incomplete",
  incomplete_expired: "Expired",
};

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

export default function SocialFlowBillingSettings({
  currentPlanCode,
  currentPlanLabel,
  status,
  currentPeriodEnd,
  cancelAtPeriodEnd,
  canManageBilling,
  paidPlans,
}: SocialFlowBillingSettingsProps) {
  const [error, setError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const periodEndLabel = formatDate(currentPeriodEnd);
  const statusLabel = status ? STATUS_LABELS[status] ?? status : "Free plan";

  function startCheckout(plan: Exclude<SocialFlowPlanCode, "free">) {
    setError(null);
    setPendingAction(`checkout:${plan}`);
    startTransition(async () => {
      try {
        const res = await fetch("/api/socialflow/billing/checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan }),
        });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; code?: string };
        if (!res.ok || !data.ok || !data.url) {
          throw new Error(data.code || "Unable to start checkout");
        }
        window.location.href = data.url;
      } catch (e: any) {
        setError(e?.message || "Unable to start checkout");
        setPendingAction(null);
      }
    });
  }

  function openPortal() {
    setError(null);
    setPendingAction("portal");
    startTransition(async () => {
      try {
        const res = await fetch("/api/socialflow/billing/portal", { method: "POST" });
        const data = (await res.json().catch(() => ({}))) as { ok?: boolean; url?: string; code?: string };
        if (!res.ok || !data.ok || !data.url) {
          throw new Error(data.code || "Unable to open billing portal");
        }
        window.location.href = data.url;
      } catch (e: any) {
        setError(e?.message || "Unable to open billing portal");
        setPendingAction(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card
        title="Current plan"
        subtitle={`Status: ${statusLabel}`}
      >
        <div className="space-y-3">
          <div className="text-2xl font-black text-slate-950">{currentPlanLabel}</div>
          {periodEndLabel && (
            <p className="text-sm text-slate-500">
              {cancelAtPeriodEnd
                ? `Your plan will be cancelled on ${periodEndLabel}.`
                : `Renews on ${periodEndLabel}.`}
            </p>
          )}
          {canManageBilling && (
            <Button variant="outline" onClick={openPortal} disabled={isPending} loading={pendingAction === "portal"}>
              Manage billing
            </Button>
          )}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {paidPlans.map((plan) => {
          const isCurrent = plan.code === currentPlanCode;
          return (
            <Card key={plan.code} title={plan.label} subtitle={plan.priceEur ? `${plan.priceEur}€ / month` : undefined} tone={isCurrent ? "brand" : "default"}>
              <div className="space-y-3">
                <p className="text-sm text-slate-500">{plan.description}</p>
                <ul className="space-y-1 text-sm text-slate-600">
                  {plan.features.map((feature) => (
                    <li key={feature}>• {feature}</li>
                  ))}
                </ul>
                {isCurrent ? (
                  <span className="inline-flex rounded-full bg-sky-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-sky-700">
                    Current plan
                  </span>
                ) : (
                  <Button
                    onClick={() => startCheckout(plan.code as Exclude<SocialFlowPlanCode, "free">)}
                    disabled={isPending}
                    loading={pendingAction === `checkout:${plan.code}`}
                  >
                    Upgrade to {plan.label}
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">{error}</div>
      )}
    </div>
  );
}
