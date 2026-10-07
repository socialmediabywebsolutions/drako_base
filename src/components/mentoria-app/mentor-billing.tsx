"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type TrialInfo = {
  isActive: boolean;
  daysRemaining: number;
};

type BillingLimits = {
  guidedSessionsPerDay: number;
  exercisesPerDay: number;
  plannerRegenerationsPerDay: number;
};

type BillingUsage = {
  guidedSessionsToday?: number;
  exercisesToday?: number;
  plannerRegenerationsToday?: number;
};

type BillingFeatures = {
  fullParentHub?: boolean;
  advancedParentInsights?: boolean;
  adaptiveInterventions?: boolean;
  adaptiveMotivation?: boolean;
  multiStudentSeats?: number;
};

type BillingInfo = {
  planCode: string;
  limits: BillingLimits;
  usage?: BillingUsage;
  features?: BillingFeatures;
};

type UpgradeData = {
  trial: TrialInfo;
  billing: BillingInfo;
  upgradePrompt: { message: string; ctaLabel: string; upgradeUrl: string } | null;
  trialWarning: { message: string } | null;
};

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  pro: "Pro",
  family: "Family",
};

const PLAN_COLORS: Record<string, string> = {
  free: "bg-slate-100 text-slate-600",
  pro: "bg-blue-100 text-blue-700",
  family: "bg-emerald-100 text-emerald-700",
};

function UsageBar({ label, used, max }: { label: string; used?: number; max: number }) {
  const pct = used !== undefined && max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
  const barColor = pct > 80 ? "bg-rose-400" : pct > 50 ? "bg-amber-400" : "bg-emerald-400";
  return (
    <div>
      <div className="flex justify-between text-xs text-slate-600 mb-1">
        <span>{label}</span>
        <span className="font-medium">{used !== undefined ? `${used} / ${max}` : `0 / ${max}`}</span>
      </div>
      <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function FeatureRow({ label, enabled }: { label: string; enabled: boolean }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className={enabled ? "text-emerald-500" : "text-slate-300"}>
        {enabled ? "✓" : "✗"}
      </span>
      <span className={enabled ? "text-slate-700" : "text-slate-400"}>{label}</span>
    </div>
  );
}

export function MentoriaBillingPanel() {
  const [data, setData] = useState<UpgradeData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      setLoading(true);
      const res = await fetch("/api/mentoria/upgrade", { cache: "no-store" });
      if (res.status === 401) { window.location.href = "/mentorias/auths/logins?callbackUrl=/mentoria/panel/plan"; return; }
      if (res.status === 403) { setError("Sin acceso al panel de facturación."); setLoading(false); return; }
      const body = await res.json().catch(() => null) as { ok: boolean; trial?: TrialInfo; billing?: BillingInfo; upgradePrompt?: UpgradeData["upgradePrompt"]; trialWarning?: UpgradeData["trialWarning"] } | null;
      if (!body?.ok || !body.trial || !body.billing) { setError("Error al cargar el plan."); setLoading(false); return; }
      setData({ trial: body.trial, billing: body.billing, upgradePrompt: body.upgradePrompt ?? null, trialWarning: body.trialWarning ?? null });
      setLoading(false);
    })();
  }, []);

  const planLabel = data ? (PLAN_LABELS[data.billing.planCode] ?? data.billing.planCode) : "";
  const planColor = data ? (PLAN_COLORS[data.billing.planCode] ?? PLAN_COLORS.free) : "";

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl space-y-6">

        {/* Header */}
        <div className="rounded-[28px] bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-950">Plan y facturación</h1>
          <p className="mt-1 text-sm text-slate-500">Estado de tu suscripción y uso del tenant.</p>
        </div>

        {loading && (
          <div className="rounded-[28px] bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
            Cargando información del plan…
          </div>
        )}

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
        )}

        {data && (
          <>
            {/* Trial warning */}
            {data.trialWarning && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                ⚠️ {data.trialWarning.message}
              </div>
            )}

            {/* Plan card */}
            <div className="rounded-[28px] bg-white p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-sm font-bold ${planColor}`}>
                      {planLabel}
                    </span>
                    {data.trial.isActive && (
                      <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                        Trial activo · {data.trial.daysRemaining}d restantes
                      </span>
                    )}
                  </div>
                  <p className="mt-2 text-sm text-slate-500">
                    {data.trial.isActive
                      ? `Período de prueba — termina en ${data.trial.daysRemaining} días.`
                      : data.billing.planCode === "free"
                      ? "Plan gratuito con acceso limitado."
                      : "Suscripción activa."}
                  </p>
                </div>
                {data.billing.planCode === "free" && !data.trial.isActive && (
                  <Link
                    href="/mentoria/panel/plan/upgrade"
                    className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition"
                  >
                    Actualizar plan
                  </Link>
                )}
              </div>
            </div>

            {/* Upgrade prompt */}
            {data.upgradePrompt && (
              <div className="rounded-[28px] bg-slate-950 p-6 shadow-sm text-white">
                <p className="text-sm text-slate-300 mb-4">{data.upgradePrompt.message}</p>
                <a
                  href={data.upgradePrompt.upgradeUrl}
                  className="inline-block rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-400 transition"
                >
                  {data.upgradePrompt.ctaLabel}
                </a>
              </div>
            )}

            {/* Usage hoy */}
            <div className="rounded-[28px] bg-white p-6 shadow-sm">
              <h2 className="font-semibold text-slate-950 mb-4 text-sm">Uso hoy</h2>
              <div className="space-y-4">
                <UsageBar
                  label="Sesiones guiadas"
                  used={data.billing.usage?.guidedSessionsToday}
                  max={data.billing.limits.guidedSessionsPerDay}
                />
                <UsageBar
                  label="Ejercicios"
                  used={data.billing.usage?.exercisesToday}
                  max={data.billing.limits.exercisesPerDay}
                />
                <UsageBar
                  label="Regeneraciones de plan"
                  used={data.billing.usage?.plannerRegenerationsToday}
                  max={data.billing.limits.plannerRegenerationsPerDay}
                />
              </div>
            </div>

            {/* Features */}
            {data.billing.features && (
              <div className="rounded-[28px] bg-white p-6 shadow-sm">
                <h2 className="font-semibold text-slate-950 mb-4 text-sm">Funcionalidades incluidas</h2>
                <div className="space-y-2">
                  <FeatureRow label="Panel de familia completo" enabled={data.billing.features.fullParentHub ?? false} />
                  <FeatureRow label="Insights avanzados para padres" enabled={data.billing.features.advancedParentInsights ?? false} />
                  <FeatureRow label="Intervenciones adaptativas" enabled={data.billing.features.adaptiveInterventions ?? false} />
                  <FeatureRow label="Motivación adaptativa" enabled={data.billing.features.adaptiveMotivation ?? false} />
                  <FeatureRow
                    label={`Alumnos simultáneos: ${data.billing.features.multiStudentSeats ?? 1}`}
                    enabled={(data.billing.features.multiStudentSeats ?? 1) > 1}
                  />
                </div>
              </div>
            )}

            {/* Billing portal */}
            <div className="rounded-[28px] bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-slate-600">Gestionar suscripción, facturas y método de pago.</p>
                <Link
                  href="/api/mentoria/billing/portal"
                  className="shrink-0 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition"
                >
                  Portal de pago →
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
