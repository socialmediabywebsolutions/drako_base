"use client";

import { useState, useTransition } from "react";
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
  active: "Activo",
  trialing: "Prueba",
  trial: "Prueba",
  past_due: "Pago vencido",
  unpaid: "Sin pagar",
  canceled: "Cancelado",
  incomplete: "Incompleto",
  incomplete_expired: "Expirado",
};

function formatDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

const panelCls = "rounded-xl border border-white/8 bg-white/4 p-5";

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
  const statusLabel = status ? STATUS_LABELS[status] ?? status : "Plan gratuito";

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
          throw new Error(data.code || "No se pudo iniciar el checkout");
        }
        window.location.href = data.url;
      } catch (e: any) {
        setError(e?.message || "No se pudo iniciar el checkout");
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
          throw new Error(data.code || "No se pudo abrir el portal de facturación");
        }
        window.location.href = data.url;
      } catch (e: any) {
        setError(e?.message || "No se pudo abrir el portal de facturación");
        setPendingAction(null);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Plan actual */}
      <section className="rounded-2xl border border-white/10 bg-white/4">
        <header className="border-b border-white/8 px-6 py-5">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-violet-400">Plan actual</p>
          <h2 className="mt-1 text-lg font-black uppercase italic tracking-tight text-white">
            Estado:{" "}
            <span className="font-normal normal-case not-italic text-white/60">{statusLabel}</span>
          </h2>
        </header>
        <div className="space-y-3 px-6 py-6">
          <div className="text-2xl font-black text-white">{currentPlanLabel}</div>
          {periodEndLabel && (
            <p className="text-sm text-white/45">
              {cancelAtPeriodEnd
                ? `Tu plan se cancelará el ${periodEndLabel}.`
                : `Se renueva el ${periodEndLabel}.`}
            </p>
          )}
          {canManageBilling && (
            <button
              onClick={openPortal}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-white/70 transition hover:border-violet-500/30 hover:bg-violet-500/8 hover:text-violet-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {pendingAction === "portal" && <span className="h-2 w-2 animate-pulse rounded-full bg-current" />}
              Gestionar facturación
            </button>
          )}
        </div>
      </section>

      {/* Planes disponibles */}
      <div className="grid gap-4 md:grid-cols-2">
        {paidPlans.map((plan) => {
          const isCurrent = plan.code === currentPlanCode;
          return (
            <div
              key={plan.code}
              className={
                isCurrent
                  ? "rounded-2xl border border-violet-500/30 bg-violet-500/8 p-5"
                  : "rounded-2xl border border-white/10 bg-white/4 p-5"
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-black uppercase italic tracking-tight text-white">{plan.label}</h3>
                  {plan.priceEur && (
                    <p className="mt-0.5 text-xs font-bold text-white/40">{plan.priceEur}€ / mes</p>
                  )}
                </div>
                {isCurrent && (
                  <span className="rounded-full bg-violet-500/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-violet-300">
                    Plan actual
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm text-white/45">{plan.description}</p>
              <ul className="mt-3 space-y-1 text-sm text-white/45">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="mt-0.5 text-violet-400">•</span>
                    {feature}
                  </li>
                ))}
              </ul>
              {!isCurrent && (
                <button
                  onClick={() => startCheckout(plan.code as Exclude<SocialFlowPlanCode, "free">)}
                  disabled={isPending}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-fuchsia-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-violet-500/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {pendingAction === `checkout:${plan.code}` && (
                    <span className="h-2 w-2 animate-pulse rounded-full bg-current" />
                  )}
                  Actualizar a {plan.label}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-500/8 p-4 text-sm text-red-300">{error}</div>
      )}
    </div>
  );
}
