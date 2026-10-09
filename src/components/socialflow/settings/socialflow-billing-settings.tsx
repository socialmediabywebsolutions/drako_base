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

const panelCls = "rounded-xl border border-gray-200 bg-gray-50 p-5";

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
      <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
        <header className="border-b border-gray-200 px-6 py-5">
          <p className="text-[11px] font-black uppercase tracking-[0.24em] text-[#3b82f6]">Plan actual</p>
          <h2 className="mt-1 text-lg font-black uppercase italic tracking-tight text-gray-900">
            Estado:{" "}
            <span className="font-normal normal-case not-italic text-gray-600">{statusLabel}</span>
          </h2>
        </header>
        <div className="space-y-3 px-6 py-6">
          <div className="text-2xl font-black text-gray-900">{currentPlanLabel}</div>
          {periodEndLabel && (
            <p className="text-sm text-gray-500">
              {cancelAtPeriodEnd
                ? `Tu plan se cancelará el ${periodEndLabel}.`
                : `Se renueva el ${periodEndLabel}.`}
            </p>
          )}
          {canManageBilling && (
            <button
              onClick={openPortal}
              disabled={isPending}
              className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-semibold text-gray-600 transition hover:border-[#3b82f6]/30 hover:bg-[#3b82f6]/5 hover:text-[#3b82f6] disabled:cursor-not-allowed disabled:opacity-60"
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
                  ? "rounded-2xl border border-[#3b82f6]/30 bg-[#3b82f6]/5 p-5"
                  : "rounded-2xl border border-gray-200 bg-gray-50 p-5"
              }
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-black uppercase italic tracking-tight text-gray-900">{plan.label}</h3>
                  {plan.priceEur && (
                    <p className="mt-0.5 text-xs font-bold text-gray-500">{plan.priceEur}€ / mes</p>
                  )}
                </div>
                {isCurrent && (
                  <span className="rounded-full bg-[#3b82f6]/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-[#3b82f6]">
                    Plan actual
                  </span>
                )}
              </div>
              <p className="mt-3 text-sm text-gray-500">{plan.description}</p>
              <ul className="mt-3 space-y-1 text-sm text-gray-500">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <span className="mt-0.5 text-[#3b82f6]">•</span>
                    {feature}
                  </li>
                ))}
              </ul>
              {!isCurrent && (
                <button
                  onClick={() => startCheckout(plan.code as Exclude<SocialFlowPlanCode, "free">)}
                  disabled={isPending}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] px-4 py-2 text-sm font-semibold text-white shadow-md shadow-[#3b82f6]/20 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
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
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      )}
    </div>
  );
}
